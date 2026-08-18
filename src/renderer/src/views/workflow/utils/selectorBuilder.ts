/**
 * 选择器构造器
 *
 * 从 UiNode 产出 Selector(primary + fallback 列表),带稳定度评分
 * 与 ui-inspector/commandGenerator 思路一致但输出结构不同:
 *   - commandGenerator 输出 YAML 字符串建议(UI 展示)
 *   - selectorBuilder 输出 Selector 对象(入 Step 数据)
 *
 * 策略优先级(对齐 Maestro Studio):
 *   L1 text / desc / id 任一唯一 → 主选择器
 *   L2 组合 index 消歧 → 次选
 *   L3 坐标兜底
 *
 * 注:这里**不做祖先升档或子树借文本**,保持 Maestro Studio 纯净行为。
 *   选什么节点由 pickResolver 决定,本模块只对单节点生成候选。
 */

import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { Selector, SelectorStrategy } from '../types'
import { scoreStrategy } from './stabilityScore'

function getShortId(rid: string): string {
  const idx = rid.lastIndexOf('/')
  return idx >= 0 ? rid.substring(idx + 1) : rid
}

/**
 * 生成候选策略(按优先级排序)
 */
function resolveCandidates(
  node: UiNode,
  screen?: { width: number; height: number }
): Array<Omit<SelectorStrategy, 'stabilityScore'>> {
  const text = node.attrs['text']
  const desc = node.attrs['content-desc']
  const rid = node.attrs['resource-id']
  const [x1, y1, x2, y2] = node.bounds
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  const point =
    screen && screen.width > 0 && screen.height > 0
      ? `${Math.round((cx / screen.width) * 100)}%,${Math.round((cy / screen.height) * 100)}%`
      : `${Math.round(cx)},${Math.round(cy)}`

  const candidates: Array<Omit<SelectorStrategy, 'stabilityScore'>> = []

  // L1 - 单个唯一
  if (text && typeof node.textIndex !== 'number') {
    candidates.push({ type: 'text', value: text })
  }
  if (desc && desc !== text && typeof node.contentDescIndex !== 'number') {
    candidates.push({ type: 'text', value: desc })
  }
  if (rid && typeof node.resourceIdIndex !== 'number') {
    candidates.push({ type: 'id', value: getShortId(rid) })
  }

  // L2 - 组合 index 消歧
  if (text && typeof node.textIndex === 'number') {
    candidates.push({ type: 'text', value: { text, index: node.textIndex } })
  }
  if (desc && desc !== text && typeof node.contentDescIndex === 'number') {
    candidates.push({ type: 'text', value: { text: desc, index: node.contentDescIndex } })
  }
  if (rid && typeof node.resourceIdIndex === 'number') {
    candidates.push({ type: 'id', value: { id: getShortId(rid), index: node.resourceIdIndex } })
  }

  // L3 - 坐标兜底(始终保留作为最后一根稻草)
  candidates.push({ type: 'point', value: point })

  return candidates
}

/**
 * 为 UiNode 生成 Selector(主选择器 + 所有 fallback)
 *
 * 返回数组第一项为 primary,其余为 fallbacks
 */
export function buildSelector(node: UiNode, screen?: { width: number; height: number }): Selector {
  const candidates = resolveCandidates(node, screen)
  const strategies: SelectorStrategy[] = candidates.map((c) => ({
    ...c,
    stabilityScore: scoreStrategy(c)
  }))

  // 按稳定度降序(primary 应该是最稳的)
  strategies.sort((a, b) => b.stabilityScore - a.stabilityScore)

  const [primary, ...fallbacks] = strategies
  return {
    primary,
    fallbacks: fallbacks.length > 0 ? fallbacks : undefined
  }
}

/**
 * 整体选择器的稳定度 = 主选择器的稳定度
 */
export function overallStability(selector: Selector): 'ok' | 'warn' | 'bad' {
  const score = selector.primary.stabilityScore
  if (score >= 80) return 'ok'
  if (score >= 50) return 'warn'
  return 'bad'
}

// ═══════════════ Selector 的"字段视图" —— 单一真相源 ═══════════════
//
// 架构动机:
//   SelectorStrategy.value 是 string | object 联合类型(为了 YAML 兼容紧凑写法)。
//   旧实现里每个消费者(UI 详情面板 / YAML serializer / 表单)都自己分支判断
//   "是字符串还是对象、字段叫什么"。这是分散知识的反模式。
//
// 此函数把 selector value 解读为**结构化 key/value 列表**,作为 selectorBuilder
// 这个域的官方 API。任何想"展示 / 渲染 / 操作 selector 字段"的代码都问它,
// 不再重复联合类型分支判断。
//
// 字段语义对照(与 Maestro YAML 字段名对齐):
//   text 类型(强 anchor):       text: <visible text>  [+ index: <dup pos>]
//   id 类型(开发者 anchor):     id:   <short rid>      [+ index: <dup pos>]
//   point 类型(坐标兜底):       point: "x,y"
//   spatial / traits(预留):    按 value 对象原样展开
//
// 当 selector value 是字符串(L1 唯一锚点)时,字段名按 strategy.type 推断:
//   text → "text", id → "id", point → "point"
// 当是对象(L2 带 index 消歧 等)时,直接按对象的键名展开。

export interface SelectorField {
  /** YAML 键名,与 Maestro 字段对齐(text/id/index/point/...) */
  key: string
  /** 值的字符串展示形态(用于 UI / 日志 / 复制粘贴) */
  value: string
  /** 原始值(对象/数字/布尔等可保留)—— 给需要类型敏感的消费者 */
  raw: unknown
}

/** strategy.type → 字符串 value 时的默认字段键名 */
function defaultFieldKey(type: SelectorStrategy['type']): string {
  switch (type) {
    case 'id':
      return 'id'
    case 'point':
      return 'point'
    case 'text':
    default:
      return 'text'
  }
}

function valueToText(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map((x) => valueToText(x)).join(', ')
  // 单 key 对象(如 { text: 'Home' }) → 扁平成 'text="Home"',避免给用户看 JSON
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
    if (entries.length === 1) {
      const [k, val] = entries[0]
      return `${k}="${valueToText(val)}"`
    }
  }
  return JSON.stringify(v)
}

/**
 * 把 SelectorStrategy 解读为字段列表(选择器结构化视图)。
 *
 * 例:
 *   { type: 'text', value: '推荐' }                → [{ key: 'text', value: '推荐' }]
 *   { type: 'text', value: { text: '推荐', index: 2 } }
 *                                                  → [{ key: 'text', value: '推荐' }, { key: 'index', value: '2' }]
 *   { type: 'id', value: 'btn_login' }              → [{ key: 'id', value: 'btn_login' }]
 *   { type: 'point', value: '540,1123' }            → [{ key: 'point', value: '540,1123' }]
 *   { type: 'spatial', value: { containsChild: { text: 'Home' }, traits: ['clickable'] } }
 *       → [{ key: 'containsChild', value: 'text="Home"' }, { key: 'traits', value: 'clickable' }]
 */
export function selectorFields(strategy: SelectorStrategy): SelectorField[] {
  const v = strategy.value

  // 标量(string/number/boolean):语义键名按 type 推断
  if (v === null || v === undefined) return []
  if (typeof v !== 'object' || Array.isArray(v)) {
    return [{ key: defaultFieldKey(strategy.type), value: valueToText(v), raw: v }]
  }

  // 对象:按键名展开,值里的嵌套对象走 valueToText 友好化
  return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({
    key: k,
    value: valueToText(val),
    raw: val
  }))
}
