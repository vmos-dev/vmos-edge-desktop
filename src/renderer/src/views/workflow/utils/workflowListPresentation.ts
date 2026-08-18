import type { WorkflowListItem } from '@shared/ipc/workflow.types'

export type WorkflowListFilter = 'all' | 'ready' | 'draft' | 'recent'

export const RECENT_WORKFLOW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function isWorkflowRecent(
  workflow: WorkflowListItem,
  now = Date.now(),
  windowMs = RECENT_WORKFLOW_WINDOW_MS
): boolean {
  return now - workflow.updatedAt <= windowMs
}

export function filterWorkflowItems(
  items: readonly WorkflowListItem[],
  filter: WorkflowListFilter,
  now = Date.now()
): WorkflowListItem[] {
  if (filter === 'all') return [...items]

  return items.filter((item) => {
    if (filter === 'ready') return item.stepCount > 0
    if (filter === 'draft') return item.stepCount <= 0
    return isWorkflowRecent(item, now)
  })
}

export function sortWorkflowItemsByUpdatedAt(
  items: readonly WorkflowListItem[]
): WorkflowListItem[] {
  return [...items].sort((left, right) => right.updatedAt - left.updatedAt)
}

export function getRecentWorkflowItems(
  items: readonly WorkflowListItem[],
  limit: number,
  now = Date.now()
): WorkflowListItem[] {
  return sortWorkflowItemsByUpdatedAt(filterWorkflowItems(items, 'recent', now)).slice(0, limit)
}
