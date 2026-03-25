import type { Device } from '@shared/ipc/data.types'
import { Request as ApiRequest } from '@shared/api'
import { API_CONTROL_CONFIG } from '@shared/api/controlConfig'
import { t } from '@renderer/locales'

/**
 * 自动化相关设备服务
 */
export class AutomationService {
  private static buildPostBody(payload: Record<string, unknown> = {}): string {
    return JSON.stringify(payload)
  }

  private static buildHeaders(contentType?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Accept-Language': ApiRequest.languageGetter()
    }

    if (contentType) {
      headers['Content-Type'] = contentType
    }

    return headers
  }

  /**
   * 获取设备 API URL
   */
  static getDeviceApiUrl(device: Device, path: string): string {
    const ip = device.host_ip
    const port = 18182 // 默认 API 端口
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `http://${ip}:${port}/android_api/v2/${device.id}/${cleanPath}`
  }

  /**
   * 获取已安装应用列表
   */
  static async getInstalledApps(device: Device): Promise<string> {
    try {
      const url = this.getDeviceApiUrl(device, 'package/list?launcher_only=true')
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders()
      })
      const result = await response.json()
      if (result.code === 200 && result.data?.packages && Array.isArray(result.data.packages)) {
        return result.data.packages
          .map(
            (app: any) =>
              `${app.app_name || t('automation.service.unknown')}=${app.package_name || ''}`
          )
          .join(', ')
      }
      return ''
    } catch (error) {
      console.error('[AutomationService] 获取应用列表失败:', error)
      return ''
    }
  }

  /**
   * 获取当前 UI 状态并简化
   */
  static async getUiState(device: Device): Promise<string> {
    try {
      const url = this.getDeviceApiUrl(device, 'accessibility/dump')
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 15)
      const cacheBuster = `?t=${timestamp}&r=${random}`

      const response = await fetch(url + cacheBuster, {
        method: 'POST',
        headers: this.buildHeaders('application/json'),
        body: this.buildPostBody({}),
        cache: 'no-store'
      })
      const result = await response.json()
      if (result.code === 200 && result.data && typeof result.data === 'string') {
        return this.simplifyUiDump(result.data)
      }
      return t('automation.service.uiStateUnavailable')
    } catch (error) {
      console.error('[AutomationService] 获取 UI 状态失败:', error)
      return t('automation.service.uiStateFailed')
    }
  }

  /**
   * 简化 UI Dump XML
   */
  static simplifyUiDump(xml: string): string {
    const result: string[] = []
    const packageMatch = xml.match(/package="([^"]+)"/)
    result.push(
      `${t('automation.service.currentApp')}${packageMatch ? packageMatch[1] : t('automation.service.unknown')}\n\n${t('automation.service.uiTree')}`
    )

    const nodeRegex = /<node\s+([^>]*)>/g
    let match
    let depth = 0
    let lastIndex = 0

    while ((match = nodeRegex.exec(xml)) !== null) {
      const beforeMatch = xml.substring(lastIndex, match.index)
      depth +=
        (beforeMatch.match(/<node\s/g) || []).length - (beforeMatch.match(/<\/node>/g) || []).length
      const attrs = match[1]
      const text = attrs.match(/text="([^"]*)"/)?.[1]
      const resourceId = attrs.match(/resource-id="([^"]*)"/)?.[1]
      const contentDesc = attrs.match(/content-desc="([^"]*)"/)?.[1]
      const className = attrs.match(/class="([^"]*)"/)?.[1]
      const bounds = attrs.match(/bounds="([^"]*)"/)?.[1]
      const scrollable = /scrollable="true"/.test(attrs)

      if (text || contentDesc || resourceId || scrollable) {
        const indent = '  '.repeat(Math.min(depth, 4))
        const parts: string[] = []
        if (resourceId) parts.push(`rid="${resourceId}"`)
        if (text) parts.push(`text="${text}"`)
        if (contentDesc) parts.push(`content-desc="${contentDesc}"`)
        if (scrollable) parts.push('scrollable')
        if (className) parts.push(`[${className.split('.').pop()}]`)
        if (bounds) parts.push(bounds)
        result.push(`${indent}${parts.join(' ')}`)
      }
      lastIndex = match.index
    }
    return result.length > 1 ? result.join('\n') : t('automation.service.noInteractiveElements')
  }

  /**
   * 执行工作流
   */
  static async executeWorkflow(device: Device, workflow: any): Promise<any> {
    const url = this.getDeviceApiUrl(device, 'workflow/execute')
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders('application/json'),
      body: this.buildPostBody(workflow)
    })
    return response.json()
  }

  /**
   * 停止工作流
   */
  static async cancelWorkflow(device: Device): Promise<any> {
    const url = this.getDeviceApiUrl(device, 'workflow/cancel')
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders('application/json'),
      body: this.buildPostBody({})
    })
    return response.json()
  }

  /**
   * 查询调试模式开关（/base/api_global_settings，不传 debug）
   */
  static async getActionTrajectoryDebug(device: Device): Promise<boolean> {
    const url = this.getDeviceApiUrl(device, API_CONTROL_CONFIG.PATHS.SET_ACTION_TRAJECTORY)
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders('application/json'),
      body: this.buildPostBody({})
    })
    const result = await response.json()
    if (result.code !== 200) {
      throw new Error(result.msg || t('automation.service.queryDebugFailed'))
    }
    return result?.data?.debug ?? false
  }

  /**
   * 设置调试模式开关（/base/api_global_settings，传 debug）
   */
  static async setActionTrajectoryDebug(device: Device, enabled: boolean): Promise<boolean> {
    const url = this.getDeviceApiUrl(device, API_CONTROL_CONFIG.PATHS.SET_ACTION_TRAJECTORY)
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders('application/json'),
      body: this.buildPostBody({ debug: enabled })
    })
    const result = await response.json()
    if (result.code !== 200) {
      throw new Error(result.msg || t('automation.service.setDebugFailed'))
    }
    return result?.data?.debug ?? false
  }
}
