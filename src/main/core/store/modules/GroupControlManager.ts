import { BaseManager } from './BaseManager'
import { Device, DATA_EVENTS } from '@shared/ipc/data.types'
import { logger } from '../../logger'
import { sendToCloud, sendToMain } from '../../ipc/IpcBus'
import { windowManager } from '../../window/WindowManager'
import { debounce } from 'lodash-es'
export class GroupControlManager extends BaseManager {
  private targets: Map<string, Device> = new Map()
  private masterId: string | null = null

  private isGroupControl = false

  public getIsGroupControl() {
    return this.isGroupControl
  }

  public setIsGroupControl(value: boolean) {
    // 如果是从开启变关闭，通知当前主控
    if (this.isGroupControl && !value && this.masterId) {
      sendToCloud(this.masterId, DATA_EVENTS.GROUP_CONTROL_DEVICES, {
        isGroupControl: false,
        targets: [],
        masterId: null
      })
    }

    this.isGroupControl = value
    if (!value) {
      this.masterId = null
      this.targets.clear()
    }
    logger.info(`[GroupControlManager] Group control state changed: ${value}`)
  }

  /**
   * 停止群控 (由系统触发，如主控窗口关闭)
   */
  public stopGroupControl() {
    if (!this.isGroupControl) return

    this.setIsGroupControl(false)

    // 通知主窗口更新状态
    sendToMain(DATA_EVENTS.GROUP_CONTROL_STOPPED)
  }

  public isMaster(deviceId: string) {
    return this.masterId === deviceId
  }

  constructor() {
    super()
  }

  /**
   * 更新群控设备列表
   */
  public setTargets(devices: Device[]) {
    this.targets.clear()

    // 排除主控设备
    devices.forEach((d) => {
      if (d.id && d.id !== this.masterId) this.targets.set(d.id, d)
    })

    logger.info(
      `[GroupControlManager] Targets updated. Count: ${this.targets.size}, Master: ${this.masterId}`
    )

    // 通知主控设备
    this.notifyMaster()
  }

  /**
   * 设置主控设备
   */
  public setMaster(deviceId: string | null) {
    if (this.masterId === deviceId && this.isGroupControl) return

    this.masterId = deviceId

    // 如果新的主控在受控列表中，必须移除，防止主控控制自己
    if (this.masterId && this.targets.has(this.masterId)) {
      this.targets.delete(this.masterId)
      logger.info(`[GroupControlManager] Removed master ${this.masterId} from targets`)
    }

    logger.info(`[GroupControlManager] Master changed: ${this.masterId}`)

    // 设置主控主动推送群控设备列表
    this.notifyMaster()
  }

  /**
   * 通知主控设备 节流 300ms
   */
  public notifyMaster = debounce(() => {
    if (!this.isGroupControl) return
    const deviceId = this.masterId || ''
    const win = windowManager.getCloudWindow(deviceId)
    if (win && !win.isDestroyed()) {
      const targetsArray = Array.from(this.targets.values())
      sendToCloud(deviceId, DATA_EVENTS.GROUP_CONTROL_DEVICES, {
        isGroupControl: this.isGroupControl,
        // 排除 主控设备
        targets: targetsArray.filter((d) => d.id !== this.masterId),
        masterId: this.masterId
      })
    }
  }, 300)
}
