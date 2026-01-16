/**
 * 云手机 Electron 主进程
 */

import { app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'

import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import { initMainWindow } from './core/window/MainWindow'
import { trayManager } from './core/window/TrayManager'
import { UDPScanner } from './core/window/UdpScanner'
import { HostScannerQueue } from './core/scheduler/deviceScheduler'
import { configManager } from './core/store/managers'
import { logger } from './core/logger/Logger'
import { CONFIG_KEYS } from '@shared/constant'
import { destroyProxyCheckWorkerManager } from './core/workers/ProxyCheckWorkerManager'
import { SQLiteDB } from './core/db/SQLiteDB'

app.commandLine.appendSwitch('no-proxy-server')

const initHardwareAcceleration = () => {
  try {
    const config = configManager.getValue(CONFIG_KEYS.DISABLE_HARDWARE_ACCELERATION)
    if (config === '1') {
      app.disableHardwareAcceleration()
    }
  } catch (error) {
    logger.error('[Init] Failed to initialize hardware acceleration:', error)
  }
}

initHardwareAcceleration()

process.on('uncaughtException', (error) => {
  logger.error('[App] Uncaught Exception:', error)
  console.error('[App] Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason) => {
  logger.error('[App] Unhandled Rejection:', reason)
  console.error('[App] Unhandled Rejection:', reason)
})

app.on('child-process-gone', (_e, details) => {
  logger.error('[Main] child-process-gone:', details)
  console.error('[Main] child-process-gone:', details)
})

app.on('render-process-gone', (_e, _wc, details) => {
  logger.error('[Main] render-process-gone:', details)
  console.error('[Main] render-process-gone:', details)
})

const udpScanner = new UDPScanner()
const hostScannerQueue = new HostScannerQueue(10)

/* -----------------------------------------------------
 * Electron 启动优化参数
 * ---------------------------------------------------*/

// 设置应用名称
app.setName('VMOS Edge')

/* -----------------------------------------------------
 * 创建窗口
 * ---------------------------------------------------*/
function createWindow(): void {
  initMainWindow()

  // 启动 UDP 自动扫描
  udpScanner.startAutoScan(30).finally(() => {
    hostScannerQueue.start()
  })
}

/* -----------------------------------------------------
 * 初始化默认配置
 * ---------------------------------------------------*/
function initDefaultConfigs(): void {
  try {
    const userDataDir = app.getPath('userData')
    const imagesDir = path.join(userDataDir, 'vmosedge', 'images')
    const screenshotStoragePath = path.join(userDataDir, 'vmosedge', 'screenshots')

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true })
      logger.info(`[Init] Created images directory: ${imagesDir}`)
    }

    if (!fs.existsSync(screenshotStoragePath)) {
      fs.mkdirSync(screenshotStoragePath, { recursive: true })
      logger.info(`[Init] Created screenshots directory: ${screenshotStoragePath}`)
    }

    configManager.initDefaults({
      [CONFIG_KEYS.IMAGE_STORAGE_PATH]: imagesDir,
      [CONFIG_KEYS.MAX_DISPLAY_SIDE]: '600',
      [CONFIG_KEYS.PROXY_CHECK_TIMEOUT]: '5000',
      [CONFIG_KEYS.PROXY_CHECK_API_KEY]: '',
      [CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE]: 'ipinfo',
      [CONFIG_KEYS.SCREENSHOT_STORAGE_PATH]: screenshotStoragePath,
      [CONFIG_KEYS.VIDEO_CODEC_PREFERENCE]: 'no-preference',
      [CONFIG_KEYS.RENDER_PREFERENCE]: 'low-power',
      [CONFIG_KEYS.DISABLE_HARDWARE_ACCELERATION]: '0',
      [CONFIG_KEYS.MAIN_WINDOW_SIZE]: 'standard',
      [CONFIG_KEYS.WHEEL_SPEED]: '100',
      [CONFIG_KEYS.KEEP_HOVER_MOVE]: '0',
      [CONFIG_KEYS.MINIMIZE_TO_TRAY]: '0'
    })

    logger.info('[Init] Default configs initialized')
  } catch (error) {
    logger.error('[Init] Failed to initialize default configs:', error)
  }
}

/* -----------------------------------------------------
 * App Ready
 * ---------------------------------------------------*/
app.whenReady().then(() => {
  logger.info('[App] Application is ready')

  electronApp.setAppUserModelId('com.vmos.edge.desktop')

  logger.info('[App] Initializing default configs...')
  initDefaultConfigs()

  app.on('browser-window-created', (_, window) => {
    // Electron-toolkit 默认快捷键管理
    optimizer.watchWindowShortcuts(window)

    /**
     * 生产环境快捷键拦截 + 隐藏调试入口
     */
    if (!is.dev) {
      window.webContents.on('before-input-event', (event, input) => {
        /**
         * ✅ 隐藏调试快捷键（生产可用）
         * Ctrl/Cmd + Shift + Alt + I
         */
        if (
          input.type === 'keyDown' &&
          (input.control || input.meta) &&
          input.shift &&
          input.alt &&
          input.key.toLowerCase() === 'i'
        ) {
          event.preventDefault()
          logger.info('[Debug] Hidden devtools shortcut triggered')
          window.webContents.toggleDevTools()
          return
        }

        /**
         * ❌ 拦截默认 DevTools
         */
        if (input.key === 'F12') {
          event.preventDefault()
          return
        }

        if (
          (input.control || input.meta) &&
          (input.shift || input.alt) &&
          input.key.toLowerCase() === 'i'
        ) {
          event.preventDefault()
          return
        }

        /**
         * ❌ 拦截刷新
         */
        if (
          input.key === 'F5' ||
          ((input.control || input.meta) && input.key.toLowerCase() === 'r')
        ) {
          event.preventDefault()
        }
      })
    }
  })

  logger.info('[App] Creating main window...')
  trayManager.init() // 初始化托盘管理器
  createWindow()
  logger.info('[App] Main window creation initiated')

  app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length === 0) {
      createWindow()
    } else {
      const win = allWindows.find((w) => !w.isDestroyed())
      if (win) {
        win.show()
        win.focus()
      }
    }
  })
})

/* -----------------------------------------------------
 * 单实例锁
 * ---------------------------------------------------*/
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (win) {
      if (win.isMinimized()) win.restore()
      if (!win.isVisible()) win.show()
      win.focus()
    }
  })
}

/* -----------------------------------------------------
 * 生命周期 & 错误处理
 * ---------------------------------------------------*/
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
  logger.info('[App] Shutting down...')
  udpScanner.stopAutoScan()
  hostScannerQueue.stop()
  // 清理代理检测 Worker
  destroyProxyCheckWorkerManager()
  // 关闭数据库连接 (执行 WAL Checkpoint)
  SQLiteDB.getInstance().close()
  logger.destroy()
})
