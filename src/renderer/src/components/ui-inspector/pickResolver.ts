/**
 * pickResolver · Maestro 基线 + 候选收集
 *
 * winner 对齐 Maestro Studio:findNodeAtPoint 返回什么就用什么(不升档、不按大小归组)
 *
 * candidates 只做"展示"用途:
 *   - 收集点击点上所有 clickable / anchored 节点
 *   - 按面积升序排(更具体的在前)
 *   - 不按面积大小区别对待,对齐 Maestro 的"平等展示"原则
 *
 * 用户在 UI 里可以手动切到其它候选,inspected 跟随切换;
 * 但算法本身不替用户做升档判断,也不标注"大区域"这类主观提示。
 */

import type { DumpResult, UiNode } from './types'
import { hasInteractiveTrait, isInputControl } from './nodeCriteria'

export interface PickCandidate {
  node: UiNode
  area: number
}

export interface PickResult {
  /** Maestro 基线:winner 就是 findNodeAtPoint 给的 hit,不升档 */
  winner: PickCandidate
  /**
   * 点击栈上的所有候选(含 hit + bounds 含点击点 ∧ clickable/anchored 的节点)
   * 按面积升序排(更具体的在前),winner 恒在 candidates 里
   */
  candidates: PickCandidate[]
}

// ═══════════════ 工具 ═══════════════

function hasStrongAnchor(node: UiNode): boolean {
  return Boolean(
    node.attrs['text']?.trim() ||
    node.attrs['content-desc']?.trim() ||
    node.attrs['resource-id']?.trim()
  )
}

function isClickableTarget(node: UiNode): boolean {
  return hasInteractiveTrait(node) || isInputControl(node)
}

function nodeArea(node: UiNode): number {
  const [x1, y1, x2, y2] = node.bounds
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
}

function boundsContains(
  bounds: readonly [number, number, number, number],
  x: number,
  y: number
): boolean {
  return x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3]
}

// ═══════════════ 主算法 ═══════════════

export function resolvePickTarget(
  hit: UiNode,
  dump: DumpResult,
  clickPoint: { x: number; y: number }
): PickResult {
  const { x: cx, y: cy } = clickPoint

  // 1. 收集候选:hit 恒入池 + dump 里所有"含点击点 ∧ (clickable ∨ anchored) ∧ 面积 > 0"的节点
  const seenIds = new Set<number>([hit.id])
  const pool: UiNode[] = [hit]

  for (const node of dump.nodes) {
    if (seenIds.has(node.id)) continue
    if (nodeArea(node) === 0) continue
    if (!boundsContains(node.bounds, cx, cy)) continue
    if (!isClickableTarget(node) && !hasStrongAnchor(node)) continue
    seenIds.add(node.id)
    pool.push(node)
  }

  // 2. 包装 + 排序(面积升序,更具体的在前)
  const candidates: PickCandidate[] = pool
    .map((n) => ({ node: n, area: nodeArea(n) }))
    .sort((a, b) => a.area - b.area)

  // 3. winner 始终是 hit (Maestro 基线:不升档)
  const winner = candidates.find((c) => c.node === hit) ?? candidates[0]

  return { winner, candidates }
}
