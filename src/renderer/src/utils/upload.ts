import { request, isCancel } from '@shared/api/request'

/* ============================
 * 上传任务类型定义
 * ============================ */
export interface UploadTaskOptions {
  url: string
  file: File
  /** hostIp 必填 */
  hostIp: string
  /** deviceId 可选 */
  deviceId?: string
  formData?: Record<string, any>
  onProgress?: (percent: number) => void
}

export type UploadStatus = 'waiting' | 'uploading' | 'pushing' | 'success' | 'error' | 'cancelled'

export interface UploadTask extends UploadTaskOptions {
  id: number
  status: UploadStatus
  progress: number
  controller: AbortController
  meta?: any
  promise?: Promise<void>
  errorInfo?: string
}

/* ============================
 * UploadQueue 类
 * ============================ */
type Listener = (...args: any[]) => void

export class UploadQueue {
  private concurrency: number
  private queue: UploadTask[] = []
  private activeCount = 0
  private taskId = 0

  /** 正在上传的 host（同一 host 只允许 1 个） */
  private activeHosts = new Set<string>()

  // 事件中心
  private events: Record<string, Listener[]> = {}

  constructor(config?: { concurrency?: number }) {
    this.concurrency = config?.concurrency ?? 3
  }

  /* ============================
   * 事件 API
   * ============================ */
  public on(event: string, fn: Listener) {
    if (!this.events[event]) this.events[event] = []
    this.events[event].push(fn)
  }

  public off(event: string, fn: Listener) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter((f) => f !== fn)
  }

  private emit(event: string, ...args: any[]) {
    if (!this.events[event]) return
    this.events[event].forEach((fn) => fn(...args))
  }

  /* ============================
   * 工具方法
   * ============================ */

  /** host 唯一 key（hostIp 必填，直接用） */
  private getHostKey(task: UploadTask) {
    return task.hostIp
  }

  /* ============================
   * 任务管理
   * ============================ */

  public add(options: UploadTaskOptions): UploadTask {
    const task: UploadTask = {
      id: this.taskId++,
      status: 'waiting',
      progress: 0,
      controller: new AbortController(),
      ...options
    }

    this.queue.push(task)
    this.emit('status', { ...task })
    this.tryStart()

    return task
  }

  public getTasks() {
    return [...this.queue]
  }

  /* ============================
   * 并发调度器
   * ============================ */

  private tryStart() {
    while (this.activeCount < this.concurrency) {
      const next = this.queue.find((t) => {
        if (t.status !== 'waiting') return false
        return !this.activeHosts.has(this.getHostKey(t))
      })

      if (!next) {
        if (this.activeCount === 0) {
          this.emit('finish')
        }
        return
      }

      this.runTask(next)
    }
  }

  private updateStatus(task: UploadTask, status: UploadStatus, meta?: any) {
    task.status = status
    if (meta) {
      task.meta = meta
    }
    this.emit('status', { ...task })
  }

  public deleteTask(id: number) {
    const index = this.queue.findIndex((t) => t.id === id)
    if (index === -1) return false

    const task = this.queue[index]

    if (task.status === 'uploading' || task.status === 'pushing') {
      task.controller.abort()
    }

    this.queue.splice(index, 1)
    this.emit('delete', id)
    this.tryStart()

    return true
  }

  /* ============================
   * 执行任务
   * ============================ */

  private runTask(task: UploadTask) {
    const hostKey = this.getHostKey(task)

    this.activeCount++
    this.activeHosts.add(hostKey)
    this.updateStatus(task, 'uploading')

    task.promise = request
      .post(task.url, task.formData, {
        signal: task.controller.signal,
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        onUploadProgress: (ev) => {
          const percent = ev.total ? ev.loaded / ev.total : 0
          task.progress = percent

          if (percent === 1) {
            if (task.status !== 'pushing') {
              this.updateStatus(task, 'pushing')
            }
          } else {
            this.emit('status', { ...task })
          }

          task.onProgress?.(percent)
        }
      })
      .then((res: any) => {
        const { data } = res || {}

        /* ============================
         * ✅ hostIp 必填后的结果判断逻辑
         * ============================ */

        // 有 deviceId → 精确校验 device 结果
        if (task.deviceId) {
          const result = data?.list?.find((item: any) => item.db_id === task.deviceId) ?? {}

          if (result?.code == 200) {
            task.progress = 1
            this.updateStatus(task, 'success')
          } else {
            task.errorInfo = result?.msg || 'Upload Failed'
            this.updateStatus(task, 'error')
          }
        } else {
          // 无 deviceId → host 级上传，请求成功即可host 级返回 data：list
          task.progress = 1
          this.updateStatus(task, 'success', data?.list)
        }
      })
      .catch((err) => {
        if (isCancel(err)) {
          this.updateStatus(task, 'cancelled')
        } else {
          task.errorInfo = err?.msg || err?.message || 'Upload Error'
          this.updateStatus(task, 'error')
        }
      })
      .finally(() => {
        this.activeCount = Math.max(0, this.activeCount - 1)
        this.activeHosts.delete(hostKey)
        this.tryStart()
      })
  }

  /* ============================
   * 队列控制
   * ============================ */

  public cancelOne(id: number) {
    const task = this.queue.find((t) => t.id === id)
    if (!task) return

    if (task.status === 'waiting') {
      this.updateStatus(task, 'cancelled')
    } else if (task.status === 'uploading' || task.status === 'pushing') {
      task.controller.abort()
    }
  }

  public cancelAll() {
    this.queue.forEach((task) => {
      if (task.status === 'waiting') {
        this.updateStatus(task, 'cancelled')
      } else if (task.status === 'uploading' || task.status === 'pushing') {
        task.controller.abort()
      }
    })
  }

  public clearAllTasks() {
    this.cancelAll()
    this.queue = []
    this.activeCount = 0
    this.activeHosts.clear()
    this.emit('status', null)
    this.emit('finish')
  }
}
