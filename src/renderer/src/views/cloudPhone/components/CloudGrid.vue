<template>
  <div class="cloud-grid-container" ref="containerRef">
    <div v-if="!data || data.length === 0" class="empty-container">
      <el-empty description="暂无选中设备" :image-size="150" />
    </div>

    <!--
      核心优化：使用 RecycleScroller 实现虚拟滚动
      
      @note
      - item-size: 行高（包含 gap），必须固定或通过计算得出
      - buffer: 预加载的像素高度，设置为 1000px 可以保证快速滚动时不白屏
      - pool-size: 组件池大小，20 个足够循环利用，避免频繁创建销毁
    -->
    <RecycleScroller
      v-else-if="containerWidth > 0"
      ref="scrollerRef"
      class="scroller"
      :items="rows"
      :item-size="rowHeight"
      key-field="id"
      :buffer="rowHeight"
      :pool-size="20"
      @scroll="onScrollerScroll"
      v-slot="{ item: row }"
    >
      <div class="grid-row" :style="{ gap: ITEM_GAP + 'px', marginBottom: ITEM_GAP + 'px' }">
        <!-- 每一行内部渲染多个 GridItem -->
        <GridItem
          v-for="device in getRowItems(row)"
          :key="device.id"
          :device="device"
          :size="size"
          :width="getItemWidth(device)"
          :height="itemConfig.height"
          :style="{ width: getItemWidth(device) + 'px', height: itemConfig.height + 'px' }"
          :is-selected="selectedIds.includes(device.id)"
          :selectable="selectable"
          :menu-items="getMenuItems ? getMenuItems(device) : []"
          :is-group-control="isGroupControl"
          @click="handleItemClick"
          @selection-change="handleCheckboxChange"
          @context-menu="handleContextMenu"
          @command="(cmd, dev) => emit('command', cmd, dev)"
          @open-window="(dev) => emit('open-window', dev)"
        />
      </div>
    </RecycleScroller>

    <!-- 右键菜单 (使用 Teleport 挂载到 body，避免父级 transform 影响 fixed 定位) -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        ref="contextMenuRef"
        class="grid-context-menu"
        :style="{ left: adjustedMenuX + 'px', top: adjustedMenuY + 'px' }"
        @click.stop
        @mouseenter="adjustMenuPosition"
      >
        <div class="menu-content">
          <div
            v-for="item in currentMenuItems"
            :key="item.command"
            class="menu-item"
            :class="{ 'menu-item-divided': item.divided }"
            @click="handleMenuClick(item)"
          >
            {{ item.label }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted, nextTick } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { Device, DeviceState } from '@shared/ipc/data.types'
import { useResizeObserver } from '@renderer/hooks/useResizeObserver'
import GridItem from './GridItem.vue'
import { ElEmpty } from 'element-plus'

// ==========================================
// 类型定义
// ==========================================
interface MenuItem {
  label: string
  command: string
  divided?: boolean
}

// ==========================================
// Props & Emits
// ==========================================
const props = withDefaults(
  defineProps<{
    data: Device[]
    selectedIds?: string[]
    size?: 'small' | 'medium' | 'large'
    orientation?: 'portrait' | 'landscape'
    selectable?: boolean
    getMenuItems?: (device: Device) => MenuItem[]
    isGroupControl?: boolean
  }>(),
  {
    selectedIds: () => [],
    size: 'medium',
    orientation: 'portrait',
    selectable: true,
    getMenuItems: () => [],
    isGroupControl: false
  }
)

const emit = defineEmits<{
  (e: 'selection-change', ids: string[]): void
  (e: 'command', command: string, device: Device): void
  (e: 'open-window', device: Device): void
  (e: 'context-menu', device: Device, event: MouseEvent): void
}>()

// ==========================================
// 布局常量配置
// ==========================================
const CONTAINER_PADDING = 0
const ITEM_GAP = 10

// 响应式配置表：不同模式下的基准宽高
const configMap = {
  small: {
    portrait: { width: 100, height: 280 },
    landscape: { width: 100, height: 158 }
  },
  medium: {
    portrait: { width: 100, height: 360 },
    landscape: { width: 100, height: 203 }
  },
  large: {
    portrait: { width: 100, height: 460 },
    landscape: { width: 100, height: 259 }
  }
}

// 当前生效的配置
const itemConfig = computed(() => configMap[props.size][props.orientation])

// 每一行的高度（包含底部间距）
const rowHeight = computed(() => itemConfig.value.height + ITEM_GAP)

// ==========================================
// 虚拟滚动核心状态
// ==========================================
const containerRef = ref<HTMLElement>()
const scrollerRef = ref() // RecycleScroller 实例引用
const containerWidth = ref(0)
const firstVisibleIndex = ref(0) // 用于 Scroll Anchoring（滚动锚定）

/**
 * 监听滚动事件
 * 1. 关闭右键菜单
 * 2. 记录当前可视区域的第一个元素索引，以便在布局改变时恢复位置
 */
const onScrollerScroll = () => {
  if (contextMenuVisible.value) {
    closeContextMenu()
  }

  if (!scrollerRef.value) return
  const el = scrollerRef.value.$el
  if (!el) return

  const scrollTop = el.scrollTop
  const rowIndex = Math.floor(scrollTop / rowHeight.value)

  if (rows.value[rowIndex]) {
    firstVisibleIndex.value = rows.value[rowIndex].startIndex
  }
}

// ==========================================
// 智能布局计算逻辑
// ==========================================

/**
 * 计算"众数比例" (Dominant Ratio)
 * 只遍历运行中的设备，找出出现频率最高的宽高比。
 * 作用：确保 GridItem 的宽度统一，避免因个别设备分辨率不同导致布局参差不齐。
 */
const dominantRatio = computed(() => {
  if (!props.data || props.data.length === 0) return 9 / 16

  // 只考虑运行中的设备
  const runningDevices = props.data.filter((device) => device.state === DeviceState.StateRunning)

  // 如果没有运行中的设备，回退到所有设备
  const devicesToUse = runningDevices.length > 0 ? runningDevices : props.data

  const ratioCounts = new Map<number, number>()

  devicesToUse.forEach((device) => {
    let dw = parseInt(device.width || '720', 10)
    let dh = parseInt(device.height || '1280', 10)

    if (dw > 0 && dh > 0) {
      // 归一化：根据当前视图方向调整宽高
      if (props.orientation === 'landscape') {
        if (dw < dh) [dw, dh] = [dh, dw]
      } else {
        if (dw > dh) [dw, dh] = [dh, dw]
      }

      // 保留3位小数避免精度问题
      const ratio = Number((dw / dh).toFixed(3))
      ratioCounts.set(ratio, (ratioCounts.get(ratio) || 0) + 1)
    }
  })

  // 找出出现次数最多的比例
  let maxCount = 0
  let bestRatio = props.orientation === 'landscape' ? 16 / 9 : 9 / 16

  for (const [ratio, count] of ratioCounts) {
    if (count > maxCount) {
      maxCount = count
      bestRatio = ratio
    }
  }

  return bestRatio
})

/**
 * 计算单个 GridItem 的宽度
 * 基于 itemConfig 的固定高度和 dominantRatio 计算得出。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getItemWidth = (_device: Device) => {
  const h = itemConfig.value.height
  const contentHeight = h - 56 // 减去底部信息栏高度
  const ratio = dominantRatio.value
  return Math.floor(contentHeight * ratio)
}

/**
 * 动态分行 (Row Generation)
 * 将扁平的 device 数组转换为适合虚拟滚动的“行”数据结构。
 * 每一行记录了它包含的 device 在原数组中的 startIndex 和 endIndex。
 */
const rows = computed(() => {
  if (containerWidth.value <= 0) return []
  if (!props.data || props.data.length === 0) return []

  const result: { id: string; startIndex: number; endIndex: number; isLastRow: boolean }[] = []
  const availableWidth = containerWidth.value - CONTAINER_PADDING * 2

  let currentLineWith = 0
  let startIndex = 0

  for (let i = 0; i < props.data.length; i++) {
    const device = props.data[i]
    const w = getItemWidth(device)
    const gap = ITEM_GAP

    if (currentLineWith === 0) {
      // 行首元素
      if (w <= availableWidth) {
        currentLineWith = w
        // 还没满，继续
      } else {
        // 极端情况：单个元素比容器还宽，强制占一行
        result.push({
          id: `row-${result.length}`,
          startIndex: i,
          endIndex: i + 1,
          isLastRow: false
        })
        startIndex = i + 1
        currentLineWith = 0
      }
    } else {
      // 非行首元素，尝试放入当前行
      if (currentLineWith + gap + w <= availableWidth) {
        currentLineWith += gap + w
      } else {
        // 放不下，换行
        // 结算上一行
        result.push({
          id: `row-${result.length}`,
          startIndex: startIndex,
          endIndex: i,
          isLastRow: false
        })
        //不仅重置，当前元素成为新行的第一个
        startIndex = i
        currentLineWith = w
      }
    }
  }

  // 处理最后一行
  if (startIndex < props.data.length) {
    result.push({
      id: `row-${result.length}`,
      startIndex: startIndex,
      endIndex: props.data.length,
      isLastRow: true
    })
  }

  return result
})

/**
 * 获取行内数据
 * 虚拟滚动只渲染 Row 组件，Row 组件内部再渲染具体的 Device 列表。
 */
const getRowItems = (row: { startIndex: number; endIndex: number }) => {
  return props.data.slice(row.startIndex, row.endIndex)
}

// ==========================================
// 右键菜单逻辑
// ==========================================
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuDevice = ref<Device | null>(null)
const contextMenuRef = ref<HTMLElement>()

const currentMenuItems = computed(() => {
  if (!contextMenuDevice.value || !props.getMenuItems) return []
  return props.getMenuItems(contextMenuDevice.value)
})

// 调整后的菜单位置
const adjustedMenuX = ref(0)
const adjustedMenuY = ref(0)

// 计算并调整菜单位置，确保不超出视口
const adjustMenuPosition = () => {
  if (!contextMenuVisible.value || !contextMenuRef.value) {
    adjustedMenuX.value = contextMenuX.value
    adjustedMenuY.value = contextMenuY.value
    return
  }

  const menuWidth = contextMenuRef.value.offsetWidth || 120
  const menuHeight = contextMenuRef.value.offsetHeight || 200
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const padding = 8 // 距离边缘的最小距离

  let x = contextMenuX.value
  let y = contextMenuY.value

  // 调整 X 坐标
  // 如果右侧超出，调整到左侧
  if (x + menuWidth + padding > viewportWidth) {
    x = viewportWidth - menuWidth - padding
  }
  // 如果左侧超出，调整到右侧
  if (x < padding) {
    x = padding
  }

  // 调整 Y 坐标
  // 如果底部超出，调整到上方
  if (y + menuHeight + padding > viewportHeight) {
    y = viewportHeight - menuHeight - padding
  }
  // 如果顶部超出，调整到下方
  if (y < padding) {
    y = padding
  }

  adjustedMenuX.value = Math.max(padding, Math.min(x, viewportWidth - menuWidth - padding))
  adjustedMenuY.value = Math.max(padding, Math.min(y, viewportHeight - menuHeight - padding))
}

const handleContextMenu = (device: Device, event: MouseEvent) => {
  contextMenuDevice.value = device

  // 使用 clientX/clientY 确保相对于视口的坐标，配合 position: fixed 使用
  // 确保坐标是有效的数值，并考虑可能的页面缩放
  const x = Math.round(event.clientX || 0)
  const y = Math.round(event.clientY || 0)

  contextMenuX.value = x
  contextMenuY.value = y
  contextMenuVisible.value = true

  // 使用 nextTick 确保 DOM 已更新，可以获取菜单尺寸
  nextTick(() => {
    adjustMenuPosition()
  })

  emit('context-menu', device, event)
}

const handleMenuClick = (item: MenuItem) => {
  if (contextMenuDevice.value) {
    emit('command', item.command, contextMenuDevice.value)
  }
  closeContextMenu()
}

const closeContextMenu = () => {
  contextMenuVisible.value = false
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  cleanup()
  document.removeEventListener('click', closeContextMenu)
})

// ==========================================
// Resize Observer
// ==========================================
const { cleanup } = useResizeObserver(containerRef, {
  throttleTime: 200,
  onResize: (entry) => {
    containerWidth.value = entry.contentRect.width
  }
})

// ==========================================
// 交互事件处理
// ==========================================
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleItemClick = (device: Device, _event: MouseEvent) => {
  if (!props.selectable) return

  const isSelected = props.selectedIds.includes(device.id)
  let newSelectedIds: string[] = []

  if (isSelected) {
    newSelectedIds = props.selectedIds.filter((id) => id !== device.id)
  } else {
    newSelectedIds = [...props.selectedIds, device.id]
  }

  emit('selection-change', newSelectedIds)
}

const handleCheckboxChange = (checked: boolean, device: Device) => {
  let newSelectedIds: string[]

  if (checked) {
    newSelectedIds = [...new Set([...props.selectedIds, device.id])]
  } else {
    newSelectedIds = props.selectedIds.filter((id) => id !== device.id)
  }
  emit('selection-change', newSelectedIds)
}

defineExpose({})
</script>

<style scoped lang="scss">
.cloud-grid-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #fff;
  padding: 0;
  box-sizing: border-box;
}

.empty-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scroller {
  height: 100%;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #c0c4cc;
    border-radius: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.grid-row {
  display: flex;
  justify-content: flex-start;
  /* 确保行内元素垂直对齐 */
  align-items: flex-start;
}

/* Context Menu Styles */
.grid-context-menu {
  position: fixed;
  z-index: 9999;
  background: #fff;
  border: 1px solid #e4e7ed;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  min-width: 120px;
  max-width: 300px;
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .menu-content {
    padding: 5px 0;
    overflow-y: auto;
    overflow-x: hidden;

    .menu-item {
      padding: 8px 16px;
      font-size: 13px;
      color: #606266;
      cursor: pointer;
      transition: background 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &:hover {
        background: #ecf5ff;
        color: #409eff;
      }

      &.menu-item-divided {
        border-top: 1px solid #ebeef5;
        margin-top: 5px;
        padding-top: 8px;
      }
    }
  }
}
</style>
