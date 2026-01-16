import type { SQLiteDB } from '../db/SQLiteDB'
import { BaseDao } from './BaseDao'

/**
 * 配置项接口
 */
export interface Config {
  key: string
  value: string
}

/**
 * 配置字典 DAO
 * 用于存储和读取键值对配置
 */
export class ConfigDao extends BaseDao<Config> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'configs')
  }

  /**
   * 重写 exists 方法，使用 key 列而不是 id 列
   */
  public exists(key: string): boolean {
    const result = this.dbInstance.db
      .prepare(`SELECT 1 FROM ${this.tableName} WHERE key = ?`)
      .get(key)
    return !!result
  }

  /**
   * 重写 getById 方法，使用 key 列而不是 id 列
   */
  public getById(key: string): Config | undefined {
    const row = this.dbInstance.db.prepare(`SELECT * FROM ${this.tableName} WHERE key = ?`).get(key)
    return row ? this.deserialize(row) : undefined
  }

  /**
   * 重写 delete 方法，使用 key 列而不是 id 列
   */
  public delete(key: string): boolean {
    const info = this.dbInstance.db.prepare(`DELETE FROM ${this.tableName} WHERE key = ?`).run(key)
    return info.changes > 0
  }

  /**
   * 根据 key 获取配置值
   */
  public getValue(key: string): string | undefined {
    const config = this.getById(key)
    return config?.value
  }

  /**
   * 设置配置值（如果不存在则创建，存在则更新）
   */
  public setValue(key: string, value: string): void {
    this.insert({ key, value })
  }

  /**
   * 删除配置项
   */
  public deleteByKey(key: string): boolean {
    return this.delete(key)
  }

  /**
   * 检查配置项是否存在
   */
  public hasKey(key: string): boolean {
    return this.exists(key)
  }

  /**
   * 批量获取配置值
   */
  public getValues(keys: string[]): Record<string, string | undefined> {
    if (keys.length === 0) return {}

    const placeholders = keys.map(() => '?').join(',')
    const rows = this.dbInstance.db
      .prepare(`SELECT key, value FROM ${this.tableName} WHERE key IN (${placeholders})`)
      .all(...keys) as Config[]

    const result: Record<string, string | undefined> = {}
    keys.forEach((key) => {
      result[key] = undefined
    })
    rows.forEach((row) => {
      result[row.key] = row.value
    })

    return result
  }

  /**
   * 批量设置配置值
   */
  public setValues(configs: Record<string, string>): void {
    const entries = Object.entries(configs)
    if (entries.length === 0) return

    const stmt = this.dbInstance.db.prepare(
      `INSERT OR REPLACE INTO ${this.tableName} (key, value) VALUES (?, ?)`
    )

    const insertMany = this.dbInstance.db.transaction((configs: Array<[string, string]>) => {
      for (const [key, value] of configs) {
        stmt.run(key, value)
      }
    })

    insertMany(entries)
  }

  /**
   * 获取所有配置项
   */
  public getAllConfigs(): Record<string, string> {
    const rows = this.getAll()
    const result: Record<string, string> = {}
    rows.forEach((config) => {
      result[config.key] = config.value
    })
    return result
  }
}
