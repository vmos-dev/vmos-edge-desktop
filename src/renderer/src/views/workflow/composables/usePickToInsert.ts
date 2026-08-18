/**
 * usePickToInsert · 元素拾取 → 推荐 → 落步骤 的完整流程
 *
 * 语义单元:
 *  - 用户在云机上点一个元素(inspect)→ 弹卡展示
 *  - 用户在弹卡选择动作或推荐(apply)→ 步骤落库,弹卡保持打开
 *  - 用户关闭弹卡(close)→ 回到选取模式
 *
 * 纯逻辑 composable —— 无 lifecycle 副作用。
 * Esc 等键盘快捷键由 view 自行注册(EditView 已有 keydown 总入口),保持
 * "状态/逻辑在 composable,DOM/事件订阅在 view" 的边界。
 *
 * **插入位置**由调用方(EditView)显式传入 `apply(payload, target)`。
 * 这里不持有"上次点的 + 按钮"或"YAML 光标"状态 —— 那些属于编排层,
 * 本 composable 只负责"挑 → 算 → 写",不该关心"插哪"的策略。
 *
 * 和视图的耦合点:
 *  - stageFrozen: 双向控制的"手机画面冻结"状态(close 后自动解冻)
 *  - stepWriter: 把步骤真正写入(由 useWorkflowDocument 提供文本补丁实现)
 */

import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import type { UiNode, DumpResult } from '@renderer/components/ui-inspector/types'
import type { PickResult } from '@renderer/components/ui-inspector/pickResolver'
import type { Step } from '@shared/ipc/workflow.types'
import type { NodeTreeContext } from '../types'
import type { ElementPopoverApplyPayload } from '../components/edit/element-popover/types'
import { buildStep } from '../utils/recommendation'
import { buildTreeContext } from '../utils/nodeTreeContext'
import { findEffectiveTarget } from '../utils/targetResolver'
import { chooseSelectorHost } from '../utils/selectorHost'

export type PopoverApplyPayload = ElementPopoverApplyPayload

/**
 * 插入目标 —— 调用方在 apply 时决定把新步骤写哪。
 *
 *  - afterStep: 插到指定 step 之后(用户点 "+ 在这里插入",或光标在某步骤范围内)
 *  - append:    追加到 root 末尾(兜底:无显式槽位 / 光标不在任何步骤内)
 *
 * 光标级定位(比如"在 YAML 第 14 行之后插文本")不在这一层处理 ——
 * 调用方负责把光标行解析成 stepId(走 useStepYamlMapping),
 * 这一层只认结构化的 stepId / root。这样 yamlOps 契约不变,YAML 合法性有保障。
 */
export type InsertionTarget = { kind: 'afterStep'; stepId: string } | { kind: 'append' }

export interface StepWriter {
  insertAfter: (afterId: string, step: Omit<Step, 'id'>) => void
  appendBatch: (steps: Array<Omit<Step, 'id'>>) => void
}

export function usePickToInsert(stepWriter: StepWriter, stageFrozen: Ref<boolean>) {
  const inspectedNode = ref<UiNode | null>(null)
  const inspectedDump = ref<DumpResult | null>(null)
  const pickResult = ref<PickResult | null>(null)
  /**
   * 当前激活候选的 id(用户在 CandidatePicker 里可以切换)
   * pickResult 变化时重置为 winner.id;UI 切换时由父组件双向绑定写入。
   * 同时作为 DeviceStage overlay 高亮的依据(切换时触发 5s 闪烁)。
   */
  const activeCandidateId = ref<number | null>(null)

  watch(pickResult, (p) => {
    activeCandidateId.value = p?.winner.node.id ?? null
  })

  /** 当前激活节点:pickResult 里按 activeCandidateId 查找,fallback 到 winner */
  const activeNode = computed<UiNode | null>(() => {
    const p = pickResult.value
    if (!p) return null
    if (activeCandidateId.value == null) return p.winner.node
    return p.candidates.find((c) => c.node.id === activeCandidateId.value)?.node ?? p.winner.node
  })

  /** 弹卡需要的屏幕尺寸(来自最近一次 dump) */
  const screen = computed<{ width: number; height: number } | undefined>(() => {
    const d = inspectedDump.value
    return d ? { width: d.screenWidth, height: d.screenHeight } : undefined
  })

  /**
   * 最近一次 dump 的树上下文(父链/子树索引)
   * 推荐器接入 effective target resolution 时使用
   */
  const treeContext = computed<NodeTreeContext | undefined>(() => {
    const d = inspectedDump.value
    return d ? buildTreeContext(d) : undefined
  })

  function inspect(payload: { node: UiNode; dump: DumpResult; pick: PickResult }): void {
    inspectedNode.value = payload.node
    inspectedDump.value = payload.dump
    pickResult.value = payload.pick
  }

  function close(): void {
    inspectedNode.value = null
    inspectedDump.value = null
    pickResult.value = null
    activeCandidateId.value = null
    // 关闭 = 用户想挑下一个,画面回到选取模式
    stageFrozen.value = false
  }

  /**
   * 应用弹卡里选中的推荐 / 动作,落成 Step(s) 写入 target 指定位置
   *
   * kind='action':selector host 由 chooseSelectorHost(action, source, target) 决定
   *   - input 类:强制使用 editable target(否则输入会丢)
   *   - 其他类:选 selector 更稳定的那个(避免"用户看到 text、生成坐标"的错觉)
   */
  function apply(payload: ElementPopoverApplyPayload, target: InsertionTarget): boolean {
    const node = inspectedNode.value
    if (!node) return false

    let newSteps: Array<Omit<Step, 'id'>>
    if (payload.kind === 'recommendation') {
      newSteps = payload.rec.steps
    } else {
      const tree = treeContext.value
      const effectiveTarget = tree ? findEffectiveTarget(node, tree, 'generic').target : node
      const host = chooseSelectorHost(payload.rule.id, node, effectiveTarget)
      newSteps = [buildStep(host, payload.rule.id, undefined, screen.value)]
    }
    if (newSteps.length === 0) return false

    if (target.kind === 'afterStep') {
      // 从后往前插,保持顺序(反复 insertAfter 同一个 id,最新的落到最后)
      for (let i = newSteps.length - 1; i >= 0; i--) {
        stepWriter.insertAfter(target.stepId, newSteps[i])
      }
    } else {
      stepWriter.appendBatch(newSteps)
    }

    // 保持当前弹卡和冻结状态,用户可继续给同一元素追加动作。
    return true
  }

  // 注:不包 readonly() —— DeepReadonly 会让下游组件 props 类型不兼容。
  // 外部不导出 setter,按约定只读即可;mutation 应走 inspect/close/apply
  return {
    inspectedNode,
    pickResult,
    activeCandidateId, // 双向:UI 切换候选时写入
    activeNode, // 只读 computed
    screen,
    treeContext,
    inspect,
    close,
    apply
  }
}
