import { hostManager, deviceManager, type Host } from '../store/managers'
import { TaskQueue } from '../utils/TaskQueue'
import { isAxiosError } from '../../../shared/api/request'
import { logger } from '../logger'

export class HostScannerQueue {
  private taskQueue: TaskQueue
  private scanIntervalMs = 3000
  private intervalHandle: NodeJS.Timeout | null = null
  private runningHosts: Set<string> = new Set()
  private stopped = false
  private readonly concurrency: number

  constructor(concurrency = 10) {
    this.concurrency = concurrency
    this.taskQueue = new TaskQueue(concurrency)
  }

  /** 启动扫描循环 */
  public start() {
    if (this.intervalHandle) {
      logger.warn('[HostScannerQueue] start: already started, skipping')
      return // 已经启动
    }
    this.stopped = false
    this.intervalHandle = setInterval(() => this.loop(), this.scanIntervalMs)
    logger.info(
      `[HostScannerQueue] start: interval=${this.scanIntervalMs}ms, concurrency=${this.concurrency}`
    )
  }

  /** 停止扫描循环 */
  public stop() {
    logger.info('[HostScannerQueue] stop: stopping scanner')
    this.stopped = true
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    // 清空等待队列（可选）
    this.taskQueue.clear()
    logger.info(`[HostScannerQueue] stop: cleared, runningHosts=${this.runningHosts.size}`)
  }

  /** 主循环：遍历所有 host 加入任务队列 */
  private loop() {
    if (this.stopped) return

    const loopStartTime = Date.now()
    const hosts = hostManager.getHosts()
    let addedCount = 0
    let skippedCount = 0

    for (const host of hosts) {
      const ip = host.ip
      if (!ip) {
        skippedCount++
        continue
      }

      // 正在运行或者队列中已有任务就跳过
      if (this.runningHosts.has(ip)) {
        skippedCount++
        continue
      }

      // 立即标记为正在处理，防止重复添加
      this.runningHosts.add(ip)

      this.taskQueue.add(() => this.scanHost(host))
      addedCount++
    }

    const loopDuration = Date.now() - loopStartTime
    logger.debug(
      `[HostScannerQueue] loop: totalHosts=${hosts.length}, added=${addedCount}, skipped=${skippedCount}, running=${this.runningHosts.size}, pending=${this.taskQueue.pendingCount}, duration=${loopDuration}ms`
    )
  }

  /** 扫描单个 host，带 running 状态 */
  private async scanHost(host: Host) {
    const ip = host.ip
    const scanStartTime = Date.now()
    logger.debug(`[HostScannerQueue] scanHost: starting hostId=${host.id}, ip=${ip}`)

    try {
      await deviceManager.syncHostDevices(ip)
      const scanDuration = Date.now() - scanStartTime
      logger.info(
        `[HostScannerQueue] scanHost success: hostId=${host.id}, ip=${ip}, duration=${scanDuration}ms, hostStatus=${host.status}`
      )

      // 如果同步成功，确保标记为在线
      if (host.status !== 'online') {
        try {
          logger.debug(
            `[HostScannerQueue] scanHost: marking host online hostId=${host.id}, ip=${ip}`
          )
          hostManager.updateHost(host.id, { status: 'online', lastActiveTime: Date.now() })
        } catch (error) {
          // 标记在线失败不影响主流程
          logger.error(`[HostScannerQueue] scanHost: markHostOnline failed for ${host.id}:`, {
            error,
            stack: error instanceof Error ? error.stack : undefined,
            hostId: host.id,
            ip
          })
        }
      }
    } catch (err: any) {
      const scanDuration = Date.now() - scanStartTime
      logger.warn(
        `[HostScannerQueue] scanHost failed: hostId=${host.id}, ip=${ip}, duration=${scanDuration}ms`,
        {
          error: err,
          message: err?.message || String(err),
          stack: err instanceof Error ? err.stack : undefined
        }
      )

      // 判断是否离线：
      // 1. 如果 err 不是 Error 对象（通常是后端返回的业务错误对象），说明网络通畅
      // 2. 如果是 AxiosError 且有 response，说明连通了（HTTP 状态码错误）
      // 3. 其他情况（如超时、网络断开）视为离线
      const isOnline = !(err instanceof Error) || (isAxiosError(err) && err.response !== undefined)
      logger.debug(
        `[HostScannerQueue] scanHost: isOnline=${isOnline} for hostId=${host.id}, ip=${ip}`
      )

      if (!isOnline) {
        try {
          logger.info(
            `[HostScannerQueue] scanHost: marking host offline hostId=${host.id}, ip=${ip}`
          )
          hostManager.markHostOffline(host.id)
        } catch (error) {
          // 标记离线失败不影响主流程
          logger.error(`[HostScannerQueue] scanHost: markHostOffline failed for ${host.id}:`, {
            error,
            stack: error instanceof Error ? error.stack : undefined,
            hostId: host.id,
            ip
          })
        }
      }
    } finally {
      this.runningHosts.delete(ip)
      logger.debug(
        `[HostScannerQueue] scanHost: completed hostId=${host.id}, ip=${ip}, runningHosts=${this.runningHosts.size}`
      )
    }
  }

  /** 查询当前队列和运行状态 */
  public status() {
    return {
      runningHosts: Array.from(this.runningHosts),
      pendingTasks: this.taskQueue.pendingCount,
      concurrency: this.taskQueue.running
    }
  }
}
