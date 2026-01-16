/**
 * IPC 核心模块
 */

import { ipcMain, BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { IPC_SEND, IPC_INVOKE, IPC_PUSH, WindowId, IpcResponse } from '@shared/ipc'
import { logger } from '../logger'

/** IPC 消息结构 */
interface IpcMessage {
  event: string
  payload?: unknown
  sender?: WindowId
}

/** 事件处理器 */
type EventHandler<T = unknown> = (payload: T, sender: WindowId) => void

/** Invoke 处理器 */
type InvokeHandler<T = unknown, R = unknown> = (
  payload: T,
  sender: WindowId
) => Promise<IpcResponse<R>>

// 处理器存储
const eventHandlers = new Map<string, Set<EventHandler<any>>>()
const invokeHandlers = new Map<string, InvokeHandler<any, any>>()

// 窗口管理器引用
let windowManagerRef: {
  mainWindow: BrowserWindow | null
  cloudWindows: Map<string, BrowserWindow>
} | null = null

/**
 * 从事件中获取发送者信息
 */
function getSender(event: IpcMainEvent | IpcMainInvokeEvent): WindowId {
  try {
    const urlStr = event.sender.getURL()
    const url = new URL(urlStr)

    // 优先从 searchParams 获取 (旧兼容)
    let deviceId = url.searchParams.get('deviceId')

    // 如果没有，尝试从 hash 中获取 (Vue Hash 路由模式)
    // hash 格式通常为 "#/phone?deviceId=xyz&..."
    if (!deviceId && url.hash) {
      const hashPart = url.hash.split('?')[1] // 获取 hash 后的参数部分
      if (hashPart) {
        const hashParams = new URLSearchParams(hashPart)
        deviceId = hashParams.get('deviceId')
      }
    }

    if (deviceId) return { type: 'cloud', deviceId }
  } catch {
    // ignore
  }
  return { type: 'main' }
}

// ==================== 初始化 ====================

let initialized = false

/**
 * 初始化 IPC 监听
 */
export function initIpcListeners(): void {
  if (initialized) return
  initialized = true

  // 监听单向消息
  ipcMain.on(IPC_SEND, (event: IpcMainEvent, msg: IpcMessage) => {
    const sender = getSender(event)
    const handlers = eventHandlers.get(msg.event)
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(msg.payload, sender)
        } catch (err) {
          logger.error(`[IPC] Error in handler for event ${msg.event}:`, err)
        }
      })
    }
  })

  // 监听请求-响应消息
  ipcMain.handle(IPC_INVOKE, async (event: IpcMainInvokeEvent, msg: IpcMessage) => {
    const sender = getSender(event)
    const handler = invokeHandlers.get(msg.event)
    if (!handler) {
      return { success: false, error: `未找到处理器: ${msg.event}` }
    }
    try {
      return await handler(msg.payload, sender)
    } catch (err) {
      logger.error(`[IPC] Invoke error in handler for event ${msg.event}:`, err)
      return { success: false, error: err instanceof Error ? err.message : '处理失败' }
    }
  })

  logger.info('[IPC] ✅ 监听器已初始化')
}

/**
 * 销毁 IPC 监听
 */
export function destroyIpcListeners(): void {
  ipcMain.removeAllListeners(IPC_SEND)
  ipcMain.removeHandler(IPC_INVOKE)
  eventHandlers.clear()
  invokeHandlers.clear()
  initialized = false
}

/**
 * 设置窗口管理器引用
 */
export function setWindowManager(manager: {
  mainWindow: BrowserWindow | null
  cloudWindows: Map<string, BrowserWindow>
}): void {
  windowManagerRef = manager
}

// ==================== 注册处理器 ====================

/**
 * 注册单向事件处理器
 */
export function on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
  if (!eventHandlers.has(event)) {
    eventHandlers.set(event, new Set())
  }
  eventHandlers.get(event)!.add(handler as EventHandler<any>)
  return () => eventHandlers.get(event)?.delete(handler as EventHandler<any>)
}

/**
 * 注册 Invoke 处理器
 */
export function handle<T = unknown, R = unknown>(
  event: string,
  handler: InvokeHandler<T, R>
): void {
  invokeHandlers.set(event, handler as InvokeHandler<any, any>)
}

// ==================== 发送消息 ====================

/**
 * 推送消息到主窗口
 */
export function sendToMain<T = unknown>(event: string, payload?: T): void {
  const win = windowManagerRef?.mainWindow
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_PUSH, { event, payload })
  }
}

/**
 * 推送消息到指定云机窗口
 */
export function sendToCloud<T = unknown>(deviceId: string, event: string, payload?: T): void {
  const win = windowManagerRef?.cloudWindows.get(deviceId)
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC_PUSH, { event, payload })
  }
}

/**
 * 广播消息到所有窗口
 */
export function broadcast<T = unknown>(event: string, payload?: T): void {
  const msg = { event, payload }

  // 发送到主窗口
  const mainWin = windowManagerRef?.mainWindow
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send(IPC_PUSH, msg)
  }

  // 发送到所有云机窗口
  windowManagerRef?.cloudWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_PUSH, msg)
    }
  })
}
