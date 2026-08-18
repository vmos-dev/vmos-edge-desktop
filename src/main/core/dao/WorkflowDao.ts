import { BaseDao } from './BaseDao'
import type { SQLiteDB } from '../db/SQLiteDB'
import { logger } from '../logger'

/**
 * 存储到 DB 的行格式
 * 与 Schema.ts 里 WORKFLOWS_SCHEMA 一一对应
 */
export interface WorkflowRow {
  id: string
  name: string
  app_id: string
  app_name: string
  app_icon?: string | null
  app_version?: string | null
  default_device_id?: string | null
  /** JSON 序列化的 Step[] */
  steps_json: string
  /** JSON 序列化的 env */
  env_json?: string | null
  /** JSON 序列化的 tags */
  tags_json?: string | null
  /** 用户原始 YAML 文本(字节级);null = 老数据走兼容重建 */
  yaml_text?: string | null
  createdAt: number
  updatedAt: number
}

/**
 * 工作流 DAO
 *
 * 按 BaseDao 模式提供基础 CRUD,额外提供:
 * - 分页列表(只返回轻字段,不含 steps_json)
 */
export class WorkflowDao extends BaseDao<WorkflowRow> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'workflows')
  }

  /**
   * 分页获取列表(轻字段,不加载 steps_json 全量)
   * step_count 通过 json_array_length 聚合得到,避免回 JS 端解析
   */
  public listLight(
    offset = 0,
    limit = 50
  ): Array<Omit<WorkflowRow, 'steps_json' | 'env_json' | 'tags_json'> & { step_count: number }> {
    try {
      const rows = this.dbInstance.db
        .prepare(
          `SELECT id, name, app_id, app_name, app_icon, app_version, default_device_id,
                  COALESCE(json_array_length(steps_json), 0) AS step_count,
                  createdAt, updatedAt
           FROM ${this.tableName}
           ORDER BY updatedAt DESC
           LIMIT ? OFFSET ?`
        )
        .all(limit, offset)
      return rows as Array<
        Omit<WorkflowRow, 'steps_json' | 'env_json' | 'tags_json'> & { step_count: number }
      >
    } catch (error) {
      logger.error('[WorkflowDao] listLight failed:', error)
      throw error
    }
  }

  /**
   * 统计按 appId 的工作流数量(可选功能,用于"最近用过"聚合)
   */
  public countByAppId(appId: string): number {
    try {
      const row = this.dbInstance.db
        .prepare(`SELECT count(*) as c FROM ${this.tableName} WHERE app_id = ?`)
        .get(appId) as { c: number }
      return row.c
    } catch (error) {
      logger.error('[WorkflowDao] countByAppId failed:', error)
      throw error
    }
  }
}
