import { sendToMain, sendToCloud } from '../../ipc/IpcBus'
import { SQLiteDB } from '../../db/SQLiteDB'
import { logger } from '../../logger'
import { windowManager } from '../../window/WindowManager'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import { Device } from '@shared/ipc/data.types'
export class BaseManager {
  protected dbInstance: SQLiteDB

  constructor() {
    this.dbInstance = SQLiteDB.getInstance()
  }

  protected notifyFrontend(event: string, payload: any) {
    logger.debug(`[BaseManager] notifyFrontend: event=${event}`, {
      payloadType: Array.isArray(payload) ? 'array' : typeof payload,
      payloadLength: Array.isArray(payload) ? payload.length : undefined
    })
    try {
      sendToMain(event, payload)

      // 判断事件类型 是否跟设备有关系
      if ([DATA_EVENTS.DEVICE_UPDATED, DATA_EVENTS.DEVICE_DELETED].includes(event)) {
        this.notifyDeviceStatusChanged(event, payload as Device[])
      }

      logger.debug(`[BaseManager] notifyFrontend success: event=${event}`)
    } catch (error) {
      logger.error(`[BaseManager] notifyFrontend failed: event=${event}`, {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        payloadType: Array.isArray(payload) ? 'array' : typeof payload
      })
    }
  }

  // 设备相关状态变更 通知对应的云机窗口
  protected notifyDeviceStatusChanged(event: string, devices: Device[]) {
    logger.debug(
      `[BaseManager] notifyDeviceStatusChanged called: event=${event}, count=${devices.length}`
    )
    try {
      let deviceId: string | undefined
      switch (event) {
        case DATA_EVENTS.DEVICE_UPDATED:
        case DATA_EVENTS.DEVICE_DELETED:
          devices.forEach((device) => {
            deviceId = device.id || device.db_id
            if (!deviceId) return
            const window = windowManager.getCloudWindow(deviceId)
            if (window) {
              sendToCloud(deviceId, event, device)
            }
          })
          break
      }
    } catch (error) {
      logger.error(`[BaseManager] notifyDeviceStatusChanged failed:`, {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        event,
        deviceCount: devices.length
      })
    }
  }
}
