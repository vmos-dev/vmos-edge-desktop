import { BaseDao } from './BaseDao'
import type { SQLiteDB } from '../db/SQLiteDB'

export interface BatchTaskItemRow {
  id: string
  batch_task_id: string
  device_id: string
  device_name: string
  host_ip: string
  base_url: string
  env_json: string
  remote_task_id: string | null
  status: string
  progress_total: number
  progress_completed: number
  error: string | null
  duration_ms: number | null
  created_at: number
}

export class BatchTaskItemDao extends BaseDao<BatchTaskItemRow> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'batch_task_items')
  }

  findByBatchTaskId(batchTaskId: string): BatchTaskItemRow[] {
    return this.dbInstance.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE batch_task_id = ?`)
      .all(batchTaskId) as BatchTaskItemRow[]
  }

  findActiveByBatchTaskId(batchTaskId: string): BatchTaskItemRow[] {
    return this.dbInstance.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE batch_task_id = ? AND status IN ('PENDING', 'RUNNING')`
      )
      .all(batchTaskId) as BatchTaskItemRow[]
  }

  findOrphanedByBatchTaskId(batchTaskId: string): BatchTaskItemRow[] {
    return this.dbInstance.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE batch_task_id = ? AND status = 'PENDING' AND remote_task_id IS NULL`
      )
      .all(batchTaskId) as BatchTaskItemRow[]
  }

  findFailedByBatchTaskId(batchTaskId: string): BatchTaskItemRow[] {
    return this.dbInstance.db
      .prepare(
        `SELECT * FROM ${this.tableName} WHERE batch_task_id = ? AND status IN ('FAILED', 'SUBMIT_FAILED')`
      )
      .all(batchTaskId) as BatchTaskItemRow[]
  }

  summaryByBatchTaskId(batchTaskId: string): Array<{ status: string; cnt: number }> {
    return this.dbInstance.db
      .prepare(
        `SELECT status, COUNT(*) as cnt FROM ${this.tableName} WHERE batch_task_id = ? GROUP BY status`
      )
      .all(batchTaskId) as Array<{ status: string; cnt: number }>
  }

  deleteByBatchTaskId(batchTaskId: string): number {
    const info = this.dbInstance.db
      .prepare(`DELETE FROM ${this.tableName} WHERE batch_task_id = ?`)
      .run(batchTaskId)
    return info.changes
  }

  updateStatus(
    id: string,
    updates: Partial<
      Pick<
        BatchTaskItemRow,
        | 'status'
        | 'remote_task_id'
        | 'progress_total'
        | 'progress_completed'
        | 'error'
        | 'duration_ms'
      >
    >
  ): boolean {
    return this.update(id, updates as Partial<BatchTaskItemRow>)
  }
}
