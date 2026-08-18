import type { Workflow } from '@shared/ipc/workflow.types'

export function cloneWorkflow<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function workflowsEqual(a: Workflow | null, b: Workflow | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
