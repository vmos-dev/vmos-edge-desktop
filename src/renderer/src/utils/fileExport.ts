import type { Device } from '@shared/ipc/data.types'
import {
  API_CONTROL_CONFIG,
  Request as ApiRequest,
  buildDeviceApiUrl,
  getErrorMessage
} from '@shared/api'

type Listener = (...args: any[]) => void

type SpeedSample = {
  time: number
  bytes: number
}

export type FileExportTaskStatus =
  | 'waiting'
  | 'preparing'
  | 'downloading'
  | 'saving'
  | 'success'
  | 'error'

export interface FileExportTask {
  id: number
  device: Device
  deviceId: string
  hostIp: string
  remotePath: string
  fileName: string
  savedFileName: string
  status: FileExportTaskStatus
  progress: number
  receivedBytes: number
  totalBytes: number | null
  speedBps: number
  etaSeconds: number | null
  error?: string
  controller: AbortController
  writerId?: string
  createdAt: number
  updatedAt: number
  speedSamples: SpeedSample[]
}

export const FILE_EXPORT_CONCURRENCY = 1

export interface FileExportQueueConfig {
  directoryToken: string
  concurrency?: number
}

export interface AddFileExportTaskPayload {
  device: Device
  remotePath: string
  fileName: string
  size?: number
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

export class FileExportQueue {
  private queue: FileExportTask[] = []
  private taskId = 0
  private activeCount = 0
  private readonly directoryToken: string
  private readonly concurrency: number
  private readonly events: Record<string, Listener[]> = {}
  private readonly cancelRequested = new Set<number>()

  constructor(config: FileExportQueueConfig) {
    this.directoryToken = config.directoryToken
    this.concurrency = config.concurrency ?? FILE_EXPORT_CONCURRENCY
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

  public add(payload: AddFileExportTaskPayload): FileExportTask {
    const now = Date.now()
    const task: FileExportTask = {
      id: this.taskId++,
      device: payload.device,
      deviceId: payload.device.id || '',
      hostIp: payload.device.host_ip || '',
      remotePath: payload.remotePath,
      fileName: payload.fileName,
      savedFileName: '',
      status: 'waiting',
      progress: 0,
      receivedBytes: 0,
      totalBytes: payload.size ?? null,
      speedBps: 0,
      etaSeconds: null,
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

  public getTasks(): FileExportTask[] {
    return [...this.queue]
  }

  private emitChange() {
    this.emit('change', this.getTasks())
  }

  private updateStatus(task: FileExportTask, status: FileExportTaskStatus) {
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

  private updateMetrics(task: FileExportTask) {
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

  private async runTask(task: FileExportTask): Promise<void> {
    this.activeCount++
    this.updateStatus(task, 'preparing')

    try {
      if (!task.deviceId) {
        throw new Error('Missing device id. File export cannot start.')
      }

      if (!task.hostIp) {
        throw new Error('Missing host ip. File export cannot start.')
      }

      if (!task.remotePath) {
        throw new Error('Missing remote path. File export cannot start.')
      }

      const exportUrl = `${buildDeviceApiUrl(task.hostIp, task.deviceId, API_CONTROL_CONFIG.PATHS.FILE_EXPORT)}?path=${encodeURIComponent(task.remotePath)}`
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/octet-stream, application/json',
          'Accept-Language': ApiRequest.languageGetter()
        },
        signal: task.controller.signal
      })

      const defaultError = response.ok
        ? 'File export failed'
        : `File export failed: ${response.status} ${response.statusText}`

      if (!response.ok || isJsonResponse(response)) {
        throw new Error(await parseResponseErrorMessage(response, defaultError))
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('File export response does not support streaming.')
      }

      task.totalBytes = parseTotalBytes(response) ?? task.totalBytes
      const headerName = parseContentDispositionFilename(response.headers.get('content-disposition'))
      const writer = await window.backupFs.createWriter({
        token: this.directoryToken,
        fileName: headerName || task.fileName
      })

      task.writerId = writer.writerId
      task.savedFileName = writer.finalFileName
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

      task.error = getErrorMessage(error, 'File export failed')
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

  public async cancelAndRemove(taskId: number): Promise<void> {
    const task = this.queue.find((item) => item.id === taskId)
    if (!task) return

    const status = task.status

    if (status === 'waiting' || status === 'success' || status === 'error') {
      this.removeTask(taskId)
      return
    }

    this.cancelRequested.add(taskId)
    task.controller.abort()

    if (task.writerId) {
      try {
        await window.backupFs.abort(task.writerId)
      } catch {
        // ignore
      } finally {
        task.writerId = undefined
      }
    }

    this.removeTask(taskId)
  }

  public async clearAll(): Promise<void> {
    const taskIds = this.queue.map((item) => item.id)
    for (const taskId of taskIds) {
      await this.cancelAndRemove(taskId)
    }
  }
}
