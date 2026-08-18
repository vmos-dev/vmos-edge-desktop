/**
 * Agent IPC 处理器
 *
 * 注册 Agent 相关的 IPC 事件处理。
 */

import { handle } from '../IpcBus'
import { logger } from '../../logger'
import { getAgentWorkerManager } from '../../workers/AgentWorkerManager'
import { AGENT_EVENTS } from '@shared/ipc/agent.types'
import { optimizeIntent } from '@vmosedge/workflow-agent-sdk/runtime'
import type {
  AIProviderConfig,
  AIVendor,
  AgentStartParams,
  AgentResumeParams
} from '@shared/ipc/agent.types'

function handleError(error: unknown): { success: false; error: string } {
  const errorMsg = (error as Error)?.message || String(error)
  return { success: false, error: errorMsg }
}

function normalizeAIVendor(vendor: string): AIVendor {
  const normalized = String(vendor || '')
    .trim()
    .toLowerCase()

  if (normalized.includes('deepseek')) return 'deepseek'
  if (normalized.includes('openai')) return 'openai'
  if (normalized.includes('anthropic') || normalized.includes('claude')) return 'anthropic'
  if (normalized.includes('google') || normalized.includes('gemini')) return 'google'
  if (normalized.includes('azure')) return 'azure'
  if (
    normalized.includes('custom') ||
    normalized.includes('other') ||
    normalized.includes('dashscope') ||
    normalized.includes('zhipu') ||
    normalized.includes('ollama')
  ) {
    return 'custom'
  }

  return 'custom'
}

function normalizeProviderConfig(provider: AIProviderConfig): AIProviderConfig {
  return {
    ...provider,
    vendor: normalizeAIVendor(String(provider.vendor)),
    baseUrl: provider.baseUrl?.trim() || undefined
  }
}

export function registerAgentHandlers(): void {
  const manager = getAgentWorkerManager()

  // 启动 Agent
  handle<AgentStartParams, { sessionId: string }>(AGENT_EVENTS.START, async (params) => {
    logger.info('[AgentHandler] START request:', {
      goal: params.goal.substring(0, 50),
      device: params.device.deviceId
    })

    try {
      const normalizedProvider = normalizeProviderConfig(params.provider)
      const result = await manager.start({
        ...params,
        provider: normalizedProvider
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      return { success: true, data: { sessionId: result.sessionId } }
    } catch (error) {
      logger.error('[AgentHandler] START error:', error)
      return handleError(error)
    }
  })

  // 停止 Agent
  handle<{ sessionId: string }, void>(AGENT_EVENTS.STOP, async ({ sessionId }) => {
    logger.info(`[AgentHandler] STOP: sessionId=${sessionId}`)
    try {
      const result = manager.stop()
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true }
    } catch (error) {
      logger.error('[AgentHandler] STOP error:', error)
      return handleError(error)
    }
  })

  // 新会话 - 清理后端状态
  handle<void, void>(AGENT_EVENTS.NEW_SESSION, async () => {
    logger.info('[AgentHandler] NEW_SESSION: cleaning backend state')
    try {
      await manager.newSession()
      return { success: true }
    } catch (error) {
      logger.error('[AgentHandler] NEW_SESSION error:', error)
      return handleError(error)
    }
  })

  // 用户回复后继续
  handle<AgentResumeParams, void>(AGENT_EVENTS.RESUME, async (params) => {
    logger.info(`[AgentHandler] RESUME: sessionId=${params.sessionId}`)
    try {
      const result = await manager.resume(params)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true }
    } catch (error) {
      logger.error('[AgentHandler] RESUME error:', error)
      return handleError(error)
    }
  })

  // 触发脚本生成（Phase 2）
  handle<{ sessionId: string }, void>(AGENT_EVENTS.GENERATE_SCRIPT, async ({ sessionId }) => {
    logger.info(`[AgentHandler] GENERATE_SCRIPT: sessionId=${sessionId}`)
    try {
      const result = await manager.generateScript(sessionId)
      if (!result.success) {
        return { success: false, error: result.error }
      }
      return { success: true }
    } catch (error) {
      logger.error('[AgentHandler] GENERATE_SCRIPT error:', error)
      return handleError(error)
    }
  })

  // 智能优化用户意图描述
  handle<{ input: string; provider: AIProviderConfig }, { optimizedText: string }>(
    AGENT_EVENTS.OPTIMIZE_INTENT,
    async ({ input, provider }) => {
      logger.info('[AgentHandler] OPTIMIZE_INTENT:', { input: input.substring(0, 50) })
      try {
        const optimizedText = await optimizeIntent(input, normalizeProviderConfig(provider))
        if (!optimizedText) {
          return { success: false, error: '优化结果为空' }
        }
        return { success: true, data: { optimizedText } }
      } catch (error) {
        logger.error('[AgentHandler] OPTIMIZE_INTENT error:', error)
        return handleError(error)
      }
    }
  )

  logger.info('[AgentHandler] ✅ Agent 处理器已注册')
}
