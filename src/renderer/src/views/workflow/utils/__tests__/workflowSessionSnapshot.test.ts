import { describe, expect, it } from 'vitest'
import type { Workflow } from '@shared/ipc/workflow.types'
import { cloneWorkflow, workflowsEqual } from '../workflowSessionSnapshot'

describe('workflowSessionSnapshot', () => {
  it('treats structurally identical workflows as equal', () => {
    const base = {
      id: 'wf-1',
      name: 'Demo',
      appId: 'com.demo.app',
      appName: 'Demo App',
      steps: [],
      createdAt: 1,
      updatedAt: 2
    } satisfies Workflow

    expect(workflowsEqual(base, cloneWorkflow(base))).toBe(true)
  })
})
