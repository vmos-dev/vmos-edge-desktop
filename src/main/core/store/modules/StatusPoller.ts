import { FlowEngineClient } from '../../client/FlowEngineClient'
import { FLOW_ENGINE_PORT } from '@shared/constant/flowEngine'
import type { FlowStatusFoundItem } from '@shared/ipc/flowEngine.api.types'
import type { BatchTaskItemRow } from '../../dao/BatchTaskItemDao'
import { logger } from '../../logger'

export interface PollResult {
  deviceId: string
  status: string
  progressTotal: number
  progressCompleted: number
  error: string | null
  durationMs: number | null
}

export type OnChangeCallback = (batchTaskId: string, changes: PollResult[]) => void

const MAX_HOST_FAILURES = 10
const MAX_CONCURRENCY = 10
const BASE_INTERVAL_MS = 1000
const MAX_INTERVAL_MS = 10000

export class StatusPoller {
  private timer: ReturnType<typeof setTimeout> | null = null
  private polling = false
  private consecutiveFailures = new Map<string, number>()
  private clients = new Map<string, FlowEngineClient>()
  private activeItemsFn: (() => BatchTaskItemRow[]) | null = null

  constructor(private onChange: OnChangeCallback) {}

  start(getActiveItems: () => BatchTaskItemRow[]): void {
    this.stop()
    this.activeItemsFn = getActiveItems
    this.scheduleNext(BASE_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.activeItemsFn = null
    this.polling = false
    this.clients.clear()
    this.consecutiveFailures.clear()
  }

  async poll(activeItems: BatchTaskItemRow[]): Promise<void> {
    if (activeItems.length === 0) return

    const byHost = this.groupByHost(activeItems)
    const hostEntries = Array.from(byHost.entries())

    for (let i = 0; i < hostEntries.length; i += MAX_CONCURRENCY) {
      const batch = hostEntries.slice(i, i + MAX_CONCURRENCY)
      await Promise.allSettled(batch.map(([hostIp, items]) => this.pollHost(hostIp, items)))
    }
  }

  private async pollHost(hostIp: string, items: BatchTaskItemRow[]): Promise<void> {
    const client = this.getClient(hostIp)
    const deviceIds = items.map((i) => i.device_id)

    try {
      const resp = await client.status({ deviceIds })
      this.consecutiveFailures.set(hostIp, 0)

      const changes: PollResult[] = []
      for (const result of resp.results) {
        if (!result.found) {
          const local = items.find((i) => i.device_id === result.deviceId)
          if (local && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(local.status)) {
            changes.push({
              deviceId: result.deviceId,
              status: 'FAILED',
              progressTotal: local.progress_total,
              progressCompleted: local.progress_completed,
              error: 'Task not found on remote engine (engine may have restarted)',
              durationMs: null
            })
          }
          continue
        }
        const found = result as FlowStatusFoundItem
        const local = items.find((i) => i.device_id === found.deviceId)
        if (!local) continue

        const changed =
          local.status !== found.task.status ||
          local.progress_completed !== found.task.progress.completed ||
          local.error !== found.task.error

        if (changed) {
          changes.push({
            deviceId: found.deviceId,
            status: found.task.status,
            progressTotal: found.task.progress.total,
            progressCompleted: found.task.progress.completed,
            error: found.task.error,
            durationMs: found.task.durationMs
          })
        }
      }

      if (changes.length > 0) {
        const byBatchTask = new Map<string, PollResult[]>()
        for (const change of changes) {
          const item = items.find((i) => i.device_id === change.deviceId)
          if (!item) continue
          const list = byBatchTask.get(item.batch_task_id) ?? []
          list.push(change)
          byBatchTask.set(item.batch_task_id, list)
        }
        for (const [batchTaskId, batchChanges] of byBatchTask) {
          this.onChange(batchTaskId, batchChanges)
        }
      }
    } catch (err) {
      const failures = (this.consecutiveFailures.get(hostIp) ?? 0) + 1
      this.consecutiveFailures.set(hostIp, failures)
      if (failures >= MAX_HOST_FAILURES) {
        const msg = `host ${hostIp} unreachable after ${failures} consecutive polls`
        logger.error(`[StatusPoller] ${msg}, marking items as FAILED`)
        const failChanges: PollResult[] = items.map((i) => ({
          deviceId: i.device_id,
          status: 'FAILED',
          progressTotal: i.progress_total,
          progressCompleted: i.progress_completed,
          error: msg,
          durationMs: null
        }))
        const byBatchTask = new Map<string, PollResult[]>()
        for (let idx = 0; idx < failChanges.length; idx++) {
          const key = items[idx].batch_task_id
          const list = byBatchTask.get(key) ?? []
          list.push(failChanges[idx])
          byBatchTask.set(key, list)
        }
        for (const [batchTaskId, batchChanges] of byBatchTask) {
          this.onChange(batchTaskId, batchChanges)
        }
        this.consecutiveFailures.delete(hostIp)
        this.clients.delete(hostIp)
      } else if (failures >= 3) {
        logger.warn(`[StatusPoller] host ${hostIp} unreachable for ${failures} consecutive polls`)
      }
    }
  }

  private scheduleNext(delayMs: number): void {
    const clamped = Math.min(delayMs, MAX_INTERVAL_MS)
    this.timer = setTimeout(async () => {
      this.timer = null

      if (this.polling) {
        if (this.activeItemsFn) this.scheduleNext(clamped)
        return
      }

      const items = this.activeItemsFn?.() ?? []
      if (items.length === 0) {
        this.stop()
        return
      }

      this.polling = true
      const start = Date.now()
      try {
        await this.poll(items)
      } finally {
        this.polling = false
      }

      if (!this.activeItemsFn) return

      const elapsed = Date.now() - start
      const hostCount = new Set(items.map((i) => i.host_ip)).size
      const nextDelay = Math.max(BASE_INTERVAL_MS, elapsed, hostCount * 100)
      this.scheduleNext(nextDelay)
    }, clamped)
  }

  private getClient(hostIp: string): FlowEngineClient {
    let client = this.clients.get(hostIp)
    if (!client) {
      client = new FlowEngineClient(hostIp, FLOW_ENGINE_PORT)
      this.clients.set(hostIp, client)
    }
    return client
  }

  private groupByHost(items: BatchTaskItemRow[]): Map<string, BatchTaskItemRow[]> {
    const map = new Map<string, BatchTaskItemRow[]>()
    for (const item of items) {
      const list = map.get(item.host_ip) ?? []
      list.push(item)
      map.set(item.host_ip, list)
    }
    return map
  }
}
