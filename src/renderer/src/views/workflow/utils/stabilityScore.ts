/**
 * 选择器稳定度打分
 *
 * 数值 0~100,越大越稳定。UI 用于"🟢🟡🔴"三态展示
 * 阈值:>= 80 绿 / 50~79 黄 / < 50 红
 */

import type { SelectorStrategy } from '../types'

export function scoreToLevel(score: number): 'ok' | 'warn' | 'bad' {
  if (score >= 80) return 'ok'
  if (score >= 50) return 'warn'
  return 'bad'
}

/**
 * 给单个选择器策略打分(对齐 Maestro 基线)
 * - text 唯一 = 95(最稳)
 * - id 唯一 = 90
 * - text + index 消歧 = 80
 * - id + index 消歧 = 75
 * - spatial 关系(containsChild / above / below / ...)= 65
 * - 坐标兜底 = 20
 */
export function scoreStrategy(strategy: Omit<SelectorStrategy, 'stabilityScore'>): number {
  const { type, value } = strategy

  switch (type) {
    case 'text':
      if (typeof value === 'string') return 95
      if (value && typeof value === 'object' && 'index' in value) return 80
      return 90

    case 'id':
      if (typeof value === 'string') return 90
      if (value && typeof value === 'object' && 'index' in value) return 75
      return 85

    case 'traits':
      return 70

    case 'spatial':
      return 65

    case 'point':
      return 20

    default:
      return 50
  }
}
