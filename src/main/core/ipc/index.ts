/**
 * 主进程 IPC 模块入口（简化版）
 */

import { initIpcListeners, destroyIpcListeners, setWindowManager } from './IpcBus'
import { registerAllHandlers } from './handlers'
import { windowManager } from '../window/WindowManager'
import { logger } from '../logger'

/**
 * 初始化 IPC 系统
 */
export function initIpc(): void {
  logger.info('[IPC] 正在初始化...')

  // 设置窗口管理器引用
  setWindowManager({
    get mainWindow() {
      return windowManager.mainWindow
    },
    cloudWindows: windowManager.cloudWindows
  })

  // 初始化监听器
  initIpcListeners()

  // 注册所有处理器
  registerAllHandlers()

  logger.info('[IPC] ✅ 初始化完成')
}

/**
 * 销毁 IPC 系统
 */
export function destroyIpc(): void {
  destroyIpcListeners()
  logger.info('[IPC] ❌ 已销毁')
}

// 导出工具函数
export { on, handle, sendToMain, sendToCloud, broadcast } from './IpcBus'
