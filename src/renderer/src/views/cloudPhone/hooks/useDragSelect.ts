import { ref, onUnmounted, type Ref, type ComputedRef } from 'vue'

interface DragSelectOptions {
  /** RecycleScroller 实例引用 */
  scrollerRef: Ref<any>
  /** 行数据 */
  rows: ComputedRef<{ id: string; startIndex: number; endIndex: number }[]>
  /** 行高（含间距） */
  rowHeight: ComputedRef<number>
  /** 所有设备数据 */
  data: () => any[]
  /** 获取单个 item 的宽度 */
  getItemWidth: (device: any) => number
  /** item 间距 */
  itemGap: number
  /** 当前是否允许选择 */
  selectable?: () => boolean
  /** 当前已选中的 ID 列表 */
  selectedIds: () => string[]
  /** 选中变化回调 */
  onSelectionChange: (ids: string[]) => void
}

/**
 * 拖拽框选 Hook
 * 在虚拟滚动的网格中实现拖拽框选功能。
 * 通过数学计算每个 item 的位置来判断是否与选择矩形相交，
 * 不依赖 DOM 元素的实际位置。
 */
export function useDragSelect(options: DragSelectOptions) {
  const DRAG_START_THRESHOLD = 4
  const isDragging = ref(false)
  const selectionRect = ref({ x: 0, y: 0, width: 0, height: 0 })

  // 拖拽起始点（相对于滚动内容的坐标）
  let startContentX = 0
  let startContentY = 0
  // 拖拽起始点（相对于视口的坐标，用于绘制选择框）
  let startClientX = 0
  let startClientY = 0
  // 拖拽开始前已选中的 ID，用于框选切换
  let preSelectedIds: string[] = []
  // 鼠标是否已按下
  let isPointerDown = false
  // 自动滚动定时器
  let autoScrollTimer: ReturnType<typeof setInterval> | null = null
  // 滚动容器元素缓存
  let scrollerEl: HTMLElement | null = null
  // 上次已发送的选中结果，避免拖动中重复 emit
  let lastSelectionKey = ''
  // 拖拽结束后吞掉紧随其后的 click，避免误触发单击逻辑
  let suppressClickTimer: ReturnType<typeof setTimeout> | null = null
  let shouldSuppressNextClick = false

  /**
   * 获取滚动容器元素
   */
  const getScrollerEl = (): HTMLElement | null => {
    if (!options.scrollerRef.value) return null
    return options.scrollerRef.value.$el as HTMLElement
  }

  const removeClickSuppression = () => {
    shouldSuppressNextClick = false
    if (suppressClickTimer) {
      clearTimeout(suppressClickTimer)
      suppressClickTimer = null
    }
    document.removeEventListener('click', onDocumentClickCapture, true)
  }

  const onDocumentClickCapture = (e: MouseEvent) => {
    if (!shouldSuppressNextClick) return
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    removeClickSuppression()
  }

  const scheduleClickSuppression = () => {
    removeClickSuppression()
    shouldSuppressNextClick = true
    document.addEventListener('click', onDocumentClickCapture, true)
    suppressClickTimer = setTimeout(() => {
      removeClickSuppression()
    }, 0)
  }

  const onSelectStart = (e: Event) => {
    if (!isPointerDown) return
    e.preventDefault()
  }

  /**
   * 判断两个矩形是否相交
   */
  const rectsIntersect = (
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number }
  ) => {
    return !(
      r1.x + r1.width < r2.x ||
      r2.x + r2.width < r1.x ||
      r1.y + r1.height < r2.y ||
      r2.y + r2.height < r1.y
    )
  }

  /**
   * 根据当前选择矩形计算被选中的 item ID
   */
  const computeSelectedIds = (contentX: number, contentY: number) => {
    // 计算选择矩形（在内容坐标系中）
    const rect = {
      x: Math.min(startContentX, contentX),
      y: Math.min(startContentY, contentY),
      width: Math.abs(contentX - startContentX),
      height: Math.abs(contentY - startContentY)
    }

    const data = options.data()
    const rowsVal = options.rows.value
    const rowH = options.rowHeight.value
    const gap = options.itemGap
    const dragSelectedIds: string[] = []

    if (rowsVal.length === 0) return [...preSelectedIds]

    const minRow = Math.max(0, Math.floor(rect.y / rowH))
    const maxRow = Math.min(rowsVal.length - 1, Math.floor((rect.y + rect.height) / rowH))

    for (let rowIdx = minRow; rowIdx <= maxRow; rowIdx++) {
      const row = rowsVal[rowIdx]
      const y = rowIdx * rowH
      let x = 0

      for (let i = row.startIndex; i < row.endIndex; i++) {
        const device = data[i]
        if (!device) continue

        const width = options.getItemWidth(device)
        const itemRect = {
          x,
          y,
          width,
          height: rowH - gap
        }

        if (rectsIntersect(rect, itemRect)) {
          dragSelectedIds.push(device.id)
        }

        x += width + gap
      }
    }

    const resultSet = new Set(preSelectedIds)

    for (const id of dragSelectedIds) {
      if (resultSet.has(id)) {
        resultSet.delete(id)
      } else {
        resultSet.add(id)
      }
    }

    return Array.from(resultSet)
  }

  /**
   * 将客户端坐标转换为滚动内容坐标
   */
  const clientToContent = (clientX: number, clientY: number) => {
    if (!scrollerEl) return { x: 0, y: 0 }
    const rect = scrollerEl.getBoundingClientRect()
    const scrollTop = scrollerEl.scrollTop
    return {
      x: clientX - rect.left,
      y: clientY - rect.top + scrollTop
    }
  }

  const emitSelectionChange = (ids: string[]) => {
    const nextKey = ids.join('\u0000')
    if (nextKey === lastSelectionKey) return
    lastSelectionKey = nextKey
    options.onSelectionChange(ids)
  }

  const syncSelectionWithPointer = () => {
    if (!isDragging.value) return

    updateVisualRect(lastClientX, lastClientY)

    const content = clientToContent(lastClientX, lastClientY)
    const newSelectedIds = computeSelectedIds(content.x, content.y)
    emitSelectionChange(newSelectedIds)
  }

  /**
   * 更新可视选择框位置（相对于滚动容器的可见区域）
   */
  const updateVisualRect = (clientX: number, clientY: number) => {
    if (!scrollerEl) return
    const rect = scrollerEl.getBoundingClientRect()

    // 限制在容器范围内
    const clampedX = Math.max(rect.left, Math.min(clientX, rect.right))
    const clampedY = Math.max(rect.top, Math.min(clientY, rect.bottom))

    const x1 = startClientX - rect.left
    const y1 = startClientY - rect.top
    const x2 = clampedX - rect.left
    const y2 = clampedY - rect.top

    selectionRect.value = {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    }
  }

  /**
   * 自动滚动逻辑：当鼠标靠近容器顶部或底部时自动滚动
   */
  const startAutoScroll = () => {
    if (autoScrollTimer) return
    autoScrollTimer = setInterval(() => {
      if (!isDragging.value || !scrollerEl) return

      const rect = scrollerEl.getBoundingClientRect()
      const edgeSize = 40 // 触发自动滚动的边缘区域大小
      const maxSpeed = 15 // 最大滚动速度

      // 获取当前鼠标位置（通过最后记录的位置）
      const mouseY = lastClientY

      if (mouseY < rect.top + edgeSize) {
        // 向上滚动
        const speed = Math.min(maxSpeed, ((rect.top + edgeSize - mouseY) / edgeSize) * maxSpeed)
        const prevScrollTop = scrollerEl.scrollTop
        scrollerEl.scrollTop -= speed
        const actualDelta = prevScrollTop - scrollerEl.scrollTop
        if (actualDelta > 0) {
          // 内容向下移动，起点在视口中的相对位置也要下移
          startClientY += actualDelta
          syncSelectionWithPointer()
        }
      } else if (mouseY > rect.bottom - edgeSize) {
        // 向下滚动
        const speed = Math.min(maxSpeed, ((mouseY - rect.bottom + edgeSize) / edgeSize) * maxSpeed)
        const prevScrollTop = scrollerEl.scrollTop
        scrollerEl.scrollTop += speed
        const actualDelta = scrollerEl.scrollTop - prevScrollTop
        if (actualDelta > 0) {
          // 内容向上移动，起点在视口中的相对位置也要上移
          startClientY -= actualDelta
          syncSelectionWithPointer()
        }
      }
    }, 16) // ~60fps
  }

  const stopAutoScroll = () => {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer)
      autoScrollTimer = null
    }
  }

  // 记录最后的鼠标位置（用于自动滚动时的计算）
  let lastClientX = 0
  let lastClientY = 0

  /**
   * 鼠标按下事件处理
   * 只要起点落在网格区域内，就允许进入待框选状态
   */
  const onMouseDown = (e: MouseEvent) => {
    if (options.selectable && !options.selectable()) return

    // 只响应左键
    if (e.button !== 0) return

    // 检查是否在滚动容器内
    scrollerEl = getScrollerEl()
    if (!scrollerEl) return

    e.preventDefault()

    preSelectedIds = [...options.selectedIds()]
    lastSelectionKey = options.selectedIds().join('\u0000')

    const content = clientToContent(e.clientX, e.clientY)
    startContentX = content.x
    startContentY = content.y
    startClientX = e.clientX
    startClientY = e.clientY
    lastClientX = e.clientX
    lastClientY = e.clientY

    isPointerDown = true
    isDragging.value = false
    selectionRect.value = { x: 0, y: 0, width: 0, height: 0 }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('selectstart', onSelectStart)
  }

  /**
   * 鼠标移动事件处理
   */
  const onMouseMove = (e: MouseEvent) => {
    if (!isPointerDown) return

    lastClientX = e.clientX
    lastClientY = e.clientY

    if (!isDragging.value) {
      const distanceX = Math.abs(e.clientX - startClientX)
      const distanceY = Math.abs(e.clientY - startClientY)

      if (distanceX < DRAG_START_THRESHOLD && distanceY < DRAG_START_THRESHOLD) {
        return
      }

      isDragging.value = true
      startAutoScroll()
    }

    syncSelectionWithPointer()
  }

  /**
   * 鼠标松开事件处理
   */
  const onMouseUp = () => {
    const didDrag = isDragging.value

    isPointerDown = false
    isDragging.value = false
    selectionRect.value = { x: 0, y: 0, width: 0, height: 0 }
    stopAutoScroll()
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('selectstart', onSelectStart)
    scrollerEl = null

    if (didDrag) {
      scheduleClickSuppression()
    }
  }

  onUnmounted(() => {
    stopAutoScroll()
    removeClickSuppression()
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('selectstart', onSelectStart)
  })

  return {
    isDragging,
    selectionRect,
    onMouseDown
  }
}
