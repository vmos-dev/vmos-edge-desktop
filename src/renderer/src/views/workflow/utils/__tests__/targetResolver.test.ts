import { describe, expect, it } from 'vitest'
import type { UiNode, DumpResult } from '@renderer/components/ui-inspector/types'
import { buildTreeContext } from '../nodeTreeContext'
import { findEffectiveTarget } from '../targetResolver'

function createNode(overrides: Partial<UiNode> = {}): UiNode {
  return {
    id: overrides.id ?? 1,
    className: 'android.widget.TextView',
    depth: 0,
    bounds: [0, 0, 100, 100],
    attrs: {},
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

describe('findEffectiveTarget', () => {
  it('returns self when source itself is clickable', () => {
    const source = createNode({
      id: 1,
      className: 'android.widget.Button',
      attrs: { clickable: 'true', enabled: 'true', text: '登录' }
    })
    const tree = buildTreeContext(wrapDump(source))

    const et = findEffectiveTarget(source, tree, 'generic')
    expect(et.target.id).toBe(1)
    expect(et.candidates[0].relation).toBe('self')
  })

  it('upgrades to the nearest clickable ancestor when source is a leaf TextView', () => {
    const label = createNode({
      id: 2,
      className: 'android.widget.TextView',
      attrs: { text: '设置' }
    })
    const item = createNode({
      id: 1,
      className: 'android.widget.LinearLayout',
      attrs: { clickable: 'true', enabled: 'true' },
      children: [label]
    })
    const tree = buildTreeContext(wrapDump(item))

    const et = findEffectiveTarget(label, tree, 'generic')
    expect(et.target.id).toBe(1)
    expect(et.candidates[0].relation).toBe('ancestor-clickable')
    expect(et.candidates[0].distance).toBe(1)
  })

  it('prefers editable ancestor when kind is input-like', () => {
    const icon = createNode({
      id: 3,
      className: 'android.widget.ImageView',
      attrs: { 'content-desc': '搜索' }
    })
    const edit = createNode({
      id: 2,
      className: 'android.widget.EditText',
      attrs: { enabled: 'true' },
      children: [icon]
    })
    const root = createNode({
      id: 1,
      className: 'android.widget.FrameLayout',
      children: [edit]
    })
    const tree = buildTreeContext(wrapDump(root))

    const et = findEffectiveTarget(icon, tree, 'input-like')
    expect(et.target.id).toBe(2)
    expect(et.candidates[0].relation).toBe('ancestor-editable')
  })

  it('falls back to self with leafWithText when no ancestor is actionable', () => {
    const label = createNode({
      id: 2,
      className: 'android.widget.TextView',
      attrs: { text: '帮助信息' }
    })
    const root = createNode({
      id: 1,
      className: 'android.widget.FrameLayout',
      children: [label]
    })
    const tree = buildTreeContext(wrapDump(root))

    const et = findEffectiveTarget(label, tree, 'generic')
    expect(et.target.id).toBe(2)
    expect(et.candidates[0].relation).toBe('self')
    expect(et.candidates[0].featuresUsed).toContain('self.leafWithText')
  })
})
