import { Device } from '@shared/ipc/data.types'
import { DeviceDao } from '../../dao/DeviceDao'
import { BaseManager } from './BaseManager'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import { request, isAxiosError } from '@shared/api/request'
import { API_CONFIG, buildApiUrl, formatTime } from '@shared/api'
import { logger } from '../../logger'
import { ConfigManager } from './ConfigManager'
import { CONFIG_KEYS } from '@shared/constant'
import { DeviceStateCache } from './DeviceStateCache'
import path from 'path'
import fs from 'fs'

export class DeviceManager extends BaseManager {
  private configManager: ConfigManager
  private deviceDao: DeviceDao
  private stateCache = new DeviceStateCache()

  constructor(config: ConfigManager) {
    super()
    this.configManager = config
    this.deviceDao = new DeviceDao(this.dbInstance)
    this.initStateCache()
  }

  private initStateCache(): void {
    try {
      const allDevices = this.deviceDao.getAll()
      const byHost = new Map<string, Device[]>()
      for (const d of allDevices) {
        const ip = d.host_ip || ''
        let list = byHost.get(ip)
        if (!list) {
          list = []
          byHost.set(ip, list)
        }
        list.push(d)
      }
      for (const [ip, devices] of byHost) {
        this.stateCache.set(ip, devices)
      }
      logger.info(
        `[DeviceManager] stateCache initialized: ${byHost.size} hosts, ${allDevices.length} devices`
      )
    } catch (error) {
      logger.error('[DeviceManager] stateCache init failed, will rebuild on first sync:', error)
    }
  }

  private applyDeviceUpdates(hostIp: string, devices: any[]): void {
    const valid = devices.filter((d) => d?.db_id)
    if (!valid.length) return
    this.dbInstance.transaction(() => {
      for (const d of valid) this.deviceDao.update(d.db_id, d)
    })
    for (const d of valid) this.stateCache.update(hostIp, d as Device)
  }

  /**
   * 应用 API 返回的删除结果到本地 DB / cache，并返回规范化后的 Device 列表。
   * API raw 数据可能缺 id 字段（Device 类型契约要求 id 必填，对应 db_id 或 UUID），
   * 此方法是规范化的唯一入口：所有下游消费者（前端事件、FrpManager 等）只接触规范化数据。
   */
  private applyDeviceDeletes(hostIp: string, devices: any[]): Device[] {
    const normalized = devices
      .filter((d) => d?.db_id)
      .map((d) => ({ ...d, id: d.id || d.db_id }) as Device)
    if (!normalized.length) return []
    this.dbInstance.transaction(() => {
      for (const d of normalized) this.deviceDao.delete(d.id)
    })
    for (const d of normalized) this.stateCache.remove(hostIp, d.id)
    return normalized
  }

  private applyPartialUpdate(hostIp: string, deviceId: string, fields: Partial<Device>): void {
    this.deviceDao.update(deviceId, fields)
    const cached = this.stateCache.get(hostIp, deviceId)
    if (cached) this.stateCache.update(hostIp, { ...cached, ...fields } as Device)
  }

  /**
   * 获取推流设置的 scdArgs 参数
   * @returns scdArgs JSON 字符串，包含 video_bit_rate 和 max_fps
   */
  private getScdArgs(): string {
    const fps = this.configManager.getValue(CONFIG_KEYS.STREAM_FPS) || '30'
    const bitrate = this.configManager.getValue(CONFIG_KEYS.STREAM_BITRATE) || '2'
    // 码率转换为字节，1MB = 1024 * 1024 字节
    // 使用字符串形式避免 JSON.stringify 将大数字转换为科学计数法
    const bitrateBytes = parseInt(bitrate) * 1024 * 1024
    return JSON.stringify({
      video_bit_rate: String(bitrateBytes),
      max_fps: fps
    })
  }

  public getDevices(): Device[] {
    const startTime = Date.now()
    logger.debug('[DeviceManager] getDevices called')
    try {
      const devices = this.deviceDao.getAll()
      // 验证返回数据
      if (!Array.isArray(devices)) {
        logger.warn('[DeviceManager] getDevices: returned data is not an array')
        throw new Error('Invalid data format: expected array')
      }
      const duration = Date.now() - startTime
      logger.debug(
        `[DeviceManager] getDevices success: count=${devices.length}, duration=${duration}ms`
      )
      return devices
    } catch (error) {
      logger.error('[DeviceManager] getDevices failed:', error)
      throw error
    }
  }

  public updateDevice(id: string, updates: Partial<Device>): void {
    const startTime = Date.now()
    logger.debug(`[DeviceManager] updateDevice called: id=${id}`, updates)
    try {
      // 输入验证
      if (!id || !updates || Object.keys(updates).length === 0) {
        logger.warn(
          `[DeviceManager] updateDevice: invalid input id=${id}, updates=${JSON.stringify(updates)}`
        )
        throw new Error('Invalid input: id and updates are required')
      }

      const updated = this.deviceDao.update(id, updates)
      const duration = Date.now() - startTime
      if (!updated) {
        logger.warn(`[DeviceManager] updateDevice no changes: id=${id}, duration=${duration}ms`)
        throw new Error(`Device not found or no changes: id=${id}`)
      }
      logger.info(`[DeviceManager] updateDevice success: id=${id}, duration=${duration}ms`)
      const updatedDevice = this.deviceDao.getById(id)
      if (updatedDevice) {
        const hostIp = updatedDevice.host_ip || ''
        this.stateCache.update(hostIp, updatedDevice)
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, [updatedDevice])
      }
    } catch (error) {
      logger.error('[DeviceManager] updateDevice failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id,
        updates
      })
      throw error
    }
  }

  /**
   * 重启设备
   * @param devices 设备列表
   * @returns
   */

  public async restartDevice(devices: Device[]) {
    const startTime = Date.now()
    const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
    logger.info(
      `[DeviceManager] restartDevice called: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
    )
    try {
      // 按照host_ip分组
      const groupedDevices = devices.reduce(
        (acc, device) => {
          const hostIp = device.host_ip || ''
          if (!hostIp) {
            logger.warn(
              `[DeviceManager] restartDevice: device ${device.id || device.db_id} has no host_ip, skipping`
            )
            return acc
          }
          acc[hostIp] = [...(acc[hostIp] || []), device]
          return acc
        },
        {} as Record<string, Device[]>
      )

      logger.info(
        `[DeviceManager] restartDevice: grouped into ${Object.keys(groupedDevices).length} hosts`
      )
      const restartedDevices: Device[] = []
      const failedDevices: Device[] = []

      for (const [hostIp, hostDevices] of Object.entries(groupedDevices)) {
        const hostStartTime = Date.now()
        const hostDeviceIds = hostDevices.map((d) => d.db_id).filter(Boolean)
        logger.info(
          `[DeviceManager] restartDevice: processing host ${hostIp}, deviceCount=${hostDevices.length}, dbIds=${hostDeviceIds.join(',')}`
        )
        try {
          const url = buildApiUrl(hostIp, API_CONFIG.PATHS.RESTART_DEVICE_BATCH)
          logger.debug(`[DeviceManager] restartDevice: calling API ${url}`)
          const { data } = await request.post<any>(url, {
            db_ids: hostDeviceIds,
            scdArgs: this.getScdArgs()
          })

          if (data?.list && Array.isArray(data.list) && data.list.length > 0) {
            logger.info(
              `[DeviceManager] restartDevice: API returned ${data.list.length} devices for host ${hostIp}`
            )
            this.applyDeviceUpdates(hostIp, data.list)
            restartedDevices.push(...(data?.list || []))
            const hostDuration = Date.now() - hostStartTime
            logger.info(
              `[DeviceManager] restartDevice: host ${hostIp} success, restarted=${data.list.length}, duration=${hostDuration}ms`
            )
          } else {
            logger.warn(`[DeviceManager] restartDevice: API returned empty list for host ${hostIp}`)
            failedDevices.push(...hostDevices)
          }
        } catch (hostError) {
          const hostDuration = Date.now() - hostStartTime
          logger.error(`[DeviceManager] restartDevice: host ${hostIp} failed:`, {
            error: hostError,
            stack: hostError instanceof Error ? hostError.stack : undefined,
            deviceCount: hostDevices.length,
            duration: hostDuration
          })
          failedDevices.push(...hostDevices)
        }
      }

      const duration = Date.now() - startTime
      logger.info(
        `[DeviceManager] restartDevice completed: restarted=${restartedDevices.length}, failed=${failedDevices.length}, duration=${duration}ms`
      )

      // 只有成功重启的设备才通知前端
      if (restartedDevices.length > 0) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, restartedDevices)
      }

      return {
        restartedDevices,
        failedDevices
      }
    } catch (error) {
      logger.error('[DeviceManager] restartDevice failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: devices.length,
        deviceIds
      })
      throw error
    }
  }
  /**
   * 同步指定 Host 下的设备列表
   * 以接口返回的数据为准：
   * - 新接口有，本地没有 → 新增
   * - 接口有，本地有 → 更新
   * - 本地有，接口没有 → 删除
   */
  public async syncHostDevices(ip: string, hostId?: string): Promise<void> {
    const startTime = Date.now()
    // called 日志降为 debug，避免每 3 秒刷屏
    logger.debug(`[DeviceManager] syncHostDevices called: hostIp=${ip}, hostId=${hostId}`)

    try {
      // 1️⃣ 请求 Host 侧设备数据
      const url = buildApiUrl(ip, API_CONFIG.PATHS.GET_DB)
      logger.debug(`[DeviceManager] syncHostDevices: calling API ${url}`)

      const { data } = await request.post<any>(url)

      // 接口数据校验
      if (!data || !Array.isArray(data.list)) {
        logger.warn(
          `[DeviceManager] syncHostDevices: API returned invalid data for host ${ip}`,
          data
        )
        return
      }

      logger.debug(
        `[DeviceManager] syncHostDevices: API returned ${data.list.length} devices for host ${ip}`
      )

      // 2️⃣ 预处理：本地设备 → Map（避免反复查 DB）
      const existingDevices = this.deviceDao.getByHostIp(ip)
      const existingMap = new Map<string, Device>()
      for (const d of existingDevices) {
        existingMap.set(d.id, d)
      }

      // 记录接口返回的所有 deviceId
      const apiIdSet = new Set<string>()

      // 事件数据收集
      const addedDevices: Device[] = []
      const updatedDevices: Device[] = []
      const deletedDevices: Device[] = []

      // 3️⃣ 用内存缓存做真正的变更检测，再写入数据库
      const now = Date.now()

      for (const rd of data.list) {
        const deviceId = rd.db_id
        if (!deviceId) {
          logger.warn(`[DeviceManager] skip device without db_id`, rd)
          continue
        }

        apiIdSet.add(deviceId)

        const deviceData: Device = {
          ...rd,
          id: deviceId,
          host_ip: ip,
          hostId: hostId,
          lastActiveTime: now
        }

        const existing = existingMap.get(deviceId)

        if (!existing) {
          addedDevices.push(deviceData)
        } else if (this.stateCache.hasChanged(ip, deviceData)) {
          updatedDevices.push(deviceData)
        }
      }

      for (const local of existingDevices) {
        if (!apiIdSet.has(local.id)) {
          deletedDevices.push(local)
        }
      }

      const hasChanges =
        addedDevices.length > 0 || updatedDevices.length > 0 || deletedDevices.length > 0

      if (hasChanges) {
        this.dbInstance.transaction(() => {
          for (const d of addedDevices) this.deviceDao.insert(d)
          for (const d of updatedDevices) this.deviceDao.update(d.id, d)
          for (const d of deletedDevices) this.deviceDao.delete(d.id)
        })

        for (const d of addedDevices) this.stateCache.update(ip, d)
        for (const d of updatedDevices) this.stateCache.update(ip, d)
        for (const d of deletedDevices) this.stateCache.remove(ip, d.id)
      }

      const duration = Date.now() - startTime
      const logFn = hasChanges ? logger.info.bind(logger) : logger.debug.bind(logger)
      logFn(
        `[DeviceManager] syncHostDevices: hostIp=${ip}, added=${addedDevices.length}, updated=${updatedDevices.length}, deleted=${deletedDevices.length}, duration=${duration}ms`
      )

      // 4️⃣ 批量通知前端（事务外）
      if (addedDevices.length) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_ADDED, addedDevices)
      }
      if (updatedDevices.length) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, updatedDevices)
      }
      if (deletedDevices.length) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_DELETED, deletedDevices)
      }

      // 通知 FRP 模块
      try {
        const { frpManager } = await import('../managers')
        frpManager.onDevicesSynced(ip, [...addedDevices, ...updatedDevices], deletedDevices)
      } catch {
        // frpManager may not be initialized yet
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const msg = isAxiosError(error) ? error.message : String(error)

      logger.error(
        `[DeviceManager] syncHostDevices failed: hostIp=${ip}, error=${msg}, duration=${duration}ms`,
        {
          error,
          stack: error instanceof Error ? error.stack : undefined
        }
      )

      throw error
    }
  }

  public markAllOfflineByHost(ip: string): void {
    const startTime = Date.now()
    logger.info(`[DeviceManager] markAllOfflineByHost called: hostIp=${ip}`)
    try {
      // 输入验证
      if (!ip) {
        logger.warn('[DeviceManager] markAllOfflineByHost: invalid ip, skipping')
        return
      }

      this.deviceDao.markAllOfflineByHost(ip)

      const updatedDevices = this.deviceDao.getByHostIp(ip)
      if (updatedDevices.length > 0) {
        this.stateCache.set(ip, updatedDevices)
      }
      const duration = Date.now() - startTime
      logger.info(
        `[DeviceManager] markAllOfflineByHost success: hostIp=${ip}, deviceCount=${updatedDevices.length}, duration=${duration}ms`
      )
      if (updatedDevices.length > 0) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, updatedDevices)
      }
    } catch (error) {
      logger.error('[DeviceManager] markAllOfflineByHost failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        hostIp: ip
      })
      throw error
    }
  }

  public deleteByHostIp(ip: string, hostId?: string): Device[] {
    const startTime = Date.now()
    logger.info(`[DeviceManager] deleteByHostIp called: hostIp=${ip}, hostId=${hostId}`)
    try {
      if (!ip && !hostId) {
        logger.warn('[DeviceManager] deleteByHostIp: invalid ip and hostId, skipping')
        return []
      }

      const deletedDevices: Device[] = []

      this.dbInstance.transaction(() => {
        // 1. 优先通过 hostId 删除（如果提供了 hostId）
        if (hostId) {
          const devicesByHostId = this.deviceDao.getByHostId(hostId)
          if (devicesByHostId.length > 0) {
            this.deviceDao.deleteByHostId(hostId)
            deletedDevices.push(...devicesByHostId)
          }
        }

        // 2. 无论是否通过 hostId 删除过，都尝试通过 IP 删除，以确保清理干净
        // 特别是考虑到 HostDao 中的 deviceCount 是通过 IP 关联的
        if (ip) {
          const devicesByHostIp = this.deviceDao.getByHostIp(ip)
          // 过滤掉已经在 deletedDevices 中的设备，避免重复删除或通知
          const remainingDevices = devicesByHostIp.filter(
            (d) => !deletedDevices.some((dd) => dd.id === d.id)
          )

          if (remainingDevices.length > 0) {
            this.deviceDao.deleteByHostIp(ip)
            deletedDevices.push(...remainingDevices)
          }
        }
      })

      if (deletedDevices.length > 0) {
        if (ip) this.stateCache.clearHost(ip)
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceManager] deleteByHostIp success: deleted ${deletedDevices.length} devices, duration=${duration}ms`
        )
        this.notifyFrontend(DATA_EVENTS.DEVICE_DELETED, deletedDevices)

        import('../managers')
          .then(({ frpManager }) => frpManager.onDevicesSynced(ip || '', [], deletedDevices))
          .catch(() => {})
      }

      return deletedDevices
    } catch (error) {
      logger.error('[DeviceManager] deleteByHostIp failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        hostIp: ip,
        hostId
      })
      throw error
    }
  }

  /**
   * 清除主机下的离线设备
   */
  public clearOfflineByHost(ip: string, hostId?: string): Device[] {
    const startTime = Date.now()
    logger.info(`[DeviceManager] clearOfflineByHost called: hostIp=${ip}, hostId=${hostId}`)
    try {
      if (!ip && !hostId) {
        logger.warn('[DeviceManager] clearOfflineByHost: invalid ip and hostId, skipping')
        return []
      }

      const offlineDevices: Device[] = []

      this.dbInstance.transaction(() => {
        // 收集所有离线设备
        const allDevices: Device[] = []

        if (hostId) {
          allDevices.push(...this.deviceDao.getByHostId(hostId))
        }

        if (ip) {
          const devicesByIp = this.deviceDao.getByHostIp(ip)
          // 合并并去重
          devicesByIp.forEach((d) => {
            if (!allDevices.some((existing) => existing.id === d.id)) {
              allDevices.push(d)
            }
          })
        }

        // 过滤出离线设备
        const devicesToClear = allDevices.filter((device) => device.state === 'offline')

        if (devicesToClear.length > 0) {
          devicesToClear.forEach((device) => {
            this.deviceDao.delete(device.id)
            offlineDevices.push(device)
          })
        }
      })

      if (offlineDevices.length > 0) {
        for (const d of offlineDevices) {
          this.stateCache.remove(d.host_ip || '', d.id)
        }
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceManager] clearOfflineByHost success: deleted ${offlineDevices.length} offline devices, duration=${duration}ms`
        )
        this.notifyFrontend(DATA_EVENTS.DEVICE_DELETED, offlineDevices)

        import('../managers')
          .then(({ frpManager }) => frpManager.onDevicesSynced(ip || '', [], offlineDevices))
          .catch(() => {})
      }

      return offlineDevices
    } catch (error) {
      logger.error('[DeviceManager] clearOfflineByHost failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        hostIp: ip,
        hostId
      })
      throw error
    }
  }

  public async updateDeviceName(device: Device): Promise<void> {
    const startTime = Date.now()
    const { db_id, user_name, host_ip } = device
    logger.info(
      `[DeviceManager] updateDeviceName called: db_id=${db_id}, user_name=${user_name}, host_ip=${host_ip}`
    )
    try {
      // 输入验证
      if (!db_id || !host_ip || user_name === undefined) {
        logger.warn(
          `[DeviceManager] updateDeviceName: invalid input, db_id=${db_id}, host_ip=${host_ip}, user_name=${user_name}`
        )
        return
      }

      const url = buildApiUrl(
        host_ip,
        `${API_CONFIG.PATHS.UPDATE_DEVICE_NAME}/${db_id}/${user_name}`
      )
      logger.debug(`[DeviceManager] updateDeviceName: calling API ${url}`)
      const { data } = await request.get<any>(url)

      logger.info(`[DeviceManager] updateDeviceName: API returned data`, data)

      // 验证响应数据
      if (data && data.db_id) {
        // 更新数据库
        this.applyPartialUpdate(host_ip, db_id, { user_name } as Partial<Device>)
        const duration = Date.now() - startTime
        logger.info(
          `[DeviceManager] updateDeviceName success: db_id=${db_id}, user_name=${user_name}, duration=${duration}ms`
        )

        // 通知前端
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, [data])
      } else {
        logger.warn(`[DeviceManager] updateDeviceName: API returned invalid data`, data)
      }
    } catch (error) {
      logger.error('[DeviceManager] updateDeviceName failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        db_id,
        user_name,
        host_ip
      })
      throw error
    }
  }

  /**
   * 删除设备
   * @param db_id 设备ID
   * @param host_ip 主机IP
   */
  public async deleteDevice(devices: Device[]) {
    const startTime = Date.now()
    const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
    logger.info(
      `[DeviceManager] deleteDevice called: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
    )
    try {
      // 按照host_ip分组
      const groupedDevices = devices.reduce(
        (acc, device) => {
          const hostIp = device.host_ip || ''
          if (!hostIp) {
            logger.warn(
              `[DeviceManager] deleteDevice: device ${device.id || device.db_id} has no host_ip, skipping`
            )
            return acc
          }
          acc[hostIp] = [...(acc[hostIp] || []), device]
          return acc
        },
        {} as Record<string, Device[]>
      )

      logger.info(
        `[DeviceManager] deleteDevice: grouped into ${Object.keys(groupedDevices).length} hosts`
      )
      const deletedDevices: Device[] = []
      const failedDevices: Device[] = []

      for (const [hostIp, hostDevices] of Object.entries(groupedDevices)) {
        const hostStartTime = Date.now()
        const hostDeviceIds = hostDevices.map((d) => d.db_id).filter(Boolean)
        logger.info(
          `[DeviceManager] deleteDevice: processing host ${hostIp}, deviceCount=${hostDevices.length}, dbIds=${hostDeviceIds.join(',')}`
        )
        try {
          const url = buildApiUrl(hostIp, API_CONFIG.PATHS.DEVICE_DELETED)
          logger.debug(`[DeviceManager] deleteDevice: calling API ${url}`)
          const { data } = await request.post<any>(url, {
            db_ids: hostDeviceIds
          })

          if (data?.list && Array.isArray(data.list) && data.list.length > 0) {
            logger.info(
              `[DeviceManager] deleteDevice: API returned ${data.list.length} devices for host ${hostIp}`
            )
            // 用规范化后的返回值，保证 deletedDevices 里每个对象 id 都有值
            const normalized = this.applyDeviceDeletes(hostIp, data.list)
            deletedDevices.push(...normalized)
            const hostDuration = Date.now() - hostStartTime
            logger.info(
              `[DeviceManager] deleteDevice: host ${hostIp} success, deleted=${data.list.length}, duration=${hostDuration}ms`
            )
          } else {
            logger.warn(`[DeviceManager] deleteDevice: API returned empty list for host ${hostIp}`)
            failedDevices.push(...hostDevices)
          }
        } catch (hostError) {
          const hostDuration = Date.now() - hostStartTime
          logger.error(`[DeviceManager] deleteDevice: host ${hostIp} failed:`, {
            error: hostError,
            stack: hostError instanceof Error ? hostError.stack : undefined,
            deviceCount: hostDevices.length,
            duration: hostDuration
          })
          failedDevices.push(...hostDevices)
        }
      }

      const duration = Date.now() - startTime
      logger.info(
        `[DeviceManager] deleteDevice completed: deleted=${deletedDevices.length}, failed=${failedDevices.length}, duration=${duration}ms`
      )

      // 只有成功删除的设备才通知前端
      if (deletedDevices.length > 0) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_DELETED, deletedDevices)

        try {
          const { frpManager } = await import('../managers')
          const byHost = new Map<string, Device[]>()
          for (const d of deletedDevices) {
            const ip = d.host_ip || ''
            if (!byHost.has(ip)) byHost.set(ip, [])
            byHost.get(ip)!.push(d)
          }
          for (const [hostIp, devs] of byHost) {
            frpManager.onDevicesSynced(hostIp, [], devs)
          }
        } catch {
          // frpManager 可能尚未初始化
        }
      }

      return {
        deletedDevices,
        failedDevices
      }
    } catch (error) {
      logger.error('[DeviceManager] deleteDevice failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: devices.length,
        deviceIds
      })
      throw error
    }
  }

  /**
   * 重置设备
   * @param devices 设备列表
   * @returns
   */
  public async resetDevice(devices: Device[]) {
    const startTime = Date.now()
    const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
    logger.info(
      `[DeviceManager] resetDevice called: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
    )
    try {
      // 按照host_ip分组
      const groupedDevices = devices.reduce(
        (acc, device) => {
          const hostIp = device.host_ip || ''
          if (!hostIp) {
            logger.warn(
              `[DeviceManager] resetDevice: device ${device.id || device.db_id} has no host_ip, skipping`
            )
            return acc
          }
          acc[hostIp] = [...(acc[hostIp] || []), device]
          return acc
        },
        {} as Record<string, Device[]>
      )

      logger.info(
        `[DeviceManager] resetDevice: grouped into ${Object.keys(groupedDevices).length} hosts`
      )
      const resetDevices: Device[] = []
      const failedDevices: Device[] = []

      for (const [hostIp, hostDevices] of Object.entries(groupedDevices)) {
        const hostStartTime = Date.now()
        const hostDeviceIds = hostDevices.map((d) => d.db_id).filter(Boolean)
        logger.info(
          `[DeviceManager] resetDevice: processing host ${hostIp}, deviceCount=${hostDevices.length}, dbIds=${hostDeviceIds.join(',')}`
        )
        try {
          const url = buildApiUrl(hostIp, API_CONFIG.PATHS.RESET_DEVICE_BATCH)
          logger.debug(`[DeviceManager] resetDevice: calling API ${url}`)
          const { data } = await request.post<any>(url, {
            db_ids: hostDeviceIds,
            scdArgs: this.getScdArgs()
          })

          if (data?.list && Array.isArray(data.list) && data.list.length > 0) {
            logger.info(
              `[DeviceManager] resetDevice: API returned ${data.list.length} devices for host ${hostIp}`
            )
            this.applyDeviceUpdates(hostIp, data.list)
            resetDevices.push(...(data?.list || []))
            const hostDuration = Date.now() - hostStartTime
            logger.info(
              `[DeviceManager] resetDevice: host ${hostIp} success, reset=${data.list.length}, duration=${hostDuration}ms`
            )
          } else {
            logger.warn(`[DeviceManager] resetDevice: API returned empty list for host ${hostIp}`)
            failedDevices.push(...hostDevices)
          }
        } catch (hostError) {
          const hostDuration = Date.now() - hostStartTime
          logger.error(`[DeviceManager] resetDevice: host ${hostIp} failed:`, {
            error: hostError,
            stack: hostError instanceof Error ? hostError.stack : undefined,
            deviceCount: hostDevices.length,
            duration: hostDuration
          })
          failedDevices.push(...hostDevices)
        }
      }

      const duration = Date.now() - startTime
      logger.info(
        `[DeviceManager] resetDevice completed: reset=${resetDevices.length}, failed=${failedDevices.length}, duration=${duration}ms`
      )

      // 只有成功重置的设备才通知前端
      if (resetDevices.length > 0) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, resetDevices)
      }

      return {
        resetDevices,
        failedDevices
      }
    } catch (error) {
      logger.error('[DeviceManager] resetDevice failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: devices.length,
        deviceIds
      })
      throw error
    }
  }

  /**
   * 一键新机
   * @param devices 设备列表
   * @param options 配置项
   * @returns
   */
  public async renewDevice(
    devices: Device[],
    options: {
      wipeData: boolean
      adiName?: string
      adiPass?: string
      cert_hash?: string
    }
  ) {
    const startTime = Date.now()
    const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
    logger.info(
      `[DeviceManager] renewDevice called: count=${devices.length}, deviceIds=${deviceIds.join(',')}, options=${JSON.stringify(options)}`
    )
    try {
      // 按照host_ip分组
      const groupedDevices = devices.reduce(
        (acc, device) => {
          const hostIp = device.host_ip || ''
          if (!hostIp) {
            logger.warn(
              `[DeviceManager] renewDevice: device ${device.id || device.db_id} has no host_ip, skipping`
            )
            return acc
          }
          acc[hostIp] = [...(acc[hostIp] || []), device]
          return acc
        },
        {} as Record<string, Device[]>
      )

      logger.info(
        `[DeviceManager] renewDevice: grouped into ${Object.keys(groupedDevices).length} hosts`
      )
      const renewedDevices: Device[] = []
      const failedDevices: Device[] = []

      for (const [hostIp, hostDevices] of Object.entries(groupedDevices)) {
        const hostStartTime = Date.now()
        const hostDeviceIds = hostDevices.map((d) => d.db_id).filter(Boolean)
        logger.info(
          `[DeviceManager] renewDevice: processing host ${hostIp}, deviceCount=${hostDevices.length}, dbIds=${hostDeviceIds.join(',')}`
        )
        try {
          const url = buildApiUrl(hostIp, API_CONFIG.PATHS.REPLACE_DEVICE_INFO)

          const params: any = {
            db_ids: hostDeviceIds,
            wipeData: options.wipeData,
            scdArgs: this.getScdArgs()
          }
          if (options.adiName) {
            params.adiName = options.adiName
          }

          if (options.adiPass) {
            params.adiPass = options.adiPass
          }

          if (options.cert_hash) {
            params.cert_hash = options.cert_hash
          }

          logger.debug(`[DeviceManager] renewDevice: calling API ${url}`, params)
          const { data } = await request.post<any>(url, params, { timeout: 60 * 1000 })

          if (data?.list && Array.isArray(data.list) && data.list.length > 0) {
            logger.info(
              `[DeviceManager] renewDevice: API returned ${data.list.length} devices for host ${hostIp}`
            )
            this.applyDeviceUpdates(hostIp, data.list)
            renewedDevices.push(...(data?.list || []))
            const hostDuration = Date.now() - hostStartTime
            logger.info(
              `[DeviceManager] renewDevice: host ${hostIp} success, renewed=${data.list.length}, duration=${hostDuration}ms`
            )
          } else {
            logger.warn(`[DeviceManager] renewDevice: API returned empty list for host ${hostIp}`)
            failedDevices.push(...hostDevices)
          }
        } catch (hostError) {
          const hostDuration = Date.now() - hostStartTime
          logger.error(`[DeviceManager] renewDevice: host ${hostIp} failed:`, {
            error: hostError,
            stack: hostError instanceof Error ? hostError.stack : undefined,
            deviceCount: hostDevices.length,
            duration: hostDuration
          })
          failedDevices.push(...hostDevices)
        }
      }

      const duration = Date.now() - startTime
      logger.info(
        `[DeviceManager] renewDevice completed: renewed=${renewedDevices.length}, failed=${failedDevices.length}, duration=${duration}ms`
      )

      // 只有成功操作的设备才通知前端
      if (renewedDevices.length > 0) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, renewedDevices)
      }

      return {
        renewedDevices,
        failedDevices
      }
    } catch (error) {
      logger.error('[DeviceManager] renewDevice failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: devices.length,
        deviceIds
      })
      throw error
    }
  }

  /**
   * 关闭设备
   * @param devices 设备列表
   * @returns
   */
  public async shutdownDevice(devices: Device[]) {
    const startTime = Date.now()
    const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
    logger.info(
      `[DeviceManager] shutdownDevice called: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
    )
    try {
      // 按照host_ip分组
      const groupedDevices = devices.reduce(
        (acc, device) => {
          const hostIp = device.host_ip || ''
          if (!hostIp) {
            logger.warn(
              `[DeviceManager] shutdownDevice: device ${device.id || device.db_id} has no host_ip, skipping`
            )
            return acc
          }
          acc[hostIp] = [...(acc[hostIp] || []), device]
          return acc
        },
        {} as Record<string, Device[]>
      )

      logger.info(
        `[DeviceManager] shutdownDevice: grouped into ${Object.keys(groupedDevices).length} hosts`
      )
      const shutdownDevices: Device[] = []
      const failedDevices: Device[] = []

      for (const [hostIp, hostDevices] of Object.entries(groupedDevices)) {
        const hostStartTime = Date.now()
        const hostDeviceIds = hostDevices.map((d) => d.db_id).filter(Boolean)
        logger.info(
          `[DeviceManager] shutdownDevice: processing host ${hostIp}, deviceCount=${hostDevices.length}, dbIds=${hostDeviceIds.join(',')}`
        )
        try {
          const url = buildApiUrl(hostIp, API_CONFIG.PATHS.SHUTDOWN_DEVICE_BATCH)
          logger.debug(`[DeviceManager] shutdownDevice: calling API ${url}`)
          const { data } = await request.post<any>(url, {
            db_ids: hostDeviceIds
          })

          if (data?.list && Array.isArray(data.list) && data.list.length > 0) {
            logger.info(
              `[DeviceManager] shutdownDevice: API returned ${data.list.length} devices for host ${hostIp}`
            )
            this.applyDeviceUpdates(hostIp, data.list)
            shutdownDevices.push(...(data?.list || []))
            const hostDuration = Date.now() - hostStartTime
            logger.info(
              `[DeviceManager] shutdownDevice: host ${hostIp} success, shutdown=${data.list.length}, duration=${hostDuration}ms`
            )
          } else {
            logger.warn(
              `[DeviceManager] shutdownDevice: API returned empty list for host ${hostIp}`
            )
            failedDevices.push(...hostDevices)
          }
        } catch (hostError) {
          const hostDuration = Date.now() - hostStartTime
          logger.error(`[DeviceManager] shutdownDevice: host ${hostIp} failed:`, {
            error: hostError,
            stack: hostError instanceof Error ? hostError.stack : undefined,
            deviceCount: hostDevices.length,
            duration: hostDuration
          })
          failedDevices.push(...hostDevices)
        }
      }

      const duration = Date.now() - startTime
      logger.info(
        `[DeviceManager] shutdownDevice completed: shutdown=${shutdownDevices.length}, failed=${failedDevices.length}, duration=${duration}ms`
      )

      // 只有成功关闭的设备才通知前端
      if (shutdownDevices.length > 0) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, shutdownDevices)
      }

      return {
        shutdownDevices,
        failedDevices
      }
    } catch (error) {
      logger.error('[DeviceManager] shutdownDevice failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: devices.length,
        deviceIds
      })
      throw error
    }
  }

  /**
   * 启动设备
   * @param devices 设备列表
   * @returns
   */
  public async startDevice(devices: Device[]) {
    const startTime = Date.now()
    const deviceIds = devices.map((d) => d.id || d.db_id).filter(Boolean)
    logger.info(
      `[DeviceManager] startDevice called: count=${devices.length}, deviceIds=${deviceIds.join(',')}`
    )
    try {
      // 按照host_ip分组
      const groupedDevices = devices.reduce(
        (acc, device) => {
          const hostIp = device.host_ip || ''
          if (!hostIp) {
            logger.warn(
              `[DeviceManager] startDevice: device ${device.id || device.db_id} has no host_ip, skipping`
            )
            return acc
          }
          acc[hostIp] = [...(acc[hostIp] || []), device]
          return acc
        },
        {} as Record<string, Device[]>
      )

      logger.info(
        `[DeviceManager] startDevice: grouped into ${Object.keys(groupedDevices).length} hosts`
      )
      const startedDevices: Device[] = []
      const failedDevices: Device[] = []

      for (const [hostIp, hostDevices] of Object.entries(groupedDevices)) {
        const hostStartTime = Date.now()
        const hostDeviceIds = hostDevices.map((d) => d.db_id).filter(Boolean)
        logger.info(
          `[DeviceManager] startDevice: processing host ${hostIp}, deviceCount=${hostDevices.length}, dbIds=${hostDeviceIds.join(',')}`
        )
        try {
          const url = buildApiUrl(hostIp, API_CONFIG.PATHS.START_DEVICE_BATCH)
          logger.debug(`[DeviceManager] startDevice: calling API ${url}`)
          const { data } = await request.post<any>(url, {
            db_ids: hostDeviceIds,
            scdArgs: this.getScdArgs()
          })

          if (data?.list && Array.isArray(data.list) && data.list.length > 0) {
            logger.info(
              `[DeviceManager] startDevice: API returned ${data.list.length} devices for host ${hostIp}`
            )
            this.applyDeviceUpdates(hostIp, data.list)
            startedDevices.push(...(data?.list || []))
            const hostDuration = Date.now() - hostStartTime
            logger.info(
              `[DeviceManager] startDevice: host ${hostIp} success, started=${data.list.length}, duration=${hostDuration}ms`
            )
          } else {
            logger.warn(`[DeviceManager] startDevice: API returned empty list for host ${hostIp}`)
            failedDevices.push(...hostDevices)
          }
        } catch (hostError) {
          const hostDuration = Date.now() - hostStartTime
          logger.error(`[DeviceManager] startDevice: host ${hostIp} failed:`, {
            error: hostError,
            stack: hostError instanceof Error ? hostError.stack : undefined,
            deviceCount: hostDevices.length,
            duration: hostDuration
          })
          failedDevices.push(...hostDevices)
        }
      }

      const duration = Date.now() - startTime
      logger.info(
        `[DeviceManager] startDevice completed: started=${startedDevices.length}, failed=${failedDevices.length}, duration=${duration}ms`
      )

      // 只有成功启动的设备才通知前端
      if (startedDevices.length > 0) {
        this.notifyFrontend(DATA_EVENTS.DEVICE_UPDATED, startedDevices)
      }

      return {
        startedDevices,
        failedDevices
      }
    } catch (error) {
      logger.error('[DeviceManager] startDevice failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: devices.length,
        deviceIds
      })
      throw error
    }
  }
  /**
   * 根据ID获取设备
   * @param id 设备ID
   * @returns
   */
  public getDeviceById(id: string): Device {
    logger.debug(`[DeviceManager] getDeviceById called: id=${id}`)
    try {
      if (!id) {
        throw new Error(`Device ID is required`)
      }
      const device = this.deviceDao.getById(id)
      if (!device) {
        throw new Error(`Device not found: id=${id}`)
      }
      return device
    } catch (error) {
      logger.error(`[DeviceManager] getDeviceById failed: id=${id}`, error)
      throw error
    }
  }

  /**
   * 根据ID列表获取设备
   * @param ids 设备ID列表
   * @returns
   */
  public getDeviceByIds(ids: string[]): Device[] {
    logger.debug(`[DeviceManager] getDeviceByIds called: ids=${ids.join(',')}`)
    try {
      if (!ids.length) {
        throw new Error(`Device IDs are required`)
      }
      return this.deviceDao.getByIds(ids)
    } catch (error) {
      logger.error(`[DeviceManager] getDeviceByIds failed: ids=${ids.join(',')}`, error)
      throw error
    }
  }

  /**
   * 截图
   * @param id 设备ID
   * @returns
   */
  public async screenshotDevice(device: Device): Promise<boolean> {
    logger.debug(`[DeviceManager] screenshotDevice called:  device=${JSON.stringify(device)}`)
    try {
      const { host_ip, db_id } = device
      if (!host_ip || !db_id) {
        throw new Error(`Device host_ip or db_id is required`)
      }
      const url = buildApiUrl(host_ip, `${API_CONFIG.PATHS.GET_SCREENSHOT}/${db_id}`)
      logger.debug(`[DeviceManager] screenshotDevice: calling API ${url}`)

      const res = await request.get<any>(
        url,
        {
          format: 'png'
        },
        {
          responseType: 'arraybuffer',
          timeout: 5000
        }
      )

      const screenshotStoragePath = this.configManager.getValue(CONFIG_KEYS.SCREENSHOT_STORAGE_PATH)
      if (!screenshotStoragePath) {
        throw new Error(`Screenshot storage path is not set`)
      }

      // 保存截图到本地
      const filePath = path.join(
        screenshotStoragePath,
        `${db_id}_${formatTime(Date.now(), 'yyyy-MM-dd_HH-mm-ss')}.png`
      )
      fs.writeFileSync(filePath, Buffer.from(res))
      logger.info(`[DeviceManager] screenshotDevice: saved to ${filePath}`)

      return true
    } catch (error) {
      logger.error(
        `[DeviceManager] screenshotDevice failed: options=${JSON.stringify(device)}`,
        error
      )
      throw error
    }
  }

  public getDevicesByGroupId(groupId: string): Device[] {
    return this.deviceDao.getByGroupId(groupId)
  }

  public moveDevices(ids: string[], groupId: string): void {
    try {
      if (ids.length === 0) return
      logger.info(`[DeviceManager] moveDevices: count=${ids.length} to groupId=${groupId}`)
      this.dbInstance.transaction(() => {
        ids.forEach((id) => {
          this.deviceDao.update(id, { groupId })
        })
      })
      this.notifyFrontend(DATA_EVENTS.DEVICES_MOVED, { deviceIds: ids, groupId })
    } catch (error) {
      logger.error(
        `[DeviceManager] moveDevices failed: ids=${ids.join(',')}, groupId=${groupId}`,
        error
      )
      throw error
    }
  }
}
