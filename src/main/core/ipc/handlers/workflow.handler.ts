/**
 * 工作流相关的 IPC 处理器
 *
 * 遵循 error-middleware / error-sensitive-data 规范:
 * - 所有 handler 用 try/catch 包裹
 * - 返回统一 { success, data?, error? } 结构
 * - 日志不记 steps 内容(可能含账号密码)
 */
import { handle } from '../IpcBus'
import {
  WORKFLOW_EVENTS,
  type Workflow,
  type WorkflowListItem,
  type CreateWorkflowPayload,
  type UpdateWorkflowPayload,
  type DeleteWorkflowPayload,
  type ListWorkflowsPayload
} from '@shared/ipc/workflow.types'
import { logger } from '../../logger'
import { workflowManager } from '../../store/managers'

// ═══════════════ 错误包装 ═══════════════

function handleError(error: unknown): { success: false; error: string } {
  const errorMsg =
    error instanceof Error ? error.message : ((error as { msg?: string })?.msg ?? String(error))
  return { success: false, error: errorMsg }
}

// ═══════════════ 轻量 payload 校验 ═══════════════
// 没引入 zod,用简单的运行时校验做基本保护
// 未来如需更严格校验可接入 zod(已在规范里列出)

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function validateCreatePayload(p: unknown): p is CreateWorkflowPayload {
  if (!p || typeof p !== 'object') return false
  const payload = p as Record<string, unknown>
  return (
    isNonEmptyString(payload.name) &&
    isNonEmptyString(payload.appId) &&
    isNonEmptyString(payload.appName)
  )
}

function validateUpdatePayload(p: unknown): p is UpdateWorkflowPayload {
  if (!p || typeof p !== 'object') return false
  const payload = p as Record<string, unknown>
  return (
    isNonEmptyString(payload.id) && payload.patch !== undefined && typeof payload.patch === 'object'
  )
}

// ═══════════════ 注册 ═══════════════

export function registerWorkflowHandlers(): void {
  // 列表(分页)
  handle<ListWorkflowsPayload | undefined, WorkflowListItem[]>(
    WORKFLOW_EVENTS.LIST,
    async (payload) => {
      try {
        const offset = payload?.offset ?? 0
        const limit = Math.min(payload?.limit ?? 50, 200) // 限制最大 200 防滥用
        const list = workflowManager.list(offset, limit)
        return { success: true, data: list }
      } catch (error) {
        logger.error('[WorkflowHandler] LIST failed:', error)
        return handleError(error)
      }
    }
  )

  // 按 id 获取完整工作流
  handle<string, Workflow | null>(WORKFLOW_EVENTS.GET, async (id) => {
    try {
      if (!isNonEmptyString(id)) {
        return { success: false, error: 'BAD_REQUEST:id 不合法' }
      }
      const workflow = workflowManager.getById(id)
      return { success: true, data: workflow }
    } catch (error) {
      logger.error(`[WorkflowHandler] GET failed: id=${id}`, error)
      return handleError(error)
    }
  })

  // 创建
  handle<CreateWorkflowPayload, Workflow>(WORKFLOW_EVENTS.CREATE, async (payload) => {
    try {
      if (!validateCreatePayload(payload)) {
        logger.warn('[WorkflowHandler] CREATE invalid payload')
        return { success: false, error: 'BAD_REQUEST:name/appId/appName 必填' }
      }
      const workflow = workflowManager.create(payload)
      return { success: true, data: workflow }
    } catch (error) {
      logger.error('[WorkflowHandler] CREATE failed:', error)
      return handleError(error)
    }
  })

  // 更新
  handle<UpdateWorkflowPayload, Workflow>(WORKFLOW_EVENTS.UPDATE, async (payload) => {
    try {
      if (!validateUpdatePayload(payload)) {
        return { success: false, error: 'BAD_REQUEST:id / patch 不合法' }
      }
      const updated = workflowManager.update(payload)
      return { success: true, data: updated }
    } catch (error) {
      logger.error('[WorkflowHandler] UPDATE failed:', error)
      return handleError(error)
    }
  })

  // 删除
  handle<DeleteWorkflowPayload, boolean>(WORKFLOW_EVENTS.DELETE, async (payload) => {
    try {
      if (!payload || !isNonEmptyString(payload.id)) {
        return { success: false, error: 'BAD_REQUEST:id 不合法' }
      }
      const deleted = workflowManager.delete(payload.id)
      return { success: true, data: deleted }
    } catch (error) {
      logger.error('[WorkflowHandler] DELETE failed:', error)
      return handleError(error)
    }
  })

  logger.info('[WorkflowHandler] ✅ 工作流处理器已注册')
}
