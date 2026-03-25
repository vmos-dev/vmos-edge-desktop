/**
 * Agent 会话 Hook
 *
 * 管理 Agent 的生命周期：启动、暂停、恢复、脚本生成。
 * 维护聊天消息列表（thinking、tool calls、results、text）。
 */

import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { AGENT_EVENTS } from '@shared/ipc/agent.types'
import { useI18n } from 'vue-i18n'
import type {
  AIProviderConfig,
  DeviceConnection,
  WorkflowScript,
  AgentPlanningData,
  AgentThinkingData,
  AgentToolCallData,
  AgentToolResultData,
  AgentDiagnosticData,
  AgentPausedData,
  AgentCompleteData,
  AgentErrorData,
  ToolCall,
  ToolResult
} from '@shared/ipc/agent.types'
import type { Device } from '@shared/ipc/data.types'

// ==================== 消息类型 ====================

export type AgentMessageType =
  | 'user'
  | 'planning'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'text'
  | 'system'
  | 'script_generating'
  | 'script_complete'

export interface AgentMessage {
  id: string
  type: AgentMessageType
  content: string
  timestamp: number
  /** thinking 消息：是否正在流式输出 */
  isStreaming?: boolean
  /** tool_call 消息 */
  toolCall?: ToolCall
  /** tool_result 消息 */
  toolResult?: ToolResult
  /** script_complete 消息 */
  workflow?: WorkflowScript
  /** planning 消息 */
  planningStatus?: AgentPlanningData['status']
  /** planning 消息 */
  plan?: AgentPlanningData['plan']
  /** 迭代次数 */
  iteration?: number
  /** 是否出错 */
  isError?: boolean
}

// ==================== Hook ====================

export function useAgentSession(props: { provider?: AIProviderConfig; device?: Device | null }) {
  const { t } = useI18n()

  const messages = ref<AgentMessage[]>([])
  const isRunning = ref(false)
  const isPaused = ref(false)
  const isGeneratingScript = ref(false)
  const sessionId = ref<string | null>(null)
  const currentWorkflow = ref<WorkflowScript | null>(null)

  const hasProvider = computed(() => !!props.provider?.apiKey)
  const hasDevice = computed(() => !!props.device)

  let msgCounter = 0
  const nextMsgId = () => `msg_${++msgCounter}`

  // ==================== 辅助 ====================

  function getDeviceConnection(): DeviceConnection | null {
    if (!props.device) return null
    return {
      hostIp: props.device.host_ip || '',
      deviceId: props.device.id
    }
  }

  function addMessage(msg: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
    const message: AgentMessage = {
      ...msg,
      id: nextMsgId(),
      timestamp: Date.now()
    }
    messages.value.push(message)
    return message
  }

  function isCurrentSession(data?: { sessionId: string } | null): boolean {
    return !!data && !!sessionId.value && data.sessionId === sessionId.value
  }

  function formatPlanningMessage(data: AgentPlanningData): string {
    if (data.status === 'started') {
      return t('automation.session.planningStarted')
    }

    return t('automation.session.planningCompleted', {
      count: data.plan?.subtasks.length ?? 0
    })
  }

  /** 格式化工具调用参数为可读文本 */
  function formatToolCallArgs(toolCall: ToolCall): string {
    const args = toolCall.arguments
    if (!args || Object.keys(args).length === 0) return ''

    // 针对常见工具的简化显示
    switch (toolCall.name) {
      case 'start_app':
      case 'stop_app':
        return (args.package_name as string) || ''
      case 'tap':
        return `(${args.x}, ${args.y})`
      case 'tap_element':
      case 'long_press_element': {
        const sel = args.selector as Record<string, string> | undefined
        if (sel?.resource_id) return sel.resource_id
        if (sel?.text) return sel.text
        if (sel?.content_desc) return sel.content_desc
        return JSON.stringify(sel || {})
      }
      case 'set_text':
        return `"${args.text}"`
      case 'input_text':
        return `"${args.text}"`
      case 'swipe':
        return `(${args.start_x},${args.start_y}) → (${args.end_x},${args.end_y})`
      case 'press_key': {
        const keyNames: Record<number, string> = {
          3: 'Home',
          4: 'Back',
          24: 'Vol+',
          25: 'Vol-',
          26: 'Power',
          66: 'Enter'
        }
        return keyNames[args.key_code as number] || `KeyCode ${args.key_code}`
      }
      case 'wait':
        return `${args.duration}ms`
      default:
        return JSON.stringify(args).substring(0, 100)
    }
  }

  /** 格式化工具结果为可读摘要 */
  function formatToolResultSummary(result: ToolResult): string {
    if (!result.success) {
      return t('automation.session.toolFailed', { error: result.error || t('common.unknownError') })
    }

    const data = result.data
    if (data === true || data === undefined) return t('automation.session.toolSuccess')
    if (typeof data === 'string') {
      return data.length > 100
        ? t('automation.session.toolResultEllipsis', { text: data.substring(0, 100) })
        : data
    }
    const str = JSON.stringify(data)
    return str.length > 100
      ? t('automation.session.toolResultEllipsis', { text: str.substring(0, 100) })
      : str
  }

  // ==================== 操作方法 ====================

  /** 启动 Agent */
  async function startAgent(goal: string): Promise<void> {
    if (!goal.trim() || isRunning.value) return
    if (!hasProvider.value) {
      ElMessage.warning(t('automation.session.noProvider'))
      return
    }

    const device = getDeviceConnection()
    if (!device) {
      ElMessage.warning(t('automation.session.noDevice'))
      return
    }

    // 重置状态
    isRunning.value = true
    isPaused.value = false
    isGeneratingScript.value = false
    currentWorkflow.value = null

    const nextSessionId = crypto.randomUUID()
    sessionId.value = nextSessionId

    // 添加用户消息
    addMessage({ type: 'user', content: goal })

    try {
      const result = await ipc.invoke<{ sessionId: string }>(AGENT_EVENTS.START, {
        goal,
        provider: props.provider,
        device,
        sessionId: nextSessionId,
        reliability: {
          limits: {
            maxIterations: 100
          }
        }
      })

      if (!result.success) throw new Error(result.error || t('automation.session.startAgentFailed'))
      if (result.data?.sessionId) {
        sessionId.value = result.data.sessionId
      }
    } catch (error: any) {
      isRunning.value = false
      sessionId.value = null
      addMessage({
        type: 'text',
        content: error.message || t('automation.session.startFailed'),
        isError: true
      })
    }
  }

  /** 发送消息（新会话或恢复暂停的 Agent） */
  async function sendMessage(input: string): Promise<void> {
    if (!input.trim()) return

    if (!sessionId.value) {
      // 新会话
      await startAgent(input)
    } else if (isPaused.value) {
      // 恢复暂停的 Agent
      addMessage({ type: 'user', content: input })
      isRunning.value = true
      isPaused.value = false

      try {
        const result = await ipc.invoke(AGENT_EVENTS.RESUME, {
          sessionId: sessionId.value,
          message: input
        })
        if (!result.success)
          throw new Error(result.error || t('automation.session.resumeAgentFailed'))
      } catch (error: any) {
        isRunning.value = false
        isPaused.value = true
        addMessage({
          type: 'text',
          content: error.message || t('automation.session.resumeFailed'),
          isError: true
        })
      }
    } else if (!isRunning.value) {
      // 会话已结束或异常后，自动开启新会话（保留当前聊天记录）
      await startAgent(input)
    }
  }

  /** 停止 Agent */
  async function stopAgent(): Promise<void> {
    if (sessionId.value) {
      await ipc.invoke(AGENT_EVENTS.STOP, { sessionId: sessionId.value })
    }
    isRunning.value = false
    isPaused.value = false
    addMessage({ type: 'system', content: t('automation.session.stopped') })
  }

  /** 触发脚本生成（Phase 2） */
  async function generateScript(): Promise<void> {
    if (!sessionId.value || isRunning.value || isGeneratingScript.value) return

    isGeneratingScript.value = true
    addMessage({ type: 'script_generating', content: t('automation.session.generatingScript') })

    try {
      const result = await ipc.invoke(AGENT_EVENTS.GENERATE_SCRIPT, {
        sessionId: sessionId.value
      })
      if (!result.success)
        throw new Error(result.error || t('automation.session.generateScriptFailed'))
    } catch (error: any) {
      isGeneratingScript.value = false
      addMessage({
        type: 'text',
        content: error.message || t('automation.session.generateScriptFailed'),
        isError: true
      })
    }
  }

  /** 新会话 */
  function newSession(): void {
    // 先停止当前运行的 Agent
    if (sessionId.value && isRunning.value) {
      ipc.invoke(AGENT_EVENTS.STOP, { sessionId: sessionId.value })
    }

    // 通知后端清理状态（销毁 Worker）
    ipc.invoke(AGENT_EVENTS.NEW_SESSION)

    // 清理前端状态
    sessionId.value = null
    messages.value = []
    isRunning.value = false
    isPaused.value = false
    isGeneratingScript.value = false
    currentWorkflow.value = null
    msgCounter = 0

    ElMessage.success(t('automation.session.newSessionSuccess'))
  }

  // ==================== IPC 事件监听 ====================

  let cleanup: Array<() => void> = []

  function setupListeners(onWorkflowComplete?: (workflow: WorkflowScript) => void): void {
    cleanup.forEach((c) => c())
    cleanup = []

    cleanup.push(
      ipc.on<AgentPlanningData>(AGENT_EVENTS.PLANNING, (data) => {
        if (!isCurrentSession(data)) return

        const content = formatPlanningMessage(data)
        const previousPlanningMessage = [...messages.value]
          .reverse()
          .find((message) => message.type === 'planning' && message.planningStatus === 'started')

        if (data.status === 'completed' && previousPlanningMessage) {
          previousPlanningMessage.content = content
          previousPlanningMessage.planningStatus = 'completed'
          previousPlanningMessage.plan = data.plan
          return
        }

        addMessage({
          type: 'planning',
          content,
          planningStatus: data.status,
          plan: data.plan
        })
      })
    )

    // Agent 思考
    cleanup.push(
      ipc.on<AgentThinkingData>(AGENT_EVENTS.THINKING, (data) => {
        if (!isCurrentSession(data)) return
        addMessage({
          type: 'thinking',
          content: data.text,
          iteration: data.iteration
        })
      })
    )

    // 工具调用
    cleanup.push(
      ipc.on<AgentToolCallData>(AGENT_EVENTS.TOOL_CALL, (data) => {
        if (!isCurrentSession(data)) return
        addMessage({
          type: 'tool_call',
          content: `${data.toolCall.name}(${formatToolCallArgs(data.toolCall)})`,
          toolCall: data.toolCall,
          iteration: data.iteration
        })
      })
    )

    // 工具结果
    cleanup.push(
      ipc.on<AgentToolResultData>(AGENT_EVENTS.TOOL_RESULT, (data) => {
        if (!isCurrentSession(data)) return
        addMessage({
          type: 'tool_result',
          content: formatToolResultSummary(data.result),
          toolResult: data.result,
          iteration: data.iteration,
          isError: !data.result.success
        })
      })
    )

    // Agent 暂停
    cleanup.push(
      ipc.on<AgentPausedData>(AGENT_EVENTS.PAUSED, (data) => {
        if (!isCurrentSession(data)) return
        isRunning.value = false
        isPaused.value = true

        if (data.text?.trim()) {
          addMessage({
            type: 'text',
            content: data.text,
            iteration: data.iteration
          })
        }
      })
    )

    cleanup.push(
      ipc.on<AgentDiagnosticData>(AGENT_EVENTS.DIAGNOSTIC, (data) => {
        if (!isCurrentSession(data)) return
        addMessage({
          type: 'system',
          content: `[${data.phase}] ${data.message}`,
          iteration: data.iteration
        })
      })
    )

    // Phase 2 生成中
    cleanup.push(
      ipc.on<{ sessionId: string }>(AGENT_EVENTS.SCRIPT_GENERATING, (data) => {
        if (!isCurrentSession(data)) return
        isGeneratingScript.value = true
      })
    )

    // 全部完成
    cleanup.push(
      ipc.on<AgentCompleteData>(AGENT_EVENTS.COMPLETE, (data) => {
        if (!isCurrentSession(data)) return
        isRunning.value = false
        // 脚本生成完成后允许继续输入，沿用同一会话上下文
        isPaused.value = true
        isGeneratingScript.value = false
        currentWorkflow.value = data.workflow

        // 移除 script_generating 转圈消息
        messages.value = messages.value.filter((m) => m.type !== 'script_generating')

        addMessage({
          type: 'script_complete',
          content: t('automation.session.scriptGenerated', {
            steps: data.workflow.flow.length,
            iterations: data.totalIterations
          }),
          workflow: data.workflow
        })

        onWorkflowComplete?.(data.workflow)
      })
    )

    // 错误
    cleanup.push(
      ipc.on<AgentErrorData>(AGENT_EVENTS.ERROR, (data) => {
        if (!isCurrentSession(data)) return
        isRunning.value = false
        isGeneratingScript.value = false

        // 移除 script_generating 转圈消息（如果有的话）
        messages.value = messages.value.filter((m) => m.type !== 'script_generating')

        addMessage({
          type: 'text',
          content: data.error || t('automation.session.unknownError'),
          isError: true
        })
      })
    )
  }

  function cleanupListeners(): void {
    cleanup.forEach((c) => c())
    cleanup = []
  }

  return {
    messages,
    isRunning,
    isPaused,
    isGeneratingScript,
    sessionId,
    currentWorkflow,
    hasProvider,
    hasDevice,
    sendMessage,
    stopAgent,
    generateScript,
    newSession,
    setupListeners,
    cleanupListeners,
    formatToolCallArgs,
    formatToolResultSummary
  }
}
