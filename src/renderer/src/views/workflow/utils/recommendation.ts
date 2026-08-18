/**
 * 通用自动化动作推荐器(基于 Android dump 树)
 *
 * 两阶段:
 *  1. Effective Target Resolution ── findEffectiveTarget 找到"真正应该操作的节点"
 *  2. Action Ranking              ── ACTION_RULES 对 target 打分,三档分桶
 *
 * 对外 API:
 *  - scoreAllActions(node, recContext, screen, tree?)     → 全动作评分(弹卡"其他可选动作"用)
 *  - computeRecommendation(node, context, screen, tree?)  → 顶部主推卡(单步 action)
 *  - recommendActions(sourceNode, dump, context)          → 工程级 JSON(ActionRecommendation[])
 *  - buildStep(node, action, params?)                     → 物化单步(选择器基于节点自身)
 *
 * 单步原则:
 *   推荐结果永远是"最匹配的单个 action"。后置动作(输入文字、滚动到可见等)由用户
 *   按需手动追加,不做自动多步扩展 —— 这避免了推荐器对后续意图的过度臆测。
 *
 * 所有最终 action 字段都是现有 ACTION_RULES 中的 ActionType,不发明新动作。
 */

import type { UiNode, DumpResult } from '@renderer/components/ui-inspector/types'
import type { ActionType, ElementType, Recommendation, Step } from '@shared/ipc/workflow.types'
import type {
  ActionBuckets,
  ActionRecommendation,
  ActionScoreContext,
  EffectiveTarget,
  NodeTreeContext,
  RecommendationContext,
  ScoredAction,
  TargetCandidate
} from '../types'
import {
  ACTION_RULES,
  BUCKET_THRESHOLDS,
  COMPOSITE_SCORE_WEIGHTS,
  ELEMENT_CLASS_MAP
} from '../constants'
import { buildSelector, overallStability } from './selectorBuilder'
import { buildTreeContext } from './nodeTreeContext'
import { findEffectiveTarget } from './targetResolver'
import { chooseSelectorHost } from './selectorHost'
import { actionLabel, getActionDefinition } from './actionRegistry'
import { extractSignals } from './nodeAttr'
import { t } from '@renderer/locales'

// ═══════════════ 元素类型(只用于 Step.metadata 持久化) ═══════════════

export function detectElementType(node: UiNode): ElementType {
  const cls = node.className || ''
  const attrs = node.attrs || {}
  const text = attrs['text'] || ''
  const clickable = attrs['clickable'] === 'true' || attrs['clickable'] === '1'
  const enabled = attrs['enabled'] !== 'false' && attrs['enabled'] !== '0'

  const byClass = ELEMENT_CLASS_MAP[cls] as ElementType | undefined
  if (byClass) {
    if (byClass === 'input-empty') {
      return text.trim().length > 0 ? 'input-filled' : 'input-empty'
    }
    if (byClass === 'image') {
      return clickable ? 'image-button' : 'image'
    }
    return byClass
  }
  if (clickable && enabled) return 'button'
  if (text.trim().length > 0) return 'text'
  return 'unknown'
}

// ═══════════════ Step 构造器 ═══════════════

/**
 * 构造一个 Step。params 未指定时从 actionRegistry.defaultParams({node}) 取
 * **节点感知默认值**,保证 recommendation 链路产出的步骤总是带最合理初值。
 *
 * 架构约定:
 *   - 每个 action 在 actionRegistry 里必须显式声明 defaultParams
 *   - defaultParams 接收节点上下文,据此推断合理默认
 *     (例:swipe 在横向 ViewPager 默认 LEFT;在竖向 feed 默认 UP)
 *   - 类型层强制无遗漏,不会因忘记维护而退化成裸命令
 */
export function buildStep(
  node: UiNode,
  action: ActionType,
  params?: Step['params'],
  screen?: { width: number; height: number }
): Omit<Step, 'id'> {
  const selector = buildSelector(node, screen)
  const def = getActionDefinition(action)
  const effectiveParams = params ?? def?.defaultParams({ node }) ?? undefined
  return {
    action,
    selector,
    stability: overallStability(selector),
    params: effectiveParams,
    metadata: {
      elementType: detectElementType(node),
      capturedAt: Date.now()
    }
  }
}

// ═══════════════ 打分 + 分桶 ═══════════════

function bucketOf(score: number): ScoredAction['bucket'] {
  if (score >= BUCKET_THRESHOLDS.top) return 'top'
  if (score >= BUCKET_THRESHOLDS.ok) return 'ok'
  return 'more'
}

/**
 * 对所有动作评分并三档分桶,每档按分降序。0 分的直接剔除。
 *
 * effective target 解析策略(按优先级):
 *   1. 调用方传入 effectiveTarget → 直接使用(避免 ViewModel 重复计算)
 *   2. 传入 tree,effectiveTarget 未传 → 内部 findEffectiveTarget
 *   3. 都没传 → 退化为只对 source 打分(向后兼容,legacy 测试走这条路径)
 */
export function scoreAllActions(
  node: UiNode,
  recContext: RecommendationContext,
  screen?: { width: number; height: number },
  tree?: NodeTreeContext,
  effectiveTarget?: EffectiveTarget
): ActionBuckets {
  const et = effectiveTarget ?? (tree ? findEffectiveTarget(node, tree, 'generic') : undefined)
  const targetNode = et?.target ?? node
  const ctx: ActionScoreContext = {
    node: targetNode,
    signals: extractSignals(targetNode, screen, tree),
    effectiveTarget: et,
    recContext,
    screen
  }

  const scored: ScoredAction[] = ACTION_RULES.map((rule) => {
    const value = Math.max(0, Math.min(100, Math.round(rule.score(ctx))))
    return { rule, value, bucket: bucketOf(value) }
  }).filter((s) => s.value > 0)

  scored.sort((a, b) => b.value - a.value)

  return {
    top: scored.filter((s) => s.bucket === 'top'),
    ok: scored.filter((s) => s.bucket === 'ok'),
    more: scored.filter((s) => s.bucket === 'more')
  }
}

// ═══════════════ YAML 预览(推荐卡展示用) ═══════════════

function formatYamlValue(value: unknown): string {
  return JSON.stringify(value)
}

function selectorToYaml(step: Omit<Step, 'id'>): string | null {
  const primary = step.selector?.primary
  if (!primary || primary.value === undefined) return null
  const v = primary.value
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
    return entries.map(([k, val]) => `${k}: ${formatYamlValue(val)}`).join(', ')
  }
  if (primary.type === 'id') return `id: ${formatYamlValue(v)}`
  if (primary.type === 'point') return `point: ${formatYamlValue(v)}`
  return formatYamlValue(v)
}

function stepToYamlLine(step: Omit<Step, 'id'>): string {
  const selYaml = selectorToYaml(step)

  switch (step.action) {
    case 'tapOn':
    case 'longPressOn':
    case 'doubleTapOn':
    case 'assertVisible':
    case 'assertNotVisible':
    case 'copyTextFrom':
    case 'scrollUntilVisible':
      return selYaml ? `- ${step.action}: ${selYaml}` : `- ${step.action}`
    case 'inputText':
      return `- inputText: "${step.params?.text ?? '...'}"`
    case 'eraseText':
      return '- eraseText'
    case 'pasteText':
      return '- pasteText'
    case 'sleep':
      return `- sleep: ${step.params?.duration ?? 1000}`
    default:
      return selYaml ? `- ${step.action}: ${selYaml}` : `- ${step.action}`
  }
}

export function toYamlPreview(steps: Array<Omit<Step, 'id'>>): string[] {
  return steps.map(stepToYamlLine)
}

// ═══════════════ 推荐主卡(✨ 推荐给你) ═══════════════

const RELATION_KEY_MAP: Record<string, string> = {
  'ancestor-clickable': 'ancestorClickable',
  'ancestor-scrollable': 'ancestorScrollable',
  'ancestor-editable': 'ancestorEditable',
  'ancestor-checkable': 'ancestorCheckable',
  'ancestor-focusable': 'ancestorFocusable',
  self: 'self'
}

function relationLabel(r: TargetCandidate['relation']): string {
  const key = RELATION_KEY_MAP[r] ?? 'self'
  return t(`workflow.recommendation.${key}`)
}

function reasonFor(top: ScoredAction, et?: EffectiveTarget): string {
  const label = actionLabel(top.rule.id)
  if (et && et.source.id !== et.target.id) {
    const rel = et.candidates.find((c) => c.node.id === et.target.id)?.relation ?? 'self'
    return t('workflow.recommendation.upgraded', {
      relation: relationLabel(rel),
      action: label,
      score: top.value
    })
  }
  return t('workflow.recommendation.bestMatch', { action: label, score: top.value })
}

/**
 * 决定顶部主推卡:
 * 1. 先做 effective target resolution(若提供 tree)
 * 2. 从所有动作评分结果中取分数最高的动作
 * 3. 以该 action 物化为单步(buildStep)
 * 4. 若没有可用动作则返回 null
 */
export function computeRecommendation(
  node: UiNode,
  context: RecommendationContext,
  screen?: { width: number; height: number },
  tree?: NodeTreeContext,
  effectiveTarget?: EffectiveTarget
): Recommendation | null {
  const et = effectiveTarget ?? (tree ? findEffectiveTarget(node, tree, 'generic') : undefined)
  const target = et?.target ?? node

  const buckets = scoreAllActions(node, context, screen, tree, et)
  const top = buckets.top[0] ?? buckets.ok[0]
  if (!top) return null

  // selector host 仍需 chooseSelectorHost 决策:tapOn 落在 source(有 text 的 TextView),
  // inputText 必须落在 target(EditText),否则输入丢失
  const host = chooseSelectorHost(top.rule.id, node, target)
  const steps = [buildStep(host, top.rule.id, undefined, screen)]
  return {
    action: top.rule.id,
    title: actionLabel(top.rule.id),
    icon: top.rule.icon,
    steps,
    yamlPreview: toYamlPreview(steps),
    priority: top.value,
    reason: reasonFor(top, et)
  }
}

// ═══════════════ 工程级推荐主流程 ═══════════════

/**
 * 通用动作推荐主流程,输出结构化 JSON 列表。
 *
 * 阶段 1: effective target resolution —— 找出真正应该操作的节点
 * 阶段 2: action ranking —— 对 ACTION_RULES 打分排序
 *
 * 输出每一项的 action 字段都是现有 ActionType(不发明新动作)。
 * 适合 Agent/CLI/测试场景消费;UI 弹卡仍走 computeRecommendation + scoreAllActions。
 */
export function recommendActions(
  sourceNode: UiNode,
  dump: DumpResult,
  context: RecommendationContext = emptyContext()
): ActionRecommendation[] {
  const tree = buildTreeContext(dump)
  const et = findEffectiveTarget(sourceNode, tree, 'generic')
  const screen = tree.screen

  // 把 et 作为入参传进去,避免 scoreAllActions 再算一次
  const buckets = scoreAllActions(sourceNode, context, screen, tree, et)
  const allScored: ScoredAction[] = [...buckets.top, ...buckets.ok, ...buckets.more]

  return allScored.map((sa): ActionRecommendation => {
    const host = chooseSelectorHost(sa.rule.id, et.source, et.target)
    const steps = [buildStep(host, sa.rule.id, undefined, screen)]
    const selectedCandidate =
      et.candidates.find((c) => c.node.id === et.target.id) ?? et.candidates[0]

    const composite = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          sa.value * COMPOSITE_SCORE_WEIGHTS.action +
            selectedCandidate.targetScore * COMPOSITE_SCORE_WEIGHTS.target +
            linkBonus(sa, context) * COMPOSITE_SCORE_WEIGHTS.linkBonus * 100
        )
      )
    )

    return {
      sourceId: et.source.id,
      targetId: et.target.id,
      action: sa.rule.id,
      score: composite,
      confidence: Math.min(1, composite / 100),
      reason:
        sa.rule.id === steps[0].action && steps.length === 1
          ? reasonFor(sa, et)
          : t('workflow.recommendation.multiStep', {
              steps: steps.map((s) => s.action).join(' → ')
            }),
      featuresUsed: [...selectedCandidate.featuresUsed, `action.${sa.rule.id}=${sa.value}`],
      steps,
      bucket: sa.bucket
    }
  })
}

function linkBonus(sa: ScoredAction, ctx: RecommendationContext): number {
  const last = ctx.lastAction
  if (!last) return 0
  if (last === 'inputText' && sa.rule.id === 'tapOn') return 0.15
  if (last === 'scrollUntilVisible' && sa.rule.id === 'tapOn') return 0.2
  if (last === 'tapOn' && sa.rule.id === 'inputText') return 0.15
  return 0
}

// ═══════════════ 空上下文(初次调用/测试用) ═══════════════

export function emptyContext(): RecommendationContext {
  return {
    hasVariableUsage: false,
    stepCount: 0
  }
}
