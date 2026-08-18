import { describe, expect, it } from 'vitest'
import type { UiNode } from '../types'
import {
  classifyNode,
  hasSemanticAnchor,
  hasInteractiveTrait,
  isInputControl,
  isInteractable
} from '../nodeCriteria'
import { PLAY_GAMES_INCLUDE_CASES, PLAY_GAMES_EXCLUDE_CASES } from './fixtures/playGamesDump'

// ──────────────── 手工节点 builder(单准则单测) ────────────────

function node(overrides: Partial<UiNode> = {}): UiNode {
  return {
    id: 0,
    className: 'android.widget.FrameLayout',
    depth: 0,
    bounds: [0, 0, 100, 100],
    attrs: {},
    children: [],
    ...overrides
  }
}

describe('isInteractable — unit coverage of the three criteria', () => {
  it('前置:面积 — excludes zero-area nodes regardless of traits', () => {
    const n = node({
      bounds: [10, 20, 10, 20],
      attrs: { clickable: 'true', text: '点我' }
    })
    expect(isInteractable(n)).toBe(false)
  })

  describe('criterion A — semantic anchor (Android isImportantForAccessibility)', () => {
    it('accepts non-empty text', () => {
      expect(hasSemanticAnchor(node({ attrs: { text: '标题' } }))).toBe(true)
    })
    it('accepts non-empty content-desc', () => {
      expect(hasSemanticAnchor(node({ attrs: { 'content-desc': '搜索' } }))).toBe(true)
    })
    it('rejects whitespace-only text (Android behavior)', () => {
      expect(hasSemanticAnchor(node({ attrs: { text: '   ' } }))).toBe(false)
    })
    it('rejects empty attrs', () => {
      expect(hasSemanticAnchor(node())).toBe(false)
    })
  })

  describe('criterion B — interactive trait (Android isActionableForAccessibility + ext)', () => {
    it.each([['clickable'], ['long-clickable'], ['focusable'], ['checkable'], ['scrollable']])(
      'accepts when %s=true',
      (attr) => {
        expect(hasInteractiveTrait(node({ attrs: { [attr]: 'true' } }))).toBe(true)
      }
    )
    it('accepts legacy "1" boolean serialization', () => {
      expect(hasInteractiveTrait(node({ attrs: { clickable: '1' } }))).toBe(true)
    })
    it('rejects when all traits are explicit false', () => {
      expect(
        hasInteractiveTrait(
          node({
            attrs: {
              clickable: 'false',
              'long-clickable': 'false',
              focusable: 'false',
              checkable: 'false',
              scrollable: 'false'
            }
          })
        )
      ).toBe(false)
    })
  })

  describe('criterion C — input control (class-based)', () => {
    it.each([
      ['android.widget.EditText'],
      ['com.google.android.material.textfield.TextInputEditText'],
      ['android.widget.SearchView'],
      ['android.widget.AutoCompleteTextView']
    ])('accepts class %s', (cls) => {
      expect(isInputControl(node({ className: cls }))).toBe(true)
    })
    it('rejects non-input class', () => {
      expect(isInputControl(node({ className: 'android.widget.Button' }))).toBe(false)
    })
  })
})

// ──────────────── 真实 dump 节点回归(Play Games) ────────────────

describe('isInteractable — real dump regression (Play Games home)', () => {
  it.each(PLAY_GAMES_INCLUDE_CASES)('INCLUDES $name', ({ node: n }) => {
    expect(isInteractable(n)).toBe(true)
    const tags = classifyNode(n)
    expect(tags.length).toBeGreaterThan(0)
  })

  it.each(PLAY_GAMES_EXCLUDE_CASES)('EXCLUDES $name', ({ node: n }) => {
    expect(isInteractable(n)).toBe(false)
  })

  it('classifyNode returns exact tag set for mixed node (Button: text + click)', () => {
    const startGame = PLAY_GAMES_INCLUDE_CASES.find((c) => c.name.startsWith('start-game'))!.node
    expect(classifyNode(startGame).sort()).toEqual(['interactive', 'semantic'])
  })

  it('classifyNode returns only interactive for focusable-only promo CardView', () => {
    const promo = PLAY_GAMES_INCLUDE_CASES.find((c) => c.name.startsWith('promo'))!.node
    expect(classifyNode(promo)).toEqual(['interactive'])
  })
})

// ──────────────── 结构性属性(防止回归) ────────────────

describe('algorithm invariants', () => {
  it('classifyNode is non-empty iff isInteractable returns true', () => {
    const samples = [
      ...PLAY_GAMES_INCLUDE_CASES.map((c) => c.node),
      ...PLAY_GAMES_EXCLUDE_CASES.map((c) => c.node)
    ]
    for (const n of samples) {
      expect(classifyNode(n).length > 0).toBe(isInteractable(n))
    }
  })

  it('disabled is NOT a filter condition (automation may want to assert disabled state)', () => {
    const disabledButton = node({
      className: 'android.widget.Button',
      bounds: [0, 0, 100, 100],
      attrs: { text: '提交', clickable: 'true', enabled: 'false' }
    })
    expect(isInteractable(disabledButton)).toBe(true)
  })
})
