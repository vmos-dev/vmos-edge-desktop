import type { UiNode, DumpResult } from './types'
import { isInteractable, selectorLocatability } from './nodeCriteria'

/**
 * 解析 dump_window_compact 返回的紧凑文本格式
 *
 * 格式示例：
 * Screen 1080x1920 rotation=0
 * [0] android.widget.FrameLayout bounds=[0,0][1080,1920]
 *   [1] android.widget.TextView text="标题" bounds=[16,24][200,72] clickable=true
 */
export function parseDumpCompact(text: string): DumpResult {
  const lines = text.split('\n').filter((l) => l.length > 0)
  if (lines.length === 0) {
    return {
      screenWidth: 0,
      screenHeight: 0,
      rotation: 0,
      nodes: [],
      tree: [],
      actionableNodes: []
    }
  }

  // 解析首行 Screen 信息
  let screenWidth = 1080
  let screenHeight = 1920
  let rotation = 0
  const screenMatch = lines[0].match(/^Screen\s+(\d+)x(\d+)\s+rotation=(\d+)/)
  if (screenMatch) {
    screenWidth = parseInt(screenMatch[1])
    screenHeight = parseInt(screenMatch[2])
    rotation = parseInt(screenMatch[3])
  }

  const nodes: UiNode[] = []
  const stack: UiNode[] = [] // 用于构建树结构
  const tree: UiNode[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]

    // 计算缩进深度（每级 2 个空格）
    const indent = line.search(/\S/)
    if (indent < 0) continue
    const depth = Math.floor(indent / 2)

    // 解析节点 ID 和类名
    const trimmed = line.trim()
    const nodeMatch = trimmed.match(/^\[(\d+)]\s+([\w.]+)(.*)$/)
    if (!nodeMatch) continue

    const id = parseInt(nodeMatch[1])
    const className = nodeMatch[2]
    const rest = nodeMatch[3]

    // 解析 bounds
    const boundsMatch = rest.match(/bounds=\[(-?\d+),(-?\d+)]\[(-?\d+),(-?\d+)]/)
    const bounds: [number, number, number, number] = boundsMatch
      ? [
          parseInt(boundsMatch[1]),
          parseInt(boundsMatch[2]),
          parseInt(boundsMatch[3]),
          parseInt(boundsMatch[4])
        ]
      : [0, 0, 0, 0]

    // 解析其他属性
    const attrs: Record<string, string> = {}
    // 匹配 key="value" 格式
    const quotedPattern = /([\w-]+)="([^"]*)"/g
    let match: RegExpExecArray | null
    while ((match = quotedPattern.exec(rest)) !== null) {
      attrs[match[1]] = match[2]
    }
    // 匹配 key=true 格式（布尔属性）
    const boolPattern = /([\w-]+)=true/g
    while ((match = boolPattern.exec(rest)) !== null) {
      if (!attrs[match[1]]) {
        attrs[match[1]] = 'true'
      }
    }

    const node: UiNode = { id, className, depth, bounds, attrs, children: [] }
    nodes.push(node)

    // 构建树结构
    // 弹出比当前深度深或相等的栈元素
    while (stack.length > depth) {
      stack.pop()
    }
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node)
    } else {
      tree.push(node)
    }
    stack.push(node)
  }

  return {
    screenWidth,
    screenHeight,
    rotation,
    nodes,
    tree,
    actionableNodes: filterActionableNodes(nodes)
  }
}

/**
 * 解析 dump_window（XML 格式）返回的 UI 层次
 *
 * XML 示例：
 * <hierarchy rotation="0">
 *   <node class="android.widget.FrameLayout" bounds="[0,0][1080,1920]" text="" ...>
 *     <node class="android.widget.TextView" bounds="[16,24][200,72]" text="标题" ... />
 *   </node>
 * </hierarchy>
 */
export function parseDumpXml(xml: string): DumpResult {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  const hierarchy = doc.querySelector('hierarchy')
  const rotation = parseInt(hierarchy?.getAttribute('rotation') || '0')

  let screenWidth = 1080
  let screenHeight = 1920
  const nodes: UiNode[] = []
  const tree: UiNode[] = []
  let nodeId = 0

  function parseNode(el: Element, depth: number, parent: UiNode | null) {
    const className = el.getAttribute('class') || ''
    const boundsStr = el.getAttribute('bounds') || ''
    const boundsMatch = boundsStr.match(/\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/)
    const bounds: [number, number, number, number] = boundsMatch
      ? [
          parseInt(boundsMatch[1]),
          parseInt(boundsMatch[2]),
          parseInt(boundsMatch[3]),
          parseInt(boundsMatch[4])
        ]
      : [0, 0, 0, 0]

    const attrs: Record<string, string> = {}
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i]
      if (attr.name !== 'class' && attr.name !== 'bounds') {
        attrs[attr.name] = attr.value
      }
    }

    const node: UiNode = { id: nodeId++, className, depth, bounds, attrs, children: [] }
    nodes.push(node)

    if (parent) {
      parent.children.push(node)
    } else {
      tree.push(node)
    }

    // 用根节点的 bounds 推算屏幕尺寸
    if (depth === 0 && bounds[2] > 0 && bounds[3] > 0) {
      screenWidth = bounds[2]
      screenHeight = bounds[3]
    }

    const children = el.querySelectorAll(':scope > node')
    children.forEach((child) => parseNode(child, depth + 1, node))
  }

  const rootNodes = doc.querySelectorAll('hierarchy > node')
  rootNodes.forEach((el) => parseNode(el, 0, null))

  // 计算重复元素的 index（对标 Maestro DeviceService.getIndex）
  computeElementIndices(nodes)

  // 预过滤可操作元素（架构层：在 hit-test 之前过滤，而非之后回溯）
  const actionableNodes = filterActionableNodes(nodes)

  return { screenWidth, screenHeight, rotation, nodes, tree, actionableNodes }
}

/**
 * 为节点列表计算 textIndex 和 resourceIdIndex
 *
 * 对标 Maestro DeviceService.kt:142-150 getIndex():
 * - 只有当 >=2 个元素共享相同的 text/resource-id 时才设置 index
 * - index 从 0 开始
 */
export function computeElementIndices(nodes: UiNode[]): void {
  const textGroups = new Map<string, UiNode[]>()
  const idGroups = new Map<string, UiNode[]>()

  const descGroups = new Map<string, UiNode[]>()

  for (const node of nodes) {
    const text = node.attrs['text']
    const rid = node.attrs['resource-id']
    const desc = node.attrs['content-desc']
    if (text) {
      if (!textGroups.has(text)) textGroups.set(text, [])
      textGroups.get(text)!.push(node)
    }
    if (rid) {
      if (!idGroups.has(rid)) idGroups.set(rid, [])
      idGroups.get(rid)!.push(node)
    }
    if (desc) {
      if (!descGroups.has(desc)) descGroups.set(desc, [])
      descGroups.get(desc)!.push(node)
    }
  }

  for (const [, group] of textGroups) {
    if (group.length >= 2) {
      group.forEach((node, i) => {
        node.textIndex = i
      })
    }
  }
  for (const [, group] of idGroups) {
    if (group.length >= 2) {
      group.forEach((node, i) => {
        node.resourceIdIndex = i
      })
    }
  }
  for (const [, group] of descGroups) {
    if (group.length >= 2) {
      group.forEach((node, i) => {
        node.contentDescIndex = i
      })
    }
  }
}

/**
 * 从全量节点中过滤出"可交互元素"
 *
 * 判定委托给 nodeCriteria.ts::isInteractable —— 那是一个对齐 Android AOSP
 * `isImportantForAccessibility` + automation 扩展的工业标准算法,与 UiAutomator /
 * Maestro / Appium 同源。详见该模块的算法出处说明。
 *
 * 这个函数本身只做"集合过滤 + 空 dump 兜底",不参与判定细节。
 */
function filterActionableNodes(nodes: UiNode[]): UiNode[] {
  return nodes.filter(isInteractable)
}

/**
 * 在节点列表中查找包含指定坐标的"最佳命中"节点
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 架构原则:按"用户点击意图的可定位性"打分,不只是面积
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Android 视图层级普遍存在"一串同 bounds 的嵌套节点"(Tab、Button 包装、
 * Compose shell 等)。旧版只按面积排序,面积相等时"先遇到的赢",父→子遍历
 * 顺序让父容器总是胜出,结果 selector 退到坐标。
 *
 * 架构修复:lexicographic 排序 (area asc, locatability desc)
 *   1. 面积越小越好 —— 更具体的子元素
 *   2. 面积相等时:selectorLocatability(node) 越高越好
 *      复用 nodeCriteria::selectorLocatability,与 chooseSelectorHost 使用的同一套
 *      "可定位性"评分标准,保证整个推荐链路的一致性。
 *
 * 为什么这是通用架构 ──
 *   1. 不依赖类名、不依赖业务关键词,对任何 Android a11y 合规的 App 都适用
 *   2. 同一个 locatability 函数同时服务:hit-test tie-break、selector host 决策、
 *      effective target 选择 —— 单一真相源,不会出现"hit-test 觉得 A 好但
 *      selector 侧觉得 B 好"的不一致
 *   3. Android 触摸冒泡保证:无论选择栈里哪个节点,tap 其中心都会正确触发
 *      最近 clickable 祖先的 onClick。所以本算法只影响 selector 稳定性,
 *      不影响运行时行为 —— 失败模式小,价值大
 *
 * 不变量(任何 dump 结构都满足):
 *   ∀ 命中坐标的节点集合 S,返回的节点 n 满足:
 *     n.area ≤ min(s.area) ∀ s ∈ S
 *     若存在多个同 n.area 的节点,n.locatability 在其中最大
 */
function findBestNodeAt(nodes: UiNode[], devX: number, devY: number): UiNode | null {
  let best: UiNode | null = null
  let bestArea = Infinity
  let bestLocatability = -Infinity

  for (const node of nodes) {
    const [x1, y1, x2, y2] = node.bounds
    if (devX < x1 || devX > x2 || devY < y1 || devY > y2) continue

    const area = (x2 - x1) * (y2 - y1)
    // 严格更小面积直接胜出(不考虑 locatability —— 面积是"具体性"的主信号)
    if (area < bestArea) {
      best = node
      bestArea = area
      bestLocatability = selectorLocatability(node)
      continue
    }
    // 同面积 tie-break:可定位性高者胜出(复用 nodeCriteria 的通用评分)
    if (area === bestArea) {
      const loc = selectorLocatability(node)
      if (loc > bestLocatability) {
        best = node
        bestLocatability = loc
      }
    }
  }
  return best
}

/**
 * 查找点击位置的"最佳命中节点"(两层查找:actionable 优先,全量回退)
 *
 * 两层设计的目的是处理"完全装饰性节点"(无 trait + 无 semantic,如纯图标 ImageView):
 *   - Layer 1: actionableNodes 命中 → 返回(按 findBestNodeAt 的 lex 排序)
 *   - Layer 2: 全量 nodes 回退 → 处理"actionable 全部在 stack 顶端但都比纯叶子大"
 *              的边缘情形(比如一块纯视觉区域)
 *
 * 两层都用同一个 findBestNodeAt 排序器,保证排序准则一致。
 */
export function findNodeAtPoint(dump: DumpResult, devX: number, devY: number): UiNode | null {
  const primary = findBestNodeAt(dump.actionableNodes, devX, devY)
  if (primary) return primary
  // 防御性回退:dump 里确实有命中点但都不在 actionableNodes 里(纯装饰区域)
  return findBestNodeAt(dump.nodes, devX, devY)
}

/** 获取节点显示名称（优先 text > content-desc > resource-id > className） */
export function getNodeLabel(node: UiNode): string {
  if (node.attrs['text']) return node.attrs['text']
  if (node.attrs['content-desc']) return node.attrs['content-desc']
  if (node.attrs['resource-id']) {
    const rid = node.attrs['resource-id']
    // 截取 id 部分（去掉包名前缀）
    const idx = rid.lastIndexOf('/')
    return idx >= 0 ? rid.substring(idx + 1) : rid
  }
  // 截取简短类名
  const idx = node.className.lastIndexOf('.')
  return idx >= 0 ? node.className.substring(idx + 1) : node.className
}
