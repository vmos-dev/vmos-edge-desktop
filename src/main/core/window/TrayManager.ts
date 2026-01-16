import { app, Menu, Tray, nativeImage } from 'electron'
import path from 'path'
import icon from '../../../../resources/icon.png?asset'
import iconWin from '../../../../resources/icon.ico?asset'
import { logger } from '../logger/Logger'
import { mainWindowManager } from './MainWindow'
import { configManager } from '../store/managers'
import { CONFIG_KEYS } from '@shared/constant'

class TrayManager {
  private static instance: TrayManager | null = null
  private tray: Tray | null = null

  private constructor() {
    this.setupWindowListeners()
  }

  /**
   * 初始化托盘管理器
   */
  public init(): void {
    logger.info('[TrayManager] Initializing...')
    // 初始检查一次状态
    this.update()
  }

  private setupWindowListeners(): void {
    app.on('browser-window-created', (_, window) => {
      window.on('minimize', () => {
        logger.info('[TrayManager] Window minimized, updating tray')
        this.update()
      })
      window.on('restore', () => {
        logger.info('[TrayManager] Window restored, updating tray')
        this.update()
      })
      window.on('show', () => {
        logger.info('[TrayManager] Window shown, updating tray')
        this.update()
      })
      window.on('hide', () => {
        logger.info('[TrayManager] Window hidden, updating tray')
        this.update()
      })
      window.on('close', () => {
        setTimeout(() => {
          logger.info('[TrayManager] Window closing, updating tray')
          this.update()
        }, 0)
      })
      window.on('closed', () => {
        logger.info('[TrayManager] Window closed, updating tray')
        this.update()
      })
    })
  }

  public static getInstance(): TrayManager {
    if (!TrayManager.instance) {
      TrayManager.instance = new TrayManager()
    }
    return TrayManager.instance
  }

  /**
   * 根据配置和窗口状态更新托盘状态
   */
  public update(): void {
    // 如果应用正在退出，不再更新托盘（避免数据库已关闭导致的报错）
    if ((app as any).isQuitting) {
      return
    }

    try {
      const minimizeToTray = configManager.getValue(CONFIG_KEYS.MINIMIZE_TO_TRAY) === '1'
      const win = mainWindowManager.getWindow()

      // 只有在开启了最小化到托盘，且窗口不显示（即被 Close 拦截后 hide）时，才显示托盘图标
      // 用户需求：最小化不隐藏到托盘，只有关闭才隐藏到托盘
      // 排除最小化状态，避免最小化时也显示托盘
      const shouldShowTray =
        minimizeToTray && win && !win.isDestroyed() && !win.isVisible() && !win.isMinimized()

      if (shouldShowTray) {
        this.createTray()
      } else {
        this.destroy()
      }
    } catch (error) {
      // 忽略可能的数据库访问错误（如退出过程中）
      logger.warn('[TrayManager] update failed:', error)
    }
  }

  private createTray(): void {
    // macOS 下不显示托盘图标
    if (this.tray || process.platform === 'darwin') return

    try {
      const trayIcon = this.getTrayIcon()
      const trayImage = nativeImage.createFromPath(trayIcon)

      this.tray = new Tray(trayImage)

      const contextMenu = Menu.buildFromTemplate([
        {
          label: '显示主界面',
          click: () => {
            this.showMainWindow()
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            app.quit()
          }
        }
      ])

      this.tray.setToolTip('VMOS Edge')
      this.tray.setContextMenu(contextMenu)

      this.tray.on('double-click', () => {
        this.showMainWindow()
      })

      logger.info('[TrayManager] Tray created')
    } catch (error) {
      logger.error('[TrayManager] Failed to create tray:', error)
    }
  }

  private showMainWindow(): void {
    const win = mainWindowManager.getWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    } else {
      mainWindowManager.init()
    }
  }

  private getTrayIcon(): string {
    if (!app.isPackaged) {
      return process.platform === 'win32' ? iconWin : icon
    }
    return process.platform === 'win32'
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(process.resourcesPath, 'icon.png')
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
      logger.info('[TrayManager] Tray destroyed')
    }
  }
}

export const trayManager = TrayManager.getInstance()
