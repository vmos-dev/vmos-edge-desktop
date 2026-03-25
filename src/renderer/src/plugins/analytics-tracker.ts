/**
 * 集中式埋点追踪器
 *
 * 通过 AOP 拦截 ipc.invoke / ipc.send / ipc.on / fetch / request 成功回调，
 * 在操作成功后自动上报对应的 analytics 事件。
 * 业务代码无需感知 analytics，实现完全解耦。
 *
 * 所有埋点代码均包裹在 try-catch 中，确保不会影响业务功能。
 * 新增埋点只需在映射表中加一行。
 */
import * as ipcModule from '@renderer/core/ipc'
import { request } from '@shared/api'
import type { Analytics } from '@vmosedge/analytics-sdk'
import {
  DEVICE_EVENTS,
  BATCH_EVENTS,
  PHONE_EVENTS,
  RESOURCE_EVENTS,
  SETTINGS_EVENTS,
  GROUP_EVENTS
} from '@vmosedge/analytics-sdk'

const WORKFLOW_TRACKING_EVENTS = {
  GENERATE: 'workflow_generate',
  EXECUTE: 'workflow_execute',
  SAVE: 'workflow_save',
  OPTIMIZE_INTENT: 'workflow_optimize_intent',
  AGENT_START: 'workflow_agent_start',
  AGENT_RESUME: 'workflow_agent_resume',
  AGENT_STOP: 'workflow_agent_stop',
  AGENT_COMPLETE: 'workflow_agent_complete',
  AGENT_ERROR: 'workflow_agent_error',
  AGENT_NEW_SESSION: 'workflow_agent_new_session'
} as const

const AI_AGENT_TRACKING_EVENTS = {
  TASK_RUN: 'ai_agent_task_run',
  TASK_STOP: 'ai_agent_task_stop',
  TASK_DELETE: 'ai_agent_task_delete',
  CONFIG_SAVE: 'ai_agent_config_save'
} as const

const AI_ASSISTANT_TRACKING_EVENTS = {
  CHAT: 'ai_assistant_chat'
} as const

interface AgentSessionContext {
  modelProvider: string
  deviceId: string
  startedAt: number
}

/** 安全上报：捕获所有异常，绝不影响业务 */
function safeTrack(analytics: Analytics, event: string, params: Record<string, unknown>): void {
  try {
    analytics.rawTrack(event, params)
  } catch (e) {
    console.warn('[analytics] track error:', event, e)
  }
}

function getModelProvider(provider: unknown): string {
  if (typeof provider === 'string') return provider

  if (provider && typeof provider === 'object') {
    const vendor = (provider as Record<string, unknown>).vendor
    if (typeof vendor === 'string') return vendor
  }

  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function getDeviceId(device: unknown): string {
  if (!isRecord(device)) return ''

  return (
    readString(device.deviceId) || readString(device.id) || readString(device.db_id) || ''
  )
}

function getWorkflowStepCount(workflow: unknown): number {
  if (!isRecord(workflow)) return 0
  return Array.isArray(workflow.flow) ? workflow.flow.length : 0
}

function getDeviceIdFromUrl(url: string): string {
  const match = url.match(/\/android_api\/v2\/([^/]+)\//)
  return match?.[1] || ''
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function getFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return isRecord(input) ? readString(input.url) : ''
}

function getRequestBody(init?: RequestInit): unknown {
  const body = init?.body

  if (typeof body === 'string') {
    return parseJsonText(body)
  }

  if (body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries())
  }

  return undefined
}

async function getTrackedResponsePayload(
  response: Response | { ok: boolean; clone?: () => any; headers?: { get?: (name: string) => string | null } }
): Promise<unknown | null> {
  if (!response.ok) return null

  const clone = typeof response.clone === 'function' ? response.clone() : response
  const contentType = clone.headers?.get?.('content-type') || ''

  let raw: unknown
  if (contentType.includes('application/json') && typeof (clone as Response).json === 'function') {
    raw = await (clone as Response).json()
  } else if (typeof (clone as Response).text === 'function') {
    raw = parseJsonText(await (clone as Response).text())
  } else {
    return {}
  }

  if (isRecord(raw) && raw.code !== undefined && Number(raw.code) !== 200) {
    return null
  }

  return raw
}

// ==================== IPC invoke 事件映射 ====================

const ipcTrackingMap: Record<
  string,
  {
    event: string
    params: (payload?: unknown, result?: unknown) => Record<string, unknown>
  }
> = {
  // 云手机操作
  'DATA:DEVICE_STARTED': {
    event: DEVICE_EVENTS.START,
    params: (payload) => {
      const devices = Array.isArray(payload) ? payload : []
      return { device_count: devices.length, is_batch: devices.length > 1 }
    }
  },
  'DATA:DEVICE_SHUTDOWNED': {
    event: DEVICE_EVENTS.SHUTDOWN,
    params: (payload) => {
      const devices = Array.isArray(payload) ? payload : []
      return { device_count: devices.length, is_batch: devices.length > 1 }
    }
  },
  'DATA:DEVICE_RESTARTED': {
    event: DEVICE_EVENTS.RESTART,
    params: (payload) => {
      const devices = Array.isArray(payload) ? payload : []
      return { device_count: devices.length, is_batch: devices.length > 1 }
    }
  },
  'DATA:DEVICE_DELETED': {
    event: DEVICE_EVENTS.DELETE,
    params: (payload) => {
      const devices = Array.isArray(payload) ? payload : []
      return { device_count: devices.length, is_batch: devices.length > 1 }
    }
  },
  'DATA:DEVICE_RESETED': {
    event: DEVICE_EVENTS.RESET,
    params: () => ({})
  },
  'DATA:UPDATE_DEVICE_NAME': {
    event: DEVICE_EVENTS.RENAME,
    params: () => ({})
  },
  'DATA:RENEW_DEVICE': {
    event: DEVICE_EVENTS.BACKUP,
    params: (payload) => {
      const data = payload as Record<string, unknown> | undefined
      const devices = (data?.devices as unknown[]) || []
      return { device_count: devices.length }
    }
  },

  // 主机操作
  'DATA:ADD_HOST': {
    event: RESOURCE_EVENTS.HOST_ADD,
    params: () => ({})
  },
  'DATA:RESTART_HOST': {
    event: RESOURCE_EVENTS.HOST_RESTART,
    params: () => ({})
  },

  // 镜像操作
  'IMAGES:DELETE_IMAGE': {
    event: RESOURCE_EVENTS.IMAGE_DELETE,
    params: () => ({})
  },
  'IMAGES:UPLOAD_IMAGE_TO_HOST': {
    event: RESOURCE_EVENTS.IMAGE_UPLOAD_TO_HOST,
    params: () => ({ host_count: 1 })
  },

  // 代理操作
  'PROXY:ADD_PROXY': {
    event: RESOURCE_EVENTS.PROXY_ADD,
    params: (payload) => {
      const data = payload as Record<string, unknown> | undefined
      return { protocol: data?.protocol || 'http' }
    }
  },
  'PROXY:BATCH_ADD_PROXY': {
    event: RESOURCE_EVENTS.PROXY_IMPORT,
    params: (payload) => {
      const proxies = Array.isArray(payload) ? payload : []
      return { count: proxies.length }
    }
  },
  'PROXY:DELETE_PROXY': {
    event: RESOURCE_EVENTS.PROXY_DELETE,
    params: () => ({ count: 1 })
  },
  'PROXY:CHECK_PROXY': {
    event: RESOURCE_EVENTS.PROXY_CHECK,
    params: (_payload, result) => {
      const data = result as Record<string, unknown> | undefined
      return { protocol: data?.protocol || '', success: !!data?.valid }
    }
  },

  // 分组操作
  'DATA:ADD_GROUP': {
    event: GROUP_EVENTS.CREATE,
    params: () => ({})
  },
  'DATA:DELETE_GROUP': {
    event: GROUP_EVENTS.DELETE,
    params: () => ({ device_count: 0 })
  },
  'DATA:DEVICES_MOVED': {
    event: GROUP_EVENTS.MOVE_DEVICE,
    params: (payload) => {
      const data = payload as Record<string, unknown> | undefined
      const devices = (data?.deviceIds as unknown[]) || []
      return { device_count: devices.length }
    }
  },

  // ADI 模板
  'ADI:IMPORT_CUSTOM_ADI': {
    event: RESOURCE_EVENTS.ADI_IMPORT,
    params: () => ({})
  },
  'ADI:UPLOAD_ADI_TO_HOST': {
    event: RESOURCE_EVENTS.ADI_UPLOAD_TO_HOST,
    params: () => ({ host_count: 1 })
  },

  // AI 工作流 - 生成脚本
  'agent:generateScript': {
    event: WORKFLOW_TRACKING_EVENTS.GENERATE,
    params: () => ({ model_provider: '', step_count: 0 })
  },

  // AI 工作流 - 保存脚本
  'automationScript:saveScript': {
    event: WORKFLOW_TRACKING_EVENTS.SAVE,
    params: (payload) => {
      const data = payload as Record<string, unknown> | undefined
      return { step_count: getWorkflowStepCount(data?.workflow) }
    }
  },

  // 设置（动态分发，event 为空，走 configTrackingMap）
  'CONFIG:SET_CONFIG': {
    event: '',
    params: () => ({})
  }
}

// CONFIG key -> analytics 事件映射
const configTrackingMap: Record<
  string,
  { event: string; params: (value: unknown) => Record<string, unknown> }
> = {
  'theme.mode': {
    event: SETTINGS_EVENTS.THEME_CHANGE,
    params: (value) => ({ mode: value as string, color: '' })
  },
  'theme.color': {
    event: SETTINGS_EVENTS.THEME_CHANGE,
    params: (value) => ({ mode: '', color: value as string })
  },
  'app.language': {
    event: SETTINGS_EVENTS.LOCALE_CHANGE,
    params: (value) => ({ locale: value as string })
  }
}

// ==================== HTTP API 路径映射 ====================
// 匹配 URL 中包含的路径片段 -> analytics 事件

const apiTrackingMap: {
  pattern: string
  event: string
  params: (ctx: { url: string; data?: unknown; response?: unknown }) => Record<string, unknown>
}[] = [
  // 创建设备
  {
    pattern: '/container_api/v1/create',
    event: DEVICE_EVENTS.CREATE,
    params: (ctx) => {
      const data = ctx.data as Record<string, unknown> | undefined
      return {
        host_id: data?.hostId || '',
        image_version: data?.imageVersion || '',
        count: (data?.count as number) || 1
      }
    }
  },
  // 批量安装应用
  {
    pattern: '/upload_file_android_batch',
    event: BATCH_EVENTS.INSTALL,
    params: () => ({ device_count: 1, file_count: 1 })
  },
  // 单个安装应用
  {
    pattern: '/upload_file_android_upload',
    event: PHONE_EVENTS.APP_INSTALL,
    params: () => ({ file_type: 'apk' })
  },
  // 克隆设备
  {
    pattern: '/clone',
    event: DEVICE_EVENTS.CLONE,
    params: (ctx) => {
      const data = ctx.data as Record<string, unknown> | undefined
      return { clone_count: (data?.count as number) || 1 }
    }
  },
  // 设置代理
  {
    pattern: '/proxy_set',
    event: BATCH_EVENTS.PROXY_SET,
    params: () => ({ device_count: 1 })
  },
  // 修改定位
  {
    pattern: '/gps_inject',
    event: BATCH_EVENTS.LOCATION_SET,
    params: () => ({ device_count: 1 })
  },
  // 修改系统属性
  {
    pattern: '/update_user_prop',
    event: BATCH_EVENTS.UPLOAD,
    params: () => ({ device_count: 1 })
  },
  // 执行命令
  {
    pattern: '/shell',
    event: BATCH_EVENTS.SCRIPT_EXEC,
    params: () => ({ device_count: 1 })
  },
  // 设置时区
  {
    pattern: '/timezone_set',
    event: BATCH_EVENTS.TIMEZONE_SET,
    params: () => ({ device_count: 1 })
  },
  // 修改镜像
  {
    pattern: '/upgrade_image',
    event: RESOURCE_EVENTS.IMAGE_IMPORT,
    params: () => ({ android_version: '', source: 'custom' })
  },
  // 导入镜像到主机
  {
    pattern: '/import_image',
    event: RESOURCE_EVENTS.IMAGE_IMPORT,
    params: () => ({ android_version: '', source: 'custom' })
  },
  // 升级内核
  {
    pattern: '/update_kernel',
    event: RESOURCE_EVENTS.HOST_UPGRADE,
    params: () => ({ upgrade_type: 'kernel' })
  },
  // 升级 CBS
  {
    pattern: '/update_cbs',
    event: RESOURCE_EVENTS.HOST_UPGRADE,
    params: () => ({ upgrade_type: 'cbs' })
  },
  // 备份导出
  {
    pattern: '/backup/export',
    event: RESOURCE_EVENTS.BACKUP_EXPORT,
    params: () => ({ device_count: 1 })
  },
  // 备份导入
  {
    pattern: '/backup/import',
    event: RESOURCE_EVENTS.BACKUP_IMPORT,
    params: () => ({})
  },
  // 导入 ADI 到主机
  {
    pattern: '/v1/import_adi',
    event: RESOURCE_EVENTS.ADI_UPLOAD_TO_HOST,
    params: () => ({ host_count: 1 })
  },
  // workflow 执行
  {
    pattern: '/workflow/execute',
    event: WORKFLOW_TRACKING_EVENTS.EXECUTE,
    params: (ctx) => ({ step_count: getWorkflowStepCount(ctx.data), loop_count: 1 })
  },
  // workflow 取消（关闭脚本）
  {
    pattern: '/workflow/cancel',
    event: BATCH_EVENTS.SCRIPT_CLOSE,
    params: () => ({ device_count: 1 })
  }
]

const fetchTrackingMap: {
  pattern: string
  event: string
  params: (ctx: { url: string; body?: unknown; response?: unknown }) => Record<string, unknown>
}[] = [
  {
    pattern: '/workflow/execute',
    event: WORKFLOW_TRACKING_EVENTS.EXECUTE,
    params: (ctx) => ({
      step_count: getWorkflowStepCount(ctx.body),
      loop_count: 1,
      device_id: getDeviceIdFromUrl(ctx.url)
    })
  },
  {
    pattern: '/workflow/cancel',
    event: BATCH_EVENTS.SCRIPT_CLOSE,
    params: (ctx) => ({ device_count: 1, device_id: getDeviceIdFromUrl(ctx.url) })
  },
  {
    pattern: '/ai_agent/task_run',
    event: AI_AGENT_TRACKING_EVENTS.TASK_RUN,
    params: (ctx) => {
      const body = ctx.body as Record<string, unknown> | undefined
      return {
        input_length: readString(body?.content).length,
        device_id: getDeviceIdFromUrl(ctx.url)
      }
    }
  },
  {
    pattern: '/ai_agent/task_stop',
    event: AI_AGENT_TRACKING_EVENTS.TASK_STOP,
    params: (ctx) => {
      const body = ctx.body as Record<string, unknown> | undefined
      return {
        task_id: readString(body?.task_id),
        device_id: getDeviceIdFromUrl(ctx.url),
        entry: 'ai_agent'
      }
    }
  },
  {
    pattern: '/ai_agent/task_delete',
    event: AI_AGENT_TRACKING_EVENTS.TASK_DELETE,
    params: (ctx) => {
      const body = ctx.body as Record<string, unknown> | undefined
      return {
        task_id: readString(body?.task_id),
        device_id: getDeviceIdFromUrl(ctx.url)
      }
    }
  },
  {
    pattern: '/ai_agent/config_set',
    event: AI_AGENT_TRACKING_EVENTS.CONFIG_SAVE,
    params: (ctx) => {
      const body = ctx.body as Record<string, unknown> | undefined
      return {
        model_provider: getModelProvider(body?.provider),
        model: readString(body?.model),
        max_turns: readNumber(body?.max_turns) ?? 0,
        device_id: getDeviceIdFromUrl(ctx.url)
      }
    }
  }
]

// ==================== IPC on 事件映射（主进程推送） ====================

const ipcOnTrackingMap: Record<
  string,
  {
    event: string
    params: (data?: unknown) => Record<string, unknown>
  }
> = {
  // AI Agent 完成
  // AgentCompleteData: { sessionId, workflow, executionLog, totalIterations, diagnostics? }
  'agent:complete': {
    event: WORKFLOW_TRACKING_EVENTS.AGENT_COMPLETE,
    params: (data) => {
      const d = data as Record<string, unknown> | undefined
      const workflow = d?.workflow as Record<string, unknown> | undefined
      const flow = (workflow?.flow as unknown[]) || []
      return {
        duration_ms: 0,
        step_count: flow.length,
        success: true
      }
    }
  },
  // AI Agent 错误
  // AgentErrorData: { sessionId, error, code?, details? }
  'agent:error': {
    event: WORKFLOW_TRACKING_EVENTS.AGENT_ERROR,
    params: (data) => {
      const d = data as Record<string, unknown> | undefined
      return {
        error_type: (d?.code as string) || 'unknown',
        model_provider: ''
      }
    }
  }
}

// ==================== 安装追踪器 ====================

export function setupTracker(analytics: Analytics) {
  // 记录应用启动时间，用于计算会话时长
  const appStartTime = Date.now()

  // 投屏窗口打开时间记录
  const windowOpenTimes = new Map<string, number>()
  const automationAgentSessions = new Map<string, AgentSessionContext>()
  let activeAutomationSessionId = ''

  const getAutomationSession = (sessionId?: string): AgentSessionContext | undefined => {
    const resolvedSessionId = sessionId || activeAutomationSessionId
    return resolvedSessionId ? automationAgentSessions.get(resolvedSessionId) : undefined
  }

  const rememberAutomationSession = (sessionId: string, payload?: unknown): AgentSessionContext => {
    const data = payload as Record<string, unknown> | undefined
    const context: AgentSessionContext = {
      modelProvider: getModelProvider(data?.provider),
      deviceId: getDeviceId(data?.device),
      startedAt: Date.now()
    }

    automationAgentSessions.clear()
    automationAgentSessions.set(sessionId, context)
    activeAutomationSessionId = sessionId

    return context
  }

  const clearAutomationSession = (sessionId?: string): void => {
    if (!sessionId) {
      automationAgentSessions.clear()
      activeAutomationSessionId = ''
      return
    }

    automationAgentSessions.delete(sessionId)
    if (activeAutomationSessionId === sessionId) {
      activeAutomationSessionId = ''
    }
  }

  // --- 1. 拦截 ipc.invoke ---
  const originalInvoke = ipcModule.ipc.invoke.bind(ipcModule.ipc)

  ipcModule.ipc.invoke = async <T = unknown, P = unknown>(event: string, payload?: P) => {
    const result = await originalInvoke<T, P>(event, payload)

    // 业务失败不上报
    if (!result.success) return result

    try {
      // CONFIG:SET_CONFIG 特殊处理
      if (event === 'CONFIG:SET_CONFIG') {
        const data = payload as { key?: string; value?: unknown } | undefined
        if (data?.key) {
          const configTracking = configTrackingMap[data.key]
          if (configTracking) {
            safeTrack(analytics, configTracking.event, configTracking.params(data.value))
          }
        }
        return result
      }

      // AI Agent 启动（agent:start 走的是 invoke 而非 send）
      if (event === 'agent:start') {
        const data = payload as Record<string, unknown> | undefined
        const responseData = isRecord(result.data) ? result.data : undefined
        const sessionId = readString(responseData?.sessionId) || readString(data?.sessionId)
        const session = sessionId ? rememberAutomationSession(sessionId, data) : undefined
        safeTrack(analytics, WORKFLOW_TRACKING_EVENTS.AGENT_START, {
          model_provider: session?.modelProvider || getModelProvider(data?.provider),
          device_id: session?.deviceId || getDeviceId(data?.device)
        })
        return result
      }

      if (event === 'agent:resume') {
        const data = payload as Record<string, unknown> | undefined
        const session = getAutomationSession(readString(data?.sessionId))
        safeTrack(analytics, WORKFLOW_TRACKING_EVENTS.AGENT_RESUME, {
          model_provider: session?.modelProvider || '',
          device_id: session?.deviceId || '',
          input_length: readString(data?.message).length,
          entry: 'automation'
        })
        return result
      }

      if (event === 'agent:stop') {
        const data = payload as Record<string, unknown> | undefined
        const sessionId = readString(data?.sessionId)
        const session = getAutomationSession(sessionId)
        safeTrack(analytics, WORKFLOW_TRACKING_EVENTS.AGENT_STOP, {
          model_provider: session?.modelProvider || '',
          device_id: session?.deviceId || '',
          duration_ms: session ? Date.now() - session.startedAt : 0,
          entry: 'automation'
        })
        clearAutomationSession(sessionId)
        return result
      }

      if (event === 'agent:newSession') {
        const session = getAutomationSession()
        safeTrack(analytics, WORKFLOW_TRACKING_EVENTS.AGENT_NEW_SESSION, {
          model_provider: session?.modelProvider || '',
          device_id: session?.deviceId || '',
          had_active_session: !!session
        })
        clearAutomationSession()
        return result
      }

      if (event === 'agent:optimizeIntent') {
        const data = payload as Record<string, unknown> | undefined
        safeTrack(analytics, WORKFLOW_TRACKING_EVENTS.OPTIMIZE_INTENT, {
          model_provider: getModelProvider(data?.provider),
          input_length: readString(data?.input).length
        })
        return result
      }

      if (event === 'agent:generateScript') {
        const data = payload as Record<string, unknown> | undefined
        const session = getAutomationSession(readString(data?.sessionId))
        safeTrack(analytics, WORKFLOW_TRACKING_EVENTS.GENERATE, {
          model_provider: session?.modelProvider || '',
          step_count: 0,
          device_id: session?.deviceId || ''
        })
        return result
      }

      // 通用 IPC 事件映射
      const tracking = ipcTrackingMap[event]
      if (tracking && tracking.event) {
        safeTrack(analytics, tracking.event, tracking.params(payload, result.data))
      }
    } catch (e) {
      console.warn('[analytics] invoke tracking error:', event, e)
    }

    return result
  }

  // --- 2. 拦截 ipc.send ---
  const originalSend = ipcModule.ipc.send.bind(ipcModule.ipc)

  ipcModule.ipc.send = <T = unknown>(event: string, payload?: T) => {
    // 先执行业务逻辑，确保 send 不受影响
    originalSend(event, payload)

    try {
      // 投屏窗口打开
      if (event === 'cloud:create') {
        const data = payload as { deviceId?: string } | undefined
        const deviceId = data?.deviceId || ''
        safeTrack(analytics, PHONE_EVENTS.WINDOW_OPEN, { device_id: deviceId })
        if (deviceId) {
          windowOpenTimes.set(deviceId, Date.now())
        }
      }

      // AI 助手发送消息
      if (event === 'ai:send-message') {
        safeTrack(analytics, AI_ASSISTANT_TRACKING_EVENTS.CHAT, { model_provider: '' })
      }

      // 投屏窗口关闭
      if (event === 'cloud:close') {
        const data = payload as { deviceId?: string; closeAll?: boolean } | undefined
        if (data?.closeAll) {
          // 一键关闭所有窗口：逐个上报时长
          windowOpenTimes.forEach((openTime, deviceId) => {
            safeTrack(analytics, PHONE_EVENTS.WINDOW_CLOSE, {
              duration_ms: Date.now() - openTime
            })
            windowOpenTimes.delete(deviceId)
          })
        } else if (data?.deviceId) {
          const openTime = windowOpenTimes.get(data.deviceId)
          safeTrack(analytics, PHONE_EVENTS.WINDOW_CLOSE, {
            duration_ms: openTime ? Date.now() - openTime : 0
          })
          windowOpenTimes.delete(data.deviceId)
        }
      }
    } catch (e) {
      console.warn('[analytics] send tracking error:', event, e)
    }
  }

  // --- 3. 拦截 ipc.on（主进程推送事件） ---
  const originalOn = ipcModule.ipc.on.bind(ipcModule.ipc)

  ipcModule.ipc.on = <T = unknown>(event: string, callback: (data: T) => void) => {
    return originalOn(event, (data: T) => {
      // 先执行业务回调
      callback(data)

      // 再安全上报
      try {
        if (event === 'agent:complete') {
          const payload = data as Record<string, unknown> | undefined
          const session = getAutomationSession(readString(payload?.sessionId))
          safeTrack(analytics, WORKFLOW_TRACKING_EVENTS.AGENT_COMPLETE, {
            duration_ms: session ? Date.now() - session.startedAt : 0,
            step_count: getWorkflowStepCount(payload?.workflow),
            success: true,
            model_provider: session?.modelProvider || '',
            device_id: session?.deviceId || ''
          })
          return
        }

        if (event === 'agent:error') {
          const payload = data as Record<string, unknown> | undefined
          const session = getAutomationSession(readString(payload?.sessionId))
          safeTrack(analytics, WORKFLOW_TRACKING_EVENTS.AGENT_ERROR, {
            error_type: readString(payload?.code) || 'unknown',
            model_provider: session?.modelProvider || '',
            device_id: session?.deviceId || ''
          })
          return
        }

        const tracking = ipcOnTrackingMap[event]
        if (tracking) {
          safeTrack(analytics, tracking.event, tracking.params(data))
        }
      } catch (e) {
        console.warn('[analytics] on tracking error:', event, e)
      }
    })
  }

  // --- 4. 拦截 fetch 成功回调 ---
  if (typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch.bind(globalThis)

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init)

      try {
        const url = getFetchUrl(input)
        const tracking = fetchTrackingMap.find((rule) => url.includes(rule.pattern))

        if (tracking) {
          const trackedPayload = await getTrackedResponsePayload(response)
          if (trackedPayload !== null) {
            safeTrack(
              analytics,
              tracking.event,
              tracking.params({
                url,
                body: getRequestBody(init),
                response: trackedPayload
              })
            )
          }
        }
      } catch (e) {
        console.warn('[analytics] fetch tracking error:', e)
      }

      return response
    }
  }

  // --- 5. 拦截 HTTP request 成功回调 ---
  request.setSuccessHandler((_msg, context) => {
    try {
      if (!context?.url) return

      const url = context.url as string
      for (const rule of apiTrackingMap) {
        if (url.includes(rule.pattern)) {
          safeTrack(
            analytics,
            rule.event,
            rule.params({ url, data: context.data, response: context.response })
          )
          break
        }
      }
    } catch (e) {
      console.warn('[analytics] request tracking error:', e)
    }
  })

  // --- 6. 应用关闭时上报 app_close ---
  window.addEventListener('beforeunload', () => {
    try {
      const sessionDuration = Date.now() - appStartTime
      // 使用 sendBeacon 确保页面关闭前数据能发出
      // gtag 内部会使用 sendBeacon，直接调用即可
      safeTrack(analytics, 'app_close', { session_duration_ms: sessionDuration })
    } catch {
      // 静默失败，不阻止窗口关闭
    }
  })
}
