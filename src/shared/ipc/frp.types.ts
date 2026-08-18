// src/shared/ipc/frp.types.ts

export const FRP_EVENTS = {
  TEST_CONNECTION: 'FRP:TEST_CONNECTION',
  DEPLOY: 'FRP:DEPLOY',
  START: 'FRP:START',
  STOP: 'FRP:STOP',
  UNINSTALL: 'FRP:UNINSTALL',
  UNINSTALL_LOCAL: 'FRP:UNINSTALL_LOCAL',
  GET_STATUS: 'FRP:GET_STATUS',
  GET_CONFIG: 'FRP:GET_CONFIG',
  UPDATE_CONFIG: 'FRP:UPDATE_CONFIG',
  RECONFIGURE: 'FRP:RECONFIGURE',
  GET_MAPPINGS: 'FRP:GET_MAPPINGS',
  GET_ENABLED_STATES: 'FRP:GET_ENABLED_STATES',
  TOGGLE_HOST: 'FRP:TOGGLE_HOST',
  TOGGLE_DEVICE: 'FRP:TOGGLE_DEVICE',
  BATCH_TOGGLE: 'FRP:BATCH_TOGGLE',
  CLEAN_ORPHANS: 'FRP:CLEAN_ORPHANS',
  DEPLOY_SCREEN: 'FRP:DEPLOY_SCREEN',
  UPDATE_SCREEN_CONFIG: 'FRP:UPDATE_SCREEN_CONFIG',
  UNINSTALL_SCREEN: 'FRP:UNINSTALL_SCREEN',

  // push（主进程→前端）
  DEPLOY_PROGRESS: 'FRP:DEPLOY_PROGRESS',
  SCREEN_PROGRESS: 'FRP:SCREEN_PROGRESS',
  STATUS_CHANGED: 'FRP:STATUS_CHANGED',
  MAPPINGS_UPDATED: 'FRP:MAPPINGS_UPDATED',
  CONNECTIONS_PERSIST: 'FRP:CONNECTIONS_PERSIST'
}

export type FrpConfigStatus = 'idle' | 'stopped' | 'deploying' | 'running' | 'error'
export type FrpDeployMode = 'public' | 'nat'

export interface FrpConfig {
  id: string
  deploy_mode: FrpDeployMode
  server_host: string
  ssh_port: number
  ssh_user: string
  ssh_password: string
  frps_port: number
  frps_token: string
  port_range_start: number
  port_range_end: number
  public_host: string
  public_frps_port: number
  frps_dashboard_port: number
  public_frps_dashboard_port: number
  frps_dashboard_user: string
  frps_dashboard_password: string
  frpc_admin_port: number
  map_host_port: number
  map_adb: number
  map_video: number
  map_control: number
  map_audio: number
  status: FrpConfigStatus
  deploy_step: string
  frps_version: string
  proxy_bind_local: number
  screen_enabled: number
  screen_port: number
  screen_public_port: number
  screen_ssl_cert: string
  screen_ssl_key: string
  created_at: number
  updated_at: number
}

export interface FrpHost {
  id: string // = host_ip
  enabled: number
  updated_at: number
}

export interface FrpDevice {
  id: string // = device_id
  host_ip: string
  enabled: number
}

export interface FrpMapping {
  id: string // proxy name: {hostIp}-{deviceId}-{portType}
  host_id: string
  host_ip: string
  device_id: string
  port_type: 'management' | 'adb' | 'video' | 'control' | 'audio'
  local_ip: string
  local_port: number
  remote_port: number
  status: 'active' | 'offline' | 'error'
  created_at: number
}

export type FrpPortType = FrpMapping['port_type']
export type DevicePortType = Exclude<FrpPortType, 'management'>

export interface FrpStatusInfo {
  frpcRunning: boolean
  sshConnected: boolean
  configStatus: FrpConfigStatus
  configured: boolean
  serverHost: string
  localIp: string
  totalMappings: number
  activeMappings: number
  screenEnabled: boolean
  screenPort: number
  screenUrl: string
}

export interface DeployProgress {
  step: number
  totalSteps: number
  label: string
  status: 'running' | 'done' | 'error'
  error?: string
}

export interface ToggleHostRequest {
  hostIp: string
  enabled: boolean
}

export interface ToggleDeviceRequest {
  deviceId: string
  hostIp: string
  enabled: boolean
  portTypes?: DevicePortType[]
}

export interface BatchToggleRequest {
  items: { deviceId: string; hostIp: string }[]
  enabled: boolean
  portTypes?: DevicePortType[]
}

export interface BatchToggleFailure {
  deviceId: string
  error: string
}

export interface BatchToggleResult {
  total: number
  succeeded: number
  failures: BatchToggleFailure[]
}

export interface EnabledStates {
  hostIps: string[]
  deviceIds: string[]
}

export interface FrpMappingFilter {
  hostIp?: string
  deviceId?: string
}

export interface DeployScreenRequest {
  port: number
  publicPort?: number
  sslCertPath?: string
  sslKeyPath?: string
}
