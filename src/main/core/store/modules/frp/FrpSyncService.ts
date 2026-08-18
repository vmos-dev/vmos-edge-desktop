import { logger } from '../../../logger'
import { FrpHostDao } from '../../../dao/FrpHostDao'
import { FrpDeviceDao } from '../../../dao/FrpDeviceDao'
import { FrpMappingDao } from '../../../dao/FrpMappingDao'
import { FrpReconciler } from './FrpReconciler'
import { FrpcAdminClient } from './FrpcAdminClient'
import type { Device } from '@shared/ipc/data.types'
import type { FrpMapping } from '@shared/ipc/frp.types'
import { MACVLAN_PORTS } from '@shared/constant'

export class FrpSyncService {
  private hostDao: FrpHostDao
  private deviceDao: FrpDeviceDao
  private mappingDao: FrpMappingDao
  private reconciler: FrpReconciler

  constructor(
    hostDao: FrpHostDao,
    deviceDao: FrpDeviceDao,
    mappingDao: FrpMappingDao,
    client: FrpcAdminClient
  ) {
    this.hostDao = hostDao
    this.deviceDao = deviceDao
    this.mappingDao = mappingDao
    this.reconciler = new FrpReconciler(client, mappingDao)
  }

  getReconciler(): FrpReconciler {
    return this.reconciler
  }

  onDevicesSynced(hostIp: string, currentDevices: Device[], deletedDevices: Device[]): void {
    let changed = false

    // 处理删除的设备 → 清理映射 + frp_devices 记录
    for (const d of deletedDevices) {
      const deleted = this.mappingDao.deleteByDeviceId(d.id)
      if (deleted > 0) {
        logger.info(`[FrpSyncService] cleaned ${deleted} mappings for deleted device ${d.id}`)
        changed = true
      }
      this.deviceDao.delete(d.id)
    }

    if (!this.hostDao.isEnabled(hostIp)) {
      if (changed) {
        this.reconciler.schedule()
      }
      logger.debug(`[FrpSyncService] host ${hostIp} not enabled, skipping device sync`)
      return
    }

    // 处理现有设备端口变化 → 更新已有映射的 localPort / localIp
    for (const device of currentDevices) {
      if (!this.deviceDao.isEnabled(device.id)) continue

      const isMacvlan = device.network_mode === 'macvlan'
      const expectedIp = isMacvlan && device.ip ? device.ip : hostIp
      const mappings = this.mappingDao.getByDeviceId(device.id)
      for (const m of mappings) {
        const expectedPort = this.getDevicePort(device, m.port_type)
        const updates: Partial<FrpMapping> = {}
        if (expectedPort !== null && expectedPort !== m.local_port) {
          updates.local_port = expectedPort
        }
        if (expectedIp !== m.local_ip) {
          updates.local_ip = expectedIp
        }
        if (Object.keys(updates).length > 0) {
          logger.info(
            `[FrpSyncService] mapping drift: id=${m.id}, updates=${JSON.stringify(updates)}`
          )
          this.mappingDao.update(m.id, updates)
          changed = true
        }
      }
    }

    if (changed) {
      this.reconciler.schedule()
    }
  }

  private getDevicePort(device: Device, portType: string): number | null {
    if (device.network_mode === 'macvlan') {
      switch (portType) {
        case 'adb':
          return MACVLAN_PORTS.adb
        case 'video':
          return MACVLAN_PORTS.video
        case 'control':
          return MACVLAN_PORTS.control
        case 'audio':
          return MACVLAN_PORTS.audio
        default:
          return null
      }
    }
    switch (portType) {
      case 'adb':
        return device.adb ?? null
      case 'video':
        return device.tcp_port ?? null
      case 'control':
        return device.tcp_control_port ?? null
      case 'audio':
        return device.tcp_audio_port ?? null
      default:
        return null
    }
  }

  stop(): void {
    this.reconciler.cancel()
  }

  destroy(): void {
    this.reconciler.destroy()
  }
}
