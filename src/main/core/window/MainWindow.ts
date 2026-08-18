/**
 * 主窗口管理器
 * 负责创建和管理主窗口
 */

import { join } from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs'
import { BrowserWindow, shell, app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { windowManager } from './WindowManager'
import { initIpc, destroyIpc } from '../ipc'
import { configManager } from '../store/managers'
import { CONFIG_KEYS } from '@shared/constant'
import { logger } from '../logger/Logger'
import icon from '../../../../resources/icon.png?asset'
import iconWin from '../../../../resources/icon.ico?asset'

class MainWindowManager {
  private static instance: MainWindowManager | null = null
  private mainWindow: BrowserWindow | null = null
  private ipcInitialized = false

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): MainWindowManager {
    if (!MainWindowManager.instance) {
      MainWindowManager.instance = new MainWindowManager()
    }
    return MainWindowManager.instance
  }

  /**
   * 获取主窗口实例
   */
  public getWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  /**
   * 初始化主窗口
   */
  public init(): BrowserWindow | null {
    try {
      if (this.mainWindow) {
        // 如果窗口已存在，显示它
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore()
        }
        this.mainWindow.focus()
        return this.mainWindow
      }

      const mainUrl = this.getMainUrl()
      logger.info(`[MainWindow] Loading URL: ${mainUrl}`)

      // 检查文件是否存在 (仅针对文件路径)
      if (!mainUrl.startsWith('http')) {
        const filePath = is.dev ? '' : join(__dirname, '../renderer/index.html')
        if (filePath && !fs.existsSync(filePath)) {
          logger.error(`[MainWindow] Critical Error: Renderer file not found at ${filePath}`)
        } else {
          logger.info(`[MainWindow] Renderer file exists at ${filePath}`)
        }
      }

      // 根据配置获取窗口大小
      const windowSizePreset = configManager.getValue(CONFIG_KEYS.MAIN_WINDOW_SIZE) || 'standard'

      const mainSizeMap = {
        standard: { width: 1250, height: 800 },
        large: { width: 1440, height: 900 },
        'extra-large': { width: 1920, height: 1080 }
      }

      const { width, height } = mainSizeMap[windowSizePreset as keyof typeof mainSizeMap]

      // 创建浏览器窗口
      this.mainWindow = windowManager.createMainWindow(
        {
          width,
          height,
          minWidth: 1000,
          minHeight: 600,
          show: false,
          frame: false, // 无边框窗口，使用自定义标题栏
          autoHideMenuBar: true,
          title: 'VMOS Edge',
          ...(process.platform === 'linux' ? { icon } : {}),
          ...(process.platform === 'win32' ? { icon: iconWin } : {}),
          ...(process.platform === 'darwin' ? { icon } : {}),
          webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            webviewTag: true,
            webSecurity: false
          }
        },
        mainUrl
      )

      this.setupWindowEvents()

      // 初始化 IPC（只在第一次创建窗口时初始化）
      if (!this.ipcInitialized) {
        initIpc()
        this.ipcInitialized = true
      }
      logger.info('[MainWindow] Main window initialized')

      return this.mainWindow
    } catch (error) {
      logger.error('[MainWindow] Failed to initialize main window:', error)
      return null
    }
  }

  /**
   * 获取主窗口URL
   */
  private getMainUrl(): string {
    let url = ''
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      url = process.env['ELECTRON_RENDERER_URL']
    } else {
      const filePath = join(__dirname, '../renderer/index.html')
      url = pathToFileURL(filePath).href
    }

    // 显式添加窗口类型参数，必须放在 hash (#) 之前，确保 preload 能够第一时间解析
    return url.includes('?') ? `${url}&winType=main` : `${url}?winType=main`
  }

  /**
   * 设置窗口事件
   */
  private setupWindowEvents(): void {
    if (!this.mainWindow) return

    this.mainWindow.on('ready-to-show', () => {
      logger.info('[MainWindow] Event: ready-to-show')
      this.mainWindow?.show()
    })

    this.mainWindow.webContents.on('did-finish-load', () => {
      logger.info('[MainWindow] Event: did-finish-load (Page loaded successfully)')
    })

    this.mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      logger.error(
        `[MainWindow] Event: did-fail-load. Code: ${errorCode}, Desc: ${errorDescription}`
      )
    })

    this.mainWindow.webContents.on('render-process-gone', (_, details) => {
      logger.error(`[MainWindow] Event: render-process-gone. Reason: ${details.reason}`)
    })

    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url).catch((err) => {
        logger.error(`[MainWindow] Failed to open external url: ${details.url}`, err)
      })
      return { action: 'deny' }
    })

    this.mainWindow.on('closed', () => {
      logger.info('[MainWindow] Event: closed')
      this.mainWindow = null
    })

    this.mainWindow.on('close', (event) => {
      // 如果正在退出应用，不进行任何拦截，直接允许关闭
      if ((app as any).isQuitting) {
        return
      }

      try {
        const minimizeToTray = configManager.getValue(CONFIG_KEYS.MINIMIZE_TO_TRAY) === '1'
        if (minimizeToTray) {
          event.preventDefault()
          this.mainWindow?.hide()
          logger.info('[MainWindow] Event: close (Prevented, minimized to tray)')
        }
      } catch (error) {
        // 忽略配置读取失败（如数据库已关闭），允许正常关闭
        logger.warn('[MainWindow] Event: close - failed to read config:', error)
      }
    })

    // 处理最小化事件
    // this.mainWindow.on('minimize', () => {
    //   try {
    //     const minimizeToTray = configManager.getValue(CONFIG_KEYS.MINIMIZE_TO_TRAY) === '1'
    //     if (minimizeToTray) {
    //       this.mainWindow?.hide()
    //       logger.info('[MainWindow] Event: minimize (Hidden to tray)')
    //     }
    //   } catch (error) {
    //     logger.warn('[MainWindow] Event: minimize - failed to read config:', error)
    //   }
    // })
  }

  /**
   * 销毁窗口
   */
  public destroy(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close()
    }
    this.mainWindow = null

    // 销毁 IPC
    if (this.ipcInitialized) {
      destroyIpc()
      this.ipcInitialized = false
    }
  }
}

// 导出单例实例
export const mainWindowManager = MainWindowManager.getInstance()

// 保留原有的函数接口以保持兼容性
export const initMainWindow = (): BrowserWindow | null => {
  return mainWindowManager.init()
}
