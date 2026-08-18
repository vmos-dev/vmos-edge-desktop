import type { FlowTaskStatus, FlowStepRecord } from './flowEngine.api.types'

// ─── IPC 通道 ───
export const BATCH_TASK_EVENTS = {
  CREATE: 'BATCH_TASK:CREATE',
  LIST: 'BATCH_TASK:LIST',
  GET: 'BATCH_TASK:GET',
  CANCEL: 'BATCH_TASK:CANCEL',
  CANCEL_ITEM: 'BATCH_TASK:CANCEL_ITEM',
  RETRY_FAILED: 'BATCH_TASK:RETRY_FAILED',
  DELETE: 'BATCH_TASK:DELETE',
  STATUS_CHANGED: 'BATCH_TASK:STATUS_CHANGED',
  ITEM_DETAIL: 'BATCH_TASK:ITEM_DETAIL'
} as const

// ─── 状态枚举 ───
export type BatchTaskStatus = 'RUNNING' | 'DONE' | 'CANCELLED'
export type BatchTaskItemStatus = FlowTaskStatus | 'SUBMIT_FAILED'

// ─── 领域模型 ───
export interface BatchTask {
  id: string
  name: string
  workflowId: string
  workflowName: string
  appId: string
  appName: string
  yamlText: string
  totalDevices: number
  status: BatchTaskStatus
  createdAt: number
  completedAt: number | null
}

export interface BatchTaskItem {
  id: string
  batchTaskId: string
  deviceId: string
  deviceName: string
  hostIp: string
  envJson: string
  remoteTaskId: string | null
  status: BatchTaskItemStatus
  progressTotal: number
  progressCompleted: number
  error: string | null
  durationMs: number | null
  createdAt: number
}

// ─── IPC 请求/响应 ───
export interface CreateBatchTaskPayload {
  name?: string
  workflowId: string
  workflowName: string
  appId: string
  appName: string
  yamlText: string
  devices: Array<{
    id: string
    name: string
    hostIp: string
    baseUrl: string
    env?: Record<string, string>
  }>
}

export interface BatchTaskListPayload {
  status?: BatchTaskStatus
  offset?: number
  limit?: number
}

export interface BatchTaskListResult {
  tasks: (BatchTask & { summary: BatchTaskSummary })[]
  total: number
}

export interface BatchTaskSummary {
  completed: number
  failed: number
  running: number
  pending: number
  cancelled: number
  submitFailed: number
}

export interface BatchTaskDetailResult {
  task: BatchTask
  items: BatchTaskItem[]
}

export interface CancelBatchPayload {
  batchTaskId: string
  deviceIds?: string[]
}

export interface RetryFailedPayload {
  batchTaskId: string
}

export interface ItemDetailPayload {
  batchTaskId: string
  deviceId: string
}

export interface ItemDetailResult {
  item: BatchTaskItem
  steps: FlowStepRecord[]
}

export interface StatusChangedEvent {
  batchTaskId: string
  batchStatus: BatchTaskStatus
  changedItems: Array<{
    deviceId: string
    status: BatchTaskItemStatus
    progressTotal: number
    progressCompleted: number
    error: string | null
  }>
  summary: BatchTaskSummary
}
