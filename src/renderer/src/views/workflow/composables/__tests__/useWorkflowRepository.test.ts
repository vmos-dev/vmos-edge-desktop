import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ipc } from '@renderer/core/ipc'
import { WORKFLOW_EVENTS, type Workflow } from '@shared/ipc/workflow.types'
import { useWorkflowRepository } from '../useWorkflowRepository'

vi.mock('@renderer/core/ipc', () => ({
  ipc: {
    invoke: vi.fn()
  }
}))

describe('useWorkflowRepository', () => {
  beforeEach(() => {
    vi.mocked(ipc.invoke).mockReset()
  })

  it('maps update to WORKFLOW_EVENTS.UPDATE and returns the saved workflow', async () => {
    const savedWorkflow = {
      id: 'wf-1',
      name: 'Demo',
      appId: 'com.demo.app',
      appName: 'Demo App',
      steps: [],
      createdAt: 1,
      updatedAt: 2
    } satisfies Workflow

    vi.mocked(ipc.invoke).mockResolvedValue({
      success: true,
      data: savedWorkflow
    })

    const repository = useWorkflowRepository()
    const result = await repository.update('wf-1', { steps: [] })

    expect(ipc.invoke).toHaveBeenCalledWith(WORKFLOW_EVENTS.UPDATE, {
      id: 'wf-1',
      patch: { steps: [] }
    })
    expect(result).toEqual(savedWorkflow)
  })
})
