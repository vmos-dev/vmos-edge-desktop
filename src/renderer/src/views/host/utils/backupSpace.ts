import { API_CONFIG, buildApiUrl, request } from '@shared/api'
import type { Host } from '@shared/ipc/data.types'
import { formatBytes } from '@renderer/utils/index'

type Translator = (key: string, values?: Record<string, unknown>) => string

const MB_TO_BYTES = 1024 * 1024
export const MIN_BACKUP_IMPORT_AVAILABLE_BYTES = 10 * 1024 * 1024 * 1024

const toNumericValue = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
    const fallback = parseFloat(value)
    if (Number.isFinite(fallback)) return fallback
  }
  return NaN
}

const calculateAvailableBytes = (totalMbRaw: unknown, usedPercentRaw: unknown): number | null => {
  const totalMb = toNumericValue(totalMbRaw)
  const usedPercent = toNumericValue(usedPercentRaw)

  if (!Number.isFinite(totalMb) || totalMb <= 0) return null
  if (!Number.isFinite(usedPercent)) return null

  const normalizedPercent = Math.min(100, Math.max(0, usedPercent))
  const availableMb = (totalMb * (100 - normalizedPercent)) / 100

  return Math.max(0, availableMb * MB_TO_BYTES)
}

const getHostAvailableStorageBytes = (systemInfo: Record<string, unknown>): number | null => {
  const ssdTotal = toNumericValue(systemInfo.ssd_total)
  const useSsdStorage = Number.isFinite(ssdTotal) && ssdTotal > 0

  if (useSsdStorage) {
    return calculateAvailableBytes(systemInfo.ssd_total, systemInfo.ssd_percent)
  }

  return calculateAvailableBytes(systemInfo.mmc_total, systemInfo.mmc_percent)
}

/**
 * 抛错场景统一通过 Error.message 承载，调用方捕获后写入任务的 errorInfo 即可。
 * 传入 signal 时，网络请求会随 signal abort 立即拒绝，避免拖住上层队列调度。
 */
export const ensureBackupImportSpace = async (
  host: Host,
  t: Translator,
  signal?: AbortSignal
): Promise<void> => {
  const systemInfoUrl = buildApiUrl(host.ip, API_CONFIG.PATHS.GET_SYSTEM_INFO)
  const systemInfoResponse = await request.get(systemInfoUrl, { signal })
  const availableBytes = getHostAvailableStorageBytes(systemInfoResponse?.data || {})

  if (availableBytes === null) {
    throw new Error(t('host.importBackupSpaceCheckFailed'))
  }

  if (availableBytes <= 0) {
    throw new Error(t('host.importBackupHostFull'))
  }

  if (availableBytes < MIN_BACKUP_IMPORT_AVAILABLE_BYTES) {
    throw new Error(
      t('host.importBackupInsufficientSpace', {
        available: formatBytes(availableBytes),
        required: formatBytes(MIN_BACKUP_IMPORT_AVAILABLE_BYTES)
      })
    )
  }
}
