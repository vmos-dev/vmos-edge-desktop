import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { Selector, SelectorStrategy } from '@shared/ipc/workflow.types'
import type {
  ElementPopoverHeading,
  ElementPropertyRow,
  SelectorStrategyRow
} from '../components/edit/element-popover/types'
import { scoreToLevel } from './stabilityScore'
import { selectorFields } from './selectorBuilder'
import { t } from '@renderer/locales'

function getShortClassName(className: string | undefined): string {
  if (!className) return t('workflow.popover.element')
  const segments = className.split('.')
  return segments[segments.length - 1] || t('workflow.popover.element')
}

function getShortResourceId(resourceId: string | undefined): string {
  if (!resourceId) return ''
  const idx = resourceId.lastIndexOf('/')
  return idx >= 0 ? resourceId.slice(idx + 1) : resourceId
}

function pushRow(
  rows: ElementPropertyRow[],
  key: string,
  value: string | number | undefined,
  options: { copyable?: boolean; copyValue?: string } = {}
): void {
  if (value == null || value === '') return
  rows.push({
    key,
    value: String(value),
    copyable: options.copyable,
    copyValue: options.copyValue ?? (value == null ? undefined : String(value))
  })
}

/** 从 attrs 里取 attrKey,非空才入;key 显示成自定义 label,默认 copyable */
function pushAttr(
  rows: ElementPropertyRow[],
  attrs: Record<string, string>,
  attrKey: string,
  label: string = attrKey
): void {
  const value = attrs[attrKey]
  if (value == null || value === '') return
  rows.push({ key: label, value, copyable: true, copyValue: value })
}

function strategyLabel(strategy: SelectorStrategy): string {
  switch (strategy.type) {
    case 'text':
      return typeof strategy.value === 'object' && strategy.value && 'index' in strategy.value
        ? t('workflow.popover.strategyTextIndexed')
        : t('workflow.popover.strategyText')
    case 'id':
      return typeof strategy.value === 'object' && strategy.value && 'index' in strategy.value
        ? t('workflow.popover.strategyIdIndexed')
        : t('workflow.popover.strategyId')
    case 'spatial':
      return t('workflow.popover.strategySpatial')
    case 'traits':
      return t('workflow.popover.strategyTraits')
    case 'point':
      return t('workflow.popover.strategyPoint')
    default:
      return strategy.type
  }
}

function strategyReason(score: number): string {
  if (score >= 90) return t('workflow.popover.reasonUnique')
  if (score >= 75) return t('workflow.popover.reasonIndexed')
  if (score >= 50) return t('workflow.popover.reasonMayChange')
  return t('workflow.popover.reasonFragile')
}

export function buildElementHeading(node: UiNode): ElementPopoverHeading {
  const title =
    node.attrs['text'] ||
    node.attrs['content-desc'] ||
    getShortClassName(node.className) ||
    t('workflow.popover.element')

  return {
    title,
    subtitle: getShortResourceId(node.attrs['resource-id'])
  }
}

/**
 * 已经用独立展示字段覆盖或由派生字段代替的原始 attr key,遍历时跳过避免重复。
 * - resource-id / text / content-desc / hint-text / package / bounds:前面已显式渲染
 * - class:由 node.className 直接派生(dump 里也存了 attrs.class,二选一即可)
 */
const HANDLED_ATTR_KEYS = new Set([
  'resource-id',
  'text',
  'content-desc',
  'hint-text',
  'hint',
  'package',
  'bounds',
  'class'
])

export function buildPropertyRows(node: UiNode): ElementPropertyRow[] {
  const rows: ElementPropertyRow[] = []
  const [x1, y1, x2, y2] = node.bounds
  const centerX = Math.round((x1 + x2) / 2)
  const centerY = Math.round((y1 + y2) / 2)

  // ── 1. 锚相关属性(重要优先) ────────
  pushAttr(rows, node.attrs, 'resource-id', 'id')
  pushAttr(rows, node.attrs, 'text', 'text')
  pushAttr(rows, node.attrs, 'content-desc', 'desc')
  // 兼容两种 hint 字段写法
  pushAttr(rows, node.attrs, 'hint-text', 'hint')
  pushAttr(rows, node.attrs, 'hint', 'hint')
  pushRow(rows, 'class', node.className, { copyable: true })
  pushAttr(rows, node.attrs, 'package', 'package')

  // ── 2. 几何 ────────
  pushRow(rows, 'bounds', `[${x1},${y1}][${x2},${y2}]`, { copyable: true })
  pushRow(rows, 'center', `${centerX}, ${centerY}`, { copyable: true })
  pushRow(rows, 'size', `${x2 - x1} × ${y2 - y1} px`)

  // ── 3. 重复消歧索引(UiNode 特有字段) ────────
  pushRow(rows, 'textIndex', node.textIndex)
  pushRow(rows, 'resourceIdIndex', node.resourceIdIndex)
  pushRow(rows, 'contentDescIndex', node.contentDescIndex)

  // ── 4. 剩余所有 attrs(布尔 trait 等),按字母序输出 ────────
  // dump 里的每一条属性都要给用户看,方便排查自定义 attr / 新 Android 版本新增字段
  const restKeys = Object.keys(node.attrs)
    .filter((k) => !HANDLED_ATTR_KEYS.has(k) && node.attrs[k] !== '')
    .sort()
  for (const key of restKeys) {
    pushRow(rows, key, node.attrs[key])
  }

  return rows
}

export function buildSelectorRows(selector: Selector): SelectorStrategyRow[] {
  const strategies = [selector.primary, ...(selector.fallbacks ?? [])]

  return strategies.map((strategy, index) => ({
    label: strategyLabel(strategy),
    // 选择器字段视图来自 selectorBuilder.selectorFields —— 单一真相源
    fields: selectorFields(strategy).map((f) => ({ key: f.key, value: f.value })),
    reasonText: strategyReason(strategy.stabilityScore),
    score: strategy.stabilityScore,
    level: scoreToLevel(strategy.stabilityScore),
    isPrimary: index === 0
  }))
}
