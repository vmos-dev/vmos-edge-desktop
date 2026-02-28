/**
 * Preload IPC
 * 直接暴露 ipcRenderer 方法，无额外封装
 */

import { ipcRenderer, IpcRendererEvent } from 'electron'
import { IPC_SEND, IPC_INVOKE, IPC_PUSH, WindowId, IpcResponse } from '@shared/ipc'

/** 获取当前窗口信息 */
function getWindowInfo(): WindowId {
  // 1. 同时解析 search (?xxx) 和 hash (#/xxx?yyy) 中的参数
  // @ts-ignore
  const searchParams = new URLSearchParams(location.search)
  // @ts-ignore
  const hashPart = location.hash?.split('?')?.[1]
  // @ts-ignore
  const hashParams = new URLSearchParams(hashPart || '')

  // 2. 优先级从高到低：winType > deviceId
  const winType = searchParams.get('winType') || hashParams.get('winType')
  const deviceId = searchParams.get('deviceId') || hashParams.get('deviceId')

  if (winType === 'main') return { type: 'main' }
  if (deviceId) return { type: 'cloud', deviceId }

  // 3. 严格判定：如果既没有 main 标识也没有 deviceId，且路径包含 /phone，判定为云机
  // @ts-ignore
  if (location.hash?.includes('/phone')) {
    return { type: 'cloud', deviceId: 'unknown' }
  }

  // 只有真正不带任何特征的才判定为主窗口
  return { type: 'main' }
}

/** 当前窗口信息 */
const windowInfo = getWindowInfo()

/**
 * IPC API - 暴露给渲染进程
 */
export const ipcApi = {
  /**
   * 发送单向消息（不等待返回）
   */
  send<T = unknown>(event: string, payload?: T): void {
    ipcRenderer.send(IPC_SEND, { event, payload, sender: windowInfo })
  },

  /**
   * 调用主进程方法（等待返回结果）
   */
  invoke<T = unknown>(event: string, payload?: unknown): Promise<IpcResponse<T>> {
    return ipcRenderer.invoke(IPC_INVOKE, { event, payload, sender: windowInfo })
  },

  /**
   * 监听主进程推送的消息
   * @returns 取消监听函数
   */
  on<T = unknown>(event: string, callback: (payload: T) => void): () => void {
    const handler = (_: IpcRendererEvent, msg: { event: string; payload: unknown }) => {
      if (msg.event === event) callback(msg.payload as T)
    }
    ipcRenderer.on(IPC_PUSH, handler)
    return () => {
      ipcRenderer.removeListener(IPC_PUSH, handler)
    }
  },

  /**
   * 监听一次
   */
  once<T = unknown>(event: string, callback: (payload: T) => void): void {
    const off = this.on<T>(event, (data) => {
      callback(data)
      off()
    })
  },

  /**
   * 获取当前窗口信息
   */
  getWindowInfo(): WindowId {
    return { ...windowInfo }
  }
}

export type IpcApi = typeof ipcApi
