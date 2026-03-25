/**
 * AI Agent 设备 API 服务
 * 兼容 macvlan 直连模式和非 macvlan 主机代理模式。
 */

import type { Device } from '@shared/ipc/data.types'
import {
  buildDeviceModuleUrl,
  postDeviceModuleJson,
  type DeviceApiTarget
} from '@renderer/utils/deviceApi'

export interface AiAgentConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
  maxTurns: number
  systemPrompt: string
}

export interface TaskHistoryItem {
  task_id: string
  task: string
  status: string
  turns?: number
  created_at: number
  finished_at?: number
}

export interface ControlApiVersionInfo {
  version_code?: number
  version_name?: string
  supported_list?: string[]
  [key: string]: unknown
}

const CONTROL_PORT = 18182

function buildControlUrl(deviceId: string, hostIp: string, path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `http://${hostIp}:${CONTROL_PORT}/android_api/v2/${deviceId}/${cleanPath}`
}

type AiAgentTarget = Device | DeviceApiTarget | null | undefined

export class AiAgentService {
  /** 启动任务 */
  static async run(target: AiAgentTarget, content: string): Promise<{ task_id: string }> {
    return postDeviceModuleJson(target, 'ai_agent', 'task_run', { content })
  }

  /** 获取运行状态 */
  static async getStatus(target: AiAgentTarget): Promise<any> {
    return postDeviceModuleJson(target, 'ai_agent', 'task_status')
  }

  /** 获取历史记录 */
  static async getHistory(
    target: AiAgentTarget,
    limit = 50
  ): Promise<{ tasks: TaskHistoryItem[] }> {
    return postDeviceModuleJson(target, 'ai_agent', 'task_list', { limit })
  }

  /** 停止任务 */
  static async stop(target: AiAgentTarget, taskId: string): Promise<any> {
    return postDeviceModuleJson(target, 'ai_agent', 'task_stop', { task_id: taskId })
  }

  /** 删除任务 */
  static async deleteTask(target: AiAgentTarget, taskId: string): Promise<any> {
    return postDeviceModuleJson(target, 'ai_agent', 'task_delete', { task_id: taskId })
  }

  /** 获取任务详情（JSONL 事件列表） */
  static async getTaskDetail(target: AiAgentTarget, taskId: string): Promise<{ events: any[] }> {
    return postDeviceModuleJson(target, 'ai_agent', 'task_detail', { task_id: taskId })
  }

  /** 获取配置（服务端返回 snake_case，转换为 camelCase） */
  static async getConfig(target: AiAgentTarget): Promise<AiAgentConfig> {
    const raw: any = await postDeviceModuleJson(target, 'ai_agent', 'config_get')
    return {
      provider: raw.provider ?? '',
      model: raw.model ?? '',
      baseUrl: raw.base_url ?? '',
      apiKey: raw.api_key ?? '',
      maxTurns: raw.max_turns ?? 50,
      systemPrompt: raw.system_prompt ?? ''
    }
  }

  /** 设置配置（服务端期望 snake_case） */
  static async setConfig(target: AiAgentTarget, config: Partial<AiAgentConfig>): Promise<any> {
    const body: Record<string, unknown> = {}
    if (config.provider !== undefined) body.provider = config.provider
    if (config.model !== undefined) body.model = config.model
    if (config.baseUrl !== undefined) body.base_url = config.baseUrl
    if (config.apiKey !== undefined) body.api_key = config.apiKey
    if (config.maxTurns !== undefined) body.max_turns = config.maxTurns
    if (config.systemPrompt !== undefined) body.system_prompt = config.systemPrompt
    return postDeviceModuleJson(target, 'ai_agent', 'config_set', body)
  }

  /** 连接 SSE 事件流 */
  static connectSSE(target: AiAgentTarget, taskId: string): EventSource {
    const url = buildDeviceModuleUrl(target, 'ai_agent', `task_stream?task_id=${taskId}`)
    return new EventSource(url)
  }

  /** 检查设备在线状态 */
  static async checkOnline(target: AiAgentTarget): Promise<boolean> {
    try {
      await postDeviceModuleJson(target, 'ai_agent', 'config_get')
      return true
    } catch {
      return false
    }
  }

  /** 获取调试模式状态（Control API） */
  static async getDebugMode(deviceId: string, hostIp: string): Promise<boolean> {
    const url = buildControlUrl(deviceId, hostIp, '/base/api_global_settings')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    const result = await response.json()
    return result?.data?.debug ?? false
  }

  /** 获取 Control API 版本 */
  static async getControlApiVersion(
    deviceId: string,
    hostIp: string
  ): Promise<ControlApiVersionInfo> {
    const url = buildControlUrl(deviceId, hostIp, '/base/version_info')
    const response = await fetch(url, { method: 'GET' })
    const result = await response.json().catch(() => ({}))

    if (!response.ok || Number(result?.code || 0) !== 200) {
      const error: Error & { status?: number; code?: number } = new Error(
        result?.msg || `Request failed (${response.status})`
      )
      error.status = response.status
      error.code = Number(result?.code || 0)
      throw error
    }

    return result?.data || {}
  }

  /** 设置调试模式（Control API） */
  static async setDebugMode(deviceId: string, hostIp: string, enabled: boolean): Promise<boolean> {
    const url = buildControlUrl(deviceId, hostIp, '/base/api_global_settings')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ debug: enabled })
    })
    const result = await response.json()
    return result?.data?.debug ?? false
  }

  /** 停止所有应用（Control API） */
  static async stopAllApps(deviceId: string, hostIp: string): Promise<string[]> {
    const url = buildControlUrl(deviceId, hostIp, '/activity/stop_all_apps')
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ back_home: true })
    })
    const result = await response.json()
    return result?.data ?? []
  }
}
