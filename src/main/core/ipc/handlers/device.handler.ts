/**
 * 设备相关的 IPC 处理器
 */
import { handle } from '../IpcBus'
import { DATA_EVENTS, type Device, type FlatData } from '@shared/ipc/data.types'
import { groupManager, hostManager, deviceManager } from '../../store/managers'
import { logger } from '../../logger'
import { isAxiosError } from '@shared/api/request'

/**
 * 处理错误，只返回错误信息，不打印日志（日志已在 manager 层打印）
 */
function handleError(error: any): { success: false; error: string } {
  let errorMsg: string

  if (isAxiosError(error)) {
    // axios 错误：优先从 response.data.msg 获取，其次从 response.data.message，最后从 error.message
    // 注意：拦截器可能 reject 的是 data 对象（有 msg 字段），所以也需要检查 error.msg
    errorMsg =
      error.response?.data?.msg ||
      error.response?.data?.message ||
      (error as any)?.msg ||
      error.message ||
      String(error)
  } else {
    // 非 axios 错误：优先从 error.msg，其次从 error.message
    errorMsg = error?.msg || error?.message || String(error)
  }

  return {
    success: false,
    error: errorMsg
  }
}

export function registerDeviceHandlers() {
  // 获取扁平化数据（包含所有 groups、hosts、devices）
  handle<void, FlatData>(DATA_EVENTS.GET_FLAT_DATA, async () => {
    const startTime = Date.now()
    logger.debug('[DeviceHandler] GET_FLAT_DATA request received')
    try {
      const groups = groupManager.getGroups()
      const hosts = hostManager.getHosts()
      const devices = deviceManager.getDevices()
      const duration = Date.now() - startTime
      logger.info(
        `[DeviceHandler] GET_FLAT_DATA success: groups=${groups.length}, hosts=${hosts.length}, devices=${devices.length}, duration=${duration}ms`
      )
      return {
        success: true,
        data: {
          groups,
          hosts,
          devices
        }
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 更新设备信息
  handle<{ id: string; updates: Partial<Device> }, void>(
    DATA_EVENTS.UPDATE_DEVICE,
    async ({ id, updates }) => {
      const startTime = Date.now()
      logger.info(`[DeviceHandler] UPDATE_DEVICE request: id=${id}`, updates)
      try {
        deviceManager.updateDevice(id, updates)
        const duration = Date.now() - startTime
        logger.info(`[DeviceHandler] UPDATE_DEVICE success: id=${id}, duration=${duration}ms`)
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 修改设备名称
  handle<Device, void>(DATA_EVENTS.UPDATE_DEVICE_NAME, async (device) => {
    const startTime = Date.now()
    logger.info(
      `[DeviceHandler] UPDATE_DEVICE_NAME request: id=${device.id}, db_id=${device.db_id}, user_name=${device.user_name}, host_ip=${device.host_ip}`
    )
    try {
      await deviceManager.updateDeviceName(device)
      const duration = Date.now() - startTime
      logger.info(
        `[DeviceHandler] UPDATE_DEVICE_NAME success: id=${device.id}, duration=${duration}ms`
      )
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 重置设备
  handle<Device[], { resetDevices: Device[]; failedDevices: Device[] }>(
    DATA_EVENTS.RESET_DEVICE,
    async (devices) => {
      const startTime = Date.now()
      const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
      logger.info(
        `[DeviceHandler] RESET_DEVICE request: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
      )
      try {
        const data = await deviceManager.resetDevice(devices)
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceHandler] RESET_DEVICE success: reset=${data.resetDevices.length}, failed=${data.failedDevices.length}, duration=${duration}ms`
        )
        return { success: true, data }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 一键新机
  handle<
    { devices: Device[]; options: { wipeData: boolean; adiID?: string; cert_hash?: string } },
    { renewedDevices: Device[]; failedDevices: Device[] }
  >(DATA_EVENTS.RENEW_DEVICE, async ({ devices, options }) => {
    const startTime = Date.now()
    const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
    logger.info(
      `[DeviceHandler] RENEW_DEVICE request: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
    )
    try {
      const data = await deviceManager.renewDevice(devices, options)
      const duration = Date.now() - startTime
      logger.info(
        `[DeviceHandler] RENEW_DEVICE success: renewed=${data.renewedDevices.length}, failed=${data.failedDevices.length}, duration=${duration}ms`
      )
      return { success: true, data }
    } catch (error) {
      return handleError(error)
    }
  })

  // 重置设备（别名）
  handle<Device[], { resetDevices: Device[]; failedDevices: Device[] }>(
    DATA_EVENTS.DEVICE_RESETED,
    async (devices) => {
      const startTime = Date.now()
      const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
      logger.info(
        `[DeviceHandler] DEVICE_RESETED request: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
      )
      try {
        const data = await deviceManager.resetDevice(devices)
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceHandler] DEVICE_RESETED success: reset=${data.resetDevices.length}, failed=${data.failedDevices.length}, duration=${duration}ms`
        )
        return { success: true, data }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 重启设备
  handle<Device[], { restartedDevices: Device[]; failedDevices: Device[] }>(
    DATA_EVENTS.DEVICE_RESTARTED,
    async (devices) => {
      const startTime = Date.now()
      const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
      logger.info(
        `[DeviceHandler] DEVICE_RESTARTED request: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
      )
      try {
        const data = await deviceManager.restartDevice(devices)
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceHandler] DEVICE_RESTARTED success: restarted=${data.restartedDevices.length}, failed=${data.failedDevices.length}, duration=${duration}ms`
        )
        return { success: true, data }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 删除设备
  handle<Device[], { deletedDevices: Device[]; failedDevices: Device[] }>(
    DATA_EVENTS.DEVICE_DELETED,
    async (devices) => {
      const startTime = Date.now()
      const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
      logger.info(
        `[DeviceHandler] DEVICE_DELETED request: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
      )
      try {
        const data = await deviceManager.deleteDevice(devices)
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceHandler] DEVICE_DELETED success: deleted=${data.deletedDevices.length}, failed=${data.failedDevices.length}, duration=${duration}ms`
        )
        return { success: true, data }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 关闭设备
  handle<Device[], { shutdownDevices: Device[]; failedDevices: Device[] }>(
    DATA_EVENTS.DEVICE_SHUTDOWNED,
    async (devices) => {
      const startTime = Date.now()
      const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
      logger.info(
        `[DeviceHandler] DEVICE_SHUTDOWNED request: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
      )
      try {
        const data = await deviceManager.shutdownDevice(devices)
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceHandler] DEVICE_SHUTDOWNED success: shutdown=${data.shutdownDevices.length}, failed=${data.failedDevices.length}, duration=${duration}ms`
        )
        return { success: true, data }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 启动设备
  handle<Device[], { startedDevices: Device[]; failedDevices: Device[] }>(
    DATA_EVENTS.DEVICE_STARTED,
    async (devices) => {
      const startTime = Date.now()
      const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
      logger.info(
        `[DeviceHandler] DEVICE_STARTED request: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
      )
      try {
        const data = await deviceManager.startDevice(devices)
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceHandler] DEVICE_STARTED success: started=${data.startedDevices.length}, failed=${data.failedDevices.length}, duration=${duration}ms`
        )
        return { success: true, data }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 根据ID获取设备
  handle<string, Device>(DATA_EVENTS.GET_DEVICE_BY_ID, async (id) => {
    const startTime = Date.now()
    logger.info(`[DeviceHandler] GET_DEVICE_BY_ID request: id=${id}`)
    try {
      const data = await deviceManager.getDeviceById(id)
      const duration = Date.now() - startTime
      logger.info(`[DeviceHandler] GET_DEVICE_BY_ID success: id=${id}, duration=${duration}ms`)
      return { success: true, data }
    } catch (error) {
      return handleError(error)
    }
  })

  // 批量获取设备信息
  handle<string[], Device[]>(DATA_EVENTS.GET_DEVICES_BY_IDS, async (ids) => {
    const startTime = Date.now()
    logger.info(`[DeviceHandler] GET_DEVICES_BY_IDS request: count=${ids.length}`)
    try {
      // 批量查询：循环调用 deviceManager.getDeviceById 并处理可能的错误
      const data = await deviceManager.getDeviceByIds(ids)
      const duration = Date.now() - startTime
      logger.info(
        `[DeviceHandler] GET_DEVICES_BY_IDS success: count=${data.length}, duration=${duration}ms`
      )
      return { success: true, data }
    } catch (error) {
      return handleError(error)
    }
  })

  // 截图
  handle<Device, void>(DATA_EVENTS.DEVICE_SCREENSHOT, async (device) => {
    const startTime = Date.now()
    logger.info(`[DeviceHandler] DEVICE_SCREENSHOT request: id=${device.id}`)
    try {
      await deviceManager.screenshotDevice(device)
      const duration = Date.now() - startTime
      logger.info(
        `[DeviceHandler] DEVICE_SCREENSHOT success: id=${device.id}, duration=${duration}ms`
      )
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })
  logger.info('[DeviceHandler] ✅ 设备处理器已注册')
}
