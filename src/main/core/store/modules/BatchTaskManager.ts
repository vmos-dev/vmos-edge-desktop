import { randomUUID } from 'node:crypto'
import { BaseManager } from './BaseManager'
import { BatchTaskDao, type BatchTaskRow } from '../../dao/BatchTaskDao'
import { BatchTaskItemDao, type BatchTaskItemRow } from '../../dao/BatchTaskItemDao'
import { FlowEngineClient } from '../../client/FlowEngineClient'
import { StatusPoller, type PollResult } from './StatusPoller'
import { FLOW_ENGINE_PORT } from '@shared/constant/flowEngine'
import { BATCH_TASK_EVENTS } from '@shared/ipc/batchTask.types'
import type {
  CreateBatchTaskPayload,
  BatchTask,
  BatchTaskItem,
  BatchTaskSummary,
  BatchTaskStatus,
  BatchTaskItemStatus,
  StatusChangedEvent
} from '@shared/ipc/batchTask.types'
import type { FlowDevicePayload, FlowStepRecord } from '@shared/ipc/flowEngine.api.types'
import { logger } from '../../logger'

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'SUBMIT_FAILED'])

export class BatchTaskManager extends BaseManager {
  private taskDao: BatchTaskDao
  private itemDao: BatchTaskItemDao
  private poller: StatusPoller

  constructor() {
    super()
    this.taskDao = new BatchTaskDao(this.dbInstance)
    this.itemDao = new BatchTaskItemDao(this.dbInstance)
    this.poller = new StatusPoller((batchTaskId, changes) =>
      this.handlePollChanges(batchTaskId, changes)
    )
  }

  async recover(): Promise<void> {
    const runningTasks = this.taskDao.findRunning()
    if (runningTasks.length === 0) return

    logger.info(`[BatchTaskManager] Recovering ${runningTasks.length} running tasks`)

    for (const task of runningTasks) {
      const orphaned = this.itemDao.findOrphanedByBatchTaskId(task.id)
      if (orphaned.length > 0) {
        logger.warn(
          `[BatchTaskManager] Marking ${orphaned.length} orphaned items as SUBMIT_FAILED for task ${task.id}`
        )
        for (const item of orphaned) {
          this.itemDao.updateStatus(item.id, {
            status: 'SUBMIT_FAILED',
            error: 'Client closed before submission completed'
          })
        }
      }

      const activeItems = this.itemDao.findActiveByBatchTaskId(task.id)
      if (activeItems.length === 0) {
        this.taskDao.update(task.id, { status: 'DONE', completed_at: Date.now() })
        continue
      }
      await this.poller.poll(activeItems)
    }

    this.startPollingIfNeeded()
  }

  destroy(): void {
    this.poller.stop()
  }

  async create(payload: CreateBatchTaskPayload): Promise<{ batchTaskId: string }> {
    const batchTaskId = randomUUID()
    const now = Date.now()

    this.taskDao.insert({
      id: batchTaskId,
      name:
        payload.name?.trim() ||
        `${payload.workflowName} #${new Date().toLocaleDateString('zh-CN').replace(/\//g, '')}-${Date.now().toString(36).slice(-4)}`,
      workflow_id: payload.workflowId,
      workflow_name: payload.workflowName,
      app_id: payload.appId,
      app_name: payload.appName,
      yaml_text: payload.yamlText,
      total_devices: payload.devices.length,
      status: 'RUNNING',
      created_at: now,
      completed_at: null
    })

    const items: BatchTaskItemRow[] = payload.devices.map((d) => ({
      id: randomUUID(),
      batch_task_id: batchTaskId,
      device_id: d.id,
      device_name: d.name,
      host_ip: d.hostIp,
      base_url: d.baseUrl,
      env_json: JSON.stringify(d.env ?? {}),
      remote_task_id: null,
      status: 'PENDING',
      progress_total: 0,
      progress_completed: 0,
      error: null,
      duration_ms: null,
      created_at: now
    }))

    for (const item of items) {
      this.itemDao.insert(item)
    }

    await this.submitToEngines(batchTaskId, payload.yamlText, items)
    this.startPollingIfNeeded()

    return { batchTaskId }
  }

  list(offset = 0, limit = 50, status?: string) {
    const tasks = this.taskDao.listRecent(offset, limit, status)
    const total = this.taskDao.countAll(status)
    return {
      tasks: tasks.map((row) => ({
        ...this.rowToTask(row),
        summary: this.getSummary(row.id)
      })),
      total
    }
  }

  get(batchTaskId: string) {
    const row = this.taskDao.getById(batchTaskId)
    if (!row) return null
    return {
      task: this.rowToTask(row),
      items: this.itemDao.findByBatchTaskId(batchTaskId).map(this.rowToItem)
    }
  }

  async getItemSteps(
    batchTaskId: string,
    deviceId: string
  ): Promise<{
    item: BatchTaskItem
    steps: FlowStepRecord[]
  } | null> {
    const items = this.itemDao.findByBatchTaskId(batchTaskId)
    const item = items.find((i) => i.device_id === deviceId)
    if (!item) return null

    let steps: FlowStepRecord[] = []
    if (item.remote_task_id) {
      try {
        const client = new FlowEngineClient(item.host_ip, FLOW_ENGINE_PORT)
        const task = await client.getTask(item.remote_task_id)
        if (task) {
          steps = task.steps ?? []
        }
      } catch {
        logger.warn(`[BatchTaskManager] getItemSteps: flow-engine unreachable for ${item.host_ip}`)
      }
    }

    return { item: this.rowToItem(item), steps }
  }

  async cancel(batchTaskId: string, deviceIds?: string[]): Promise<void> {
    const items = deviceIds
      ? this.itemDao
          .findByBatchTaskId(batchTaskId)
          .filter((i) => deviceIds.includes(i.device_id) && !TERMINAL_STATUSES.has(i.status))
      : this.itemDao.findActiveByBatchTaskId(batchTaskId)

    if (items.length === 0) return

    const byHost = this.groupByHost(items)
    await Promise.allSettled(
      Array.from(byHost.entries()).map(async ([hostIp, hostItems]) => {
        const client = new FlowEngineClient(hostIp, FLOW_ENGINE_PORT)
        const ids = hostItems.map((i) => i.device_id)
        try {
          await client.cancel({ deviceIds: ids })
        } catch {
          logger.warn(`[BatchTaskManager] cancel remote failed for host ${hostIp}, marking locally`)
        }
        for (const i of hostItems) {
          this.itemDao.updateStatus(i.id, { status: 'CANCELLED' })
        }
      })
    )

    if (!deviceIds) {
      this.taskDao.update(batchTaskId, { status: 'CANCELLED', completed_at: Date.now() })
    }

    this.checkBatchCompletion(batchTaskId)
    this.pushStatusChanged(batchTaskId)
  }

  async retryFailed(batchTaskId: string): Promise<void> {
    const task = this.taskDao.getById(batchTaskId)
    if (!task) return

    const failedItems = this.itemDao.findFailedByBatchTaskId(batchTaskId)
    if (failedItems.length === 0) return

    for (const item of failedItems) {
      this.itemDao.updateStatus(item.id, {
        status: 'PENDING',
        remote_task_id: null,
        error: null,
        progress_total: 0,
        progress_completed: 0,
        duration_ms: null
      })
    }

    this.taskDao.update(batchTaskId, { status: 'RUNNING', completed_at: null })
    const refreshed = this.itemDao.findActiveByBatchTaskId(batchTaskId)
    await this.submitToEngines(batchTaskId, task.yaml_text, refreshed)
    this.startPollingIfNeeded()
    this.pushStatusChanged(batchTaskId)
  }

  async delete(batchTaskId: string): Promise<boolean> {
    const task = this.taskDao.getById(batchTaskId)
    if (!task || task.status === 'RUNNING') return false

    const items = this.itemDao.findByBatchTaskId(batchTaskId)
    const byHost = this.groupByHost(items.filter((i) => i.remote_task_id))

    await Promise.allSettled(
      Array.from(byHost.entries()).map(async ([hostIp, hostItems]) => {
        const client = new FlowEngineClient(hostIp, FLOW_ENGINE_PORT)
        const taskIds = hostItems.map((i) => i.remote_task_id!)
        try {
          await client.delete({ taskIds })
        } catch {
          logger.warn(`[BatchTaskManager] remote delete failed for host ${hostIp}`)
        }
      })
    )

    this.itemDao.deleteByBatchTaskId(batchTaskId)
    return this.taskDao.delete(batchTaskId)
  }

  private async submitToEngines(
    batchTaskId: string,
    yaml: string,
    items: BatchTaskItemRow[]
  ): Promise<void> {
    const byHost = this.groupByHost(items)

    await Promise.allSettled(
      Array.from(byHost.entries()).map(async ([hostIp, hostItems]) => {
        const client = new FlowEngineClient(hostIp, FLOW_ENGINE_PORT)
        const devices: FlowDevicePayload[] = hostItems.map((i) => ({
          baseUrl: i.base_url,
          deviceId: i.device_id,
          name: i.device_name,
          env: JSON.parse(i.env_json)
        }))

        try {
          const resp = await client.execute({ yaml, devices })
          for (const result of resp.results) {
            const item = hostItems.find((i) => i.device_id === result.deviceId)
            if (!item) continue
            if (result.success) {
              this.itemDao.updateStatus(item.id, { remote_task_id: result.taskId })
            } else {
              this.itemDao.updateStatus(item.id, {
                status: 'SUBMIT_FAILED',
                error: result.error
              })
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          for (const item of hostItems) {
            this.itemDao.updateStatus(item.id, {
              status: 'SUBMIT_FAILED',
              error: msg
            })
          }
        }
      })
    )

    this.checkBatchCompletion(batchTaskId)
  }

  private handlePollChanges(batchTaskId: string, changes: PollResult[]): void {
    const items = this.itemDao.findByBatchTaskId(batchTaskId)
    for (const change of changes) {
      const item = items.find((i) => i.device_id === change.deviceId)
      if (!item) continue

      this.itemDao.updateStatus(item.id, {
        status: change.status,
        progress_total: change.progressTotal,
        progress_completed: change.progressCompleted,
        error: change.error,
        duration_ms: change.durationMs
      })
    }

    this.checkBatchCompletion(batchTaskId)
    this.pushStatusChanged(batchTaskId)
  }

  private checkBatchCompletion(batchTaskId: string): void {
    const active = this.itemDao.findActiveByBatchTaskId(batchTaskId)
    if (active.length === 0) {
      const task = this.taskDao.getById(batchTaskId)
      if (task && task.status === 'RUNNING') {
        this.taskDao.update(batchTaskId, { status: 'DONE', completed_at: Date.now() })
      }
    }
  }

  private pushStatusChanged(batchTaskId: string): void {
    const task = this.taskDao.getById(batchTaskId)
    if (!task) return

    const items = this.itemDao.findByBatchTaskId(batchTaskId)
    const event: StatusChangedEvent = {
      batchTaskId,
      batchStatus: task.status as BatchTaskStatus,
      changedItems: items.map((i) => ({
        deviceId: i.device_id,
        status: i.status as BatchTaskItemStatus,
        progressTotal: i.progress_total,
        progressCompleted: i.progress_completed,
        error: i.error
      })),
      summary: this.getSummary(batchTaskId)
    }

    this.notifyFrontend(BATCH_TASK_EVENTS.STATUS_CHANGED, event)
  }

  private getSummary(batchTaskId: string): BatchTaskSummary {
    const rows = this.itemDao.summaryByBatchTaskId(batchTaskId)
    const summary: BatchTaskSummary = {
      completed: 0,
      failed: 0,
      running: 0,
      pending: 0,
      cancelled: 0,
      submitFailed: 0
    }
    for (const row of rows) {
      switch (row.status) {
        case 'COMPLETED':
          summary.completed = row.cnt
          break
        case 'FAILED':
          summary.failed = row.cnt
          break
        case 'RUNNING':
          summary.running = row.cnt
          break
        case 'PENDING':
          summary.pending = row.cnt
          break
        case 'CANCELLED':
          summary.cancelled = row.cnt
          break
        case 'SUBMIT_FAILED':
          summary.submitFailed = row.cnt
          break
      }
    }
    return summary
  }

  private startPollingIfNeeded(): void {
    this.poller.stop()

    const runningTasks = this.taskDao.findRunning()
    if (runningTasks.length === 0) return

    this.poller.start(() => {
      const items: BatchTaskItemRow[] = []
      for (const task of this.taskDao.findRunning()) {
        items.push(...this.itemDao.findActiveByBatchTaskId(task.id))
      }
      return items
    })
  }

  private rowToTask(row: BatchTaskRow): BatchTask {
    return {
      id: row.id,
      name: row.name,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name,
      appId: row.app_id,
      appName: row.app_name,
      yamlText: row.yaml_text,
      totalDevices: row.total_devices,
      status: row.status as BatchTaskStatus,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }
  }

  private rowToItem(row: BatchTaskItemRow): BatchTaskItem {
    return {
      id: row.id,
      batchTaskId: row.batch_task_id,
      deviceId: row.device_id,
      deviceName: row.device_name,
      hostIp: row.host_ip,
      envJson: row.env_json,
      remoteTaskId: row.remote_task_id,
      status: row.status as BatchTaskItemStatus,
      progressTotal: row.progress_total,
      progressCompleted: row.progress_completed,
      error: row.error,
      durationMs: row.duration_ms,
      createdAt: row.created_at
    }
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
