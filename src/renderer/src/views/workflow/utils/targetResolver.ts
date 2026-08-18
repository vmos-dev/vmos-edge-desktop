/**
 * Effective Target Resolution(两阶段推荐:阶段 1)
 *
 * 目标:给定用户点击的 sourceNode,从它和它的祖先中找出"真正应该被操作的节点"。
 *
 * 候选集(按语义收集,不预先过滤):
 *  1. source 自己
 *  2. 最近 clickable 祖先
 *  3. 最近 editable 祖先(input-like 场景加分)
 *  4. 最近 scrollable 祖先(scroll-like 场景加分)
 *  5. 最近 checkable 祖先(toggle-like 场景加分)
 *  6. 最近 focusable 祖先(通用兜底)
 *
 * 评分:复用 constants.ts 的 TARGET_SCORE_WEIGHTS + 距离衰减;
 * 最终 target = candidates[0](按 targetScore 降序)
 */

import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { NodeTreeContext, EffectiveTarget, TargetCandidate, TargetKind } from '../types'
import { findAncestor } from './nodeTreeContext'
import {
  isClickable,
  isScrollable,
  isEditable,
  isCheckable,
  isFocusable,
  hasText,
  hasContentDesc,
  isEnabled
} from './nodeAttr'
import { TARGET_SCORE_WEIGHTS, TARGET_ASCEND_MAX_DEPTH } from '../constants'

export function findEffectiveTarget(
  source: UiNode,
  tree: NodeTreeContext,
  kind: TargetKind = 'generic'
): EffectiveTarget {
  const candidates: TargetCandidate[] = [scoreSelf(source)]

  const ancClick = findAncestor(source, tree, isClickable, TARGET_ASCEND_MAX_DEPTH)
  if (ancClick) {
    candidates.push({
      node: ancClick.node,
      relation: 'ancestor-clickable',
      distance: ancClick.distance,
      targetScore: distanceWeighted(ancClick.distance),
      featuresUsed: ['ancestor.clickable', `distance=${ancClick.distance}`]
    })
  }

  const ancEdit = findAncestor(source, tree, isEditable, TARGET_ASCEND_MAX_DEPTH)
  if (ancEdit) {
    candidates.push({
      node: ancEdit.node,
      relation: 'ancestor-editable',
      distance: ancEdit.distance,
      targetScore:
        kind === 'input-like'
          ? TARGET_SCORE_WEIGHTS.ancestorEditable
          : TARGET_SCORE_WEIGHTS.ancestorEditable - 20,
      featuresUsed: ['ancestor.editable', `distance=${ancEdit.distance}`]
    })
  }

  const ancScroll = findAncestor(source, tree, isScrollable, TARGET_ASCEND_MAX_DEPTH)
  if (ancScroll) {
    candidates.push({
      node: ancScroll.node,
      relation: 'ancestor-scrollable',
      distance: ancScroll.distance,
      targetScore:
        kind === 'scroll-like'
          ? TARGET_SCORE_WEIGHTS.ancestorScrollable
          : TARGET_SCORE_WEIGHTS.ancestorScrollable - 30,
      featuresUsed: ['ancestor.scrollable', `distance=${ancScroll.distance}`]
    })
  }

  const ancCheck = findAncestor(source, tree, isCheckable, TARGET_ASCEND_MAX_DEPTH)
  if (ancCheck) {
    candidates.push({
      node: ancCheck.node,
      relation: 'ancestor-checkable',
      distance: ancCheck.distance,
      targetScore:
        kind === 'toggle-like'
          ? TARGET_SCORE_WEIGHTS.ancestorCheckable
          : TARGET_SCORE_WEIGHTS.ancestorCheckable - 25,
      featuresUsed: ['ancestor.checkable', `distance=${ancCheck.distance}`]
    })
  }

  const ancFocus = findAncestor(source, tree, isFocusable, TARGET_ASCEND_MAX_DEPTH)
  if (ancFocus) {
    candidates.push({
      node: ancFocus.node,
      relation: 'ancestor-focusable',
      distance: ancFocus.distance,
      targetScore: 45,
      featuresUsed: ['ancestor.focusable', `distance=${ancFocus.distance}`]
    })
  }

  candidates.sort((a, b) => b.targetScore - a.targetScore)
  return { source, target: candidates[0].node, candidates }
}

function scoreSelf(node: UiNode): TargetCandidate {
  const features: string[] = []
  let score: number

  if (!isEnabled(node)) {
    features.push('self.disabled')
    score = 5
  } else if (isClickable(node)) {
    features.push('self.clickable')
    score = TARGET_SCORE_WEIGHTS.selfClickable
  } else if (isEditable(node)) {
    features.push('self.editable')
    score = TARGET_SCORE_WEIGHTS.ancestorEditable + 10
  } else if (isCheckable(node)) {
    features.push('self.checkable')
    score = TARGET_SCORE_WEIGHTS.ancestorCheckable + 10
  } else if (isScrollable(node)) {
    features.push('self.scrollable')
    score = TARGET_SCORE_WEIGHTS.ancestorScrollable + 10
  } else if (hasText(node) || hasContentDesc(node)) {
    features.push('self.leafWithText')
    score = TARGET_SCORE_WEIGHTS.selfLeafWithText
  } else {
    features.push('self.noFeature')
    score = 20
  }

  return {
    node,
    relation: 'self',
    distance: 0,
    targetScore: score,
    featuresUsed: features
  }
}

function distanceWeighted(distance: number): number {
  if (distance <= 1) return TARGET_SCORE_WEIGHTS.ancestorClickableDistance1
  if (distance === 2) return TARGET_SCORE_WEIGHTS.ancestorClickableDistance2
  return TARGET_SCORE_WEIGHTS.ancestorClickableDistance3Plus
}
