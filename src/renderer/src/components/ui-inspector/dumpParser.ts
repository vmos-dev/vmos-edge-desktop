import type { UiNode, DumpResult } from './types'

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
    return { screenWidth: 0, screenHeight: 0, rotation: 0, nodes: [], tree: [] }
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

  return { screenWidth, screenHeight, rotation, nodes, tree }
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
      ? [parseInt(boundsMatch[1]), parseInt(boundsMatch[2]), parseInt(boundsMatch[3]), parseInt(boundsMatch[4])]
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

  return { screenWidth, screenHeight, rotation, nodes, tree }
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
