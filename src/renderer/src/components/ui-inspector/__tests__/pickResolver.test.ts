/**
 * pickResolver · Maestro 基线 + 候选收集
 *
 * 不变量:
 *   I1: winner === hit (Maestro 基线,不升档)
 *   I2: candidates 包含 hit + 所有含点击点 ∧ (clickable ∨ anchored) 的节点
 *   I3: candidates 按面积升序(更具体的在前)
 *   I4: 零面积节点不进候选
 *   I5: winner ∈ candidates
 */
import { describe, expect, it } from 'vitest'
import type { DumpResult, UiNode } from '../types'
import { resolvePickTarget } from '../pickResolver'

let nextId = 1000

function mk(partial: {
  className?: string
  bounds: [number, number, number, number]
  attrs?: Record<string, string>
  children?: UiNode[]
}): UiNode {
  return {
    id: nextId++,
    className: partial.className ?? 'android.view.View',
    depth: 0,
    bounds: partial.bounds,
    attrs: partial.attrs ?? {},
    children: partial.children ?? []
  }
}

function buildDump(roots: UiNode[], screenWidth = 1080, screenHeight = 2376): DumpResult {
  const flat: UiNode[] = []
  const walk = (n: UiNode): void => {
    flat.push(n)
    for (const c of n.children) walk(c)
  }
  for (const r of roots) walk(r)
  return {
    screenWidth,
    screenHeight,
    rotation: 0,
    nodes: flat,
    tree: roots,
    actionableNodes: []
  }
}

const FULLSCREEN: [number, number, number, number] = [0, 0, 1080, 2376]

// ═══════════════ winner 不升档(Maestro 基线) ═══════════════

describe('winner = hit (不升档)', () => {
  it('即使祖先有更稳的锚,winner 还是 hit', () => {
    const hit = mk({
      bounds: [864, 1269, 1080, 1419],
      attrs: { 'resource-id': 'com.x:id/e12', clickable: 'true' }
    })
    const better = mk({
      bounds: [864, 1269, 1080, 1472],
      attrs: { 'content-desc': '阅读或添加评论', clickable: 'true' },
      children: [hit]
    })
    const root = mk({ bounds: FULLSCREEN, children: [better] })

    const dump = buildDump([root])
    const result = resolvePickTarget(hit, dump, { x: 972, y: 1344 })

    expect(result.winner.node).toBe(hit)
    expect(result.candidates).toContainEqual(result.winner)
  })
})

// ═══════════════ candidates 收集 ═══════════════

describe('candidates 包含整个点击栈', () => {
  it('收集所有 clickable/anchored + 含点击点的 node', () => {
    const icon = mk({ bounds: [925, 1291, 1033, 1399] })
    const frame = mk({
      bounds: [864, 1269, 1080, 1419],
      attrs: { 'resource-id': 'com.x:id/frame', clickable: 'true' },
      children: [icon]
    })
    const btn = mk({
      bounds: [864, 1269, 1080, 1472],
      attrs: { 'content-desc': '评论', clickable: 'true' },
      children: [frame]
    })
    const root = mk({ bounds: FULLSCREEN, children: [btn] })

    const dump = buildDump([root])
    const result = resolvePickTarget(frame, dump, { x: 972, y: 1344 })

    const ids = result.candidates.map((c) => c.node.id)
    expect(ids).toContain(frame.id) // hit(恒入)
    expect(ids).toContain(btn.id) // 祖先有锚
    expect(ids).not.toContain(icon.id) // icon 无锚不可点
  })

  it('hit 无锚不可点也会入候选', () => {
    const hit = mk({ bounds: [100, 100, 200, 200] })
    const anchor = mk({
      bounds: [50, 50, 250, 250],
      attrs: { 'resource-id': 'com.x:id/wrap' },
      children: [hit]
    })
    const root = mk({ bounds: FULLSCREEN, children: [anchor] })

    const dump = buildDump([root])
    const result = resolvePickTarget(hit, dump, { x: 150, y: 150 })

    expect(result.candidates.map((c) => c.node.id)).toContain(hit.id)
  })

  it('bounds 不含点击点的 node 不入池', () => {
    const left = mk({
      bounds: [0, 0, 400, 400],
      attrs: { clickable: 'true', text: 'Left' }
    })
    const right = mk({
      bounds: [680, 0, 1080, 400],
      attrs: { clickable: 'true', text: 'Right' }
    })
    const root = mk({ bounds: FULLSCREEN, children: [left, right] })

    const dump = buildDump([root])
    const result = resolvePickTarget(left, dump, { x: 200, y: 200 })

    const ids = result.candidates.map((c) => c.node.id)
    expect(ids).toContain(left.id)
    expect(ids).not.toContain(right.id)
  })

  it('零面积节点被过滤', () => {
    const real = mk({
      bounds: [50, 50, 200, 200],
      attrs: { clickable: 'true', text: 'Real' }
    })
    const zero = mk({
      bounds: [100, 100, 100, 100],
      attrs: { clickable: 'true', text: 'Zero' }
    })
    const root = mk({ bounds: FULLSCREEN, children: [real, zero] })

    const dump = buildDump([root])
    const result = resolvePickTarget(real, dump, { x: 100, y: 100 })

    expect(result.candidates.map((c) => c.node.id)).not.toContain(zero.id)
  })
})

// ═══════════════ 候选排序(面积升序,不分组) ═══════════════

describe('候选排序', () => {
  it('所有候选按面积升序,不分组', () => {
    const inner = mk({
      bounds: [100, 100, 200, 200], // 10000
      attrs: { clickable: 'true', text: 'Inner' }
    })
    const middle = mk({
      bounds: [50, 50, 250, 250], // 40000
      attrs: { clickable: 'true', text: 'Middle' },
      children: [inner]
    })
    const outer = mk({
      bounds: [0, 0, 1080, 2300], // 97% 大容器 —— 也平等排进去
      attrs: { clickable: 'true', 'content-desc': 'Outer' },
      children: [middle]
    })

    const dump = buildDump([outer])
    const result = resolvePickTarget(inner, dump, { x: 150, y: 150 })

    // 排序:inner(10000) < middle(40000) < outer(~2.5M)
    expect(result.candidates[0].node).toBe(inner)
    expect(result.candidates[1].node).toBe(middle)
    expect(result.candidates[2].node).toBe(outer)
  })
})

// ═══════════════ 退化 ═══════════════

describe('退化输入', () => {
  it('hit 无锚不可点,单候选 → 仍返回 hit', () => {
    const hit = mk({ bounds: [100, 100, 150, 150] })
    const root = mk({ bounds: FULLSCREEN, children: [hit] })

    const dump = buildDump([root])
    const result = resolvePickTarget(hit, dump, { x: 120, y: 120 })

    expect(result.winner.node).toBe(hit)
    expect(result.candidates).toHaveLength(1)
  })

  it('dump size 0 不崩', () => {
    const hit = mk({ bounds: [0, 0, 100, 100] })
    const dump = buildDump([hit], 0, 0)
    expect(() => resolvePickTarget(hit, dump, { x: 50, y: 50 })).not.toThrow()
  })
})
