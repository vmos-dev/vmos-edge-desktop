import { BaseDao } from './BaseDao'
import type { SQLiteDB } from '../db/SQLiteDB'

export interface BatchTaskRow {
  id: string
  name: string
  workflow_id: string
  workflow_name: string
  app_id: string
  app_name: string
  yaml_text: string
  total_devices: number
  status: string
  created_at: number
  completed_at: number | null
}

export class BatchTaskDao extends BaseDao<BatchTaskRow> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'batch_tasks')
  }

  listRecent(offset = 0, limit = 50, status?: string): BatchTaskRow[] {
    let sql = `SELECT * FROM ${this.tableName}`
    const params: unknown[] = []
    if (status) {
      sql += ' WHERE status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)
    return this.dbInstance.db.prepare(sql).all(...params) as BatchTaskRow[]
  }

  countByStatus(): Record<string, number> {
    const rows = this.dbInstance.db
      .prepare(`SELECT status, COUNT(*) as cnt FROM ${this.tableName} GROUP BY status`)
      .all() as Array<{ status: string; cnt: number }>
    return Object.fromEntries(rows.map((r) => [r.status, r.cnt]))
  }

  countAll(status?: string): number {
    if (status) {
      const row = this.dbInstance.db
        .prepare(`SELECT COUNT(*) as cnt FROM ${this.tableName} WHERE status = ?`)
        .get(status) as { cnt: number }
      return row.cnt
    }
    return this.count()
  }

  findRunning(): BatchTaskRow[] {
    return this.dbInstance.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE status = 'RUNNING'`)
      .all() as BatchTaskRow[]
  }
}
