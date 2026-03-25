/** dump_window_compact 解析后的 UI 节点 */
export interface UiNode {
  /** 全局节点 ID */
  id: number
  /** Java 类名 */
  className: string
  /** 缩进层级（深度） */
  depth: number
  /** 边界坐标 [left, top, right, bottom] */
  bounds: [number, number, number, number]
  /** 节点属性（text, resource-id, content-desc 等） */
  attrs: Record<string, string>
  /** 子节点 */
  children: UiNode[]
}

/** dump 解析结果 */
export interface DumpResult {
  /** 屏幕宽度 */
  screenWidth: number
  /** 屏幕高度 */
  screenHeight: number
  /** 屏幕旋转角度 */
  rotation: number
  /** 所有节点（扁平列表） */
  nodes: UiNode[]
  /** 根节点树 */
  tree: UiNode[]
}
