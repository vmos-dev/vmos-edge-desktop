/**
 * useStepYamlMapping · step id → YAML 行范围 映射
 *
 * 输入:workflow.steps(步骤树)+ 当前 YAML 文本
 * 输出:stepIdToLine map + lineForStep 查询
 *
 * 用途:WorkflowSidePanel 里点步骤 `{ }` 按钮时,跳到对应 YAML 行
 *
 * 实现:用 yaml 库的 LineCounter 解析当前文本定位每个 seq item 的行范围,
 * 再按 DFS 顺序和 steps 树并行走,把 step.id 和行范围一一对应
 *
 * YAML 非法时返回空映射(切模式 gate 会拦截,业务上看不到空映射的副作用)
 */

import { computed, type ComputedRef, type Ref } from 'vue'
import { parseAllDocuments, LineCounter, isSeq, isMap, isNode, type YAMLSeq } from 'yaml'
import type { Step } from '../types'
import { findChildCommands, findBranchArms } from '../utils/yamlAst'

export interface LineRange {
  start: number
  end: number
}

// ═══════════════ 核心:YAML AST → (stepId → 行范围) ═══════════════

/**
 * 按 DFS 顺序把 steps 树和 YAML seq 树并行走,收集映射
 * items 的长度和 steps 的长度可能不同(disabled step 跳过),按 YAML 序列顺序推进
 */
function walkSteps(
  steps: readonly Step[],
  seq: YAMLSeq,
  lineCounter: LineCounter,
  out: Map<string, LineRange>
): void {
  const items = seq.items
  let yamlIdx = 0

  for (const step of steps) {
    if (step.disabled) continue
    if (yamlIdx >= items.length) break

    const item = items[yamlIdx]
    yamlIdx++

    if (!isNode(item) || !item.range) continue

    const startPos = lineCounter.linePos(item.range[0])
    const endPos = lineCounter.linePos(Math.max(item.range[0], item.range[2] - 1))
    out.set(step.id, { start: startPos.line, end: endPos.line })

    // 递归:composite step 的 commands 子序列
    if (step.children && step.children.length > 0 && isMap(item)) {
      const childSeq = findChildCommands(item)
      if (childSeq) walkSteps(step.children, childSeq, lineCounter, out)
    }
    // branch 的 arms[i].commands
    if (step.branches && step.branches.length > 0 && isMap(item)) {
      const branchSeq = findBranchArms(item)
      if (branchSeq) {
        for (
          let armIdx = 0;
          armIdx < step.branches.length && armIdx < branchSeq.items.length;
          armIdx++
        ) {
          const arm = branchSeq.items[armIdx]
          if (!isMap(arm)) continue
          const armCmds = findChildCommands(arm)
          if (armCmds) walkSteps(step.branches[armIdx].children, armCmds, lineCounter, out)
        }
      }
    }
  }
}

// ═══════════════ Composable ═══════════════

export function useStepYamlMapping(
  steps: Ref<readonly Step[]> | ComputedRef<readonly Step[]>,
  yaml: Ref<string> | ComputedRef<string>
): {
  lineForStep: (stepId: string) => LineRange | null
  stepIdForLine: (line: number) => string | null
} {
  const stepIdToLine = computed<Map<string, LineRange>>(() => {
    const out = new Map<string, LineRange>()
    const text = yaml.value
    const stepList = steps.value
    if (!text || stepList.length === 0) return out

    try {
      const lineCounter = new LineCounter()
      const docs = parseAllDocuments(text, { lineCounter })
      const seqDoc = docs.find((d) => isSeq(d.contents))
      if (!seqDoc || !isSeq(seqDoc.contents)) return out
      walkSteps(stepList, seqDoc.contents, lineCounter, out)
    } catch {
      // YAML 非法:返回空映射,上层 gate 会阻塞切换
    }
    return out
  })

  /**
   * 行号 → 步骤 id(反向查找,用于"光标所在步骤后插入")
   *
   * 多个嵌套步骤的 range 都可能覆盖同一行(repeat 覆盖它所有子步骤的行),
   * 返回**最小范围**的那个 = 光标实际所在的最内层步骤。
   *
   * 不在任何步骤范围内(config 段、首尾空行)→ 返回 null,调用方走 append 兜底。
   */
  function stepIdForLine(line: number): string | null {
    if (line <= 0) return null
    let bestId: string | null = null
    let bestSize = Number.POSITIVE_INFINITY
    for (const [id, range] of stepIdToLine.value) {
      if (line < range.start || line > range.end) continue
      const size = range.end - range.start
      if (size < bestSize) {
        bestId = id
        bestSize = size
      }
    }
    return bestId
  }

  return {
    lineForStep: (stepId: string) => stepIdToLine.value.get(stepId) ?? null,
    stepIdForLine
  }
}
