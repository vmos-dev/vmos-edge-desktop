/**
 * selectorBuilder 域 API 测试
 *
 * 重点覆盖 selectorFields(strategy) —— 选择器结构化字段视图,作为
 * 整个项目"selector 字段语义"的单一真相源。
 *
 * 任何想展示/序列化/操作 selector 的代码都应通过这个 API 拿字段,
 * 不再各自分支判断 string | object 联合。
 */

import { describe, expect, it } from 'vitest'
import type { SelectorStrategy } from '@shared/ipc/workflow.types'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import { buildSelector, selectorFields } from '../selectorBuilder'

// ─── 测试用 UiNode 工厂 ────────────────────────────────────
let __nextId = 1000
function mk(partial: {
  className?: string
  bounds?: [number, number, number, number]
  attrs?: Record<string, string>
  children?: UiNode[]
}): UiNode {
  return {
    id: __nextId++,
    className: partial.className ?? 'android.view.View',
    depth: 0,
    bounds: partial.bounds ?? [0, 0, 100, 100],
    attrs: partial.attrs ?? {},
    children: partial.children ?? []
  }
}

describe('selectorFields — selector 结构化字段视图', () => {
  describe('字符串 value(L1 唯一锚点)按 strategy.type 推断键名', () => {
    it('text → text 键', () => {
      const s: SelectorStrategy = { type: 'text', value: '登录', stabilityScore: 95 }
      expect(selectorFields(s)).toEqual([{ key: 'text', value: '登录', raw: '登录' }])
    })

    it('id → id 键', () => {
      const s: SelectorStrategy = { type: 'id', value: 'btn_submit', stabilityScore: 80 }
      expect(selectorFields(s)).toEqual([{ key: 'id', value: 'btn_submit', raw: 'btn_submit' }])
    })

    it('point → point 键', () => {
      const s: SelectorStrategy = { type: 'point', value: '540,1123', stabilityScore: 20 }
      expect(selectorFields(s)).toEqual([{ key: 'point', value: '540,1123', raw: '540,1123' }])
    })
  })

  describe('对象 value(L2 带消歧)按对象键名展开', () => {
    it('text + index 拆成两个字段,index 独立可见', () => {
      const s: SelectorStrategy = {
        type: 'text',
        value: { text: '推荐', index: 2 },
        stabilityScore: 75
      }
      expect(selectorFields(s)).toEqual([
        { key: 'text', value: '推荐', raw: '推荐' },
        { key: 'index', value: '2', raw: 2 }
      ])
    })

    it('id + index', () => {
      const s: SelectorStrategy = {
        type: 'id',
        value: { id: 'item', index: 0 },
        stabilityScore: 70
      }
      expect(selectorFields(s)).toEqual([
        { key: 'id', value: 'item', raw: 'item' },
        { key: 'index', value: '0', raw: 0 }
      ])
    })
  })

  describe('边界:不同类型值都有合理表示', () => {
    it('null/undefined value 返回空数组', () => {
      expect(selectorFields({ type: 'text', value: null, stabilityScore: 0 })).toEqual([])
      expect(selectorFields({ type: 'text', value: undefined, stabilityScore: 0 })).toEqual([])
    })

    it('数字/布尔 value 用 type 默认键名 + String 化', () => {
      expect(
        selectorFields({ type: 'text', value: 42 as unknown as string, stabilityScore: 0 })
      ).toEqual([{ key: 'text', value: '42', raw: 42 }])
      expect(
        selectorFields({ type: 'text', value: true as unknown as string, stabilityScore: 0 })
      ).toEqual([{ key: 'text', value: 'true', raw: true }])
    })

    it('对象嵌套对象时,内层值 JSON 化(罕见,兜底)', () => {
      const s: SelectorStrategy = {
        type: 'traits',
        value: { hint: { kind: 'long-press', payload: 1 } },
        stabilityScore: 50
      }
      expect(selectorFields(s)).toEqual([
        {
          key: 'hint',
          value: '{"kind":"long-press","payload":1}',
          raw: { kind: 'long-press', payload: 1 }
        }
      ])
    })
  })
})

// ═══════════════ buildSelector · Maestro 基线 ═══════════════

describe('buildSelector · Maestro 基线(不升档、不借子树)', () => {
  it('node 自带 text → primary = text(95)', () => {
    const node = mk({ attrs: { text: 'Login', clickable: 'true' } })
    const sel = buildSelector(node)
    expect(sel.primary.type).toBe('text')
    expect(sel.primary.value).toBe('Login')
    expect(sel.primary.stabilityScore).toBe(95)
  })

  it('node 自带 content-desc → primary = text(95)', () => {
    const node = mk({ attrs: { 'content-desc': '关闭', clickable: 'true' } })
    const sel = buildSelector(node)
    expect(sel.primary.type).toBe('text')
    expect(sel.primary.value).toBe('关闭')
    expect(sel.primary.stabilityScore).toBe(95)
  })

  it('node 自带 resource-id 唯一 → primary = id(90)', () => {
    const node = mk({
      attrs: { 'resource-id': 'com.app:id/btn_submit', clickable: 'true' }
    })
    const sel = buildSelector(node)
    expect(sel.primary.type).toBe('id')
    expect(sel.primary.value).toBe('btn_submit')
    expect(sel.primary.stabilityScore).toBe(90)
  })

  it('node 完全无锚 → primary = point(20)', () => {
    const node = mk({ attrs: {} })
    const sel = buildSelector(node)
    expect(sel.primary.type).toBe('point')
    expect(sel.primary.stabilityScore).toBe(20)
  })

  it('node 无锚但子树有锚 → 仍然 primary = point(不借子树)', () => {
    const textLeaf = mk({ attrs: { text: 'Home' } })
    const container = mk({
      attrs: { clickable: 'true' },
      children: [textLeaf]
    })
    const sel = buildSelector(container)
    // Maestro 基线:container 自身没 text/desc/id,即使子树有也不借
    expect(sel.primary.type).toBe('point')
  })

  it('node 有 text+index 消歧 → primary = text+index(80)', () => {
    const node = mk({
      attrs: { text: 'Item', clickable: 'true' }
    })
    node.textIndex = 2
    const sel = buildSelector(node)
    expect(sel.primary.type).toBe('text')
    expect(sel.primary.value).toEqual({ text: 'Item', index: 2 })
    expect(sel.primary.stabilityScore).toBe(80)
  })

  it('fallbacks 里不会有 spatial 策略(基线不生成)', () => {
    const node = mk({
      attrs: { text: 'Login', 'resource-id': 'com.app:id/btn', clickable: 'true' }
    })
    const sel = buildSelector(node)
    const hasSpatial = sel.fallbacks?.some((s) => s.type === 'spatial') ?? false
    expect(hasSpatial).toBe(false)
  })
})
