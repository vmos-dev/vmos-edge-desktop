/**
 * useInsertionTarget · 新步骤落地位置的解析策略
 *
 * 职责:把"插到哪"抽象成一个响应式 computed,EditView 只负责组合,不持有策略。
 *
 * 3 种来源,优先级从高到低:
 *   1. pendingInsertAfterId —— 用户刚点过 "+ 在这里插入",强意图
 *   2. YAML 光标所在步骤 —— 对齐 Android Studio Layout Editor / Dreamweaver
 *      双视图编辑器的行业做法:光标落哪个容器,新元素就插到那个容器
 *   3. append —— 兜底,追加到末尾
 *
 * 为什么光标精度到"所在步骤"而非"那一行":
 *   YAML 是结构化文本(缩进 + schema),直接字符级 splice 会破坏合法性。
 *   通过 useStepYamlMapping.stepIdForLine 把行号映射到 stepId,继续走
 *   yamlOps.insertStepAfter 这条安全路径。
 *
 * 为什么 target 是 computed 而非 getter:
 *   响应式下游可订阅 —— 未来做"提示将插到第 N 步"、"YAML 里高亮即将插入位置"
 *   这类视觉反馈时零成本。getter 要反过来让调用方手动触发更新,违反单一真相源。
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { Step } from '@shared/ipc/workflow.types'
import type { InsertionTarget } from './usePickToInsert'
import { useStepYamlMapping } from './useStepYamlMapping'

interface UseInsertionTargetOptions {
  /** 当前步骤树(解析 YAML 得到)*/
  steps: Ref<readonly Step[]>
  /** 当前 YAML 文本 */
  yamlText: Ref<string>
  /** YAML 编辑器的光标行号(0 = 编辑器未就绪 / 不在 yaml 视图)*/
  yamlCursorLine: Ref<number>
}

export interface UseInsertionTargetResult {
  /** 下一次 apply 应该把新步骤写到哪里 */
  target: ComputedRef<InsertionTarget>
  /** 用户显式指定"插到某步骤之后"(点 + 按钮)*/
  requestInsertAfter: (stepId: string) => void
  /** 清除显式指定(apply 成功或 Esc 取消 pick 后调用)*/
  reset: () => void
}

export function useInsertionTarget(options: UseInsertionTargetOptions): UseInsertionTargetResult {
  const { stepIdForLine } = useStepYamlMapping(options.steps, options.yamlText)
  const pendingInsertAfterId = ref<string | null>(null)

  const target = computed<InsertionTarget>(() => {
    if (pendingInsertAfterId.value) {
      return { kind: 'afterStep', stepId: pendingInsertAfterId.value }
    }
    const line = options.yamlCursorLine.value
    if (line > 0) {
      const stepId = stepIdForLine(line)
      if (stepId) return { kind: 'afterStep', stepId }
    }
    return { kind: 'append' }
  })

  function requestInsertAfter(stepId: string): void {
    pendingInsertAfterId.value = stepId
  }

  function reset(): void {
    pendingInsertAfterId.value = null
  }

  return { target, requestInsertAfter, reset }
}
