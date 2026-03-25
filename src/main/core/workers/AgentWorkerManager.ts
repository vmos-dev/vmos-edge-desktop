/**
 * Agent Runtime Manager
 *
 * 保留旧命名以兼容现有调用点，内部实现已切换为
 * @vmosedge/workflow-agent-sdk 的 runtime。
 */

import { v4 as uuidv4 } from 'uuid'
import {
  createAutomationAgentRuntime,
  type AutomationAgentRuntime
} from '@vmosedge/workflow-agent-sdk/runtime'
import { logger } from '../logger'
import { broadcast } from '../ipc/IpcBus'
import { AGENT_EVENTS } from '@shared/ipc/agent.types'
import type {
  AgentCompleteData,
  AgentDiagnosticData,
  AgentErrorData,
  AgentPausedData,
  AgentPlanningData,
  AgentScriptGeneratingData,
  AgentStartParams,
  AgentThinkingData,
  AgentToolCallData,
  AgentToolResultData
} from '@shared/ipc/agent.types'

type StartResult = { success: true; sessionId: string } | { success: false; error: string }
type BasicResult = { success: true } | { success: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeError(sessionId: string, error: unknown): AgentErrorData {
  if (error instanceof Error) {
    const errorRecord = error as Error & { code?: unknown; details?: unknown }
    return {
      sessionId,
      error: error.message || String(error),
      ...(typeof errorRecord.code === 'string'
        ? { code: errorRecord.code as AgentErrorData['code'] }
        : {}),
      ...(isRecord(errorRecord.details) ? { details: errorRecord.details } : {})
    }
  }

  if (isRecord(error)) {
    return {
      sessionId,
      error: typeof error.message === 'string' ? error.message : String(error),
      ...(typeof error.code === 'string' ? { code: error.code as AgentErrorData['code'] } : {}),
      ...(isRecord(error.details) ? { details: error.details } : {})
    }
  }

  return { sessionId, error: String(error) }
}

export class AgentWorkerManager {
  private runtime: AutomationAgentRuntime | null = null
  private sessionId: string | null = null
  private isRunning = false
  private isPaused = false

  private ensureRuntime(): AutomationAgentRuntime {
    if (this.runtime) return this.runtime

    const runtime = createAutomationAgentRuntime({
      persistence: {
        mode: 'sqlite'
      }
    })

    runtime.on('planning', (data) => {
      this.broadcastEvent<AgentPlanningData>(AGENT_EVENTS.PLANNING, data)
    })

    runtime.on('thinking', (data) => {
      this.broadcastEvent<AgentThinkingData>(AGENT_EVENTS.THINKING, data)
    })

    runtime.on('toolcall', (data) => {
      this.broadcastEvent<AgentToolCallData>(AGENT_EVENTS.TOOL_CALL, data)
    })

    runtime.on('toolresult', (data) => {
      this.broadcastEvent<AgentToolResultData>(AGENT_EVENTS.TOOL_RESULT, data)
    })

    runtime.on('diagnostic', (data) => {
      this.broadcastEvent<AgentDiagnosticData>(AGENT_EVENTS.DIAGNOSTIC, data)
    })

    runtime.on('paused', (data) => {
      this.isRunning = false
      this.isPaused = true
      this.broadcastEvent<AgentPausedData>(AGENT_EVENTS.PAUSED, data)
    })

    runtime.on('scriptgenerating', (data) => {
      this.broadcastEvent<AgentScriptGeneratingData>(AGENT_EVENTS.SCRIPT_GENERATING, data)
    })

    runtime.on('complete', (data) => {
      this.isRunning = false
      this.isPaused = true
      this.broadcastEvent<AgentCompleteData>(AGENT_EVENTS.COMPLETE, data)
    })

    runtime.on('error', (data) => {
      this.isRunning = false
      this.broadcastEvent<AgentErrorData>(AGENT_EVENTS.ERROR, data)
    })

    this.runtime = runtime
    return runtime
  }

  private broadcastEvent<T>(event: string, data: T): void {
    broadcast(event, JSON.parse(JSON.stringify(data)))
  }

  private async resetRuntime(): Promise<void> {
    if (!this.runtime) return

    const runtime = this.runtime
    this.runtime = null
    this.isRunning = false
    this.isPaused = false

    try {
      await runtime.destroy()
    } catch (error) {
      logger.error('[AgentWorkerManager] Failed to destroy runtime:', error)
    }
  }

  private handleAsyncError(sessionId: string, error: unknown): void {
    if (this.sessionId !== sessionId) {
      return
    }

    this.isRunning = false
    const payload = normalizeError(sessionId, error)
    this.broadcastEvent<AgentErrorData>(AGENT_EVENTS.ERROR, payload)
  }

  public async start(params: AgentStartParams): Promise<StartResult> {
    try {
      if (this.runtime || this.sessionId) {
        await this.resetRuntime()
      }

      const sessionId = params.sessionId || uuidv4()
      this.sessionId = sessionId
      this.isRunning = true
      this.isPaused = false

      const runtime = this.ensureRuntime()
      void runtime
        .start({
          ...params,
          sessionId
        })
        .catch((error) => {
          this.handleAsyncError(sessionId, error)
        })

      return { success: true, sessionId }
    } catch (error) {
      logger.error('[AgentWorkerManager] START error:', error)
      return { success: false, error: normalizeError('unknown', error).error }
    }
  }

  public async resume(params: {
    sessionId: string
    message: string
  }): Promise<BasicResult> {
    if (params.sessionId !== this.sessionId) {
      return { success: false, error: '会话不存在或已过期' }
    }

    if (!this.isPaused) {
      return { success: false, error: 'Agent 未暂停' }
    }

    const runtime = this.ensureRuntime()
    this.isRunning = true
    this.isPaused = false

    void runtime.resume(params).catch((error) => {
      this.handleAsyncError(params.sessionId, error)
    })

    return { success: true }
  }

  public async generateScript(sessionId: string): Promise<BasicResult> {
    if (sessionId !== this.sessionId) {
      return { success: false, error: '会话不存在或已过期' }
    }

    if (this.isRunning) {
      return { success: false, error: 'Agent 仍在运行' }
    }

    const runtime = this.ensureRuntime()
    void runtime.generateScript(sessionId).catch((error) => {
      this.handleAsyncError(sessionId, error)
    })

    return { success: true }
  }

  public stop(): BasicResult {
    if (this.runtime && this.sessionId) {
      this.runtime.stop(this.sessionId)
    }

    this.isRunning = false
    this.isPaused = false
    return { success: true }
  }

  public async newSession(): Promise<void> {
    this.stop()
    this.sessionId = null
    await this.resetRuntime()
  }

  public async destroy(): Promise<void> {
    this.stop()
    this.sessionId = null
    await this.resetRuntime()
  }
}

let instance: AgentWorkerManager | null = null

export function getAgentWorkerManager(): AgentWorkerManager {
  if (!instance) {
    instance = new AgentWorkerManager()
  }
  return instance
}

export async function destroyAgentWorkerManager(): Promise<void> {
  if (!instance) return
  await instance.destroy()
  instance = null
}
