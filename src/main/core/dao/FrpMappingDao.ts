import type { SQLiteDB } from '../db/SQLiteDB'
import { BaseDao } from './BaseDao'
import type { FrpMapping } from '@shared/ipc/frp.types'

export class FrpMappingDao extends BaseDao<FrpMapping> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'frp_mappings')
  }

  public getByHostIp(hostIp: string): FrpMapping[] {
    const rows = this.dbInstance.db
      .prepare('SELECT * FROM frp_mappings WHERE host_ip = ?')
      .all(hostIp)
    return rows.map((row) => this.deserialize(row))
  }

  public getByDeviceId(deviceId: string): FrpMapping[] {
    const rows = this.dbInstance.db
      .prepare('SELECT * FROM frp_mappings WHERE device_id = ?')
      .all(deviceId)
    return rows.map((row) => this.deserialize(row))
  }

  public deleteByDeviceId(deviceId: string): number {
    const info = this.dbInstance.db
      .prepare('DELETE FROM frp_mappings WHERE device_id = ?')
      .run(deviceId)
    return info.changes
  }

  public deleteByHostIp(hostIp: string): number {
    const info = this.dbInstance.db
      .prepare('DELETE FROM frp_mappings WHERE host_ip = ?')
      .run(hostIp)
    return info.changes
  }

  public findOrphans(existingDeviceIds: Set<string>): FrpMapping[] {
    const all = this.getAll()
    return all.filter((m) => m.device_id !== 'host' && !existingDeviceIds.has(m.device_id))
  }

  public updateRemotePort(proxyName: string, remotePort: number): void {
    this.update(proxyName, { remote_port: remotePort } as Partial<FrpMapping>)
  }

  public updateStatus(proxyName: string, status: FrpMapping['status']): void {
    this.update(proxyName, { status } as Partial<FrpMapping>)
  }

  public batchInsert(mappings: FrpMapping[]): void {
    this.dbInstance.transaction(() => {
      for (const m of mappings) {
        this.insert(m)
      }
    })
  }

  public batchDelete(proxyNames: string[]): void {
    this.dbInstance.transaction(() => {
      for (const name of proxyNames) {
        this.delete(name)
      }
    })
  }
}
