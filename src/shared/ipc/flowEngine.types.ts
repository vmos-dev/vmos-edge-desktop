export const FLOW_ENGINE_EVENTS = {
  CHECK_UPDATE: 'FLOW_ENGINE:CHECK_UPDATE',
  DEPLOY: 'FLOW_ENGINE:DEPLOY',
  DEPLOY_PROGRESS: 'FLOW_ENGINE:DEPLOY_PROGRESS'
} as const

export type FlowEngineInstallStrategy = 'none' | 'install' | 'update' | 'unreachable'

export interface FlowEngineVersionInfo {
  version?: string
  versionCode?: number
}

export interface CheckUpdatePayload {
  hostIp: string
}

export interface CheckUpdateResult {
  strategy: FlowEngineInstallStrategy
  current?: FlowEngineVersionInfo
  bundled: Required<FlowEngineVersionInfo>
  error?: string
}

export interface DeployPayload {
  hostIp: string
  password: string
}

export type DeployStep = 'connecting' | 'uploading' | 'installing' | 'verifying'

export interface DeployProgress {
  step: DeployStep
  detail?: string
}

export interface DeployResult {
  success: boolean
  version?: string
  versionCode?: number
  error?: string
}
