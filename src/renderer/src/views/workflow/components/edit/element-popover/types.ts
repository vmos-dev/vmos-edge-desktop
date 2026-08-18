import type { Recommendation } from '@shared/ipc/workflow.types'
import type { ActionRule } from '../../../types'
import type { CategoryStyle } from '../../../utils/actionCategoryStyle'

export type ElementPopoverMode = 'actions' | 'details'

export type ElementPopoverApplyPayload =
  | { kind: 'recommendation'; rec: Recommendation }
  | { kind: 'action'; rule: ActionRule }

export interface ElementPopoverHeading {
  title: string
  subtitle: string
}

export interface ElementPropertyRow {
  key: string
  value: string
  copyable?: boolean
  copyValue?: string
}

/**
 * 选择器策略的结构化字段展示项。
 *
 * 架构动机:selector value 可能是字符串(L1 唯一锚点)或对象(L2 带 index 消歧)。
 * 旧实现把对象 JSON.stringify 成单一字符串,index 等字段被埋在 JSON blob 里,
 * 用户看不清。新实现把 value 拆成字段列表,UI 分行渲染。
 *
 * 约定:
 *   - 字符串 value(如 text: "推荐") → [{ key: 'text', value: '推荐' }]
 *   - 对象 value(如 { text, index }) → 每个键一行
 */
export interface SelectorField {
  key: string
  value: string
}

export interface SelectorStrategyRow {
  label: string
  /** 结构化字段 —— 每个键一行,index 等关键字独立展示,不再埋在 JSON 里 */
  fields: SelectorField[]
  reasonText: string
  score: number
  level: 'ok' | 'warn' | 'bad'
  isPrimary: boolean
}

export interface ElementActionListItem {
  label: string
  description: string
  score: number
  rule: ActionRule
  style: CategoryStyle
}

export interface ElementRecommendationCard {
  title: string
  reason: string
  helperText: string
  actionLabel: string
  rec: Recommendation
  style: CategoryStyle
}
