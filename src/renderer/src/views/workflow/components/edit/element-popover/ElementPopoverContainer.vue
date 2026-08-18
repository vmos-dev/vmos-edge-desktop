<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { PickResult } from '@renderer/components/ui-inspector/pickResolver'
import type { Recommendation } from '@shared/ipc/workflow.types'
import { useElementPopoverViewModel } from '../../../composables/useElementPopoverViewModel'
import { useOnboardingGuide } from '../../../composables/useOnboardingGuide'
import { getSelectorDetailSteps, SELECTOR_GUIDE_ID } from '../../../guide/steps'
import type { ActionRule, NodeTreeContext } from '../../../types'
import CandidatePicker from './CandidatePicker.vue'
import ElementActionPane from './ElementActionPane.vue'
import ElementDetailsPane from './ElementDetailsPane.vue'
import ElementPopoverFrame from './ElementPopoverFrame.vue'
import type { ElementPopoverApplyPayload, ElementPopoverMode } from './types'

interface Props {
  node: UiNode | null
  screen?: { width: number; height: number }
  tree?: NodeTreeContext
  /** 拾取结果(含候选列表) */
  pick?: PickResult | null
}

defineOptions({ name: 'ElementPopoverContainer' })

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'apply', payload: ElementPopoverApplyPayload): void
  (e: 'close'): void
}>()

/** 激活候选 id 由父组件控制(父级同时传给 DeviceStage overlay 做高亮闪烁) */
const activeCandidateId = defineModel<number | null>('activeId', { default: null })

const { t } = useI18n()
const screen = toRef(props, 'screen')
const tree = toRef(props, 'tree')
const mode = ref<ElementPopoverMode>('actions')
const selectorGuide = useOnboardingGuide(SELECTOR_GUIDE_ID, getSelectorDetailSteps())

watch(
  () => props.node,
  (next, prev) => {
    if (next && next !== prev) mode.value = 'actions'
  }
)

watch(mode, (m) => {
  if (m === 'details') selectorGuide.tryAutoStart()
})

/**
 * activeNode 响应候选切换:pick 存在 → 按 activeCandidateId 查找;
 * fallback 到 props.node(兼容无 pick 的旧路径)
 */
const activeNode = computed<UiNode | null>(() => {
  if (props.pick && activeCandidateId.value != null) {
    const found = props.pick.candidates.find((c) => c.node.id === activeCandidateId.value)
    if (found) return found.node
  }
  return props.node
})

const viewModel = useElementPopoverViewModel({
  node: activeNode,
  screen,
  tree
})

const switchLabel = computed(() =>
  mode.value === 'actions'
    ? t('workflow.elementPopover.viewDetails')
    : t('workflow.elementPopover.backToActions')
)

/** pick 提示:基于当前 active 节点的 primary 选择器分数(Maestro 基线不按面积判断) */
const pickHint = computed<{ text: string; tone: 'info' | 'warn' } | null>(() => {
  if (!props.pick) return null
  const score = viewModel.selectorRows.value[0]?.score ?? 0
  if (score <= 20) {
    return { text: t('workflow.elementPopover.noAnchor'), tone: 'warn' }
  }
  if (score < 80) {
    return { text: t('workflow.elementPopover.lowStability'), tone: 'info' }
  }
  return null
})

/** 多于 1 个候选才展示候选列表 */
const showCandidatePicker = computed<boolean>(
  () => !!props.pick && props.pick.candidates.length > 1
)

function handleApplyRecommendation(recommendation: Recommendation): void {
  emit('apply', { kind: 'recommendation', rec: recommendation })
}

function handleApplyAction(rule: ActionRule): void {
  emit('apply', { kind: 'action', rule })
}
</script>

<template>
  <ElementPopoverFrame
    v-if="node"
    :title="viewModel.heading.value.title"
    :subtitle="viewModel.heading.value.subtitle"
    :hint="pickHint"
    :mode="mode"
    :switch-label="switchLabel"
    @close="$emit('close')"
    @toggle-mode="mode = mode === 'actions' ? 'details' : 'actions'"
  >
    <CandidatePicker
      v-if="showCandidatePicker && pick && activeCandidateId != null"
      :candidates="pick.candidates"
      v-model:activeId="activeCandidateId as number"
    />

    <ElementActionPane
      v-if="mode === 'actions'"
      :recommendation="viewModel.recommendation.value"
      :actions="viewModel.actions.value"
      @apply-recommendation="handleApplyRecommendation"
      @apply-action="handleApplyAction"
    />

    <ElementDetailsPane
      v-else
      :selector-rows="viewModel.selectorRows.value"
      :property-rows="viewModel.propertyRows.value"
    />
  </ElementPopoverFrame>
</template>
