import { logger } from '../logger'

export class TaskQueue {
  /** 任务队列（等待执行的任务） */
  private queue: Array<() => Promise<void>> = []

  /** 当前正在执行的任务数量 */
  private runningCount = 0

  /** 最大并发数 */
  private readonly concurrency: number

  constructor(concurrency = 1) {
    this.concurrency = concurrency
  }

  /**
   * 添加一个任务到队列
   * @param task 返回 Promise 的异步函数
   */
  add(task: () => Promise<void>) {
    this.queue.push(task)
    this.schedule() // 尝试调度任务
  }

  /**
   * 清空等待中的任务
   * （不会影响已经在执行中的任务）
   */
  clear() {
    this.queue = []
  }

  /**
   * 核心调度器
   * 会尽可能拉满并发数
   */
  private schedule() {
    // 当还有空闲执行槽位时，不断拉任务执行
    while (this.runningCount < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) return

      this.runningCount++

      // 包一层异步执行，防止阻塞调度
      Promise.resolve()
        .then(() => task())
        .catch((err) => {
          logger.error('[TaskQueue] Task execution failed:', err)
        })
        .finally(() => {
          this.runningCount--
          this.schedule() // 一个任务完成后，继续拉下一个
        })
    }
  }

  /** 等待中的任务数量 */
  get pendingCount() {
    return this.queue.length
  }

  /** 当前执行中的任务数量 */
  get running() {
    return this.runningCount
  }

  /** 是否空闲（无等待任务 + 无执行任务） */
  get isIdle() {
    return this.queue.length === 0 && this.runningCount === 0
  }
}
