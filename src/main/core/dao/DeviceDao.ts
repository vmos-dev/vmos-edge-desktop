import type { SQLiteDB } from '../db/SQLiteDB'
import type { Device } from '@shared/ipc/data.types'
import { BaseDao } from './BaseDao'

export class DeviceDao extends BaseDao<Device> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'devices')
  }

  /**
   * 反序列化：处理特殊字段（dns, is_macvlan, is_symlink）
   */
  protected deserialize(data: any): Device {
    // 处理 DNS JSON 字段
    if (data.dns && typeof data.dns === 'string') {
      try {
        data.dns = JSON.parse(data.dns)
      } catch (e) {
        data.dns = []
      }
    }

    // 将 SQLite 0/1 转换为布尔值
    if (typeof data.is_macvlan === 'number') {
      data.is_macvlan = !!data.is_macvlan
    }
    if (typeof data.is_symlink === 'number') {
      data.is_symlink = !!data.is_symlink
    }

    return data as Device
  }

  /**
   * 序列化：处理特殊字段
   * 注意：父类已经处理了基本类型转换，这里只处理设备特有的逻辑
   */
  protected serialize(data: Partial<Device>): Record<string, any> {
    // 先调用父类处理基本类型
    const serialized = super.serialize(data)

    // 特别注意：父类已经将数组转为 JSON，不需要再处理 dns
    // 布尔值父类也已经转为 0/1，这里的处理是防御性的（以防某些场景父类未处理）

    return serialized
  }

  /**
   * 根据主机 IP 查询设备
   */
  public getByHostIp(hostIp: string): Device[] {
    const rows = this.dbInstance.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE trim(host_ip) = trim(?)`)
      .all(hostIp)
    return rows.map((row) => this.deserialize(row))
  }

  /**
   * 根据主机 ID 查询设备
   */
  public getByHostId(hostId: string): Device[] {
    const rows = this.dbInstance.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE hostId = ?`)
      .all(hostId)
    return rows.map((row) => this.deserialize(row))
  }

  /**
   * 批量标记主机下的所有设备为离线
   */
  public markAllOfflineByHost(hostIp: string): void {
    this.dbInstance.db
      .prepare(`UPDATE ${this.tableName} SET state = 'offline' WHERE trim(host_ip) = trim(?)`)
      .run(hostIp)
  }

  /**
   * 标记不在列表中的设备为离线
   */
  public markOfflineNotInList(hostIp: string, activeIds: string[]): void {
    if (activeIds.length === 0) {
      this.markAllOfflineByHost(hostIp)
      return
    }

    const placeholders = activeIds.map(() => '?').join(',')
    this.dbInstance.db
      .prepare(
        `UPDATE ${this.tableName} SET state = 'offline' WHERE trim(host_ip) = trim(?) AND id NOT IN (${placeholders}) AND state != 'offline'`
      )
      .run(hostIp, ...activeIds)
  }

  /**
   * 删除主机下的所有设备
   */
  public deleteByHostIp(hostIp: string): void {
    this.dbInstance.db
      .prepare(`DELETE FROM ${this.tableName} WHERE trim(host_ip) = trim(?)`)
      .run(hostIp)
  }

  /**
   * 根据主机 ID 删除设备
   */
  public deleteByHostId(hostId: string): void {
    this.dbInstance.db.prepare(`DELETE FROM ${this.tableName} WHERE hostId = ?`).run(hostId)
  }

  public getByGroupId(groupId: string): Device[] {
    const rows = this.dbInstance.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE groupId = ?`)
      .all(groupId)
    return rows.map((row) => this.deserialize(row))
  }

  /**
   * 批量根据ID查询设备
   */
  public getByIds(ids: string[]): Device[] {
    if (ids.length === 0) return []
    const placeholders = ids.map(() => '?').join(',')
    const rows = this.dbInstance.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id IN (${placeholders})`)
      .all(...ids)
    return rows.map((row) => this.deserialize(row))
  }
}
