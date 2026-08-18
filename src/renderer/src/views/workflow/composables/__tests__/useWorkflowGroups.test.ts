import { shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'
import type { WorkflowListItem } from '@shared/ipc/workflow.types'
import { useWorkflowGroups } from '../useWorkflowGroups'

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

describe('useWorkflowGroups', () => {
  it('groups workflows by visible app label and sorts items by updated time descending', () => {
    const items = shallowRef<readonly WorkflowListItem[]>([
      createWorkflow({
        id: 'b-older',
        name: 'B 旧流程',
        appId: 'com.demo.beta',
        appName: 'Beta',
        stepCount: 1,
        updatedAt: NOW - DAY * 5
      }),
      createWorkflow({
        id: 'alpha-new',
        name: 'Alpha 新流程',
        appId: 'com.demo.alpha',
        appName: 'Alpha',
        stepCount: 4,
        updatedAt: NOW - DAY
      }),
      createWorkflow({
        id: 'b-newer',
        name: 'B 新流程',
        appId: 'com.demo.beta',
        appName: 'Beta',
        stepCount: 2,
        updatedAt: NOW - DAY * 2
      })
    ])

    const grouped = useWorkflowGroups(items)

    expect(grouped.groups.value.map((group) => group.label)).toEqual(['Alpha', 'Beta'])
    expect(grouped.groups.value[1]?.items.map((item) => item.id)).toEqual(['b-newer', 'b-older'])
    expect(grouped.navItems.value.map((item) => item.label)).toEqual(['Alpha', 'Beta'])
  })

  it('falls back to appId when appName is empty and derives summary counts from the current source list', () => {
    const items = shallowRef<readonly WorkflowListItem[]>([
      createWorkflow({
        id: 'fallback',
        appId: 'com.demo.unnamed',
        appName: '',
        stepCount: 0,
        updatedAt: NOW - DAY * 8
      }),
      createWorkflow({
        id: 'recent-ready',
        appId: 'com.demo.alpha',
        appName: 'Alpha',
        stepCount: 6,
        updatedAt: NOW - DAY * 2
      }),
      createWorkflow({
        id: 'recent-draft',
        appId: 'com.demo.alpha',
        appName: 'Alpha',
        stepCount: 0,
        updatedAt: NOW - DAY * 3
      })
    ])

    const grouped = useWorkflowGroups(items)

    expect(grouped.groups.value.map((group) => group.label)).toEqual(['Alpha', 'com.demo.unnamed'])
    expect(grouped.summary.value).toEqual({
      workflowCount: 3,
      appCount: 2
    })

    items.value = items.value.filter((item) => item.appName === 'Alpha')

    expect(grouped.groups.value.map((group) => group.label)).toEqual(['Alpha'])
    expect(grouped.summary.value).toEqual({
      workflowCount: 2,
      appCount: 1
    })
  })

  it('merges app groups case-insensitively and keeps the first-seen label', () => {
    const items = shallowRef<readonly WorkflowListItem[]>([
      createWorkflow({
        id: 'chrome-upper-a',
        appId: 'com.android.chrome',
        appName: 'Chrome',
        stepCount: 1,
        updatedAt: NOW - DAY
      }),
      createWorkflow({
        id: 'chrome-lower',
        appId: 'com.android.chrome',
        appName: 'chrome',
        stepCount: 2,
        updatedAt: NOW - DAY * 2
      }),
      createWorkflow({
        id: 'chrome-upper-b',
        appId: 'com.android.chrome',
        appName: 'CHROME',
        stepCount: 3,
        updatedAt: NOW - DAY * 3
      })
    ])

    const grouped = useWorkflowGroups(items)

    expect(grouped.groups.value).toHaveLength(1)
    expect(grouped.groups.value[0]?.label).toBe('Chrome')
    expect(grouped.groups.value[0]?.count).toBe(3)
    expect(grouped.summary.value.appCount).toBe(1)
  })

  it('only exposes subtitles when a group really needs disambiguation', () => {
    const items = shallowRef<readonly WorkflowListItem[]>([
      createWorkflow({
        id: 'alpha',
        appId: 'com.demo.alpha',
        appName: 'Alpha',
        stepCount: 1
      }),
      createWorkflow({
        id: 'reader-cn',
        appId: 'com.demo.reader.cn',
        appName: 'Reader',
        stepCount: 2
      }),
      createWorkflow({
        id: 'reader-intl',
        appId: 'com.demo.reader.intl',
        appName: 'Reader',
        stepCount: 3
      }),
      createWorkflow({
        id: 'fallback-id',
        appId: 'com.demo.fallback',
        appName: '',
        stepCount: 0
      })
    ])

    const grouped = useWorkflowGroups(items)

    expect(grouped.groups.value.find((group) => group.label === 'Alpha')?.subtitle).toBeNull()
    expect(grouped.groups.value.find((group) => group.label === 'Reader')?.subtitle).toBe(
      'com.demo.reader.cn +1'
    )
    expect(
      grouped.groups.value.find((group) => group.label === 'com.demo.fallback')?.subtitle
    ).toBeNull()
  })
})
