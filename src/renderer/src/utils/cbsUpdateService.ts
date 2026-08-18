import { request } from '@shared/api/request'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { getErrorMessage } from '@shared/api/utils'
import { RequestQueue } from './requestQueue'
import type { Host } from '@shared/ipc/data.types'

// ── 类型定义 ──────────────────────────────────────────

export interface CbsRemoteConfig {
  cbs_version: string
  download_url: string
  update_description: Record<string, string>
}

export interface HostCbsInfo {
  host: Host
  currentVersion: string
  needsUpdate: boolean
}

// ── 远程配置 URL ────────────────────────────────────
const CBS_UPDATE_CONFIG_URL =
  'https://vmos-edge.oss-cn-guangzhou.aliyuncs.com/cbs-release-json/cbs-release.json'

// ── 版本比对 ──────────────────────────────────────────

export function compareSemver(a: string, b: string): number {
  const toNum = (s: string) => {
    const n = parseInt(s, 10)
    return isNaN(n) ? 0 : n
  }
  const pa = a.split('.').map(toNum)
  const pb = b.split('.').map(toNum)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// ── 获取远程配置 ──────────────────────────────────────

export async function fetchCbsRemoteConfig(): Promise<CbsRemoteConfig> {
  const url = `${CBS_UPDATE_CONFIG_URL}?t=${Date.now()}`
  const res = await fetch(url, {
    cache: 'no-cache',
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.cbs_version || !data.download_url) {
    throw new Error('Invalid CBS update config')
  }
  if (!/^https?:\/\//i.test(data.download_url)) {
    throw new Error('Invalid download URL protocol')
  }
  return data as CbsRemoteConfig
}

// ── 并发查询主机 CBS 版本（最多 10 并发） ────────────

export function queryHostCbsVersions(hosts: Host[], latestVersion: string): Promise<HostCbsInfo[]> {
  return new Promise((resolve) => {
    if (hosts.length === 0) {
      resolve([])
      return
    }

    const results: HostCbsInfo[] = []
    const queue = new RequestQueue({ concurrency: 10, timeout: 15000 })

    for (const host of hosts) {
      queue.add({
        url: buildApiUrl(host.ip, API_CONFIG.PATHS.GET_HARDWARE_CFG),
        meta: { host },
        executor: async (task) => {
          const res: any = await request.get(
            buildApiUrl(host.ip, API_CONFIG.PATHS.GET_HARDWARE_CFG),
            { signal: task.controller.signal, timeout: 15000 }
          )
          return res
        }
      })
    }

    queue.on('status', (task) => {
      const host = task.meta.host as Host
      if (task.status === 'success') {
        const res = task.data
        const version = res?.data?.version || res?.version || ''
        results.push({
          host,
          currentVersion: version,
          needsUpdate: !!version && compareSemver(version, latestVersion) < 0
        })
      }
    })

    queue.on('finish', () => resolve(results))
  })
}

// ── 下载 CBS 包 ──────────────────────────────────────

export function extractFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const name = pathname.split('/').pop() || ''
    if (name) return name
  } catch {}
  return 'cbs_update.cbs'
}

export async function downloadCbsPackage(
  url: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<{ blob: Blob; fileName: string }> {
  const timeoutSignal = AbortSignal.timeout(20 * 60_000)
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
  const res = await fetch(url, { signal: combinedSignal })
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)

  const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10)
  if (!res.body) {
    return { blob: await res.blob(), fileName: extractFileName(url) }
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (onProgress) {
      onProgress(contentLength > 0 ? Math.min(received / contentLength, 1) : -1)
    }
  }

  return { blob: new Blob(chunks as BlobPart[]), fileName: extractFileName(url) }
}

export { getErrorMessage }
