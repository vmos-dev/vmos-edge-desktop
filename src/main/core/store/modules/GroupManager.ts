import { v4 as uuidv4 } from 'uuid'
import { Group } from '@shared/ipc/data.types'
import { GroupDao } from '../../dao/GroupDao'
import { BaseManager } from './BaseManager'
import { HostManager } from './HostManager'
import { DeviceManager } from './DeviceManager'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import { logger } from '../../logger'

export class GroupManager extends BaseManager {
  private groupDao: GroupDao
  private hostManager: HostManager
  private deviceManager: DeviceManager

  constructor(hostManager: HostManager, deviceManager: DeviceManager) {
    super()
    this.groupDao = new GroupDao(this.dbInstance)
    this.hostManager = hostManager
    this.deviceManager = deviceManager
  }

  public getGroups(): Group[] {
    const startTime = Date.now()
    logger.debug('[GroupManager] getGroups called')
    try {
      const groups = this.groupDao.getAll()
      const duration = Date.now() - startTime
      logger.debug(
        `[GroupManager] getGroups success: count=${groups.length}, duration=${duration}ms`
      )
      return groups
    } catch (error) {
      logger.error('[GroupManager] getGroups failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  public addGroup(name: string, type: 'host' | 'device' = 'host'): Group {
    const startTime = Date.now()
    logger.info(`[GroupManager] addGroup called: name=${name}, type=${type}`)
    const newGroup: Group = {
      id: uuidv4(),
      name,
      type,
      sortIndex: 0,
      createTime: Date.now()
    }

    try {
      this.dbInstance.transaction(() => {
        newGroup.sortIndex = this.groupDao.count()
        this.groupDao.insert(newGroup)
      })

      const duration = Date.now() - startTime
      logger.info(
        `[GroupManager] addGroup success: id=${newGroup.id}, name=${newGroup.name}, sortIndex=${newGroup.sortIndex}, duration=${duration}ms`
      )
      this.notifyFrontend(DATA_EVENTS.GROUP_ADDED, newGroup)
      return newGroup
    } catch (error) {
      logger.error('[GroupManager] addGroup failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        name
      })
      throw error
    }
  }

  public updateGroup(params: Partial<Group>) {
    const startTime = Date.now()
    const { id, ...rest } = params
    logger.info(`[GroupManager] updateGroup called: id=${id}`, rest)
    try {
      const updated = this.groupDao.update(id as string, rest)
      const duration = Date.now() - startTime
      if (!updated) {
        logger.warn(`[GroupManager] updateGroup no changes: id=${id}, duration=${duration}ms`)
        throw new Error(`Group not found or no changes: id=${id}`)
      }
      logger.info(`[GroupManager] updateGroup success: id=${id}, duration=${duration}ms`)
      this.notifyFrontend(DATA_EVENTS.GROUP_UPDATED, { id, ...rest })
    } catch (error) {
      logger.error('[GroupManager] updateGroup failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id,
        updates: rest
      })
      throw error
    }
  }

  public deleteGroup(id: string) {
    const startTime = Date.now()
    logger.info(`[GroupManager] deleteGroup called: id=${id}`)
    if (id === 'default' || id === 'device_default') {
      logger.warn('[GroupManager] deleteGroup rejected: cannot delete default group')
      throw new Error('默认分组不能删除')
    }

    try {
      this.dbInstance.transaction(() => {
        // 1. 处理主机：移动到默认主机分组
        const hosts = this.hostManager.getHostsByGroupId(id)
        if (hosts.length > 0) {
          logger.info(`[GroupManager] deleteGroup: moving ${hosts.length} hosts to default group`)
          const hostIds = hosts.map((host) => host.id)
          this.hostManager.moveHosts(hostIds, 'default')
        }

        // 2. 处理设备：移动到默认设备分组
        // 注意：getDevicesByGroupId 应该只返回直接归属于该分组的设备（device.groupId = id）
        // 而不是通过 Host 归属的。
        const devices = this.deviceManager.getDevicesByGroupId(id)
        if (devices.length > 0) {
          logger.info(
            `[GroupManager] deleteGroup: moving ${devices.length} devices to device_default group`
          )
          const deviceIds = devices.map((d) => d.id)
          this.deviceManager.moveDevices(deviceIds, 'device_default')
        }

        this.groupDao.delete(id)
      })

      const duration = Date.now() - startTime
      logger.info(`[GroupManager] deleteGroup success: id=${id}, duration=${duration}ms`)
      this.notifyFrontend(DATA_EVENTS.GROUP_DELETED, { id })
    } catch (error) {
      logger.error('[GroupManager] deleteGroup failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id
      })
      throw error
    }
  }
}
