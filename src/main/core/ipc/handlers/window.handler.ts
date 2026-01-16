/**
 * 窗口控制处理器
 */

import { windowManager } from '../../window/WindowManager'
import { on } from '../IpcBus'
import { logger } from '../../logger'
import {
  WINDOW_MINIMIZE,
  WINDOW_MAXIMIZE,
  WINDOW_CLOSE,
  WINDOW_RESIZE,
  WindowId,
  WindowResizeParams,
  WINDOW_TOP
} from '@shared/ipc'

/**
 * 注册窗口控制相关的事件处理器
 */
export function registerWindowHandlers(): void {
  // 最小化窗口
  on(WINDOW_MINIMIZE, (_payload, sender: WindowId) => {
    logger.debug(
      `[WindowHandler] WINDOW_MINIMIZE from ${sender.type === 'main' ? 'main' : sender.deviceId}`
    )
    const window = getWindowBySender(sender)
    if (window && !window.isDestroyed()) {
      window.minimize()
    }
  })

  // 最大化/还原窗口
  on(WINDOW_MAXIMIZE, (_payload, sender: WindowId) => {
    logger.debug(
      `[WindowHandler] WINDOW_MAXIMIZE from ${sender.type === 'main' ? 'main' : sender.deviceId}`
    )
    const window = getWindowBySender(sender)
    if (window && !window.isDestroyed()) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  })

  // 关闭窗口
  on(WINDOW_CLOSE, (_payload, sender: WindowId) => {
    logger.info(
      `[WindowHandler] WINDOW_CLOSE from ${sender.type === 'main' ? 'main' : sender.deviceId}`
    )
    const window = getWindowBySender(sender)
    if (window && !window.isDestroyed()) {
      window.close()
    }
  })

  // 窗口大小调整
  on<WindowResizeParams>(WINDOW_RESIZE, (data, sender: WindowId) => {
    if (!data) return
    logger.debug(
      `[WindowHandler] WINDOW_RESIZE from ${sender.type === 'main' ? 'main' : sender.deviceId}: ${data.width}x${data.height}`
    )

    const window = getWindowBySender(sender)
    if (window && !window.isDestroyed()) {
      window.setSize(Math.floor(data.width), Math.floor(data.height), true)
    }
  })

  // 置顶窗口
  on<boolean>(WINDOW_TOP, (data, sender: WindowId) => {
    logger.info(
      `[WindowHandler] WINDOW_TOP from ${sender.type === 'main' ? 'main' : sender.deviceId}: ${data}`
    )
    const window = getWindowBySender(sender)
    if (window && !window.isDestroyed()) {
      window.setAlwaysOnTop(data)
    }
  })

  logger.info('[WindowHandler] ✅ 窗口控制处理器已注册')
}

/** 根据发送者获取对应窗口 */
function getWindowBySender(sender: WindowId) {
  if (sender.type === 'main') {
    return windowManager.mainWindow
  } else if (sender.deviceId) {
    return windowManager.getCloudWindow(sender.deviceId)
  }
  return null
}
