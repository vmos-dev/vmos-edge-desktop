/**
 * 全局类型声明
 */

import type {
  BackupCreateWriterPayload,
  BackupCreateWriterResult,
  BackupSelectDirectoryResult,
  IpcResponse,
  WindowId
} from '@shared/ipc'

export {}

interface RendererIpcApi {
  send: <T = unknown>(event: string, payload?: T) => void
  invoke: <T = unknown>(event: string, payload?: unknown) => Promise<IpcResponse<T>>
  on: <T = unknown>(event: string, callback: (payload: T) => void) => () => void
  once: <T = unknown>(event: string, callback: (payload: T) => void) => void
  getWindowInfo: () => WindowId
}

interface RendererBackupFsApi {
  selectDirectory: () => Promise<BackupSelectDirectoryResult | null>
  createWriter: (payload: BackupCreateWriterPayload) => Promise<BackupCreateWriterResult>
  write: (writerId: string, chunk: Uint8Array) => Promise<void>
  close: (writerId: string) => Promise<void>
  abort: (writerId: string) => Promise<void>
}

declare global {
  interface Window {
    /**
     * Electron IPC Renderer API（底层）
     */
    electron?: {
      ipcRenderer: {
        send: (channel: string, ...args: unknown[]) => void
        on: (channel: string, listener: (...args: unknown[]) => void) => void
        once: (channel: string, listener: (...args: unknown[]) => void) => void
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
        removeListener: (channel: string, listener: (...args: unknown[]) => void) => void
        removeAllListeners: (channel: string) => void
      }
    }

    /**
     * 统一的 IPC API
     */
    ipc: RendererIpcApi

    /**
     * 备份写盘 API
     */
    backupFs: RendererBackupFsApi
  }
}
