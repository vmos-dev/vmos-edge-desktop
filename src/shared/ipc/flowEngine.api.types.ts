// ─── 通用响应信封 ───
export interface FlowApiEnvelope<T> {
  code: number
  message: string
  data: T | null
}

// ─── POST /flow/execute ───
export interface FlowExecuteRequest {
  yaml: string
  devices: FlowDevicePayload[]
}
export interface FlowDevicePayload {
  baseUrl: string
  deviceId: string
  name?: string
  env?: Record<string, string>
}
export type FlowExecuteSuccessItem = { deviceId: string; success: true; taskId: string }
export type FlowExecuteFailItem = { deviceId: string; success: false; code: number; error: string }
export interface FlowExecuteResponse {
  total: number
  succeeded: number
  failed: number
  results: (FlowExecuteSuccessItem | FlowExecuteFailItem)[]
}

// ─── POST /flow/status ───
export interface FlowStatusRequest {
  deviceIds: string[]
}
export type FlowStatusFoundItem = { deviceId: string; found: true; task: FlowTaskShape }
export type FlowStatusMissingItem = { deviceId: string; found: false; task: null }
export interface FlowStatusResponse {
  total: number
  found: number
  missing: number
  results: (FlowStatusFoundItem | FlowStatusMissingItem)[]
}

// ─── POST /flow/cancel ───
export interface FlowCancelRequest {
  deviceIds: string[]
}
export type FlowCancelSuccessItem = { deviceId: string; success: true }
export type FlowCancelFailItem = { deviceId: string; success: false; code: number; error: string }
export interface FlowCancelResponse {
  total: number
  succeeded: number
  failed: number
  results: (FlowCancelSuccessItem | FlowCancelFailItem)[]
}

// ─── POST /flow/delete ───
export interface FlowDeleteRequest {
  taskIds: string[]
}
export type FlowDeleteSuccessItem = { taskId: string; success: true }
export type FlowDeleteFailItem = { taskId: string; success: false; code: number; error: string }
export interface FlowDeleteResponse {
  total: number
  succeeded: number
  failed: number
  results: (FlowDeleteSuccessItem | FlowDeleteFailItem)[]
}

// ─── TaskShape ───
export type FlowTaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
export type FlowStepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WARNED' | 'SKIPPED'

export interface FlowTaskShape {
  taskId: string
  deviceId: string
  status: FlowTaskStatus
  flowName: string | null
  appId: string | null
  progress: { total: number; completed: number; current: number }
  steps: FlowStepRecord[]
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  durationMs: number | null
  error: string | null
}

export interface FlowStepRecord {
  index: number
  command: unknown
  status: FlowStepStatus
  metadata: {
    logMessages: string[]
    insight: { message: string; level: 'NONE' | 'INFO' | 'WARNING' | 'ERROR' }
  }
  startedAt?: number
  completedAt?: number
  error?: string
  screenshot?: string
  children?: FlowStepRecord[]
}

// ─── flow-engine IPC 通道（renderer → main → flow-engine 代理） ───
export const FLOW_EVENTS = {
  EXECUTE: 'FLOW:EXECUTE',
  STATUS: 'FLOW:STATUS',
  CANCEL: 'FLOW:CANCEL'
} as const

// ─── IPC payload（renderer → main） ───
export interface FlowIpcExecutePayload {
  hostIp: string
  yaml: string
  devices: FlowDevicePayload[]
}

export interface FlowIpcStatusPayload {
  hostIp: string
  deviceIds: string[]
}

export interface FlowIpcCancelPayload {
  hostIp: string
  deviceIds: string[]
}
