/**
 * Agent 自动化模块 - IPC 与类型定义
 *
 * 运行时能力由 @vmosedge/workflow-agent-sdk 提供，
 * 这里保留桌面端需要的 IPC 事件常量与少量本地辅助函数。
 */

import type {
  AIVendor as SdkAIVendor,
  AIProviderConfig as SdkAIProviderConfig,
  DeviceConnection as SdkDeviceConnection,
  ToolCategory as SdkToolCategory,
  ToolDefinition as SdkToolDefinition,
  ToolCall as SdkToolCall,
  ToolResult as SdkToolResult,
  ExecutionLogEntry as SdkExecutionLogEntry,
  WorkflowScript as SdkWorkflowScript,
  ExceptionHandler as SdkExceptionHandler,
  WorkflowStep as SdkWorkflowStep,
  WorkflowAction as SdkWorkflowAction,
  ChatMessage as SdkChatMessage,
  TaskPlan as SdkTaskPlan,
  TaskPlanSubtask as SdkTaskPlanSubtask,
  ReliabilityConfig as SdkReliabilityConfig,
  RuntimeDiagnosticsSummary as SdkRuntimeDiagnosticsSummary,
  McpServerConfig as SdkMcpServerConfig,
  AgentRuntimeOptions as SdkAgentRuntimeOptions,
  AgentRuntimeStartParams as SdkAgentRuntimeStartParams,
  AgentRuntimeResumeParams as SdkAgentRuntimeResumeParams,
  AgentPlanningData as SdkAgentPlanningData,
  AgentThinkingData as SdkAgentThinkingData,
  AgentToolCallData as SdkAgentToolCallData,
  AgentToolResultData as SdkAgentToolResultData,
  AgentDiagnosticData as SdkAgentDiagnosticData,
  AgentPausedData as SdkAgentPausedData,
  AgentScriptGeneratingData as SdkAgentScriptGeneratingData,
  AgentCompleteData as SdkAgentCompleteData,
  AgentErrorData as SdkAgentErrorData
} from '@vmosedge/workflow-agent-sdk/types'

// ==================== IPC 事件 ====================

export const AGENT_EVENTS = {
  /** 启动 Agent（Renderer → Main） */
  START: 'agent:start',
  /** 停止 Agent（Renderer → Main） */
  STOP: 'agent:stop',
  /** 用户回复后继续 Agent Loop（Renderer → Main） */
  RESUME: 'agent:resume',
  /** 新会话（Renderer → Main） */
  NEW_SESSION: 'agent:newSession',
  /** 触发脚本生成（Renderer → Main） */
  GENERATE_SCRIPT: 'agent:generateScript',

  /** 任务规划状态（Main → Renderer） */
  PLANNING: 'agent:planning',
  /** Agent 思考文本（Main → Renderer） */
  THINKING: 'agent:thinking',
  /** Agent 调用工具（Main → Renderer） */
  TOOL_CALL: 'agent:toolCall',
  /** 工具执行结果（Main → Renderer） */
  TOOL_RESULT: 'agent:toolResult',
  /** 运行时诊断（Main → Renderer） */
  DIAGNOSTIC: 'agent:diagnostic',
  /** Agent 暂停等待用户输入（Main → Renderer） */
  PAUSED: 'agent:paused',
  /** 脚本生成中（Main → Renderer） */
  SCRIPT_GENERATING: 'agent:scriptGenerating',
  /** 脚本生成完成（Main → Renderer） */
  COMPLETE: 'agent:complete',
  /** 错误（Main → Renderer） */
  ERROR: 'agent:error',
  /** 智能优化用户意图描述（Renderer → Main → Renderer） */
  OPTIMIZE_INTENT: 'agent:optimizeIntent'
} as const

// ==================== SDK 对齐类型 ====================

export type AIVendor = SdkAIVendor
export type AIProviderConfig = SdkAIProviderConfig
export type DeviceConnection = SdkDeviceConnection
export type ToolCategory = SdkToolCategory
export type ToolDefinition = SdkToolDefinition
export type ToolCall = SdkToolCall
export type ToolResult = SdkToolResult
export type ExecutionLogEntry = SdkExecutionLogEntry
export type WorkflowScript = SdkWorkflowScript
export type ExceptionHandler = SdkExceptionHandler
export type WorkflowStep = SdkWorkflowStep
export type WorkflowAction = SdkWorkflowAction
export type ChatMessage = SdkChatMessage
export type TaskPlan = SdkTaskPlan
export type TaskPlanSubtask = SdkTaskPlanSubtask
export type ReliabilityConfig = SdkReliabilityConfig
export type RuntimeDiagnosticsSummary = SdkRuntimeDiagnosticsSummary
export type McpServerConfig = SdkMcpServerConfig
export type AgentRuntimeOptions = SdkAgentRuntimeOptions
export type AgentStartParams = SdkAgentRuntimeStartParams
export type AgentResumeParams = SdkAgentRuntimeResumeParams
export type AgentPlanningData = SdkAgentPlanningData
export type AgentThinkingData = SdkAgentThinkingData
export type AgentToolCallData = SdkAgentToolCallData
export type AgentToolResultData = SdkAgentToolResultData
export type AgentDiagnosticData = SdkAgentDiagnosticData
export type AgentPausedData = SdkAgentPausedData
export type AgentScriptGeneratingData = SdkAgentScriptGeneratingData
export type AgentCompleteData = SdkAgentCompleteData
export type AgentErrorData = SdkAgentErrorData

/** 厂商默认配置映射 */
export const VENDOR_DEFAULTS: Record<AIVendor, { baseUrl: string; models: string[] }> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder']
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini']
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-7-sonnet-latest']
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-7-sonnet-latest']
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-1.5-pro', 'gemini-2.0-flash']
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-1.5-pro', 'gemini-2.0-flash']
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

// ==================== 辅助函数 ====================

/** 获取动作的可读描述文本 */
export function getActionDescription(action: WorkflowAction): string {
  const params = (action.params || {}) as Record<string, any>

  switch (action.path) {
    case 'base/sleep':
      return `等待 ${params.duration}ms`
    case 'permission/set':
      return `授权应用: ${params.package_name}`
    case 'activity/start_activity':
    case 'activity/start':
      return `启动应用: ${params.package_name}`
    case 'activity/stop':
      return `停止应用: ${params.package_name}`
    case 'accessibility/node': {
      const selector = params.selector
      const actionType = params.action as string | undefined
      const target =
        selector?.text ||
        selector?.resource_id ||
        selector?.content_desc ||
        selector?.class_name ||
        (typeof selector?.index === 'number' ? `index=${selector.index}` : undefined) ||
        'unknown'

      if (actionType === 'click') return `点击: ${target}`
      if (actionType === 'long_click') return `长按: ${target}`
      if (actionType === 'set_text') return `输入: ${params.action_params?.text || ''} → ${target}`
      if (actionType === 'scroll_forward') return `向前滚动: ${target}`
      if (actionType === 'scroll_backward') return `向后滚动: ${target}`
      return `查找节点: ${target}`
    }
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
        26: '电源',
        66: '回车'
      }
      const keyCode = params.key_code as number
      return `按键: ${keyNames[keyCode] || `KeyCode ${keyCode}`}`
    }
    case 'accessibility/dump':
      return '获取 UI 布局'
    case 'system/toast':
      return `弹提示: ${params.message}`
    default:
      return action.path
  }
}
