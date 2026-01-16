/**
 * IPC 类型定义
 */

/** 窗口类型 */
export type WindowType = 'main' | 'cloud'

/** 窗口标识 */
export interface WindowId {
  type: WindowType
  deviceId?: string
}

/** IPC 响应结构 */
export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/** 设备端口配置 */
export interface DevicePorts {
  video: number
  audio: number
  touch: number
}

/** 创建云机窗口参数 */
export interface CreateCloudParams {
  deviceId: string
  ip: string
  ports: DevicePorts
}

/** 云机状态数据 */
export interface CloudStatusData {
  deviceId: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  message?: string
}

/** 窗口调整大小参数 */
export interface WindowResizeParams {
  width: number
  height: number
}
