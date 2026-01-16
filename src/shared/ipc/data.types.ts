export interface Group {
  id: string
  name: string
  sortIndex: number
  createTime: number
  lastActiveTime?: number
}

export interface Host {
  id: string
  groupId: string
  name: string
  ip: string
  status: 'online' | 'offline' | 'unknown'
  lastActiveTime?: number
}

export const enum DeviceState {
  StateCreating = 'creating', // 创建中
  StateStarting = 'starting', // 启动中
  StateRunning = 'running', // 运行中
  StateStopping = 'stopping', // 停止中
  StateStopped = 'stopped', // 已停止
  StatePaused = 'paused', // 已暂停
  StateExited = 'exited', // 已退出
  StateDeleting = 'deleting', // 删除中
  StateUpgrading = 'upgrading', // 升级中
  StateFailed = 'failed', // 失败
  StateRebooting = 'rebooting', // 重启中
  StateRebuilding = 'rebuilding', // 重置中
  StateRenewing = 'renewing', // 一键新机中
  StateOffline = 'offline' // 离线
}

export const HostState = {
  Online: 'online',
  Offline: 'offline',
  Unknown: 'unknown'
} as const

export interface Device {
  id: string // 主键 (对应 db_id 或生成的 UUID)

  // 扩展字段
  adb?: number
  adb_index?: number
  adi_name?: string
  adi_pass?: string
  aosp_version?: string
  country?: string
  cpus?: number
  created?: string
  data?: string
  data_size?: number
  device_type?: string
  db_id?: string
  db_version?: number
  dns?: string[] // 存储为 JSON 字符串
  dpi?: string
  exit_code?: number
  fps?: string
  gateway?: string
  height?: string
  image?: string
  image_id?: string
  ip?: string
  is_macvlan?: boolean // 布尔值 (0/1)
  is_symlink?: boolean // 布尔值 (0/1)
  locale?: string
  mac?: string
  macvlan_ip?: string
  macvlan_network?: string
  memory?: number
  network_mode?: string
  real_data_path?: string
  s5_status?: number
  s5_text?: string
  short_id?: string
  state?: DeviceState
  tcp_audio_port?: number
  tcp_control_port?: number
  tcp_port?: number
  timezone?: string
  updated_at?: string
  user_name?: string
  width?: string
  host_ip?: string
  lastActiveTime: number
}

export interface TreeNode {
  key: string
  label: string
  type: 'group' | 'host' | 'device'
  data: Group | Host | Device
  children?: TreeNode[]
  isLeaf?: boolean
}

// 扁平化数据结构
export interface FlatData {
  groups: Group[]
  hosts: Host[]
  devices: Device[]
}

export interface Image {
  id: string
  name: string
  version: string
  size: number
  androidVersion: string
  storagePath: string
  importTime: number
  connectionMode?: string
}

export interface Proxy {
  id: string
  name: string
  protocol: 'http' | 'https' | 'socks5' | 'vmess' | 'ss' | 'ssr' | 'vless'
  host: string
  port: number
  username?: string
  password?: string
  // 对于 vmess 和 ss 协议，存储原始链接字符串
  rawLink?: string
  lastCheckStatus: 'success' | 'failed'
  createTime: number
}
// Events
export const DATA_EVENTS = {
  GET_GROUPS: 'DATA:GET_GROUPS',
  GET_HOSTS: 'DATA:GET_HOSTS',
  GET_FLAT_DATA: 'DATA:GET_FLAT_DATA',
  DATA_UPDATED: 'DATA:DATA_UPDATED', // Deprecated: Legacy full update

  // Group Events
  GROUP_ADDED: 'DATA:GROUP_ADDED',
  GROUP_UPDATED: 'DATA:GROUP_UPDATED',
  GROUP_DELETED: 'DATA:GROUP_DELETED',

  // Host Events
  HOST_ADDED: 'DATA:HOST_ADDED',
  HOST_UPDATED: 'DATA:HOST_UPDATED',
  HOST_MOVED: 'DATA:HOST_MOVED',
  HOST_DELETED: 'DATA:HOST_DELETED',
  HOSTS_MOVED: 'DATA:HOSTS_MOVED', // 批量
  HOST_OPEN_API_DETAIL: 'DATA:HOST_OPEN_API_DETAIL',
  SEARCH_HOSTS_BY_IDENTIFIER_AND_STATUS_WITH_DEVICE_COUNT:
    'DATA:SEARCH_HOSTS_BY_IDENTIFIER_AND_STATUS_WITH_DEVICE_COUNT',
  RESTART_HOST: 'DATA:RESTART_HOST',
  RESET_HOST: 'DATA:RESET_HOST',
  CLEAN_HOST_IMAGE: 'DATA:CLEAN_HOST_IMAGE',

  // Device Events
  DEVICE_ADDED: 'DATA:DEVICE_ADDED',
  DEVICE_UPDATED: 'DATA:DEVICE_UPDATED',
  DEVICE_DELETED: 'DATA:DEVICE_DELETED',
  DEVICE_RESTARTED: 'DATA:DEVICE_RESTARTED',
  DEVICE_RESETED: 'DATA:DEVICE_RESETED',
  DEVICE_SHUTDOWNED: 'DATA:DEVICE_SHUTDOWNED',
  DEVICE_STARTED: 'DATA:DEVICE_STARTED',
  DEVICE_SCREENSHOT: 'DATA:DEVICE_SCREENSHOT',

  // CRUD Actions (Requests)
  ADD_GROUP: 'DATA:ADD_GROUP',
  ADD_HOST: 'DATA:ADD_HOST',
  UPDATE_GROUP: 'DATA:UPDATE_GROUP',
  DELETE_GROUP: 'DATA:DELETE_GROUP',
  UPDATE_HOST: 'DATA:UPDATE_HOST',
  MOVE_HOST: 'DATA:MOVE_HOST', // 单个移动
  MOVE_HOSTS: 'DATA:MOVE_HOSTS', // 批量移动
  UPDATE_DEVICE: 'DATA:UPDATE_DEVICE',
  RENEW_DEVICE: 'DATA:RENEW_DEVICE',
  RESET_DEVICE: 'DATA:RESET_DEVICE',
  UPDATE_DEVICE_NAME: 'DATA:UPDATE_DEVICE_NAME',
  GET_DEVICE_BY_ID: 'DATA:GET_DEVICE_BY_ID',
  GET_DEVICES_BY_IDS: 'DATA:GET_DEVICES_BY_IDS',
  GET_HOST_BY_IP: 'DATA:GET_HOST_BY_IP',

  // Group Control Events
  GET_GROUP_CONTROL_DEVICES: 'DATA:GET_GROUP_CONTROL_DEVICES',
  GROUP_CONTROL_DEVICES: 'DATA:GROUP_CONTROL_DEVICES',
  CLAIM_MASTER: 'DATA:CLAIM_MASTER',
  SET_GROUP_CONTROL: 'DATA:SET_GROUP_CONTROL',
  GROUP_CONTROL_STOPPED: 'DATA:GROUP_CONTROL_STOPPED'
}
