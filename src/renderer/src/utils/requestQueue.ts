import { request, isCancel } from '@shared/api/request'

/* ============================
 * 请求任务类型定义
 * ============================ */
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestTaskOptions {
  url: string
  method?: RequestMethod
  data?: any // For POST/PUT body
  params?: any // For GET/DELETE query params
  headers?: Record<string, string>
  /** 唯一标识，可选，用于防止重复添加等 */
  key?: string
  /** 附加数据，用于回调透传 */
  meta?: any
}

export type RequestStatus = 'waiting' | 'processing' | 'success' | 'error' | 'cancelled'

export interface RequestTask extends RequestTaskOptions {
  id: number
  status: RequestStatus
  controller: AbortController
  promise?: Promise<void>
  response?: any
  error?: any
}

/* ============================
 * RequestQueue 类
 * ============================ */
type Listener = (...args: any[]) => void

export class RequestQueue {
  private concurrency: number
  private queue: RequestTask[] = []
  private activeCount = 0
  private taskId = 0

  // 事件中心
  private events: Record<string, Listener[]> = {}

  constructor(config?: { concurrency?: number }) {
    this.concurrency = config?.concurrency ?? 10
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
   * 任务管理
   * ============================ */

  public add(options: RequestTaskOptions): RequestTask {
    const task: RequestTask = {
      id: this.taskId++,
      status: 'waiting',
      controller: new AbortController(),
      method: 'GET', // Default to GET
      ...options
    }

    this.queue.push(task)
    this.emit('add', { ...task })
    this.emit('change', this.queue)
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
      const next = this.queue.find((t) => t.status === 'waiting')

      if (!next) {
        if (this.activeCount === 0) {
          this.emit('finish')
        }
        return
      }

      this.runTask(next)
    }
  }

  private updateStatus(task: RequestTask, status: RequestStatus) {
    task.status = status
    this.emit('status', { ...task })
    this.emit('change', this.queue)
  }

  public deleteTask(id: number) {
    const index = this.queue.findIndex((t) => t.id === id)
    if (index === -1) return false

    const task = this.queue[index]

    if (task.status === 'processing') {
      task.controller.abort()
    }

    this.queue.splice(index, 1)
    this.emit('delete', id)
    this.emit('change', this.queue)
    this.tryStart()

    return true
  }

  /* ============================
   * 执行任务
   * ============================ */

  private runTask(task: RequestTask) {
    this.activeCount++
    this.updateStatus(task, 'processing')

    const { url, method, data, params, headers } = task

    // 构建请求配置
    const config = {
      signal: task.controller.signal,
      headers: headers || {},
      timeout: 10000 // 可以根据需求设置超时
    }

    let reqPromise: Promise<any>

    switch (method?.toUpperCase()) {
      case 'POST':
        reqPromise = request.post(url, data, { ...config, params })
        break
      case 'PUT':
        reqPromise = request.put(url, data, { ...config, params })
        break
      case 'DELETE':
        reqPromise = request.delete(url, { ...config, params, data })
        break
      case 'GET':
      default:
        reqPromise = request.get(url, { ...config, params })
        break
    }

    task.promise = reqPromise
      .then((res: any) => {
        task.response = res
        // 假设 code === 200 为成功，这里可能需要根据实际业务调整
        // 或者直接认为请求成功就是 success，业务错误由调用方判断
        // 参考 upload.ts，这里先假设请求通了就算 success，具体业务逻辑如下：
        if (res?.code === 200 || res?.status === 200 || res?.success) {
          this.updateStatus(task, 'success')
        } else {
          // 也可以根据业务需要标记为 error
          // task.error = res?.msg || 'Request Failed'
          // this.updateStatus(task, 'error')
          // 暂时统一视为 success (http success)，让业务层处理
          this.updateStatus(task, 'success')
        }
      })
      .catch((err) => {
        if (isCancel(err)) {
          this.updateStatus(task, 'cancelled')
        } else {
          task.error = err
          this.updateStatus(task, 'error')
        }
      })
      .finally(() => {
        this.activeCount = Math.max(0, this.activeCount - 1)
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
    } else if (task.status === 'processing') {
      task.controller.abort()
    }
  }

  public cancelAll() {
    this.queue.forEach((task) => {
      if (task.status === 'waiting') {
        this.updateStatus(task, 'cancelled')
      } else if (task.status === 'processing') {
        task.controller.abort()
      }
    })
  }

  public clearAllTasks() {
    this.cancelAll()
    this.queue = []
    this.activeCount = 0
    this.emit('change', this.queue)
    this.emit('finish')
  }

  // 获取统计信息
  public getStats() {
    const stats = {
      waiting: 0,
      processing: 0,
      success: 0,
      error: 0,
      cancelled: 0,
      total: this.queue.length
    }
    this.queue.forEach((t) => {
      if (stats[t.status] !== undefined) {
        stats[t.status]++
      }
    })
    return stats
  }
}
