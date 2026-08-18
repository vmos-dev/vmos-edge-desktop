import { describe, expect, it } from 'vitest'
import type { UiNode, DumpResult } from '@renderer/components/ui-inspector/types'
import { buildTreeContext } from '../nodeTreeContext'
import {
  computeRecommendation,
  emptyContext,
  recommendActions,
  scoreAllActions
} from '../recommendation'

function createNode(overrides: Partial<UiNode> = {}): UiNode {
  return {
    id: 1,
    className: 'android.widget.Button',
    depth: 0,
    bounds: [20, 20, 120, 80],
    attrs: {
      text: '登录',
      clickable: 'true',
      enabled: 'true'
    },
    children: [],
    ...overrides
  }
}

function wrapDump(root: UiNode, screen = { width: 1080, height: 1920 }): DumpResult {
  const flat: UiNode[] = []
  const walk = (n: UiNode): void => {
    flat.push(n)
    n.children.forEach(walk)
  }
  walk(root)
  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    rotation: 0,
    nodes: flat,
    tree: [root],
    actionableNodes: flat
  }
}

describe('computeRecommendation · 单步契约', () => {
  // 推荐器只给一步最匹配的 action —— 后置动作(聚焦、清空、滚动到可见)由用户手动追加,
  // 避免对后续意图的过度臆测。

  it('可点击元素 → 单步 tapOn(不自动追加 scrollUntilVisible)', () => {
    const node = createNode({ bounds: [0, 2100, 160, 2180] })
    const rec = computeRecommendation(node, emptyContext(), { width: 1080, height: 1920 })

    expect(rec).not.toBeNull()
    expect(rec?.action).toBe('tapOn')
    expect(rec?.steps).toHaveLength(1)
    expect(rec?.steps[0].action).toBe('tapOn')
  })

  it('空 EditText → 单步 inputText(不自动追加 tapOn 聚焦)', () => {
    const edit = createNode({
      id: 5,
      className: 'android.widget.EditText',
      attrs: { enabled: 'true' }
    })
    const tree = buildTreeContext(wrapDump(edit))

    const rec = computeRecommendation(edit, emptyContext(), tree.screen, tree)
    expect(rec).not.toBeNull()
    expect(rec?.steps).toHaveLength(1)
    expect(rec?.steps[0].action).toBe('inputText')
  })

  it('有文本的 EditText → 单步(不自动串 [tapOn, eraseText, inputText])', () => {
    const edit = createNode({
      id: 5,
      className: 'android.widget.EditText',
      attrs: { enabled: 'true', text: '已有内容' }
    })
    const tree = buildTreeContext(wrapDump(edit))

    const rec = computeRecommendation(edit, emptyContext(), tree.screen, tree)
    expect(rec).not.toBeNull()
    expect(rec?.steps).toHaveLength(1)
  })
})

describe('scoreAllActions with effective target', () => {
  it('prefers tapOn when source is a non-clickable TextView inside a clickable LinearLayout', () => {
    const label = createNode({
      id: 12,
      className: 'android.widget.TextView',
      attrs: { text: '设置', enabled: 'true' }
    })
    const item = createNode({
      id: 11,
      className: 'android.widget.LinearLayout',
      attrs: { clickable: 'true', enabled: 'true' },
      children: [label]
    })
    const tree = buildTreeContext(wrapDump(item))

    const buckets = scoreAllActions(label, emptyContext(), tree.screen, tree)
    expect(buckets.top.length).toBeGreaterThan(0)
    expect(buckets.top[0].rule.id).toBe('tapOn')
    expect(buckets.top[0].value).toBeGreaterThanOrEqual(100)
  })
})

describe('selector host (source vs target) — architecture split', () => {
  it('uses SOURCE text for tapOn even when target upgrades to clickable parent', () => {
    // 用户点 TextView("登录"),父 LinearLayout clickable 但无 text
    const label = createNode({
      id: 12,
      className: 'android.widget.TextView',
      attrs: { text: '登录', enabled: 'true' }
    })
    const item = createNode({
      id: 11,
      className: 'android.widget.LinearLayout',
      attrs: { clickable: 'true', enabled: 'true' },
      children: [label]
    })
    const tree = buildTreeContext(wrapDump(item))

    const rec = computeRecommendation(label, emptyContext(), tree.screen, tree)
    expect(rec).not.toBeNull()
    expect(rec?.action).toBe('tapOn')
    // selector 应该落在有 text 的 source,不是父节点坐标
    const primary = rec?.steps[0].selector?.primary
    expect(primary?.type).toBe('text')
    expect(primary?.value).toBe('登录')
  })

  it('uses TARGET(editable) for inputText even when source is an icon inside EditText', () => {
    // source:输入框里的清除 icon;target 应升级到 EditText 本身
    const clearIcon = createNode({
      id: 20,
      className: 'android.widget.ImageView',
      attrs: { 'content-desc': 'clear', enabled: 'true' }
    })
    const edit = createNode({
      id: 19,
      className: 'android.widget.EditText',
      attrs: { enabled: 'true', 'resource-id': 'com.app:id/search_input' },
      children: [clearIcon]
    })
    const tree = buildTreeContext(wrapDump(edit))

    const rec = computeRecommendation(clearIcon, emptyContext(), tree.screen, tree)
    expect(rec).not.toBeNull()
    expect(rec?.action).toBe('inputText')
    expect(rec?.steps).toHaveLength(1)
    // inputText 的 selector 必须指向 EditText(editable),否则输入会丢
    const primary = rec?.steps[0].selector?.primary
    expect(primary?.type).toBe('id')
    expect(primary?.value).toBe('search_input')
  })
})

describe('recommendActions JSON output', () => {
  it('returns sourceId/targetId reflecting target upgrade', () => {
    const label = createNode({
      id: 42,
      className: 'android.widget.TextView',
      attrs: { text: '账号设置', enabled: 'true' }
    })
    const item = createNode({
      id: 40,
      className: 'android.widget.LinearLayout',
      attrs: { clickable: 'true', enabled: 'true' },
      children: [label]
    })
    const dump = wrapDump(item)

    const results = recommendActions(label, dump, emptyContext())
    expect(results.length).toBeGreaterThan(0)

    const top = results[0]
    expect(top.sourceId).toBe(42)
    expect(top.targetId).toBe(40)
    expect(top.action).toBe('tapOn')
    expect(top.steps[0].action).toBe('tapOn')
    expect(top.bucket).toBe('top')
  })

  it('every result only uses known ActionType values (no invented actions)', () => {
    const node = createNode({
      className: 'android.widget.EditText',
      attrs: { enabled: 'true' }
    })
    const dump = wrapDump(node)

    const results = recommendActions(node, dump, emptyContext())
    const known = new Set([
      'tapOn',
      'longPressOn',
      'doubleTapOn',
      'inputText',
      'eraseText',
      'pasteText',
      'scroll',
      'swipe',
      'scrollUntilVisible',
      'extendedWaitUntil',
      'assertVisible',
      'assertNotVisible',
      'copyTextFrom'
    ])
    for (const r of results) {
      expect(known.has(r.action)).toBe(true)
      for (const step of r.steps) {
        expect(known.has(step.action)).toBe(true)
      }
    }
  })
})

describe('scroll / swipe action rules (coverage for pure scroll)', () => {
  it('surfaces scroll in top bucket when target is a scrollable container', () => {
    const list = createNode({
      id: 30,
      className: 'androidx.recyclerview.widget.RecyclerView',
      attrs: { scrollable: 'true', enabled: 'true' }
    })
    const tree = buildTreeContext(wrapDump(list))

    const buckets = scoreAllActions(list, emptyContext(), tree.screen, tree)
    const ids = [...buckets.top, ...buckets.ok].map((s) => s.rule.id)
    expect(ids).toContain('scroll')
  })
})

describe('lastTargetId consumption (repeat-action penalty)', () => {
  it('penalizes repeating tapOn on same target in consecutive step', () => {
    const btn = createNode({
      id: 50,
      className: 'android.widget.Button',
      attrs: { clickable: 'true', enabled: 'true', text: '确认' }
    })
    const tree = buildTreeContext(wrapDump(btn))

    // 第一次推荐:无 lastAction,tapOn 评分 100
    const fresh = scoreAllActions(btn, emptyContext(), tree.screen, tree)
    const freshTap = fresh.top.find((s) => s.rule.id === 'tapOn')!
    expect(freshTap.value).toBeGreaterThanOrEqual(100)

    // 第二次:模拟"上一步已经对这个按钮执行过 tapOn"
    const repeated = scoreAllActions(
      btn,
      {
        hasVariableUsage: false,
        stepCount: 1,
        lastAction: 'tapOn',
        lastTargetId: 'text:确认'
      },
      tree.screen,
      tree
    )
    const repeatedTap = [...repeated.top, ...repeated.ok, ...repeated.more].find(
      (s) => s.rule.id === 'tapOn'
    )!
    expect(repeatedTap.value).toBeLessThan(freshTap.value)
    expect(freshTap.value - repeatedTap.value).toBeGreaterThanOrEqual(25)
  })
})
