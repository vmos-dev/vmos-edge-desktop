/**
 * 工作流相关 IPC 类型和事件常量
 *
 */

// ═══════════════ 工作流数据模型 ═══════════════

/** 工作流整体结构(完整加载时使用) */
export interface Workflow {
  id: string
  name: string
  /** 目标应用包名,必填 */
  appId: string
  /** 应用显示名 */
  appName: string
  /** 应用图标(base64 data URI 或相对路径) */
  appIcon?: string
  /** 创建时云机上的版本号(versionName);非实时,仅用于卡片展示 */
  appVersion?: string
  /** 上次使用的云机 id,下次打开时优先尝试 */
  defaultDeviceId?: string
  steps: Step[]
  env?: Record<string, string>
  tags?: string[]
  /**
   * 用户编辑时的原始 YAML 文本(字节级)。
   * steps 是语义结构化表示;yamlText 保留引号 / flow 风格 / 键顺序 / 注释等
   * 风格细节。前端加载工作流时优先用 yamlText;为空(老数据)再 fallback 到
   * 从 steps 重建(stepsToYaml)。两者必须同源,由前端 save 时一并写入。
   */
  yamlText?: string
  createdAt: number
  updatedAt: number
}

/** 工作流列表项(列表场景只加载轻字段,不含 steps;stepCount 由 SQL 聚合得到) */
export interface WorkflowListItem {
  id: string
  name: string
  appId: string
  appName: string
  appIcon?: string
  appVersion?: string
  defaultDeviceId?: string
  /**
   * **顶层** 步骤数量(由 SQLite `json_array_length(steps_json)` 聚合,
   * 避免加载 steps 全量)。**不含** repeat / retry / branch 等容器内的子步骤 ——
   * 这与编辑页 `doc.steps.value.length` 的口径一致(都是顶层数组长度)。
   * 用户语义上的"总步骤"若需要,客户端读完整 workflow 后递归遍历。
   */
  stepCount: number
  createdAt: number
  updatedAt: number
}

// ═══════════════ 步骤 ═══════════════

export interface Step {
  id: string
  action: ActionType | string
  selector?: Selector
  params?: ActionParams
  stability: 'ok' | 'warn' | 'bad'
  label?: string
  optional?: boolean
  when?: StepCondition
  chance?: number
  disabled?: boolean
  metadata: StepMetadata

  // ═══ 组合步骤(可嵌套)═══

  /**
   * repeat / retry / runFlow 的子命令
   * (可视化视图里会缩进渲染;运行时引擎解包成子命令树执行)
   */
  children?: Step[]

  /**
   * branch 的多分支结构:每个分支带可选 when 条件 + commands
   * 只有 action === 'branch' 时才有
   */
  branches?: Array<{ when?: StepCondition; children: Step[] }>

  /**
   * 原始 YAML 节点(JS 对象)。遇到组件不完全认识的命令时用它兜底,
   * 保证 YAML 手写 → 可视化 → 回 YAML 的往返不丢字段。
   * 可视化视图对 raw 步骤只支持「整条拖动/删除/禁用」,内部字段不改。
   */
  raw?: unknown
  /** true = 可视化不展开内部,仅作占位块(由 raw 决定) */
  opaque?: boolean
}

export interface StepMetadata {
  elementType: ElementType
  /** 捕获时的 epoch ms */
  capturedAt: number
  /** 截图存储引用(V2) */
  screenshotRef?: string
  /** 当时的 UI dump 片段,用于调试和自愈 */
  elementDump?: unknown
}

// ═══════════════ 选择器 ═══════════════

export interface Selector {
  primary: SelectorStrategy
  fallbacks?: SelectorStrategy[]
}

export interface SelectorStrategy {
  type: 'text' | 'id' | 'spatial' | 'point' | 'traits'
  value: unknown
  /** 稳定度 0~100,用于 UI 标识红黄绿 */
  stabilityScore: number
}

// ═══════════════ 动作类型 ═══════════════

export type ActionType =
  | 'tapOn'
  | 'longPressOn'
  | 'doubleTapOn'
  | 'inputText'
  | 'eraseText'
  | 'pasteText'
  | 'swipe'
  | 'scroll'
  | 'scrollUntilVisible'
  | 'assertVisible'
  | 'assertNotVisible'
  | 'extendedWaitUntil'
  | 'sleep'
  | 'waitForAnimationToEnd'
  | 'launchApp'
  | 'stopApp'
  | 'killApp'
  | 'copyTextFrom'
  | 'setClipboard'
  | 'runScript'
  | 'evalScript'
  | 'defineVariables'
  | 'httpRequest'
  | 'pressKey'
  | 'takeScreenshot'
  | 'setLocation'
  | 'setPermissions'
  | 'setAirplaneMode'
  | 'shell'
  | 'openLink'
  | 'repeat'
  | 'retry'
  | 'runFlow'
  | 'branch'

/** 元素类型(推荐算法依赖) */
export type ElementType =
  | 'button'
  | 'image-button'
  | 'input-empty'
  | 'input-filled'
  | 'toggle'
  | 'text'
  | 'text-link'
  | 'image'
  | 'webview'
  | 'unknown'

/** 动作参数(宽松类型,各 action 有自己的必填字段) */
export interface ActionParams {
  text?: string
  duration?: number | [number, number]
  times?: number | string
  timeout?: number | string
  [k: string]: unknown
}

/** 条件(when 字段) */
export interface StepCondition {
  visible?: unknown
  notVisible?: unknown
  true?: string
  label?: string
}

// ═══════════════ 应用信息(从云机扫描) ═══════════════

export interface AppInfo {
  packageName: string
  displayName: string
  /** base64 data URI 或相对路径,可能异步补齐 */
  icon?: string
  versionName?: string
  versionCode?: number
  installTime?: number
  lastUsedTime?: number
  /** 安装包大小 bytes */
  size?: number
}

// ═══════════════ 推荐结果 ═══════════════

export interface Recommendation {
  action: ActionType
  /** UI 展示文案,如 "点击这个按钮" */
  title: string
  icon: string
  /**
   * 推荐落地的完整步骤序列(主步骤 + 附加步骤,如 tapOn → eraseText → inputText)
   * 消费者直接 stepOps.addBatch(steps) 即可;不需要回解析 YAML
   */
  steps: Array<Omit<Step, 'id'>>
  /** YAML 预览,仅用于 UI 展示 */
  yamlPreview: string[]
  priority: number
  reason?: string
}

// ═══════════════ IPC 通道 ═══════════════

export const WORKFLOW_EVENTS = {
  LIST: 'WORKFLOW:LIST',
  GET: 'WORKFLOW:GET',
  CREATE: 'WORKFLOW:CREATE',
  UPDATE: 'WORKFLOW:UPDATE',
  DELETE: 'WORKFLOW:DELETE'
} as const

export type WorkflowEvent = (typeof WORKFLOW_EVENTS)[keyof typeof WORKFLOW_EVENTS]

// ═══════════════ IPC 请求 / 响应 payload 类型 ═══════════════

export interface ListWorkflowsPayload {
  offset?: number
  limit?: number
}

export interface CreateWorkflowPayload {
  name: string
  appId: string
  appName: string
  appIcon?: string
  appVersion?: string
  defaultDeviceId?: string
  /** 可选:新建即"建好就保存"时一并落库的 step / env / tags
   *  让客户端只发一次 IPC 完成 create + save,避免 create-then-update 中间失败留脏数据 */
  steps?: Step[]
  env?: Record<string, string>
  tags?: string[]
  /** 原始 YAML 文本;见 Workflow.yamlText */
  yamlText?: string
}

export interface UpdateWorkflowPayload {
  id: string
  patch: Partial<Omit<Workflow, 'id' | 'createdAt'>>
}

export interface DeleteWorkflowPayload {
  id: string
}
