import { describe, expect, it } from 'vitest'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { Selector } from '@shared/ipc/workflow.types'
import { buildElementHeading, buildPropertyRows, buildSelectorRows } from '../elementPopoverMappers'

function createNode(overrides: Partial<UiNode> = {}): UiNode {
  return {
    id: 1,
    className: 'android.widget.TextView',
    depth: 0,
    bounds: [20, 40, 180, 120],
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

describe('buildElementHeading', () => {
  it('falls back from text to content-desc to class name', () => {
    expect(
      buildElementHeading(
        createNode({
          attrs: {
            text: '登录',
            'content-desc': '登录按钮',
            'resource-id': 'com.demo:id/login_button'
          }
        })
      )
    ).toEqual({
      title: '登录',
      subtitle: 'login_button'
    })

    expect(
      buildElementHeading(
        createNode({
          attrs: {
            text: '',
            'content-desc': '登录按钮',
            'resource-id': ''
          }
        })
      )
    ).toEqual({
      title: '登录按钮',
      subtitle: ''
    })

    expect(
      buildElementHeading(
        createNode({
          className: 'android.widget.Button',
          attrs: {
            text: '',
            'content-desc': '',
            'resource-id': ''
          }
        })
      )
    ).toEqual({
      title: 'Button',
      subtitle: ''
    })
  })
})

describe('buildPropertyRows', () => {
  it('includes index rows when they exist and omits them otherwise', () => {
    const indexedRows = buildPropertyRows(
      createNode({
        textIndex: 1,
        resourceIdIndex: 0,
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

    expect(indexedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'textIndex', value: '1' }),
        expect.objectContaining({ key: 'resourceIdIndex', value: '0' }),
        expect.objectContaining({ key: 'contentDescIndex', value: '2' })
      ])
    )

    const plainRows = buildPropertyRows(
      createNode({
        attrs: {
          text: '',
          'content-desc': '',
          'resource-id': '',
          enabled: 'true',
          clickable: 'false'
        }
      })
    )

    expect(plainRows.find((row) => row.key === 'textIndex')).toBeUndefined()
    expect(plainRows.find((row) => row.key === 'resourceIdIndex')).toBeUndefined()
    expect(plainRows.find((row) => row.key === 'contentDescIndex')).toBeUndefined()
  })
})

describe('buildSelectorRows', () => {
  it('marks primary; renders fields list with index visible(不再藏在 JSON 里)', () => {
    const selector: Selector = {
      primary: {
        type: 'id',
        value: { id: 'login_button', index: 0 },
        stabilityScore: 75
      },
      fallbacks: [{ type: 'point', value: '100,200', stabilityScore: 20 }]
    }

    const rows = buildSelectorRows(selector)

    expect(rows[0]).toMatchObject({
      label: 'workflow.popover.strategyIdIndexed',
      reasonText: 'workflow.popover.reasonIndexed',
      score: 75,
      isPrimary: true
    })
    // 字段视图:每个键一项,index 独立可见
    expect(rows[0].fields).toEqual([
      { key: 'id', value: 'login_button' },
      { key: 'index', value: '0' }
    ])

    expect(rows[1]).toMatchObject({
      label: 'workflow.popover.strategyPoint',
      reasonText: 'workflow.popover.reasonFragile',
      isPrimary: false
    })
    expect(rows[1].fields).toEqual([{ key: 'point', value: '100,200' }])
  })

  it('字符串型 selector value(L1 唯一锚点)按 type 推断键名', () => {
    const selector: Selector = {
      primary: { type: 'text', value: '推荐', stabilityScore: 95 },
      fallbacks: [{ type: 'id', value: 'tab_recommend', stabilityScore: 80 }]
    }
    const rows = buildSelectorRows(selector)
    expect(rows[0].fields).toEqual([{ key: 'text', value: '推荐' }])
    expect(rows[1].fields).toEqual([{ key: 'id', value: 'tab_recommend' }])
  })
})
