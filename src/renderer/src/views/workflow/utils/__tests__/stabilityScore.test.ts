/**
 * stabilityScore · 打分表单元测试
 *
 * 关键分界(UI 的绿 / 黄 / 红):
 *   ≥ 80 绿 · 50-79 黄 · < 50 红
 */
import { describe, expect, it } from 'vitest'
import type { SelectorStrategy } from '@shared/ipc/workflow.types'
import { scoreStrategy, scoreToLevel } from '../stabilityScore'

function strat(
  type: SelectorStrategy['type'],
  value: unknown
): Omit<SelectorStrategy, 'stabilityScore'> {
  return { type, value } as Omit<SelectorStrategy, 'stabilityScore'>
}

describe('scoreStrategy', () => {
  it('text unique = 95', () => {
    expect(scoreStrategy(strat('text', 'Login'))).toBe(95)
  })

  it('text + index = 80', () => {
    expect(scoreStrategy(strat('text', { text: 'Item', index: 2 }))).toBe(80)
  })

  it('id unique = 90', () => {
    expect(scoreStrategy(strat('id', 'btn_submit'))).toBe(90)
  })

  it('id + index = 75', () => {
    expect(scoreStrategy(strat('id', { id: 'row', index: 0 }))).toBe(75)
  })

  it('spatial 关系(containsChild / below / above / leftOf / rightOf)= 65', () => {
    expect(
      scoreStrategy(strat('spatial', { containsChild: { text: 'Home' }, traits: ['clickable'] }))
    ).toBe(65)
    expect(scoreStrategy(strat('spatial', { containsDescendants: [{ text: 'A' }] }))).toBe(65)
    expect(scoreStrategy(strat('spatial', { below: { text: 'Title' } }))).toBe(65)
    expect(scoreStrategy(strat('spatial', { above: { text: 'Title' } }))).toBe(65)
    expect(scoreStrategy(strat('spatial', { leftOf: { text: 'X' } }))).toBe(65)
    expect(scoreStrategy(strat('spatial', { rightOf: { text: 'X' } }))).toBe(65)
  })

  it('traits = 70', () => {
    expect(scoreStrategy(strat('traits', { kind: 'button' }))).toBe(70)
  })

  it('point = 20', () => {
    expect(scoreStrategy(strat('point', '540,1123'))).toBe(20)
  })
})

describe('scoreToLevel', () => {
  it('≥ 80 → ok(绿)', () => {
    expect(scoreToLevel(95)).toBe('ok')
    expect(scoreToLevel(85)).toBe('ok')
    expect(scoreToLevel(80)).toBe('ok')
  })

  it('50–79 → warn(黄)', () => {
    expect(scoreToLevel(75)).toBe('warn')
    expect(scoreToLevel(65)).toBe('warn')
    expect(scoreToLevel(50)).toBe('warn')
  })

  it('< 50 → bad(红)', () => {
    expect(scoreToLevel(20)).toBe('bad')
    expect(scoreToLevel(0)).toBe('bad')
  })
})
