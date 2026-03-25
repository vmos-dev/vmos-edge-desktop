/**
 * Preload 脚本（简化版）
 * 安全地将 IPC API 暴露给渲染进程
 */

import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ipcApi, backupFsApi, type IpcApi, type BackupFsApi } from './ipc'

// 获取窗口信息用于日志
const windowInfo = ipcApi.getWindowInfo()

/**
 * 执行 API 注入
 */
function exposeApis(): void {
  // 注入 electron 基础 API
  contextBridge.exposeInMainWorld('electron', electronAPI)

  // 注入统一的 IPC API
  contextBridge.exposeInMainWorld('ipc', ipcApi)
  contextBridge.exposeInMainWorld('backupFs', backupFsApi)

  // 日志输出
  if (windowInfo.type === 'cloud') {
    console.log(`[Preload] ✅ IPC API 已注入 (云机窗口: ${windowInfo.deviceId})`)
  } else {
    console.log('[Preload] ✅ IPC API 已注入 (主窗口)')
  }
}

// 执行注入
if (process.contextIsolated) {
  try {
    exposeApis()
  } catch (error) {
    console.error('[Preload] ❌ API 注入失败:', error)
  }
} else {
  // 非上下文隔离模式（开发环境）
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.ipc = ipcApi
  // @ts-ignore
  window.backupFs = backupFsApi
}

// 类型声明扩展
declare global {
  interface Window {
    electron: typeof electronAPI
    ipc: IpcApi
    backupFs: BackupFsApi
  }
}
