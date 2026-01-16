import type { SQLiteDB } from '../db/SQLiteDB'
import { BaseDao } from './BaseDao'
import { Proxy } from '@shared/ipc/data.types'

/**
 * 代理数据接口
 */

/**
 * 代理 DAO
 * 提供代理的增删改查功能
 */
export class ProxyDao extends BaseDao<Proxy> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'proxies')
  }

  /**
   * 添加代理
   * @param proxy 代理数据
   */
  public addProxy(proxy: Proxy): void {
    this.insert(proxy)
  }

  /**
   * 更新代理
   * @param id 代理ID
   * @param updates 更新数据
   */
  public updateProxy(id: string, updates: Partial<any>): boolean {
    return this.update(id, updates)
  }

  /**
   * 删除代理
   * @param id 代理ID
   */
  public deleteProxy(id: string): boolean {
    return this.delete(id)
  }

  /**
   * 根据ID获取代理
   * @param id 代理ID
   */
  public getProxyById(id: string): Proxy | undefined {
    return this.getById(id)
  }

  /**
   * 获取所有代理
   */
  public getAllProxies(): Proxy[] {
    return this.getAll()
  }

  /**
   * 查询代理（根据名称或主机）
   * @param options 查询选项
   */
  public queryProxies(options: { name?: string; host?: string }): Proxy[] {
    try {
      let sql = 'SELECT * FROM proxies WHERE 1=1'
      const params: any[] = []

      if (options.name) {
        sql += ' AND name LIKE ?'
        params.push(`%${options.name}%`)
      }

      if (options.host) {
        sql += ' AND host LIKE ?'
        params.push(`%${options.host}%`)
      }

      sql += ' ORDER BY createTime DESC'

      const rows = this.dbInstance.db.prepare(sql).all(...params)
      return rows.map((row) => this.deserialize(row))
    } catch (error) {
      throw error
    }
  }
}
