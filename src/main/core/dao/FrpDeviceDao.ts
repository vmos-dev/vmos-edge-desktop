import type { SQLiteDB } from '../db/SQLiteDB'
import { BaseDao } from './BaseDao'
import type { FrpDevice } from '@shared/ipc/frp.types'

export class FrpDeviceDao extends BaseDao<FrpDevice> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'frp_devices')
  }

  public getByDeviceId(deviceId: string): FrpDevice | undefined {
    return this.getById(deviceId)
  }

  public getByHostIp(hostIp: string): FrpDevice[] {
    const rows = this.dbInstance.db
      .prepare('SELECT * FROM frp_devices WHERE host_ip = ?')
      .all(hostIp)
    return rows.map((row) => this.deserialize(row))
  }

  public getEnabledByHostIp(hostIp: string): FrpDevice[] {
    const rows = this.dbInstance.db
      .prepare('SELECT * FROM frp_devices WHERE host_ip = ? AND enabled = 1')
      .all(hostIp)
    return rows.map((row) => this.deserialize(row))
  }

  public getAllEnabled(): FrpDevice[] {
    const rows = this.dbInstance.db.prepare('SELECT * FROM frp_devices WHERE enabled = 1').all()
    return rows.map((row) => this.deserialize(row))
  }

  public setEnabled(deviceId: string, hostIp: string, enabled: boolean): void {
    const existing = this.getById(deviceId)
    if (existing) {
      this.update(deviceId, { enabled: enabled ? 1 : 0 } as Partial<FrpDevice>)
    } else {
      this.insert({ id: deviceId, host_ip: hostIp, enabled: enabled ? 1 : 0 } as FrpDevice)
    }
  }

  public isEnabled(deviceId: string): boolean {
    const device = this.getById(deviceId)
    return device?.enabled === 1
  }

  public deleteByHostIp(hostIp: string): number {
    const info = this.dbInstance.db.prepare('DELETE FROM frp_devices WHERE host_ip = ?').run(hostIp)
    return info.changes
  }
}
