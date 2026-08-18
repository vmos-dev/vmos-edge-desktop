import type { SQLiteDB } from '../db/SQLiteDB'
import type { Host } from '@shared/ipc/data.types'
import { BaseDao } from './BaseDao'

export class HostDao extends BaseDao<Host> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'hosts')
  }

  /**
   * 根据分组 ID 查询主机
   */
  public getByGroupId(groupId: string): Host[] {
    const rows = this.dbInstance.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE groupId = ?`)
      .all(groupId)
    return rows.map((row) => this.deserialize(row))
  }
  /** 根据ip 查询主机信息 */
  public getByIp(ip: string): Host | undefined {
    const row = this.dbInstance.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE trim(ip) = trim(?)`)
      .get(ip)
    return row ? this.deserialize(row) : undefined
  }
  /**
   * 更新主机状态
   */
  public updateStatus(id: string, status: string): boolean {
    return this.update(id, { status } as Partial<Host>)
  }

  /**
   * 将所有主机从一个分组移动到另一个分组
   */
  public moveAllToGroup(fromGroupId: string, toGroupId: string): void {
    this.dbInstance.db
      .prepare(`UPDATE ${this.tableName} SET groupId = ? WHERE groupId = ?`)
      .run(toGroupId, fromGroupId)
  }

  /** 查询所有主机和关联的分组信息 */
  public getAllWithGroup(): (Host & { groupName: string | null })[] {
    const rows = this.dbInstance.db
      .prepare(
        `SELECT ${this.tableName}.* , groups.name AS groupName FROM ${this.tableName} LEFT JOIN groups ON ${this.tableName}.groupId = groups.id`
      )
      .all()
    return rows.map((row) => this.deserialize(row) as Host & { groupName: string | null })
  }
  /**
   * 根据 IP 或 ID 模糊匹配 + 状态过滤
   * 并统计每台主机的设备数量
   */
  public searchHostsByIdentifierAndStatusWithDeviceCount(
    keyword: string,
    status: string,
    groupId: string
  ) {
    const conditions: string[] = []
    const params: any[] = []

    // Keyword 条件
    if (keyword && keyword.trim() !== '') {
      conditions.push('(h.ip LIKE ? OR h.id LIKE ?)')
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    // Status 条件
    if (status && status.trim() !== '') {
      conditions.push('h.status = ?')
      params.push(status)
    }

    // GroupId 条件
    if (groupId && groupId.trim() !== '') {
      conditions.push('h.groupId = ?')
      params.push(groupId)
    }

    // 如果都没有条件，就设置为 true
    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1'

    const sql = `
      SELECT
        h.*,
        g.name AS groupName,
        COUNT(d.id) AS deviceCount
      FROM hosts h
      LEFT JOIN devices d
        ON trim(h.ip) = trim(d.host_ip)
      LEFT JOIN groups g
        ON h.groupId = g.id
      WHERE ${whereClause}
      GROUP BY h.id
    `

    const rows = this.dbInstance.db.prepare(sql).all(...params)

    // 使用 JS 进行自然排序 (因为 SQLite 默认字符串排序 10 < 2)
    return rows
      .map((row) => this.deserialize(row))
      .sort((a, b) => {
        const ipA = a.ip || ''
        const ipB = b.ip || ''
        return ipA.localeCompare(ipB, undefined, { numeric: true, sensitivity: 'base' })
      })
  }
}
