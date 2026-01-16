import type { SQLiteDB } from '../db/SQLiteDB'
import { BaseDao } from './BaseDao'
import { Image } from '@shared/ipc/data.types'

/**
 * 镜像数据接口
 */

/**
 * 镜像 DAO
 * 提供镜像的添加和删除功能
 */
export class ImageDao extends BaseDao<Image> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'images')
  }

  /**
   * 添加镜像
   * @param image 镜像数据
   */
  public addImage(image: Image): void {
    this.insert(image)
  }

  /**
   * 删除镜像
   * @param id 镜像ID
   * @returns 是否删除成功
   */
  public deleteImage(id: string): boolean {
    return this.delete(id)
  }

  /**
   * 通用查询方法
   * @param options 查询选项
   * @param options.name 镜像名称（模糊查询，可选）
   * @param options.androidVersion Android版本（精确匹配，可选）
   * @returns 镜像列表
   */
  public query(options?: { name?: string; androidVersion?: string; version?: string }): Image[] {
    const conditions: string[] = []
    const params: any[] = []

    if (options?.name) {
      conditions.push('name LIKE ?')
      params.push(`%${options.name}%`)
    }

    if (options?.androidVersion) {
      conditions.push('androidVersion = ?')
      params.push(options.androidVersion)
    }

    if (options?.version) {
      conditions.push('version = ?')
      params.push(options.version)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `SELECT * FROM ${this.tableName} ${whereClause}`

    const rows = this.dbInstance.db.prepare(sql).all(...params)
    return rows.map((row) => this.deserialize(row))
  }

  /**
   * 批量删除镜像
   * @param ids 镜像ID列表
   * @returns 删除成功的数量
   */
  public deleteImages(ids: string[]): number {
    if (ids.length === 0) return 0

    const placeholders = ids.map(() => '?').join(',')
    const stmt = this.dbInstance.db.prepare(
      `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`
    )
    const info = stmt.run(...ids)
    return info.changes
  }
}
