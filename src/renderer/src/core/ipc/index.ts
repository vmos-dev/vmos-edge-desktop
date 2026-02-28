/**
 * 渲染进程 IPC（简化版）
 * 直接使用 window.ipc，无额外封装
 */

import type { IpcResponse, WindowId } from '@shared/ipc'

// 重新导出事件常量（便于业务代码使用）
export {
  // 窗口事件
  WINDOW_MINIMIZE,
  WINDOW_MAXIMIZE,
  WINDOW_CLOSE,
  WINDOW_RESIZE,
  WINDOW_TOP,
  // 云机事件
  CLOUD_CREATE,
  CLOUD_CLOSE,
  CLOUD_CONNECT,
  CLOUD_DISCONNECT,
  CLOUD_STATUS_CHANGE,
  CLOUD_GET_LIST,
  CLOUD_ARRANGE,
  // 桥接事件
  BRIDGE_MAIN_TO_CLOUD,
  BRIDGE_CLOUD_TO_MAIN,
  BRIDGE_BROADCAST,
  // MediaMTX 事件
  MEDIAMTX_START,
  MEDIAMTX_STOP,
  MEDIAMTX_GET_STATUS,
  MEDIAMTX_STATUS_CHANGE,
  MEDIAMTX_LOG
} from '@shared/ipc'

// 重新导出类型
export type { IpcResponse, WindowId }
export type {
  CreateCloudParams,
  CloudStatusData,
  WindowResizeParams,
  DevicePorts,
  StartMediaServerOptions,
  StartMediaServerResult,
  MediaServerStatus
} from '@shared/ipc'

// ==================== IPC 函数 ====================

/**
 * 发送单向消息（不等待返回）
 * @example ipc.send('window:minimize')
 */
export function send<T = unknown>(event: string, payload?: T): void {
  window.ipc?.send(event, payload)
}

/**
 * 调用主进程方法（等待返回结果）
 * @example const result = await ipc.invoke('device:getMagicBox')
 */
export function invoke<T = unknown, P = unknown>(
  event: string,
  payload?: P
): Promise<IpcResponse<T>> {
  return (
    window.ipc?.invoke<T>(event, payload) ??
    Promise.resolve({ success: false, error: 'IPC 未初始化' })
  )
}

/**
 * 监听主进程推送的消息
 * @returns 取消监听函数
 * @example const off = ipc.on('device:online', (data) => console.log(data))
 */
export function on<T = unknown>(event: string, callback: (payload: T) => void): () => void {
  return window.ipc?.on<T>(event, callback) ?? (() => {})
}

/**
 * 监听一次
 */
export function once<T = unknown>(event: string, callback: (payload: T) => void): void {
  window.ipc?.once<T>(event, callback)
}

/**
 * 获取当前窗口信息
 */
export function getWindowInfo(): WindowId | null {
  return window.ipc?.getWindowInfo() ?? null
}

/**
 * 是否为主窗口
 */
export function isMainWindow(): boolean {
  return getWindowInfo()?.type === 'main'
}

/**
 * 是否为云机窗口
 */
export function isCloudWindow(): boolean {
  return getWindowInfo()?.type === 'cloud'
}

/**
 * 获取设备ID（仅云机窗口有效）
 */
export function getDeviceId(): string | null {
  return getWindowInfo()?.deviceId ?? null
}

// ==================== 便捷方法 ====================

/** 最小化窗口 */
export function minimize(): void {
  send('window:minimize')
}

/** 最大化/还原窗口 */
export function maximize(): void {
  send('window:maximize')
}

/** 关闭窗口 */
export function close(): void {
  send('window:close')
}

// ==================== 默认导出 ====================

/**
 * IPC 对象（兼容旧代码）
 */
export const ipc = {
  send,
  invoke,
  on,
  once,
  getWindowInfo,
  isMainWindow,
  isCloudWindow,
  getDeviceId,
  minimize,
  maximize,
  close
}

export default ipc
