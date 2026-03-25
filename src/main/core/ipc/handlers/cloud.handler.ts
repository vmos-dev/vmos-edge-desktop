/**
 * 云机窗口处理器
 */

import { on, handle, sendToMain, sendToCloud, broadcast } from '../IpcBus'
import {
  CLOUD_CREATE,
  CLOUD_CLOSE,
  CLOUD_CONNECT,
  CLOUD_DISCONNECT,
  CLOUD_GET_LIST,
  BRIDGE_MAIN_TO_CLOUD,
  BRIDGE_CLOUD_TO_MAIN,
  BRIDGE_BROADCAST,
  WindowId,
  CreateCloudParams,
  CLOUD_ARRANGE
} from '@shared/ipc'
import { windowManager } from '../../window/WindowManager'
import { logger } from '../../logger'
import { BrowserWindow, screen } from 'electron'

function getMergedWorkArea() {
  const displays = screen.getAllDisplays()

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const d of displays) {
    const a = d.workArea
    minX = Math.min(minX, a.x)
    minY = Math.min(minY, a.y)
    maxX = Math.max(maxX, a.x + a.width)
    maxY = Math.max(maxY, a.y + a.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export function arrangeCloudWindowsTiled(
  windows: BrowserWindow[],
  options?: {
    gapX?: number
    gapY?: number
  }
) {
  const gapX = options?.gapX ?? 8
  const gapY = options?.gapY ?? 8

  // 1️⃣ 拉起窗口
  const active = windows.filter((win) => {
    if (win.isDestroyed()) return false
    if (win.isFullScreen()) win.setFullScreen(false)
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
    return true
  })

  if (active.length === 0) return

  // 2️⃣ 合并屏幕
  const area = getMergedWorkArea()

  // 3️⃣ 排序
  let x = area.x
  let y = area.y
  let rowMaxH = 0

  for (const win of active) {
    const { width: w, height: h } = win.getBounds()

    // 换行判断：如果不是行首且放不下，则换行
    if (x > area.x && x + w > area.x + area.width) {
      x = area.x
      y += rowMaxH + gapY
      rowMaxH = 0
    }

    win.setPosition(Math.round(x), Math.round(y), false)

    x += w + gapX
    rowMaxH = Math.max(rowMaxH, h)
  }
}

/**
 * 注册云机相关的事件处理器
 */
export function registerCloudHandlers(): void {
  // 创建云机窗口
  on<CreateCloudParams>(CLOUD_CREATE, (data, sender: WindowId) => {
    if (!data) {
      logger.error('[CloudHandler] ❌ 创建云机窗口缺少参数')
      return
    }

    logger.info(`[CloudHandler] 创建云机窗口请求来自: ${formatSender(sender)}`, data)

    const { deviceId } = data

    // 获取基础 URL
    const mainWindow = windowManager.mainWindow
    if (!mainWindow) {
      logger.error('[CloudHandler] ❌ 主窗口不存在，无法创建云机窗口')
      return
    }

    const baseUrl = mainWindow.webContents.getURL().split('#')[0].split('?')[0]

    // 创建窗口
    windowManager.createCloudWindow(deviceId, baseUrl)
  })

  // 关闭云机窗口
  on<{ deviceId: string; closeAll?: boolean }>(CLOUD_CLOSE, (data) => {
    logger.info(`[CloudHandler] CLOUD_CLOSE request:`, data)
    if (data.closeAll) {
      windowManager.cloudWindows.forEach((window) => {
        if (!window.isDestroyed()) {
          window.close()
        }
      })
    } else {
      const cloudWindow = windowManager.getCloudWindow(data.deviceId)
      if (cloudWindow && !cloudWindow.isDestroyed()) {
        cloudWindow.close()
      }
    }
  })

  // 排布云机窗口
  on<void>(CLOUD_ARRANGE, () => {
    logger.info('[CloudHandler] CLOUD_ARRANGE request')
    try {
      let windows = Array.from(windowManager.cloudWindows.values())
      if (windows.length === 0) return

      // 排除销毁的
      windows = windows.filter((window) => !window.isDestroyed())
      arrangeCloudWindowsTiled(windows)
    } catch (error) {
      logger.error('[CloudHandler] ❌ 排布云机窗口失败', error)
    }
  })

  // 云机连接成功
  on(CLOUD_CONNECT, (_payload: unknown, sender: WindowId) => {
    if (sender.type !== 'cloud' || !sender.deviceId) return

    logger.info(`[CloudHandler] 云机已连接: ${sender.deviceId}`)
  })

  // 云机断开连接
  on(CLOUD_DISCONNECT, (_payload: unknown, sender: WindowId) => {
    if (sender.type !== 'cloud' || !sender.deviceId) return

    logger.info(`[CloudHandler] 云机已断开: ${sender.deviceId}`)
  })

  // 获取云机窗口列表（Invoke）
  handle<void, string[]>(CLOUD_GET_LIST, async () => {
    logger.debug('[CloudHandler] CLOUD_GET_LIST request')
    const deviceIds = Array.from(windowManager.cloudWindows.keys())
    return {
      success: true,
      data: deviceIds
    }
  })

  // 主窗口 -> 云机窗口 消息转发
  on<{ deviceId: string; event: string; payload?: unknown }>(
    BRIDGE_MAIN_TO_CLOUD,
    (data, sender: WindowId) => {
      logger.debug(`[CloudHandler] BRIDGE_MAIN_TO_CLOUD:`, data)
      if (sender.type !== 'main') {
        logger.warn('[CloudHandler] ⚠️ 只有主窗口可以使用 MAIN_TO_CLOUD')
        return
      }

      if (!data?.deviceId || !data?.event) {
        logger.error('[CloudHandler] ❌ MAIN_TO_CLOUD 缺少必要参数')
        return
      }

      sendToCloud(data.deviceId, data.event, data.payload)
    }
  )

  // 云机窗口 -> 主窗口 消息转发
  on<{ event: string; payload?: unknown }>(BRIDGE_CLOUD_TO_MAIN, (data, sender: WindowId) => {
    logger.debug(`[CloudHandler] BRIDGE_CLOUD_TO_MAIN:`, data)
    if (sender.type !== 'cloud') {
      logger.warn('[CloudHandler] ⚠️ 只有云机窗口可以使用 CLOUD_TO_MAIN')
      return
    }

    if (!data?.event) {
      logger.error('[CloudHandler] ❌ CLOUD_TO_MAIN 缺少 event 参数')
      return
    }

    // 在 payload 中附加发送者 deviceId
    sendToMain(data.event, {
      ...(data.payload as object),
      _fromDeviceId: sender.deviceId
    })
  })

  // 广播消息
  on<{ event: string; payload?: unknown }>(BRIDGE_BROADCAST, (data) => {
    logger.debug(`[CloudHandler] BRIDGE_BROADCAST:`, data)
    if (!data?.event) {
      logger.error('[CloudHandler] ❌ BROADCAST 缺少 event 参数')
      return
    }

    broadcast(data.event, data.payload)
  })

  logger.info('[CloudHandler] ✅ 云机处理器已注册')
}

/** 格式化发送者信息 */
function formatSender(sender: WindowId): string {
  return sender.type === 'main' ? '主窗口' : `云机窗口[${sender.deviceId}]`
}
