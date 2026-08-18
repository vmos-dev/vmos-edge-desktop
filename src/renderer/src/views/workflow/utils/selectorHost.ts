/**
 * Selector Host 决策
 *
 * 架构澄清:在 Android 自动化里,有两个独立的概念
 *
 *   1. 执行目标(execution target)
 *      —— runtime 真正被触发的节点。Android 点击事件会冒泡到最近 clickable 祖先,
 *         所以用户点 TextView,onClick 在父 LinearLayout 触发。
 *         findEffectiveTarget 计算的就是这个。
 *
 *   2. 选择器宿主(selector host)
 *      —— selector 语义指向的节点。flow-engine 用 selector 定位元素、取 bounding box
 *         中心点击。对 click 类动作,选哪个节点当宿主不影响最终触发(落在
 *         [源节点.bounds] 或 [执行目标.bounds] 的中心,都会通过冒泡打到同一个 onClick)。
 *         所以应该在"selector 更稳"的节点上建 selector。
 *
 * 对 input 类动作,两者必须一致:
 *   inputText 要求 selector 直接命中 editable 节点,否则输入丢失。
 *
 * 这个函数是架构级策略 —— 任何 step 物化(apply 路径)都应该调用它决定
 * selector host,不要再直接给 target 当 selector。
 */

import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { ActionType } from '@shared/ipc/workflow.types'
import { buildSelector } from './selectorBuilder'
import { isEditable } from './nodeAttr'

/** 必须直接命中目标节点的动作(selector 不能指向源/祖先) */
const INPUT_LIKE_ACTIONS: ReadonlySet<string> = new Set(['inputText', 'eraseText', 'pasteText'])

/**
 * 决定 step 的 selector 应该宿主在哪个节点。
 *
 * - input 类:force 用 target(前提 target editable);target 不 editable 时回退 source
 * - 其他类:在 source / target 中挑 selector 更稳定的那个
 */
export function chooseSelectorHost(action: ActionType, source: UiNode, target: UiNode): UiNode {
  if (source === target) return source

  if (INPUT_LIKE_ACTIONS.has(action)) {
    return isEditable(target) ? target : source
  }

  // click-like / scroll-like / verify-like / read-like:按 selector 稳定度挑
  const srcScore = buildSelector(source).primary.stabilityScore
  const tgtScore = buildSelector(target).primary.stabilityScore
  return srcScore >= tgtScore ? source : target
}
