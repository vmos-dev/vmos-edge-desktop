import { toRaw } from 'vue'
import { ipc } from '@renderer/core/ipc'
import {
  WORKFLOW_EVENTS,
  type Workflow,
  type WorkflowListItem,
  type CreateWorkflowPayload,
  type UpdateWorkflowPayload,
  type DeleteWorkflowPayload,
  type ListWorkflowsPayload
} from '@shared/ipc/workflow.types'

/**
 * 把含 Vue reactive proxy 的 payload 转成结构化克隆友好的 plain 对象。
 *
 * 用 structuredClone 而非 JSON.parse(JSON.stringify(...)),原因:
 *  - 保留 Date / Map / Set / RegExp / TypedArray 等(JSON 路径会丢失或扁平化)
 *  - 单次序列化,无双重栈开销
 *  - undefined 字段不会被 JSON 静默删除(structuredClone 会保留 own keys)
 *
 * toRaw 只解外层代理,structuredClone 自己会递归克隆,中间的嵌套 reactive
 * 值会被 Vue 的 get trap 反射出原始结构,被 structuredClone 完整复制。
 */
function toPlain<T>(value: T): T {
  return structuredClone(toRaw(value))
}

async function invokeOrThrow<T, P>(event: string, payload?: P): Promise<T> {
  const response = await ipc.invoke<T, P>(event, payload)
  if (!response.success) {
    throw new Error(response.error || 'IPC request failed')
  }
  return response.data as T
}

export function useWorkflowRepository() {
  async function list(params: ListWorkflowsPayload = {}): Promise<WorkflowListItem[]> {
    return await invokeOrThrow<WorkflowListItem[], ListWorkflowsPayload>(
      WORKFLOW_EVENTS.LIST,
      toPlain(params)
    )
  }

  async function get(id: string): Promise<Workflow | null> {
    return await invokeOrThrow<Workflow | null, string>(WORKFLOW_EVENTS.GET, id)
  }

  async function create(payload: CreateWorkflowPayload): Promise<Workflow> {
    return await invokeOrThrow<Workflow, CreateWorkflowPayload>(
      WORKFLOW_EVENTS.CREATE,
      toPlain(payload)
    )
  }

  async function update(id: string, patch: UpdateWorkflowPayload['patch']): Promise<Workflow> {
    return await invokeOrThrow<Workflow, UpdateWorkflowPayload>(
      WORKFLOW_EVENTS.UPDATE,
      toPlain({ id, patch } satisfies UpdateWorkflowPayload)
    )
  }

  async function remove(id: string): Promise<boolean> {
    return await invokeOrThrow<boolean, DeleteWorkflowPayload>(WORKFLOW_EVENTS.DELETE, {
      id
    })
  }

  return {
    list,
    get,
    create,
    update,
    remove
  }
}

export type WorkflowRepository = ReturnType<typeof useWorkflowRepository>
