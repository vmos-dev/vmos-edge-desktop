import type { SQLiteDB } from '../db/SQLiteDB'
import { getTableColumns } from '../db/Schema'
import { logger } from '../logger'

/**
 * 基础 DAO 类
 * 提供统一的字段过滤、序列化、反序列化逻辑
 */
export abstract class BaseDao<T extends Record<string, any>> {
  protected validColumns: Set<string>

  constructor(
    protected dbInstance: SQLiteDB,
    protected tableName: string
  ) {
    this.validColumns = getTableColumns(tableName)
  }

  /**
   * 序列化数据（过滤非法字段 + 类型转换）
   */
  protected serialize(data: Partial<T>): Record<string, any> {
    const filtered: Record<string, any> = {}

    Object.keys(data).forEach((key) => {
      if (!this.validColumns.has(key)) {
        // 跳过不在 schema 中的字段
        return
      }

      const value = data[key]

      // 跳过 undefined
      if (value === undefined) return

      // 处理不同类型 - 顺序很重要！
      if (value === null) {
        filtered[key] = null
      } else if (typeof value === 'boolean') {
        // 布尔转 0/1（必须在 number 之前检查）
        filtered[key] = value ? 1 : 0
      } else if (typeof value === 'string') {
        filtered[key] = value
      } else if (typeof value === 'number') {
        // 检查是否是有效数字
        if (Number.isFinite(value)) {
          filtered[key] = value
        } else {
          filtered[key] = 0
        }
      } else if (typeof value === 'bigint') {
        filtered[key] = value
      } else if (Buffer.isBuffer(value)) {
        filtered[key] = value
      } else if (Array.isArray(value)) {
        // 数组转 JSON（必须在 typeof object 之前）
        try {
          filtered[key] = JSON.stringify(value)
        } catch (e) {
          filtered[key] = '[]'
        }
      } else if (typeof value === 'object') {
        // 对象转 JSON
        try {
          filtered[key] = JSON.stringify(value)
        } catch (e) {
          filtered[key] = '{}'
        }
      } else if (typeof value === 'function' || typeof value === 'symbol') {
        // 函数和 Symbol 跳过
        return
      } else {
        // 其他类型强制转字符串
        try {
          filtered[key] = String(value)
        } catch (e) {
          return
        }
      }
    })

    return filtered
  }

  /**
   * 反序列化数据（子类可以重写以处理特殊字段）
   */
  protected deserialize(data: any): T {
    return data as T
  }

  /**
   * 通用查询 - 根据 ID 获取
   */
  public getById(id: string | number): T | undefined {
    try {
      const row = this.dbInstance.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id)
      const result = row ? this.deserialize(row) : undefined
      return result
    } catch (error) {
      logger.error(`[BaseDao] getById failed: table=${this.tableName}, id=${id}`, error)
      throw error
    }
  }

  /**
   * 通用查询 - 获取所有
   */
  public getAll(): T[] {
    try {
      const rows = this.dbInstance.db.prepare(`SELECT * FROM ${this.tableName}`).all()
      const result = rows.map((row) => this.deserialize(row))
      return result
    } catch (error) {
      logger.error(`[BaseDao] getAll failed: table=${this.tableName}`, error)
      throw error
    }
  }

  /**
   * 通用插入（INSERT OR REPLACE）
   */
  public insert(data: T): void {
    const id = (data as any).id
    const serialized = this.serialize(data)
    const keys = Object.keys(serialized)

    if (keys.length === 0) {
      const error = new Error(`[BaseDao] No valid fields to insert for table ${this.tableName}`)
      logger.error(`[BaseDao] insert failed: table=${this.tableName}`, error)
      throw error
    }

    const columns = keys.join(', ')
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map((k) => serialized[k])

    try {
      this.dbInstance.db
        .prepare(`INSERT OR REPLACE INTO ${this.tableName} (${columns}) VALUES (${placeholders})`)
        .run(...values)
    } catch (error) {
      logger.error(`[BaseDao] insert failed: table=${this.tableName}, id=${id}`, {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        fields: keys
      })
      throw error
    }
  }

  /**
   * 通用更新
   */
  public update(id: string, updates: Partial<T>): boolean {
    const serialized = this.serialize(updates)
    delete serialized.id // 防止更新主键

    const fields = Object.keys(serialized)
    if (fields.length === 0) {
      logger.warn(`[BaseDao] update: no fields to update, table=${this.tableName}, id=${id}`)
      return false
    }

    try {
      const setClause = fields.map((key) => `${key} = @${key}`).join(', ')
      const stmt = this.dbInstance.db.prepare(
        `UPDATE ${this.tableName} SET ${setClause} WHERE id = @id`
      )

      const info = stmt.run({ ...serialized, id })
      const changed = info.changes > 0
      return changed
    } catch (error) {
      logger.error(`[BaseDao] update failed: table=${this.tableName}, id=${id}`, {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        updates: fields
      })
      throw error
    }
  }

  /**
   * 通用删除
   */
  public delete(id: string | number): boolean {
    try {
      const info = this.dbInstance.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id)
      const deleted = info.changes > 0
      return deleted
    } catch (error) {
      logger.error(`[BaseDao] delete failed: table=${this.tableName}, id=${id}`, error)
      throw error
    }
  }

  /**
   * 检查记录是否存在
   */
  public exists(id: string | number): boolean {
    try {
      const result = this.dbInstance.db
        .prepare(`SELECT 1 FROM ${this.tableName} WHERE id = ?`)
        .get(id)
      const exists = !!result
      return exists
    } catch (error) {
      logger.error(`[BaseDao] exists failed: table=${this.tableName}, id=${id}`, error)
      throw error
    }
  }

  /**
   * 统计记录数
   */
  public count(): number {
    try {
      const result = this.dbInstance.db
        .prepare(`SELECT count(*) as count FROM ${this.tableName}`)
        .get() as { count: number }
      return result.count
    } catch (error) {
      logger.error(`[BaseDao] count failed: table=${this.tableName}`, error)
      throw error
    }
  }
}
