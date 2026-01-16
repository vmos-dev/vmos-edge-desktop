import { on } from '../IpcBus'
import { DATA_EVENTS, Device } from '@shared/ipc/data.types'
import { groupControlManager } from '../../store/managers'
import { logger } from '../../logger'
export function registerGroupControlHandlers() {
  // 监听来自 Renderer 的群控设备列表更新
  on<Device[]>(DATA_EVENTS.GROUP_CONTROL_DEVICES, (devices) => {
    try {
      logger.info(`[GroupControlHandler] Received targets update: ${devices?.length || 0} devices`)
      groupControlManager.setTargets(devices || [])
    } catch (error) {
      logger.error(`[GroupControlHandler] Failed to set targets: ${error}`)
    }
  })

  // 窗口声明自己想成为 Master
  on<Device>(DATA_EVENTS.CLAIM_MASTER, (device: Device) => {
    try {
      // 这里的 setMaster 期望 string | null，但传入的是 Device 对象
      // 修正为传入 id
      groupControlManager.setMaster(device?.id || null)
    } catch (error) {
      logger.error(`[GroupControlHandler] Failed to set master: ${error}`)
    }
  })

  // 设置群控开关状态
  on<boolean>(DATA_EVENTS.SET_GROUP_CONTROL, (enabled) => {
    try {
      groupControlManager.setIsGroupControl(enabled)
    } catch (error) {
      logger.error(`[GroupControlHandler] Failed to set group control: ${error}`)
    }
  })

  // 触发推送群控设备列表
  on<boolean>(DATA_EVENTS.GET_GROUP_CONTROL_DEVICES, () => {
    try {
      groupControlManager.notifyMaster()
    } catch (error) {
      logger.error(`[GroupControlHandler] Failed to notify master: ${error}`)
    }
  })
}
