/**
 * AI 对话 UI 类型定义
 */

// ===== 翻译函数 =====
export type TranslateFn = (key: string, params?: Record<string, any>) => string

// ===== 消息模型 =====

/** 消息类型（字符串，可扩展） */
export type MessageType = string

/** 内置消息类型常量 */
export const MESSAGE_TYPES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  THINKING: 'thinking',
  TOOL_CALL: 'tool_call',
  TOOL_GROUP: 'tool_group',
  TURN_DIVIDER: 'turn_divider',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const

/** 工具调用状态 */
export type ToolCallStatus = 'loading' | 'ok' | 'fail'

/** 通用消息接口 */
export interface ChatMessage {
  type: MessageType
  content: string
  [key: string]: any
}

/** 工具调用消息 */
export interface ToolCallMessage extends ChatMessage {
  type: 'tool_call'
  toolCallId: string
  toolName: string
  arguments: string
  status: ToolCallStatus
  result: string
  fullResult: string
}

/** 工具调用分组（展示层生成） */
export interface ToolGroupMessage {
  type: 'tool_group'
  groupId: string
  tools: ToolCallMessage[]
}

/** 展示消息 */
export type DisplayMessage = ChatMessage | ToolGroupMessage

/** 快捷操作 */
export interface QuickAction {
  icon: string
  title: string
  desc: string
  prompt: string
}
