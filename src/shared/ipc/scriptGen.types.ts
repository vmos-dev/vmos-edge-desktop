/**
 * 脚本生成大师 - 类型定义
 * 基于 VMOS Edge Workflow API 规范
 */

// ==================== IPC 事件 ====================

export const SCRIPT_GEN_EVENTS = {
  /** 开始/继续生成 */
  RUN: 'scriptGen:run',
  /** 取消当前生成 */
  CANCEL: 'scriptGen:cancel',
  /** 优化意图描述 */
  OPTIMIZE_INTENT: 'script-gen:optimize-intent',
  /** 新建会话（清空历史） */
  NEW_SESSION: 'scriptGen:newSession',
  /** 流式输出推送 */
  STREAM: 'scriptGen:stream',
  /** 生成完成推送 */
  COMPLETE: 'scriptGen:complete',
  /** 错误推送 */
  ERROR: 'scriptGen:error'
} as const

// ==================== Provider 配置 ====================

/** 支持的 AI 厂商 */
export type AIVendor = 'deepseek' | 'openai' | 'anthropic' | 'google' | 'azure' | 'custom'

/** AI Provider 配置 */
export interface AIProviderConfig {
  vendor: AIVendor
  baseUrl: string
  apiKey: string
  model: string
}

/** 厂商默认配置映射 */
export const VENDOR_DEFAULTS: Record<AIVendor, { baseUrl: string; models: string[] }> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder']
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp']
  },
  azure: {
    baseUrl: '',
    models: []
  },
  custom: {
    baseUrl: '',
    models: []
  }
}

// ==================== 云机环境数据 ====================

/** 顶层 Activity 信息 */
export interface TopActivityInfo {
  package_name: string
  class_name: string
}

/** 简化后的 UI 节点 */
export interface SimplifiedNode {
  text?: string
  'resource-id'?: string
  'content-desc'?: string
  class: string
  bounds: string
  clickable?: boolean
  children?: SimplifiedNode[]
}

/** 设备环境快照 */
export interface DeviceEnvironment {
  /** 顶层 Activity */
  topActivity: TopActivityInfo | null
  /** 简化后的 UI XML/JSON */
  uiDump: string
  /** 截图 base64（可选） */
  screenshot?: string
}

// ==================== Workflow 脚本类型 ====================

/** 工作流脚本 */
export interface WorkflowScript {
  id: string
  name: string
  version: string
  steps: Record<string, WorkflowStep>
  flow: string[]
  description?: string
  timeout?: number
  exception_handlers?: ExceptionHandler[]
}

/** 异常处理器 */
export interface ExceptionHandler {
  name: string
  selector: Record<string, unknown>
  action: string
  action_params?: Record<string, unknown>
  max_trigger_count: number
}

/** 工作流步骤 */
export interface WorkflowStep {
  description?: string
  completed?: string
  loop?:
    | { count: number; interval?: number } // 固定次数模式
    | { max_count: number; interval?: number } // 条件退出模式
  actions: WorkflowAction[]
}

/** Workflow 动作基础接口 */
export interface WorkflowAction {
  path: string
  params?: Record<string, unknown>
  throw_if_empty?: string[]
}

/** 逻辑控制 - 暂停 */
export interface SleepAction extends WorkflowAction {
  path: 'base/sleep'
  params: { duration: number }
}

/** 应用管理 - 启动 */
export interface StartActivityAction extends WorkflowAction {
  path: 'activity/start_activity'
  params: { package_name: string }
}

/** 权限设置 */
export interface SetPermissionAction extends WorkflowAction {
  path: 'permission/set'
  params: { package_name: string; grant_all: boolean }
}

/** 输入控制 - 点击 */
export interface ClickAction extends WorkflowAction {
  path: 'input/click'
  params: { x: number; y: number }
}

/** 输入控制 - 输入文本 */
export interface InputTextAction extends WorkflowAction {
  path: 'input/text'
  params: { text: string }
}

/** 输入控制 - 滑动 */
export interface SwipeAction extends WorkflowAction {
  path: 'input/scroll_bezier'
  params: {
    start_x: number
    start_y: number
    end_x: number
    end_y: number
    duration: number
  }
}

/** 输入控制 - 按键 */
export interface KeyEventAction extends WorkflowAction {
  path: 'input/keyevent'
  params: { key_code: number }
}

/** 无障碍 - 节点操作 (统一接口) */
export interface NodeAction extends WorkflowAction {
  path: 'accessibility/node'
  params: {
    selector: {
      resource_id?: string
      text?: string
      content_desc?: string
      class_name?: string
      index?: number
      // 注意：不支持 clickable，接口会报错
      desc?: string // 兼容 content_desc
      [key: string]: unknown
    }
    action?: string
    action_params?: Record<string, unknown>
    wait_timeout?: number
    wait_interval?: number
  }
}

/** 系统 - Toast */
export interface ToastAction extends WorkflowAction {
  path: 'system/toast'
  params: { message: string }
}

/** 所有 Workflow 动作类型 */
export type AnyWorkflowAction =
  | SleepAction
  | StartActivityAction
  | SetPermissionAction
  | ClickAction
  | InputTextAction
  | SwipeAction
  | KeyEventAction
  | NodeAction
  | ToastAction
  | WorkflowAction

// ==================== 任务生成上下文 ====================

/** 执行上下文（每次请求 AI 时携带，保持交互连续性） */
export interface ExecutionContext {
  /** 用户原始目标 */
  userIntent: string
  /** 已录入到脚本中的步骤描述列表（用于记忆对齐，防止重复录入） */
  recordedSteps: string[]
  /** 当前执行阶段：instruction_done=用户完成手动引导, continue=继续录入, script_recorded=上一步脚本录入完成, script_executed=用户已执行完脚本并回传新dump */
  currentPhase: 'instruction_done' | 'continue' | 'script_recorded' | 'script_executed'
  /** 上一轮执行情况反馈 */
  lastAction?: {
    /** 动作/指令描述 */
    description: string
    /** 执行结果 */
    result: 'success' | 'failed' | 'pending'
    /** 失败原因或补充说明 */
    reason?: string
  }
}

// ==================== 消息类型 ====================

/** 聊天消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 聊天消息 */
export interface ChatMessage {
  role: MessageRole
  content: string
  timestamp?: number
}

// ==================== IPC 请求/响应 ====================

/** 运行请求参数 */
export interface ScriptGenRunParams {
  /** 用户输入消息 */
  message: string
  /** AI Provider 配置 */
  provider?: AIProviderConfig
  /** 设备环境快照（可选） */
  environment?: DeviceEnvironment
  /** 会话 ID */
  sessionId?: string
  /** 当前设备 UI 状态（dump 结果） */
  uiState?: string
  /** 执行上下文（用于感知当前进度） */
  executionContext: ExecutionContext
}

/** 流式输出数据 */
export interface ScriptGenStreamData {
  sessionId: string
  /** 增量内容 */
  delta: string
  /** 当前完整内容（可选） */
  content?: string
}

/** 生成完成数据 - 交互式生成模式 */
export interface ScriptGenCompleteData {
  sessionId: string
  /** 响应类型：instruction=操作指令, action/script=生成动作, complete=任务完成, question=需要确认 */
  responseType: 'instruction' | 'action' | 'script' | 'complete' | 'question'

  // ===== instruction 专用字段 =====
  /** 给用户的操作指令 */
  instruction?: string
  /** 目标元素描述 */
  targetElement?: string
  /** 预期结果描述 */
  expectedResult?: string

  // ===== action/script 专用字段 =====
  /** 生成的动作（responseType=action/script时有值） */
  action?: WorkflowAction | WorkflowAction[]
  /** 动作描述（将记录到 recordedSteps 中） */
  description?: string
  /** 步骤 ID（用于最终脚本分组） */
  stepId?: string | number
  /** 步骤描述 */
  stepDescription?: string
  /** 步骤完成条件（用于循环退出，如 "success"） */
  stepCompleted?: string
  /** 步骤循环配置（用于生成循环结构，如滑动查找） */
  stepLoop?:
    | { count: number; interval?: number } // 固定次数模式
    | { max_count: number; interval?: number } // 条件退出模式
  /** 校验信息 */
  validation?: { selector: Record<string, string>; description: string }

  // ===== 通用字段 =====
  /** 消息（complete/question时的说明） */
  message?: string
  /** 内部思维过程 */
  thought?: string
  /** 原始响应内容 */
  rawContent?: string
  /** 生成的完整工作流脚本（仅在 complete 时存在） */
  workflow?: WorkflowScript
}

/** 错误数据 */
export interface ScriptGenErrorData {
  sessionId: string
  error: string
  code?: string
}

/** 新建会话响应 */
export interface NewSessionResponse {
  sessionId: string
}

// ==================== Worker 消息类型 ====================

/** 发送给 Worker 的消息类型 */
export type WorkerInMessage =
  | {
      id: string
      type: 'run'
      data: {
        message: string
        provider: AIProviderConfig
        history: ChatMessage[]
        /** 当前设备 UI 状态（dump 结果） */
        uiState?: string
        /** 执行上下文 */
        executionContext: ExecutionContext
      }
    }
  | {
      id: string
      type: 'cancel'
    }
  | {
      id: string
      type: 'optimize_intent'
      data: {
        input: string
        packages: string
        provider: AIProviderConfig
      }
    }

/** Worker 返回的消息类型 */
export type WorkerOutMessage =
  | {
      id: string
      type: 'stream'
      data: { delta: string; content: string }
    }
  | {
      id: string
      type: 'complete'
      data: {
        responseType: 'instruction' | 'action' | 'script' | 'complete' | 'question'
        // instruction 专用字段
        instruction?: string
        targetElement?: string
        expectedResult?: string
        // action/script 专用字段
        action?: WorkflowAction | WorkflowAction[]
        description?: string
        stepId?: number // Worker 统一使用 number，与 ScriptGenCompleteData 的 string | number 兼容
        stepDescription?: string
        stepCompleted?: string
        stepLoop?:
          | { count: number; interval?: number } // 固定次数模式
          | { max_count: number; interval?: number } // 条件退出模式
        validation?: { selector: Record<string, string>; description: string }
        replaceFailedSteps?: number
        completedPlanStepIndex?: number
        // 通用字段
        message?: string
        thought?: string
        rawContent: string
        userMessage?: string
        historyUserMessage?: string
      }
    }
  | {
      id: string
      type: 'error'
      error: string
    }

// ==================== 辅助函数 ====================

/** 获取动作的可读描述 */
export function getActionDescription(action: WorkflowAction): string {
  const params = (action.params || {}) as any

  switch (action.path) {
    // 新格式 API
    case 'base/sleep':
      return `等待 ${params.duration}ms`
    case 'permission/set':
      return `授权应用: ${params.package_name}`
    case 'activity/start_activity':
      return `启动应用: ${params.package_name}`
    case 'accessibility/node': {
      const selector = params.selector
      const actionType = params.action as string | undefined

      // 优先显示文本，其次资源 ID，最后是类名
      const target =
        selector?.text ||
        selector?.resource_id ||
        selector?.content_desc ||
        selector?.desc ||
        selector?.class_name ||
        (typeof selector?.index === 'number' ? `index=${selector.index}` : undefined) ||
        'unknown'

      if (actionType === 'click') {
        return `点击: ${target}`
      } else if (actionType === 'input') {
        return `输入: ${params.action_params?.text || ''} -> ${target}`
      } else if (actionType === 'scroll_forward') {
        return `向前滚动: ${target}`
      } else if (actionType === 'scroll_backward') {
        return `向后滚动: ${target}`
      }
      return `操作节点: ${target}`
    }
    case 'system/toast':
      return `弹提示: ${params.message}`

    // 兼容旧格式
    case 'logic/sleep':
      return `等待 ${params.duration}ms`
    case 'activity/start':
      return `启动应用: ${params.package_name}`
    case 'activity/stop':
      return `停止应用: ${params.package_name}`
    case 'input/click':
      return `点击坐标 (${params.x}, ${params.y})`
    case 'input/text':
      return `输入文本: "${params.text}"`
    case 'input/scroll_bezier':
      return `滑动: (${params.start_x},${params.start_y}) → (${params.end_x},${params.end_y})`
    case 'input/keyevent': {
      const keyNames: Record<number, string> = {
        3: 'Home',
        4: '返回',
        24: '音量+',
        25: '音量-',
        66: '回车'
      }
      const keyCode = params.key_code as number
      return `按键: ${keyNames[keyCode] || `KeyCode ${keyCode}`}`
    }
    case 'accessibility/find_node':
      return `查找节点: ${params.text || params.resource_id || 'unknown'}`
    case 'accessibility/perform_action':
      return `执行动作: ${params.text || params.view_id}`
    case 'accessibility/dump':
      return '获取 UI 布局'
    case 'activity/top_activity':
      return '获取顶层 Activity'
    default:
      return action.path
  }
}

/** 获取动作类型标签 */
export function getActionTypeLabel(path: string): string {
  const labels: Record<string, string> = {
    // 新格式
    'base/sleep': '等待',
    'permission/set': '授权',
    'activity/start_activity': '启动应用',
    'accessibility/node': '节点操作',
    'system/toast': '提示',
    // 兼容旧格式
    'logic/sleep': '等待',
    'activity/start': '启动应用',
    'activity/stop': '停止应用',
    'input/click': '点击',
    'input/text': '输入',
    'input/scroll_bezier': '滑动',
    'input/keyevent': '按键',
    'accessibility/find_node': '查找节点',
    'accessibility/perform_action': '执行动作',
    'accessibility/dump': 'UI布局',
    'activity/top_activity': '顶层Activity'
  }
  return labels[path] || path
}
