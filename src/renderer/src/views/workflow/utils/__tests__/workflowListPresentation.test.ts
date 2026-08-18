import { describe, expect, it } from 'vitest'
import type { WorkflowListItem } from '@shared/ipc/workflow.types'
import {
  filterWorkflowItems,
  getRecentWorkflowItems,
  sortWorkflowItemsByUpdatedAt
} from '../workflowListPresentation'

const NOW = new Date('2026-04-21T12:00:00+08:00').getTime()
const DAY = 24 * 60 * 60 * 1000

function createWorkflow(overrides: Partial<WorkflowListItem>): WorkflowListItem {
  return {
    id: overrides.id ?? 'wf',
    name: overrides.name ?? '默认流程',
    appId: overrides.appId ?? 'com.example.app',
    appName: overrides.appName ?? '示例应用',
    appVersion: overrides.appVersion ?? '1.0.0',
    stepCount: overrides.stepCount ?? 0,
    createdAt: overrides.createdAt ?? NOW - DAY * 10,
    updatedAt: overrides.updatedAt ?? NOW - DAY * 3,
    ...overrides
  }
}

describe('workflowListPresentation', () => {
  const items = [
    createWorkflow({
      id: 'draft-old',
      name: '草稿旧流程',
      stepCount: 0,
      updatedAt: NOW - DAY * 20
    }),
    createWorkflow({ id: 'ready-new', name: '已就绪新流程', stepCount: 8, updatedAt: NOW - DAY }),
    createWorkflow({
      id: 'ready-recent',
      name: '最近流程',
      stepCount: 3,
      updatedAt: NOW - DAY * 2
    }),
    createWorkflow({ id: 'draft-recent', name: '最近草稿', stepCount: 0, updatedAt: NOW - DAY * 4 })
  ]

  it('sorts workflows by updatedAt descending', () => {
    expect(sortWorkflowItemsByUpdatedAt(items).map((item) => item.id)).toEqual([
      'ready-new',
      'ready-recent',
      'draft-recent',
      'draft-old'
    ])
  })

  it('filters ready, draft and recent workflows', () => {
    expect(filterWorkflowItems(items, 'ready', NOW).map((item) => item.id)).toEqual([
      'ready-new',
      'ready-recent'
    ])

    expect(filterWorkflowItems(items, 'draft', NOW).map((item) => item.id)).toEqual([
      'draft-old',
      'draft-recent'
    ])

    expect(filterWorkflowItems(items, 'recent', NOW).map((item) => item.id)).toEqual([
      'ready-new',
      'ready-recent',
      'draft-recent'
    ])
  })

  it('returns the newest recent workflows up to the requested limit', () => {
    expect(getRecentWorkflowItems(items, 2, NOW).map((item) => item.id)).toEqual([
      'ready-new',
      'ready-recent'
    ])
  })
})
