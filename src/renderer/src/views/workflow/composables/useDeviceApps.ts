/**
 * useDeviceApps · 云机应用扫描 + 缓存
 *
 * 规范落实:
 * - 走 deviceApi.getDeviceModuleJson,透明适配 macvlan / proxy 两种网络模式
 * - 扫描结果 5 min 缓存(TTL,避免切设备时反复请求)
 * - Abort 超时保护(HTTP_TIMEOUT_MS)
 * - 最近应用通过 localStorage 持久化
 * - 所有 error 包装到 ref,不 throw(上层组件消费)
 */

import { ref, readonly } from 'vue'
import type { Device } from '@shared/ipc/data.types'
import type { AppInfo } from '@shared/ipc/workflow.types'
import { t } from '@renderer/locales'
import { getDeviceModuleJson } from '@renderer/utils/deviceApi'
import { APP_SCAN_CACHE_TTL_MS, HTTP_TIMEOUT_MS } from '../constants'

// ═══════════════ 响应结构(与后端实际 API 对齐) ═══════════════

/**
 * 后端 /package/list?launcher_only=true 返回的单项格式
 * 字段按实际 API 可能返回的集合定义;未知字段忽略
 */
interface RawPackageItem {
  app_name?: string
  package_name?: string
  version_name?: string
  version_code?: number
  install_time?: number
  last_used_time?: number
  size?: number
  icon?: string
}

interface PackageListResponse {
  packages?: RawPackageItem[]
}

// ═══════════════ 模块级缓存(跨组件实例共享) ═══════════════

interface ScanCache {
  apps: AppInfo[]
  scannedAt: number
}

/** 按 device.id 作 key,TTL 失效 */
const scanCache = new Map<string, ScanCache>()

/** 最近使用的应用(按 packageName 去重)的 localStorage key */
const RECENT_APPS_KEY = 'workflow:recent-apps'
const RECENT_APPS_MAX = 20

// ═══════════════ 工具 ═══════════════

function normalize(raw: RawPackageItem): AppInfo | null {
  const pkg = raw.package_name?.trim()
  if (!pkg) return null
  return {
    packageName: pkg,
    displayName: raw.app_name?.trim() || pkg,
    versionName: raw.version_name,
    versionCode: raw.version_code,
    installTime: raw.install_time,
    lastUsedTime: raw.last_used_time,
    size: raw.size,
    icon: raw.icon
  }
}

function readRecent(): AppInfo[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(RECENT_APPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as AppInfo[]) : []
  } catch {
    // 解析失败(版本变更或被污染)→ 清空
    window.localStorage.removeItem(RECENT_APPS_KEY)
    return []
  }
}

function writeRecent(apps: AppInfo[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(RECENT_APPS_KEY, JSON.stringify(apps.slice(0, RECENT_APPS_MAX)))
  } catch {
    // 存储失败(配额满等)忽略,不影响流程
  }
}

// ═══════════════ Composable ═══════════════

export function useDeviceApps() {
  const loading = ref(false)
  const apps = ref<AppInfo[]>([])
  const error = ref<string | null>(null)

  // ── Actions ──

  /**
   * 扫描设备的已安装应用(只扫桌面可见的 launcher apps)
   * @param device 目标云机
   * @param force 强制忽略缓存
   */
  async function scan(device: Device, force = false): Promise<AppInfo[]> {
    error.value = null

    // 缓存命中
    if (!force) {
      const hit = scanCache.get(device.id)
      if (hit && Date.now() - hit.scannedAt < APP_SCAN_CACHE_TTL_MS) {
        apps.value = hit.apps
        return hit.apps
      }
    }

    loading.value = true
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), HTTP_TIMEOUT_MS)

    try {
      // 透明适配 macvlan / proxy
      const data = await getDeviceModuleJson<PackageListResponse>(
        device,
        'package',
        'list?type=all&launcher_only=true'
      )
      const scanned = (data.packages ?? []).map(normalize).filter((a): a is AppInfo => a !== null)

      scanCache.set(device.id, { apps: scanned, scannedAt: Date.now() })
      apps.value = scanned
      return scanned
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        error.value = t('workflow.misc.scanTimeout')
      } else {
        error.value = e instanceof Error ? e.message : String(e)
      }
      return []
    } finally {
      clearTimeout(timeoutId)
      loading.value = false
    }
  }

  /**
   * 主动失效某台设备的缓存(如设备重启、用户手动刷新)
   */
  function invalidate(deviceId: string): void {
    scanCache.delete(deviceId)
  }

  // ── 最近使用的应用 ──

  function getRecent(limit = 4): AppInfo[] {
    return readRecent().slice(0, limit)
  }

  function markUsed(app: AppInfo): void {
    const list = readRecent().filter((x) => x.packageName !== app.packageName)
    list.unshift(app)
    writeRecent(list)
  }

  return {
    // 响应式状态(只读)
    loading: readonly(loading),
    apps: readonly(apps),
    error: readonly(error),

    // Actions
    scan,
    invalidate,
    getRecent,
    markUsed
  }
}
