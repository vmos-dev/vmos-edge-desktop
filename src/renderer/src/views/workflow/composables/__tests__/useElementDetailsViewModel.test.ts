import { describe, expect, it } from 'vitest'
import { effectScope, ref } from 'vue'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import { useElementDetailsViewModel } from '../useElementDetailsViewModel'

function createNode(overrides: Partial<UiNode> = {}): UiNode {
  return {
    id: 1,
    className: 'android.widget.TextView',
    depth: 0,
    bounds: [20, 20, 220, 120],
    attrs: {
      text: '',
      'content-desc': '',
      'resource-id': 'com.demo:id/login_button',
      enabled: 'true',
      clickable: 'true'
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

describe('useElementDetailsViewModel', () => {
  it('derives selector-first details rows and preserves index metadata', () => {
    const { result, stop } = inScope(() =>
      (() => {
        const node = ref(
          createNode({
            resourceIdIndex: 0,
            textIndex: 1,
            contentDescIndex: 2,
            attrs: {
              text: '登录',
              'content-desc': '登录按钮',
              'resource-id': 'com.demo:id/login_button',
              enabled: 'true',
              clickable: 'true'
            }
          })
        )
        return useElementDetailsViewModel({ node, selectorHost: node })
      })()
    )

    expect(result.selectorRows.value[0]).toMatchObject({
      isPrimary: true
    })
    expect(result.propertyRows.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'textIndex', value: '1' }),
        expect.objectContaining({ key: 'resourceIdIndex', value: '0' }),
        expect.objectContaining({ key: 'contentDescIndex', value: '2' })
      ])
    )

    stop()
  })
})
