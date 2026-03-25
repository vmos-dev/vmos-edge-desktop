import { BaseDao } from './BaseDao'
import type { SQLiteDB } from '../db/SQLiteDB'
import type { AutomationScriptRecord } from '@shared/ipc/automationScript.types'
import { logger } from '../logger'

export class AutomationScriptDao extends BaseDao<AutomationScriptRecord> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'automation_scripts')
  }

  /**
   * 按更新时间倒序获取所有脚本
   */
  public getAllOrderByUpdateTime(): AutomationScriptRecord[] {
    try {
      const rows = this.dbInstance.db
        .prepare(`SELECT * FROM ${this.tableName} ORDER BY updateTime DESC`)
        .all()
      return rows.map((row) => this.deserialize(row))
    } catch (error) {
      logger.error(`[AutomationScriptDao] getAllOrderByUpdateTime failed`, error)
      throw error
    }
  }
}
