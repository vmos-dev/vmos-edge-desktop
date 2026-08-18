import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { UiNode, DumpResult } from '@renderer/components/ui-inspector/types'
import type { PickResult } from '@renderer/components/ui-inspector/pickResolver'
import type { Recommendation, Step } from '@shared/ipc/workflow.types'
import { usePickToInsert } from '../usePickToInsert'

function createNode(overrides: Partial<UiNode> = {}): UiNode {
  return {
    id: 1,
    className: 'android.widget.Button',
    depth: 0,
    bounds: [20, 20, 200, 100],
    attrs: {
      text: 'Login',
      clickable: 'true',
      enabled: 'true'
    },
    children: [],
    ...overrides
  }
}

function createDump(node: UiNode): DumpResult {
  return {
    screenWidth: 1080,
    screenHeight: 1920,
    rotation: 0,
    nodes: [node],
    tree: [node],
    actionableNodes: [node]
  }
}

function createPick(node: UiNode): PickResult {
  return {
    winner: { node, area: 14400 },
    candidates: [{ node, area: 14400 }]
  }
}

function createRecommendation(): Recommendation {
  return {
    action: 'tapOn',
    title: 'Tap this button',
    icon: 'tap',
    reason: 'Matches the selected element',
    priority: 100,
    yamlPreview: ['- tapOn: Login'],
    steps: [
      {
        action: 'tapOn',
        selector: {
          primary: {
            type: 'text',
            value: 'Login',
            stabilityScore: 100
          }
        },
        stability: 'ok',
        metadata: {
          elementType: 'button',
          capturedAt: 1
        }
      }
    ]
  }
}

describe('usePickToInsert', () => {
  it('keeps the inspected element popover open after applying a recommendation', async () => {
    const inserted: Array<Omit<Step, 'id'>> = []
    const stageFrozen = ref(true)
    const node = createNode()
    const dump = createDump(node)
    const pick = createPick(node)

    const scope = effectScope()
    const result = scope.run(() =>
      usePickToInsert(
        {
          insertAfter: (_afterId, step) => inserted.push(step),
          appendBatch: (steps) => inserted.push(...steps)
        },
        stageFrozen
      )
    )

    expect(result).toBeDefined()
    result!.inspect({ node, dump, pick })
    await nextTick()

    const applied = result!.apply(
      { kind: 'recommendation', rec: createRecommendation() },
      { kind: 'append' }
    )

    expect(applied).toBe(true)
    expect(inserted).toHaveLength(1)
    expect(result!.inspectedNode.value?.id).toBe(node.id)
    expect(result!.pickResult.value?.winner.node.id).toBe(pick.winner.node.id)
    expect(result!.activeCandidateId.value).toBe(node.id)
    expect(stageFrozen.value).toBe(true)

    scope.stop()
  })
})
