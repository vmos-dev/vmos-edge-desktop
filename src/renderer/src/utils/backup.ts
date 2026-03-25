import { DeviceState, type Device } from '@shared/ipc/data.types'
import { API_CONFIG, buildApiUrl, getErrorMessage, Request as ApiRequest, request } from '@shared/api'

type Listener = (...args: any[]) => void

type SpeedSample = {
  time: number
  bytes: number
}

export type BackupTaskStatus =
  | 'waiting'
  | 'preparing'
  | 'downloading'
  | 'saving'
  | 'success'
  | 'error'

export interface BackupTask {
  id: number
  device: Device
  dbId: string
  hostIp: string
  status: BackupTaskStatus
  progress: number
  receivedBytes: number
  totalBytes: number | null
  speedBps: number
  etaSeconds: number | null
  fileName: string
  error?: string
  controller: AbortController
  writerId?: string
  createdAt: number
  updatedAt: number
  speedSamples: SpeedSample[]
}

export const BACKUP_CONCURRENCY = 1

export interface BackupQueueConfig {
  directoryToken: string
  directoryPath?: string
  concurrency?: number
}

function getDbId(device: Device): string {
  return device.db_id || device.id || ''
}

function parseContentDispositionFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return ''

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*([^;]+)/i)
  if (utf8Match?.[1]) {
    const value = utf8Match[1].trim().replace(/^"|"$/g, '')
    const utf8Prefix = "UTF-8''"
    if (value.startsWith(utf8Prefix)) {
      try {
        return decodeURIComponent(value.slice(utf8Prefix.length))
      } catch {
        return value.slice(utf8Prefix.length)
      }
    }
    return value
  }

  const plainMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i)
  if (plainMatch?.[1]) {
    return plainMatch[1].trim().replace(/^"|"$/g, '')
  }

  return ''
}

function formatFallbackFileName(dbId: string): string {
  const date = new Date()
  const yyyy = String(date.getFullYear())
  const MM = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const HH = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `backup-${dbId}-${yyyy}${MM}${dd}-${HH}${mm}${ss}.tar`
}

function parseTotalBytes(response: Response): number | null {
  const raw = response.headers.get('content-length')
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function isJsonResponse(response: Response): boolean {
  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  return (
    contentType.includes('application/json') ||
    contentType.includes('text/json') ||
    contentType.includes('application/problem+json')
  )
}

async function parseResponseErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  try {
    const json = await response.clone().json()
    return getErrorMessage(json, fallbackMessage)
  } catch {
    // ignore and fallback to text parser
  }

  try {
    const text = (await response.clone().text()).trim()
    if (!text) return fallbackMessage

    try {
      const json = JSON.parse(text)
      return getErrorMessage(json, fallbackMessage)
    } catch {
      return text
    }
  } catch {
    return fallbackMessage
  }
}

export class BackupQueue {
  private queue: BackupTask[] = []
  private taskId = 0
  private activeCount = 0
  private readonly directoryToken: string
  private readonly concurrency: number
  private readonly events: Record<string, Listener[]> = {}
  private readonly cancelRequested = new Set<number>()

  constructor(config: BackupQueueConfig) {
    this.directoryToken = config.directoryToken
    this.concurrency = config.concurrency ?? BACKUP_CONCURRENCY
  }

  public on(event: string, fn: Listener) {
    if (!this.events[event]) this.events[event] = []
    this.events[event].push(fn)
  }

  public off(event: string, fn: Listener) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter((item) => item !== fn)
  }

  private emit(event: string, ...args: any[]) {
    const listeners = this.events[event]
    if (!listeners) return
    listeners.forEach((fn) => fn(...args))
  }

  public add(device: Device): BackupTask {
    const now = Date.now()
    const task: BackupTask = {
      id: this.taskId++,
      device,
      dbId: getDbId(device),
      hostIp: device.host_ip || '',
      status: 'waiting',
      progress: 0,
      receivedBytes: 0,
      totalBytes: null,
      speedBps: 0,
      etaSeconds: null,
      fileName: '',
      controller: new AbortController(),
      createdAt: now,
      updatedAt: now,
      speedSamples: []
    }

    this.queue.push(task)
    this.emitChange()
    this.tryStart()

    return task
  }

  public getTasks(): BackupTask[] {
    return [...this.queue]
  }

  private emitChange() {
    this.emit('change', this.getTasks())
  }

  private updateStatus(task: BackupTask, status: BackupTaskStatus) {
    task.status = status
    task.updatedAt = Date.now()
    this.emitChange()
  }

  private tryStart() {
    while (this.activeCount < this.concurrency) {
      const next = this.queue.find((item) => item.status === 'waiting')
      if (!next) {
        if (this.activeCount === 0) {
          this.emit('finish')
        }
        return
      }

      void this.runTask(next)
    }
  }

  private updateMetrics(task: BackupTask) {
    const now = Date.now()
    task.updatedAt = now

    task.speedSamples.push({ time: now, bytes: task.receivedBytes })
    while (task.speedSamples.length > 1 && now - task.speedSamples[0].time > 2000) {
      task.speedSamples.shift()
    }

    if (task.speedSamples.length >= 2) {
      const first = task.speedSamples[0]
      const last = task.speedSamples[task.speedSamples.length - 1]
      const deltaBytes = last.bytes - first.bytes
      const deltaMs = last.time - first.time
      task.speedBps = deltaMs > 0 ? (deltaBytes / deltaMs) * 1000 : 0
    } else {
      task.speedBps = 0
    }

    if (task.totalBytes && task.totalBytes > 0) {
      task.progress = Math.min(1, task.receivedBytes / task.totalBytes)
      task.etaSeconds =
        task.speedBps > 0 ? (task.totalBytes - task.receivedBytes) / task.speedBps : null
    } else {
      task.progress = 0
      task.etaSeconds = null
    }
  }

  private async runTask(task: BackupTask): Promise<void> {
    this.activeCount++
    this.updateStatus(task, 'preparing')

    try {
      if (!task.dbId) {
        throw new Error('Missing db_id for device. Backup cannot start.')
      }

      if (!task.hostIp) {
        throw new Error('Missing host_ip for device. Backup cannot start.')
      }

      if (task.device.state !== DeviceState.StateStopped) {
        throw new Error(
          `Backup is only supported for stopped devices. Current state: ${task.device.state || 'unknown'}`
        )
      }

      const exportUrl = `${buildApiUrl(task.hostIp, API_CONFIG.PATHS.EXPORT_BACKUP)}?db_id=${encodeURIComponent(task.dbId)}`
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/octet-stream, application/json',
          'Accept-Language': ApiRequest.languageGetter()
        },
        signal: task.controller.signal
      })

      const defaultError = response.ok
        ? 'Backup failed'
        : `Backup download failed: ${response.status} ${response.statusText}`
      if (!response.ok || isJsonResponse(response)) {
        throw new Error(await parseResponseErrorMessage(response, defaultError))
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Backup response does not support streaming.')
      }

      task.totalBytes = parseTotalBytes(response)
      const headerName = parseContentDispositionFilename(
        response.headers.get('content-disposition')
      )
      const fallbackName = formatFallbackFileName(task.dbId)
      const writer = await window.backupFs.createWriter({
        token: this.directoryToken,
        fileName: headerName || fallbackName
      })

      task.writerId = writer.writerId
      task.fileName = writer.finalFileName
      this.updateStatus(task, 'downloading')
      this.emitChange()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        if (!value || value.byteLength === 0) {
          continue
        }

        await window.backupFs.write(writer.writerId, value)
        task.receivedBytes += value.byteLength
        this.updateMetrics(task)
        this.emitChange()
      }

      this.updateStatus(task, 'saving')
      await window.backupFs.close(writer.writerId)
      task.writerId = undefined
      task.progress = 1
      task.etaSeconds = 0
      this.updateStatus(task, 'success')
    } catch (error) {
      const cancelled = this.cancelRequested.has(task.id) || task.controller.signal.aborted

      if (cancelled) {
        return
      }

      if (task.writerId) {
        try {
          await window.backupFs.abort(task.writerId)
        } catch {
          // ignore
        }
        task.writerId = undefined
      }

      task.error = getErrorMessage(error, 'Backup failed')
      task.speedBps = 0
      task.etaSeconds = null
      this.updateStatus(task, 'error')
    } finally {
      this.activeCount = Math.max(0, this.activeCount - 1)
      this.cancelRequested.delete(task.id)
      this.tryStart()
    }
  }

  private removeTask(taskId: number) {
    const index = this.queue.findIndex((item) => item.id === taskId)
    if (index === -1) return
    this.queue.splice(index, 1)
    this.emitChange()
  }

  private async cancelByApi(task: BackupTask): Promise<string | undefined> {
    try {
      await request.post(buildApiUrl(task.hostIp, API_CONFIG.PATHS.CANCEL_BACKUP), {
        db_id: task.dbId
      })
      return undefined
    } catch (error) {
      return getErrorMessage(error, 'Failed to cancel backup')
    }
  }

  public async cancelAndRemove(taskId: number): Promise<{ cancelError?: string }> {
    const task = this.queue.find((item) => item.id === taskId)
    if (!task) return {}

    const status = task.status

    // 如果是等待中、成功或错误状态，直接移除任务即可
    if (status === 'waiting' || status === 'success' || status === 'error') {
      this.removeTask(taskId)
      return {}
    }

    // 标记取消请求并中止本地控制控制器
    this.cancelRequested.add(taskId)
    task.controller.abort()

    let cancelError: string | undefined

    // 只有在请求进行中（准备或下载）时才需要调用后端的取消接口
    if ((status === 'preparing' || status === 'downloading') && task.dbId && task.hostIp) {
      cancelError = await this.cancelByApi(task)
    }

    // 如果本地写入器还在运行，则中止它（清理临时文件）
    if (task.writerId) {
      try {
        await window.backupFs.abort(task.writerId)
      } catch (error) {
        const writerError = getErrorMessage(error, 'Failed to remove temporary file')
        cancelError = cancelError || writerError
      } finally {
        task.writerId = undefined
      }
    }

    this.removeTask(taskId)
    return { cancelError }
  }

  public async clearAll(): Promise<void> {
    const taskIds = this.queue.map((item) => item.id)
    for (const taskId of taskIds) {
      await this.cancelAndRemove(taskId)
    }
  }
}
