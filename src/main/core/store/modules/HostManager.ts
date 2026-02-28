import { Device, Host } from '@shared/ipc/data.types'
import { HostDao } from '../../dao/HostDao'
import { BaseManager } from './BaseManager'
import { DeviceManager } from './DeviceManager'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'
import { request } from '@shared/api/request'
import { shell } from 'electron'
import { logger } from '../../logger'

export class HostManager extends BaseManager {
  private hostDao: HostDao
  private deviceManager: DeviceManager

  constructor(deviceManager: DeviceManager) {
    super()
    this.hostDao = new HostDao(this.dbInstance)
    this.deviceManager = deviceManager
  }

  public getHosts(): Host[] {
    const startTime = Date.now()
    logger.debug('[HostManager] getHosts called')
    try {
      const hosts = this.hostDao.getAll()
      const duration = Date.now() - startTime
      logger.debug(`[HostManager] getHosts success: count=${hosts.length}, duration=${duration}ms`)
      return hosts
    } catch (error) {
      logger.error('[HostManager] getHosts failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  public getHostsWithGroup(): (Host & { groupName: string | null })[] {
    const startTime = Date.now()
    logger.debug('[HostManager] getHostsWithGroup called')
    try {
      const hosts = this.hostDao.getAllWithGroup()
      const duration = Date.now() - startTime
      logger.debug(
        `[HostManager] getHostsWithGroup success: count=${hosts.length}, duration=${duration}ms`
      )
      return hosts
    } catch (error) {
      logger.error('[HostManager] getHostsWithGroup failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  public updateHost(id: string, updates: Partial<Host>) {
    const startTime = Date.now()
    logger.info(`[HostManager] updateHost called: id=${id}`, updates)
    try {
      const updated = this.hostDao.update(id, updates)
      const duration = Date.now() - startTime
      if (!updated) {
        logger.warn(`[HostManager] updateHost no changes: id=${id}, duration=${duration}ms`)
        throw new Error(`Host not found or no changes: id=${id}`)
      }
      logger.info(`[HostManager] updateHost success: id=${id}, duration=${duration}ms`)
      this.notifyFrontend(DATA_EVENTS.HOST_UPDATED, { id, ...updates })
    } catch (error) {
      logger.error('[HostManager] updateHost failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id,
        updates
      })
      throw error
    }
  }

  public moveHosts(hostIds: string[], groupId: string) {
    const startTime = Date.now()
    logger.info(
      `[HostManager] moveHosts called: hostIds=${hostIds.join(',')}, count=${hostIds.length}, groupId=${groupId}`
    )
    try {
      this.dbInstance.transaction(() => {
        hostIds.forEach((id) => {
          this.hostDao.update(id, { groupId })
        })
      })
      const duration = Date.now() - startTime
      logger.info(
        `[HostManager] moveHosts success: count=${hostIds.length}, groupId=${groupId}, duration=${duration}ms`
      )
      this.notifyFrontend(DATA_EVENTS.HOSTS_MOVED, { hostIds, groupId })
    } catch (error) {
      logger.error('[HostManager] moveHosts failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        hostIds,
        groupId
      })
      throw error
    }
  }

  public async handleHostDiscovery(ip: string, hostId: string, hostName: string) {
    const startTime = Date.now()
    logger.info(
      `[HostManager] handleHostDiscovery called: ip=${ip}, hostId=${hostId}, hostName=${hostName}`
    )
    try {
      let isNew = false
      this.dbInstance.transaction(() => {
        const existing = this.hostDao.getById(hostId)

        if (!existing) {
          isNew = true
          const newHost: Host = {
            id: hostId,
            groupId: 'default',
            name: hostName,
            ip,
            status: 'online',
            lastActiveTime: Date.now()
          }
          logger.info(`[HostManager] handleHostDiscovery: creating new host id=${hostId}, ip=${ip}`)
          this.hostDao.insert(newHost)
        } else {
          logger.debug(
            `[HostManager] handleHostDiscovery: updating existing host id=${hostId}, ip=${ip}`
          )
          const updates: Partial<Host> = {
            ip,
            status: 'online',
            lastActiveTime: Date.now()
          }
          if (hostName) updates.name = hostName
          this.hostDao.update(hostId, updates)
        }
      })

      const duration = Date.now() - startTime
      if (isNew) {
        // 获取完整对象以确保数据的完整性
        const host = this.hostDao.getById(hostId)
        if (host) {
          logger.info(
            `[HostManager] handleHostDiscovery success: new host created id=${hostId}, ip=${ip}, duration=${duration}ms`
          )
          this.notifyFrontend(DATA_EVENTS.HOST_ADDED, host)
        }
      } else {
        logger.info(
          `[HostManager] handleHostDiscovery success: host updated id=${hostId}, ip=${ip}, duration=${duration}ms`
        )
        this.notifyFrontend(DATA_EVENTS.HOST_UPDATED, {
          id: hostId,
          ip,
          status: 'online',
          name: hostName
        })
      }
    } catch (error) {
      logger.error('[HostManager] handleHostDiscovery failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        ip,
        hostId,
        hostName
      })
      throw error
    }
  }

  public markHostOffline(hostId: string) {
    const startTime = Date.now()
    logger.info(`[HostManager] markHostOffline called: hostId=${hostId}`)
    try {
      let success = false
      this.dbInstance.transaction(() => {
        const host = this.hostDao.getById(hostId)
        if (this.hostDao.updateStatus(hostId, 'offline')) {
          if (host && host.ip) {
            logger.debug(
              `[HostManager] markHostOffline: marking devices offline for host ip=${host.ip}`
            )
            this.deviceManager.markAllOfflineByHost(host.ip)
          }
          success = true
        }
      })

      const duration = Date.now() - startTime
      if (success) {
        logger.info(
          `[HostManager] markHostOffline success: hostId=${hostId}, duration=${duration}ms`
        )
        this.notifyFrontend(DATA_EVENTS.HOST_UPDATED, { id: hostId, status: 'offline' })
      } else {
        logger.warn(
          `[HostManager] markHostOffline no changes: hostId=${hostId}, duration=${duration}ms`
        )
        throw new Error(`Host not found or no changes: hostId=${hostId}`)
      }
    } catch (error) {
      logger.error('[HostManager] markHostOffline failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        hostId
      })
      throw error
    }
  }

  public deleteHost(host: Host) {
    try {
      logger.info(`[HostManager] deleteHost called:`, host)
      if (!host.id || !host.ip) {
        logger.warn(`[HostManager] deleteHost: invalid host, id=${host.id}, ip=${host.ip}`)
        throw new Error('Host ID or IP cannot be empty')
      }
      // 删除该主机下的设备（deleteByHostIp 内部会通知前端）
      this.dbInstance.transaction(() => {
        logger.debug(
          `[HostManager] deleteHost: deleting devices for host ip=${host.ip}, id=${host.id}`
        )
        this.deviceManager.deleteByHostIp(host.ip, host.id)
        logger.info(
          `[HostManager] deleteHost: devices deleted for host ip=${host.ip}, id=${host.id}`
        )
        this.hostDao.delete(host.id)
        logger.info(`[HostManager] deleteHost: host deleted id=${host.id}`)
      })
      logger.info(`[HostManager] deleteHost success: id=${host.id}, ip=${host.ip}`)
      this.notifyFrontend(DATA_EVENTS.HOST_DELETED, host)
    } catch (error) {
      logger.error('[HostManager] deleteHost failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id: host.id,
        ip: host.ip
      })
      throw error
    }
  }

  public getHostsByGroupId(groupId: string): Host[] {
    const startTime = Date.now()
    logger.debug(`[HostManager] getHostsByGroupId called: groupId=${groupId}`)
    try {
      const hosts = this.hostDao.getAll().filter((h) => h.groupId === groupId)
      const duration = Date.now() - startTime
      logger.debug(
        `[HostManager] getHostsByGroupId success: groupId=${groupId}, count=${hosts.length}, duration=${duration}ms`
      )
      return hosts
    } catch (error) {
      logger.error('[HostManager] getHostsByGroupId failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        groupId
      })
      throw error
    }
  }

  public async openApiDetail(device: Device) {
    const url = `http://${device.host_ip}:${API_CONFIG.DEFAULT_PORT}/docs`
    logger.info(`[HostManager] openApiDetail called:`, { device, url })
    try {
      await shell.openExternal(url)
      logger.info(`[HostManager] openApiDetail success: deviceId=${device.id}`)
    } catch (error) {
      logger.error('[HostManager] openApiDetail failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        deviceId: device.id,
        hostIp: device.host_ip,
        url
      })
      throw error
    }
  }

  public addHosts(hosts: { ip: string; id: string; groupId: string; name?: string }[]) {
    const startTime = Date.now()
    logger.info(`[HostManager] addHosts called:`, hosts)
    try {
      const addedHosts: Host[] = []
      const updatedHosts: Host[] = []
      this.dbInstance.transaction(() => {
        // 先获取所有主机，避免在循环中多次查询
        const allHosts = this.hostDao.getAll()
        const existingIps = new Set(allHosts.map((h) => h.ip))
        // 创建 ID 映射，用于快速查找
        const existingIds = new Map(allHosts.map((h) => [h.id, h]))

        for (const host of hosts) {
          // 优先检查 ID 是否存在，存在则更新
          if (existingIds.has(host.id)) {
            const existingHost = existingIds.get(host.id)!
            logger.info(`[HostManager] addHosts: updating existing host id=${host.id}`)

            const updates: Partial<Host> = {
              ip: host.ip,
              groupId: host.groupId,
              name: host.name || host.ip,
              status: 'online',
              lastActiveTime: Date.now()
            }
            this.hostDao.update(host.id, updates)
            updatedHosts.push({ ...existingHost, ...updates })
            continue
          }

          // 检查具有此 IP 的主机是否已存在 (如果 ID 不同但 IP 相同，则跳过以避免 IP 冲突)
          if (existingIps.has(host.ip)) {
            logger.debug(`[HostManager] addHosts: skipping existing host ip=${host.ip}`)
            continue
          }

          const newHost: Host = {
            id: host.id,
            groupId: host.groupId,
            name: host.name || host.ip,
            ip: host.ip,
            status: 'online',
            lastActiveTime: Date.now()
          }
          logger.debug(`[HostManager] addHosts: adding new host id=${newHost.id}, ip=${newHost.ip}`)
          this.hostDao.insert(newHost)
          addedHosts.push(newHost)
          // 添加到 Set 中，防止本次批量添加中有重复 IP
          existingIps.add(host.ip)
        }
      })

      const duration = Date.now() - startTime
      logger.info(
        `[HostManager] addHosts success: added=${addedHosts.length}, updated=${updatedHosts.length}, skipped=${
          hosts.length - addedHosts.length - updatedHosts.length
        }, duration=${duration}ms`
      )

      // 为每个添加的主机通知前端
      addedHosts.forEach((host) => {
        this.notifyFrontend(DATA_EVENTS.HOST_ADDED, host)
      })

      // 为每个更新的主机通知前端
      updatedHosts.forEach((host) => {
        this.notifyFrontend(DATA_EVENTS.HOST_UPDATED, host)
      })

      return [...addedHosts, ...updatedHosts]
    } catch (error) {
      logger.error('[HostManager] addHosts failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: hosts.length,
        hosts: hosts.map((h) => ({ ip: h.ip, groupId: h.groupId }))
      })
      throw error
    }
  }
  /**
   * 根据 IP 或 ID 模糊匹配 + 状态过滤
   * 并统计每台主机的设备数量
   */
  public searchHostsByIdentifierAndStatusWithDeviceCount(keyword: string, status: string): Host[] {
    const startTime = Date.now()
    logger.debug(
      `[HostManager] searchHostsByIdentifierAndStatusWithDeviceCount called: keyword=${keyword}, status=${status}`
    )
    try {
      const hosts = this.hostDao.searchHostsByIdentifierAndStatusWithDeviceCount(keyword, status)
      const duration = Date.now() - startTime
      logger.debug(
        `[HostManager] searchHostsByIdentifierAndStatusWithDeviceCount success: count=${hosts.length}, duration=${duration}ms`
      )
      return hosts
    } catch (error) {
      logger.error('[HostManager] searchHostsByIdentifierAndStatusWithDeviceCount failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        keyword,
        status
      })
      throw error
    }
  }

  public async restartHost(host: Host) {
    const startTime = Date.now()
    logger.info(`[HostManager] restartHost called:`, host)
    try {
      // 2. 调用 API
      await request.get(buildApiUrl(host.ip, API_CONFIG.PATHS.RESTART_HOST))

      // 1. 更新本地状态（乐观更新）
      this.dbInstance.transaction(() => {
        // 标记主机离线
        this.hostDao.updateStatus(host.id, 'offline')
        // 标记设备离线
        if (host.ip) {
          this.deviceManager.markAllOfflineByHost(host.ip)
        }
      })
      this.notifyFrontend(DATA_EVENTS.HOST_UPDATED, { id: host.id, status: 'offline' })

      const duration = Date.now() - startTime
      logger.info(`[HostManager] restartHost success: id=${host.id}, duration=${duration}ms`)
    } catch (error) {
      logger.error('[HostManager] restartHost failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id: host.id,
        ip: host.ip
      })
      throw error
    }
  }

  public async resetHost(host: Host) {
    const startTime = Date.now()
    logger.info(`[HostManager] resetHost called:`, host)
    try {
      // 1. 调用 API
      await request.get(
        buildApiUrl(host.ip, API_CONFIG.PATHS.RESET_HOST),
        {},
        {
          timeout: 60 * 1000
        }
      )

      // 2. 更新本地状态
      this.dbInstance.transaction(() => {
        if (host.ip) {
          // 删除设备（deleteByHostIp 内部会通知前端）
          this.deviceManager.deleteByHostIp(host.ip, host.id)
        }
        // 标记主机离线
        this.hostDao.updateStatus(host.id, 'offline')
      })

      const duration = Date.now() - startTime
      logger.info(`[HostManager] resetHost success: id=${host.id}, duration=${duration}ms`)

      // 3. 通知前端
      this.notifyFrontend(DATA_EVENTS.HOST_UPDATED, { id: host.id, status: 'offline' })

      //
    } catch (error) {
      logger.error('[HostManager] resetHost failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id: host.id,
        ip: host.ip
      })
      throw error
    }
  }

  public async cleanHostImage(host: Host) {
    const startTime = Date.now()
    logger.info(`[HostManager] cleanHostImage called:`, host)
    try {
      // 1. 仅调用 API
      await request.get(buildApiUrl(host.ip, API_CONFIG.PATHS.CLEAN_IMAGE))

      const duration = Date.now() - startTime
      logger.info(`[HostManager] cleanHostImage success: id=${host.id}, duration=${duration}ms`)
    } catch (error) {
      logger.error('[HostManager] cleanHostImage failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id: host.id,
        ip: host.ip
      })
      throw error
    }
  }

  public getHostByIp(ip: string): Host | undefined {
    try {
      logger.info(`[HostManager] getHostByIp called: ip=${ip}`)
      const host = this.hostDao.getByIp(ip)
      if (!host) {
        logger.warn(`[HostManager] getHostByIp: host not found, ip=${ip}`)
        return undefined
      }
      logger.info(`[HostManager] getHostByIp success: ip=${ip}, host=${host.id}`)
      return host
    } catch (error) {
      logger.error('[HostManager] getHostByIp failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        ip
      })
      throw error
    }
  }

  /**
   * 根据 ID 获取主机信息
   */
  public getHostById(id: string): Host | undefined {
    try {
      return this.hostDao.getById(id)
    } catch (error) {
      logger.error('[HostManager] getHostById failed:', {
        error,
        id
      })
      return undefined
    }
  }
}
