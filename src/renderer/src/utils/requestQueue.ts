import { request, isCancel } from '@shared/api/request'
import { getErrorMessage } from '@shared/api/utils'

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
  /** 自定义执行器，适用于一个任务包含多步异步逻辑的场景 */
  executor?: (task: RequestTask) => Promise<any>
  /** 唯一标识，可选，用于防止重复添加等 */
  key?: string
  /** 附加数据，用于回调透传 */
  meta?: any
  /** 超时时间（毫秒） */
  timeout?: number
}

export type RequestStatus = 'waiting' | 'processing' | 'success' | 'error' | 'cancelled'

export interface RequestTask extends RequestTaskOptions {
  id: number
  status: RequestStatus
  controller: AbortController
  promise?: Promise<void>
  data?: any
  error?: any
}

/* ============================
 * RequestQueue 类
 * ============================ */
type Listener = (...args: any[]) => void

export class RequestQueue {
  private concurrency: number
  private timeout: number
  private queue: RequestTask[] = []
  private activeCount = 0
  private taskId = 0

  // 事件中心
  private events: Record<string, Listener[]> = {}

  constructor(config?: { concurrency?: number; timeout?: number }) {
    this.concurrency = config?.concurrency ?? 10
    this.timeout = config?.timeout ?? 10000
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

    const { url, method, data, params, headers, executor } = task

    // 构建请求配置
    const config = {
      signal: task.controller.signal,
      headers: headers || {},
      timeout: task.timeout || this.timeout // 优先使用任务级别的超时，否则使用全局配置
    }

    const reqPromise = executor
      ? executor(task)
      : (() => {
          switch (method?.toUpperCase()) {
            case 'POST':
              return request.post(url, data, { ...config, params })
            case 'PUT':
              return request.put(url, data, { ...config, params })
            case 'DELETE':
              return request.delete(url, { ...config, params, data })
            case 'GET':
            default:
              return request.get(url, { ...config, params })
          }
        })()

    task.promise = reqPromise
      .then((res: any) => {
        if (executor) {
          task.data = res
          this.updateStatus(task, 'success')
          return
        }

        // 假设 code === 200 为成功，这里可能需要根据实际业务调整
        // 或者直接认为请求成功就是 success，业务错误由调用方判断
        // 参考 upload.ts，这里先假设请求通了就算 success，具体业务逻辑如下：
        // 兼容 code 为 string 的情况, 且考虑可能包裹在 data 中
        // 优先取 res.code，其次 res.data.code
        const code = res?.code !== undefined ? res.code : res?.data?.code

        // 使用宽松比较，兼容字符串 "200" 和数字 200
        // 用户要求：不要强行比较 (==)
        if (code == 200) {
          this.updateStatus(task, 'success')
          // 如果 res.data 存在则使用，否则使用 res 本身作为数据（视具体结构而定）
          // 之前的逻辑是 task.data = res?.data
          // 如果 res 本身就是数据体，那么 task.data = res.data 可能是 undefined 或者子对象
          // 安全起见：如果取到了 code，且 res.data 存在，则用 res.data
          task.data = res?.data ?? res
        } else {
          // 也可以根据业务需要标记为 error
          task.error = getErrorMessage(res) || 'Request Failed'
          this.updateStatus(task, 'error')
        }
      })
      .catch((err) => {
        if (isCancel(err)) {
          this.updateStatus(task, 'cancelled')
        } else {
          task.error = getErrorMessage(err) || 'Request Failed'
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
