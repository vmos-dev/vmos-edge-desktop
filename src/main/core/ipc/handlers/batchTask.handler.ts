// src/main/core/ipc/handlers/batchTask.handler.ts
import { handle } from '../IpcBus'
import { batchTaskManager } from '../../store/managers'
import { BATCH_TASK_EVENTS } from '@shared/ipc/batchTask.types'
import type {
  CreateBatchTaskPayload,
  BatchTaskListPayload,
  BatchTaskListResult,
  BatchTaskDetailResult,
  CancelBatchPayload,
  RetryFailedPayload,
  ItemDetailPayload,
  ItemDetailResult
} from '@shared/ipc/batchTask.types'
import { logger } from '../../logger'

function handleError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  logger.error(`[BatchTask Handler] ${msg}`)
  return { success: false as const, error: msg }
}

export function registerBatchTaskHandlers(): void {
  handle<CreateBatchTaskPayload, { batchTaskId: string }>(
    BATCH_TASK_EVENTS.CREATE,
    async (payload) => {
      try {
        const result = await batchTaskManager.create(payload)
        return { success: true, data: result }
      } catch (err) {
        return handleError(err)
      }
    }
  )

  handle<BatchTaskListPayload | undefined, BatchTaskListResult>(
    BATCH_TASK_EVENTS.LIST,
    async (payload) => {
      try {
        const result = batchTaskManager.list(
          payload?.offset ?? 0,
          payload?.limit ?? 50,
          payload?.status
        )
        return { success: true, data: result }
      } catch (err) {
        return handleError(err)
      }
    }
  )

  handle<string, BatchTaskDetailResult | null>(BATCH_TASK_EVENTS.GET, async (batchTaskId) => {
    try {
      const result = batchTaskManager.get(batchTaskId)
      return { success: true, data: result }
    } catch (err) {
      return handleError(err)
    }
  })

  handle<CancelBatchPayload, void>(BATCH_TASK_EVENTS.CANCEL, async (payload) => {
    try {
      await batchTaskManager.cancel(payload.batchTaskId, payload.deviceIds)
      return { success: true, data: undefined }
    } catch (err) {
      return handleError(err)
    }
  })

  handle<{ batchTaskId: string; deviceId: string }, void>(
    BATCH_TASK_EVENTS.CANCEL_ITEM,
    async (payload) => {
      try {
        await batchTaskManager.cancel(payload.batchTaskId, [payload.deviceId])
        return { success: true, data: undefined }
      } catch (err) {
        return handleError(err)
      }
    }
  )

  handle<RetryFailedPayload, void>(BATCH_TASK_EVENTS.RETRY_FAILED, async (payload) => {
    try {
      await batchTaskManager.retryFailed(payload.batchTaskId)
      return { success: true, data: undefined }
    } catch (err) {
      return handleError(err)
    }
  })

  handle<string, boolean>(BATCH_TASK_EVENTS.DELETE, async (batchTaskId) => {
    try {
      const result = await batchTaskManager.delete(batchTaskId)
      return { success: true, data: result }
    } catch (err) {
      return handleError(err)
    }
  })

  handle<ItemDetailPayload, ItemDetailResult | null>(
    BATCH_TASK_EVENTS.ITEM_DETAIL,
    async (payload) => {
      try {
        const result = await batchTaskManager.getItemSteps(payload.batchTaskId, payload.deviceId)
        return { success: true, data: result }
      } catch (err) {
        return handleError(err)
      }
    }
  )
}
