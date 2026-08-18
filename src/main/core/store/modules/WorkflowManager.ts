import { BaseManager } from './BaseManager'
import { logger } from '../../logger'
import { WorkflowDao, type WorkflowRow } from '../../dao/WorkflowDao'
import { randomUUID } from 'node:crypto'
import type {
  Workflow,
  WorkflowListItem,
  CreateWorkflowPayload,
  UpdateWorkflowPayload
} from '@shared/ipc/workflow.types'

/**
 * 工作流 Manager
 *
 * 负责:
 * - 持久化到 SQLite(通过 WorkflowDao)
 * - JSON 字段的序列化 / 反序列化
 * - CRUD 错误包装(上层 IPC handler 只需关心业务错)
 *
 * 注意:工作流里的 inputText 步骤可能含账号密码,日志里只记 id/appId/统计,
 * 绝不记 steps 内容(参考 error-sensitive-data 规范)
 */
export class WorkflowManager extends BaseManager {
  private dao: WorkflowDao

  constructor() {
    super()
    this.dao = new WorkflowDao(this.dbInstance)
  }

  // ═══════════════ 列表 ═══════════════

  /**
   * 分页获取工作流列表(轻字段,不含 steps)
   */
  public list(offset = 0, limit = 50): WorkflowListItem[] {
    const startTime = Date.now()
    try {
      const rows = this.dao.listLight(offset, limit)
      const result: WorkflowListItem[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        appId: row.app_id,
        appName: row.app_name,
        appIcon: row.app_icon ?? undefined,
        appVersion: row.app_version ?? undefined,
        defaultDeviceId: row.default_device_id ?? undefined,
        stepCount: row.step_count ?? 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }))
      logger.debug(
        `[WorkflowManager] list success: count=${result.length}, duration=${Date.now() - startTime}ms`
      )
      return result
    } catch (error) {
      logger.error('[WorkflowManager] list failed:', error)
      throw error
    }
  }

  // ═══════════════ 单个读取 ═══════════════

  public getById(id: string): Workflow | null {
    try {
      const row = this.dao.getById(id)
      if (!row) return null
      return this.rowToWorkflow(row)
    } catch (error) {
      logger.error(`[WorkflowManager] getById failed: id=${id}`, error)
      throw error
    }
  }

  // ═══════════════ 创建 ═══════════════

  public create(payload: CreateWorkflowPayload): Workflow {
    const now = Date.now()
    const id = randomUUID()
    const workflow: Workflow = {
      id,
      name: payload.name,
      appId: payload.appId,
      appName: payload.appName,
      appIcon: payload.appIcon,
      appVersion: payload.appVersion,
      defaultDeviceId: payload.defaultDeviceId,
      steps: payload.steps ?? [],
      env: payload.env,
      tags: payload.tags,
      yamlText: payload.yamlText,
      createdAt: now,
      updatedAt: now
    }

    try {
      const row = this.workflowToRow(workflow)
      this.dao.insert(row)
      logger.info('[WorkflowManager] created', {
        id,
        appId: workflow.appId,
        stepsCount: workflow.steps.length
      })
      return workflow
    } catch (error) {
      logger.error('[WorkflowManager] create failed:', error)
      throw error
    }
  }

  // ═══════════════ 更新 ═══════════════

  public update(payload: UpdateWorkflowPayload): Workflow {
    const { id, patch } = payload
    const existing = this.getById(id)
    if (!existing) {
      throw new Error(`Workflow not found: id=${id}`)
    }

    const now = Date.now()
    const updated: Workflow = {
      ...existing,
      ...patch,
      id, // 防止被 patch 篡改
      createdAt: existing.createdAt, // 防止覆盖
      updatedAt: now
    }

    try {
      // 用显式 UPDATE(BaseDao.update),而非 INSERT OR REPLACE。
      // REPLACE 语义是 DELETE + INSERT,会掉触发器/级联;且这里是已存在行的更新场景。
      const row = this.workflowToRow(updated)
      const ok = this.dao.update(id, row)
      if (!ok) {
        // 极少数情况:行被并发删除
        throw new Error(`Workflow update made no changes: id=${id}`)
      }
      // 只记关键字段,不记 steps 内容(可能含凭据)
      logger.info('[WorkflowManager] updated', {
        id,
        stepsCount: updated.steps.length,
        updatedAt: now
      })
      return updated
    } catch (error) {
      logger.error(`[WorkflowManager] update failed: id=${id}`, error)
      throw error
    }
  }

  // ═══════════════ 删除 ═══════════════

  public delete(id: string): boolean {
    try {
      const deleted = this.dao.delete(id)
      if (deleted) {
        logger.info(`[WorkflowManager] deleted: id=${id}`)
      }
      return deleted
    } catch (error) {
      logger.error(`[WorkflowManager] delete failed: id=${id}`, error)
      throw error
    }
  }

  // ═══════════════ 序列化辅助 ═══════════════

  private rowToWorkflow(row: WorkflowRow): Workflow {
    return {
      id: row.id,
      name: row.name,
      appId: row.app_id,
      appName: row.app_name,
      appIcon: row.app_icon ?? undefined,
      appVersion: row.app_version ?? undefined,
      defaultDeviceId: row.default_device_id ?? undefined,
      steps: this.safeParseJson(row.steps_json, []),
      env: row.env_json ? this.safeParseJson(row.env_json, {}) : undefined,
      tags: row.tags_json ? this.safeParseJson(row.tags_json, []) : undefined,
      yamlText: row.yaml_text ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }

  private workflowToRow(w: Workflow): WorkflowRow {
    return {
      id: w.id,
      name: w.name,
      app_id: w.appId,
      app_name: w.appName,
      app_icon: w.appIcon ?? null,
      app_version: w.appVersion ?? null,
      default_device_id: w.defaultDeviceId ?? null,
      steps_json: JSON.stringify(w.steps),
      env_json: w.env ? JSON.stringify(w.env) : null,
      tags_json: w.tags ? JSON.stringify(w.tags) : null,
      yaml_text: w.yamlText ?? null,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt
    }
  }

  private safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      logger.warn('[WorkflowManager] safeParseJson failed, using fallback', {
        raw: raw.slice(0, 100)
      })
      return fallback
    }
  }
}
