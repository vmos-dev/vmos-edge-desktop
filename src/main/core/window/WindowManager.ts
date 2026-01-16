/**
 * 窗口管理器
 * 管理主窗口和云机窗口的创建和生命周期
 */

import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import icon from '../../../../resources/icon.png?asset'
import iconWin from '../../../../resources/icon.ico?asset'
import { configManager } from '../store/managers'
import { CONFIG_KEYS } from '@shared/constant'
import { logger } from '../logger'
import { groupControlManager } from '../store/managers'

class WindowManager {
  mainWindow: BrowserWindow | null = null
  cloudWindows = new Map<string, BrowserWindow>() // deviceId → window

  /** 创建主窗口 */
  createMainWindow(config: BrowserWindowConstructorOptions, url: string) {
    logger.info('[WindowManager] createMainWindow called')
    if (this.mainWindow) {
      this.mainWindow.focus()
      return this.mainWindow
    }

    const win = new BrowserWindow(config)

    win.loadURL(url)

    win.on('closed', () => {
      this.mainWindow = null
      // 关闭所有子窗口
      this.cloudWindows.forEach((window) => {
        window.close()
      })
      this.cloudWindows.clear()
    })

    this.mainWindow = win
    return win
  }
  calcPortraitSize(maxSide: number) {
    const height = Math.round(maxSide)
    let width = Math.round((height * 9) / 16)

    // 双保险：绝不允许宽 > 高
    if (width > height) {
      width = height
    }

    return { width, height }
  }

  /** 创建云机窗口 */
  createCloudWindow(deviceId: string, url: string) {
    logger.info(`[WindowManager] createCloudWindow called: deviceId=${deviceId}`)
    if (this.cloudWindows.has(deviceId)) {
      const win = this.cloudWindows.get(deviceId)!
      if (win.isDestroyed()) {
        this.cloudWindows.delete(deviceId)
      } else {
        if (win.isMinimized()) {
          win.restore()
        }
        win.focus()
        return win
      }
    }

    // 获取最大显示尺寸
    const maxDisplaySide = configManager.getValue(CONFIG_KEYS.MAX_DISPLAY_SIDE)

    const { width, height } = this.calcPortraitSize(parseInt(maxDisplaySide || '600'))

    const win = new BrowserWindow({
      width,
      height,
      minWidth: 200,
      minHeight: 200,
      frame: false,
      resizable: true,
      autoHideMenuBar: true,
      backgroundColor: '#fff',
      title: 'VMOS Edge - Cloud Phone',
      ...(process.platform === 'linux' ? { icon } : {}),
      ...(process.platform === 'win32' ? { icon: iconWin } : {}),
      ...(process.platform === 'darwin' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })

    // 群控模式下打开的第一个窗口就是主控

    let isMaster = 0 // 0 不是主控 1 是主控

    if (groupControlManager.getIsGroupControl()) {
      if (this.cloudWindows.size === 0) {
        groupControlManager.setMaster(deviceId)
        isMaster = 1
      }
    }

    win.loadURL(`${url}#/phone?deviceId=${deviceId}&isMaster=${isMaster}`)

    win.on('closed', () => {
      // 检查是否是主控窗口关闭
      if (groupControlManager.getIsGroupControl() && groupControlManager.isMaster(deviceId)) {
        console.log('主控窗口关闭')
        logger.info(`[WindowManager] Master window closed: ${deviceId}`)
        groupControlManager.stopGroupControl()
      }
      this.cloudWindows.delete(deviceId)
    })

    this.cloudWindows.set(deviceId, win)
    return win
  }

  /** 通过 deviceId 获取云机窗口 */
  getCloudWindow(deviceId: string) {
    return this.cloudWindows.get(deviceId)
  }
}

export const windowManager = new WindowManager()
