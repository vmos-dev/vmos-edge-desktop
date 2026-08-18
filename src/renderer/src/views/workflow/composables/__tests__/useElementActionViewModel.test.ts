import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import { useElementActionViewModel } from '../useElementActionViewModel'

function createNode(overrides: Partial<UiNode> = {}): UiNode {
  return {
    id: 1,
    className: 'android.widget.Button',
    depth: 0,
    bounds: [20, 20, 200, 100],
    attrs: {
      text: '登录',
      clickable: 'true',
      enabled: 'true'
    },
    children: [],
    ...overrides
  }
}

function inScope<T>(fn: () => T): { result: T; stop: () => void } {
  const scope = effectScope()
  let result!: T
  scope.run(() => {
    result = fn()
  })

  return {
    result,
    stop: () => scope.stop()
  }
}

describe('useElementActionViewModel', () => {
  it('builds a single-step hero recommendation and excludes it from the secondary list', () => {
    const { result, stop } = inScope(() =>
      useElementActionViewModel({
        node: ref(createNode()),
        screen: ref({ width: 1080, height: 1920 }),
        effectiveTarget: ref(undefined)
      })
    )

    expect(result.recommendation.value).not.toBeNull()
    expect(result.recommendation.value?.rec.steps).toHaveLength(1)
    expect(result.recommendation.value?.rec.action).toBe('tapOn')
    expect(result.actions.value.every((item) => item.rule.id !== 'tapOn')).toBe(true)

    stop()
  })
})
