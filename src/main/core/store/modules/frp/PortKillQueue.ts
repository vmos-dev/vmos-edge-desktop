import { logger } from '../../../logger'

interface PortKillQueueOptions {
  /** 实际执行杀端口的实现，返回未杀掉的端口列表 */
  killer: (ports: number[]) => Promise<number[]>
  /** 重试条件：返回 false 时放弃所有挂起的重试（如 SSH 已断、服务已停） */
  canRun: () => boolean
  /** 重试耗尽时上报，端口最终仍有持久连接 */
  onExhausted: (ports: number[]) => void
  /** 重试间隔，默认 5 秒 */
  intervalMs?: number
  /** 最大尝试次数，默认 3 次 */
  maxAttempts?: number
  /** killer 单次执行超时，默认 30 秒，防止远端 hang 卡死队列 */
  killerTimeoutMs?: number
}

/**
 * 端口杀异步重试队列。
 *
 * 业务语义：proxy 删除后第一次杀连接若仍有残留，给客户端自然 close / TCP keepalive 超时窗口，
 * 不立即报错。所有待重试端口聚合到单批量 timer，下次触发时一条 SSH 命令处理整批，
 * 避免 N 个并发 SSH exec。
 *
 * 并发契约：
 * - 单 worker：同时只有一个 process() 在跑（processing flag）
 * - 单 timer：同时只有一个 schedule（timer 非空时跳过）
 * - generation：clear() 时递增，让正在 await 的 process() 检测到中断后放弃写回
 */
export class PortKillQueue {
  private retries = new Map<number, number>() // port -> attempts done
  private timer: ReturnType<typeof setTimeout> | null = null
  private processing = false
  private generation = 0

  private readonly killer: PortKillQueueOptions['killer']
  private readonly canRun: PortKillQueueOptions['canRun']
  private readonly onExhausted: PortKillQueueOptions['onExhausted']
  private readonly intervalMs: number
  private readonly maxAttempts: number
  private readonly killerTimeoutMs: number

  constructor(opts: PortKillQueueOptions) {
    this.killer = opts.killer
    this.canRun = opts.canRun
    this.onExhausted = opts.onExhausted
    this.intervalMs = opts.intervalMs ?? 5_000
    this.maxAttempts = opts.maxAttempts ?? 3
    this.killerTimeoutMs = opts.killerTimeoutMs ?? 30_000
  }

  /** 入队等待重试。已在队列中的 port 保留其 attempts，新入队的从 0 开始。 */
  enqueue(ports: number[]): void {
    if (ports.length === 0) return
    for (const port of ports) {
      if (!this.retries.has(port)) this.retries.set(port, 0)
    }
    this.schedule()
  }

  /** 取消所有挂起重试并清空队列。正在执行的 process() 通过 generation 校验自我中止。 */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.retries.clear()
    this.generation++
  }

  private schedule(): void {
    if (this.timer || this.processing) return
    if (this.retries.size === 0) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.process().catch((err) => {
        logger.warn('[PortKillQueue] process error:', err)
      })
    }, this.intervalMs)
  }

  private async process(): Promise<void> {
    if (this.processing) return
    this.processing = true
    const generation = this.generation
    try {
      if (!this.canRun()) {
        this.retries.clear()
        return
      }
      const batch = Array.from(this.retries.keys())
      if (batch.length === 0) return

      // killer 套 timeout，防止远端 hang 让 processing 永远 true 导致死锁
      const timeout = new Promise<number[]>((resolve) =>
        setTimeout(() => resolve(batch), this.killerTimeoutMs)
      )
      const remaining = await Promise.race([
        this.killer(batch).catch((err) => {
          logger.warn('[PortKillQueue] killer threw:', err)
          return batch
        }),
        timeout
      ])

      // await 期间被 clear()，generation 已变 → 放弃写回，避免把已清掉的端口加回去
      if (generation !== this.generation) return

      const remainingSet = new Set(remaining)
      const exhausted: number[] = []
      for (const port of batch) {
        if (!remainingSet.has(port)) {
          this.retries.delete(port)
          continue
        }
        const attempts = (this.retries.get(port) ?? 0) + 1
        if (attempts >= this.maxAttempts) {
          this.retries.delete(port)
          exhausted.push(port)
        } else {
          this.retries.set(port, attempts)
        }
      }

      if (exhausted.length > 0) {
        logger.warn(`[PortKillQueue] exhausted: ${exhausted.join(',')}`)
        this.onExhausted(exhausted)
      }
    } finally {
      this.processing = false
      // 调度只看队列是否非空，与 generation 无关：
      // generation 失配只影响"是否写回旧 batch 结果"，不影响"新入队 port 是否需要处理"
      if (this.retries.size > 0) this.schedule()
    }
  }
}
