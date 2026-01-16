/**
 * 全局类型声明
 */

import type { IpcApi } from '@shared/ipc'

export {}

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
    ipc: IpcApi
  }
}
