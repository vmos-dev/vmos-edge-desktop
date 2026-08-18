/**
 * 从 DumpResult 构建节点树的父子反向索引。
 *
 * UiNode 本身没有 parent 字段,为避免侵入 dump 解析器,
 * 推荐器在调用前一次性构建 O(N) 索引。
 */

import type { UiNode, DumpResult } from '@renderer/components/ui-inspector/types'
import type { NodeTreeContext } from '../types'

export function buildTreeContext(dump: DumpResult): NodeTreeContext {
  const parentMap = new Map<number, UiNode>()
  const nodeMap = new Map<number, UiNode>()

  const walk = (node: UiNode, parent: UiNode | null): void => {
    nodeMap.set(node.id, node)
    if (parent) parentMap.set(node.id, parent)
    for (const child of node.children) walk(child, node)
  }
  for (const root of dump.tree) walk(root, null)

  return {
    roots: dump.tree,
    parentMap,
    nodeMap,
    screen: { width: dump.screenWidth, height: dump.screenHeight }
  }
}

/**
 * 向上查找第一个满足 predicate 的祖先(不含自身)。
 * 找到返回 `{ node, distance }`,distance 表示向上跳了多少层(直接父=1)。
 */
export function findAncestor(
  node: UiNode,
  tree: NodeTreeContext,
  predicate: (n: UiNode) => boolean,
  maxDepth: number = Number.POSITIVE_INFINITY
): { node: UiNode; distance: number } | null {
  let cur = tree.parentMap.get(node.id)
  let distance = 1
  while (cur && distance <= maxDepth) {
    if (predicate(cur)) return { node: cur, distance }
    cur = tree.parentMap.get(cur.id)
    distance++
  }
  return null
}
