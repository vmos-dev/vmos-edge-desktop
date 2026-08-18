<script setup lang="ts">
/**
 * 工作流编辑 · 路由视图
 *
 * 路由参数:
 *  - :id = 'new'   → 从 history.state.seed 进入新建草稿;无 seed 则回列表
 *  - :id = 'wf-x'  → 加载已有工作流
 *
 * 组合:useWorkflowDocument(数据)+ useFlowRunner(运行)+ usePickToInsert(拾取)
 * + useActiveDevice(当前云机)+ useDeviceSelection(换云机对话框)
 * 本视图只做 wiring,不持有 UI 状态
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Device } from '@shared/ipc/data.types'
import type { AppInfo, CreateWorkflowPayload, Step } from '@shared/ipc/workflow.types'

import DeviceStage from './components/DeviceStage.vue'
import DeviceAppSelectorDialog from './components/dialogs/DeviceAppSelectorDialog.vue'
import EditTopBar from './components/edit/EditTopBar.vue'
import EditActionBar from './components/edit/EditActionBar.vue'
import EngineStatusBanner from './components/edit/EngineStatusBanner.vue'
import WorkflowSidePanel from './components/edit/WorkflowSidePanel.vue'
import ElementPopoverContainer from './components/edit/element-popover/ElementPopoverContainer.vue'
import type { ElementPopoverApplyPayload } from './components/edit/element-popover/types'
import ActionPickerDialog from './components/edit/step-form/ActionPickerDialog.vue'
import FlowEngineDeployDialog from './components/dialogs/FlowEngineDeployDialog.vue'

import { useActiveDevice } from './composables/useActiveDevice'
import { useDebouncedSave } from './composables/useDebouncedSave'
import { useDeviceSelection } from './composables/useDeviceSelection'
import {
  useFlowEngineHealth,
  RUNNABLE_FLOW_ENGINE_STATUSES
} from './composables/useFlowEngineHealth'
import { useFlowRunner } from './composables/useFlowRunner'
import { useInsertionTarget } from './composables/useInsertionTarget'
import { usePickToInsert } from './composables/usePickToInsert'
import {
  useWorkflowDocument,
  consumePendingNewWorkflowSeed,
  setPendingNewWorkflowSeed
} from './composables/useWorkflowDocument'
import { useWorkflowList } from './composables/useWorkflowList'
import { useWorkflowRepository } from './composables/useWorkflowRepository'
import { useOnboardingGuide } from './composables/useOnboardingGuide'
import {
  getEditViewSteps,
  getElementPickSteps,
  getFrozenModeSteps,
  EDIT_GUIDE_ID,
  PICK_GUIDE_ID,
  FROZEN_GUIDE_ID
} from './guide/steps'
import type { RunState } from './types'

defineOptions({ name: 'WorkflowEdit' })

const NEW_WORKFLOW_ROUTE_ID = 'new'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const repository = useWorkflowRepository()
const doc = useWorkflowDocument(repository)
const list = useWorkflowList(repository)

/** save/run 用的工作流(YAML 错时 null) */
const currentWorkflow = doc.workflow
/** UI 显示用的工作流(meta 加载即有值,不受 YAML 错影响) */
const displayWorkflow = doc.displayMeta

const { device: selectedDevice } = useActiveDevice(displayWorkflow)
const {
  isRunning,
  lineStatuses,
  lineErrors,
  canRun: flowCanRun,
  syncStatus,
  run,
  cancel,
  dispose
} = useFlowRunner(selectedDevice)
const {
  status: engineStatus,
  version: engineVersion,
  retry: retryEngineHealth
} = useFlowEngineHealth(selectedDevice)

const stageFrozen = ref(false)
const effectiveStageFrozen = computed({
  get: () => doc.hasYamlError.value || stageFrozen.value,
  set: (value: boolean) => {
    if (!doc.hasYamlError.value) stageFrozen.value = value
  }
})
const pick = usePickToInsert(
  {
    insertAfter: (afterId, step) => doc.insertAfter(afterId, step),
    appendBatch: (steps) => doc.appendBatch(steps)
  },
  stageFrozen
)
const deviceSel = useDeviceSelection()

// 光标行号:YamlEditor → WorkflowSidePanel → 这里(Events up,响应式)。
// 0 = 不在 YAML 视图 或 编辑器未就绪
const editGuide = useOnboardingGuide(EDIT_GUIDE_ID, getEditViewSteps())
const pickGuide = useOnboardingGuide(PICK_GUIDE_ID, getElementPickSteps())
const frozenGuide = useOnboardingGuide(FROZEN_GUIDE_ID, getFrozenModeSteps())

const yamlCursorLine = ref(0)

// 插入位置策略独立成 composable —— EditView 只剩"组合"
const insertion = useInsertionTarget({
  steps: doc.steps,
  yamlText: doc.text,
  yamlCursorLine
})

const runState = computed<RunState>(() => (isRunning.value ? 'running' : 'idle'))
const stepCount = computed(() => doc.steps.value.length)
const canRun = computed(
  () =>
    flowCanRun.value &&
    doc.isLoaded.value &&
    stepCount.value > 0 &&
    !doc.hasYamlError.value &&
    RUNNABLE_FLOW_ENGINE_STATUSES.includes(engineStatus.value)
)

/** 依 engineStatus 派生按钮 tooltip 文案;加新状态时会编译报错,强制此处做出决策 */
function engineStatusTooltip(s: typeof engineStatus.value): string | null {
  switch (s) {
    case 'online':
      return null
    case 'offline':
      return t('workflow.engine.offline')
    case 'not-installed':
      return t('workflow.engine.notInstalled')
    case 'update-available':
      return t('workflow.engine.updateAvailable')
    case 'unknown':
      return t('workflow.engine.checking')
    default: {
      const _exhaustive: never = s
      return _exhaustive
    }
  }
}

/** 运行按钮不可用时的原因(给 EditActionBar 做 tooltip,精准传达"为何灰了") */
const runDisabledReason = computed<string | null>(() => {
  if (isRunning.value) return null
  if (!selectedDevice.value) return t('workflow.selectDeviceFirst')
  const engineReason = engineStatusTooltip(engineStatus.value)
  if (engineReason) return engineReason
  if (doc.hasYamlError.value) return t('workflow.editor.yamlCannotSave')
  if (stepCount.value === 0) return t('workflow.editor.selectDeviceAndAddSteps')
  return null
})

// ═══ 路由 → doc 同步 ═══

/**
 * 仅出于 TS 形态对齐:类型从 CreateWorkflowPayload 收一下
 * (实际取值走 consumePendingNewWorkflowSeed)
 */
type SeedRecord = CreateWorkflowPayload

async function handleRouteIdChange(rawId: string | undefined): Promise<void> {
  const id = rawId && rawId.length > 0 ? rawId : undefined

  if (!id) {
    await router.replace({ name: 'Automation' })
    return
  }

  if (id === NEW_WORKFLOW_ROUTE_ID) {
    // 已经处于同一个新建草稿,不要重置
    if (doc.isNew.value) return

    const seed: SeedRecord | null = consumePendingNewWorkflowSeed()
    if (!seed) {
      // 没 seed 进 /new 是非法状态(直链 / 跨页 reload 后 sessionStorage 已空),回列表
      await router.replace({ name: 'Automation' })
      return
    }
    doc.startNew(seed)
    return
  }

  if (!doc.isNew.value && currentWorkflow.value?.id === id) return

  await doc.openExisting(id)
  if (!doc.isLoaded.value) {
    await router.replace({ name: 'Automation' })
  }
}

// ═══ 持久化 / 离开 ═══

async function persistSession(options?: {
  showSuccess?: boolean
  /** 失败时是否弹 error toast(自动保存场景置 false,避免连击时刷屏) */
  showError?: boolean
  syncCreatedRoute?: boolean
}): Promise<boolean> {
  if (doc.hasYamlError.value) {
    if (options?.showError !== false) {
      ElMessage.error(doc.error.value ?? t('workflow.editor.yamlCannotSave'))
    }
    return false
  }
  if (!doc.isDirty.value) return true

  const wasNew = doc.isNew.value
  const ok = await doc.save()
  if (!ok) {
    if (options?.showError !== false) {
      ElMessage.error(doc.error.value ?? t('workflow.editor.saveFailed'))
    }
    return false
  }

  // 把保存结果 upsert 到共享列表缓存,不再全量 refresh
  const wf = currentWorkflow.value
  if (wf) {
    list.patchItem({
      id: wf.id,
      name: wf.name,
      appId: wf.appId,
      appName: wf.appName,
      appIcon: wf.appIcon,
      appVersion: wf.appVersion,
      defaultDeviceId: wf.defaultDeviceId,
      stepCount: wf.steps.length,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt
    })
  }

  if (wasNew && options?.syncCreatedRoute !== false && wf) {
    await router.replace({
      name: 'WorkflowEdit',
      params: { id: wf.id }
    })
  }

  if (options?.showSuccess !== false) {
    ElMessage.success(t('workflow.editor.saveSuccess'))
  }
  return true
}

async function handleSave(): Promise<void> {
  if (doc.hasYamlError.value) {
    ElMessage.error(t('workflow.editor.yamlCannotSave'))
    return
  }
  await persistSession()
}

function handleKeyShortcut(event: KeyboardEvent): void {
  // Cmd/Ctrl+S → 保存
  if ((event.ctrlKey || event.metaKey) && event.key === 's' && !event.shiftKey && !event.altKey) {
    event.preventDefault()
    void handleSave()
    return
  }
  // Esc → 关闭元素弹卡(若打开)
  if (event.key === 'Escape' && pick.inspectedNode.value) {
    handleClosePick()
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (doc.canLeave().kind === 'clean') return
  // Chromium 119+ 只看 preventDefault();Electron 关窗 / Cmd+R 走同一通道,
  // 会显示原生确认。Web 版 build 也共用此分支。
  event.preventDefault()
}

async function canLeave(): Promise<boolean> {
  const decision = doc.canLeave()
  if (decision.kind === 'clean') return true

  if (decision.kind === 'invalid-yaml') {
    try {
      await ElMessageBox.confirm(
        t('workflow.editor.yamlErrorLeaveBody'),
        t('workflow.editor.yamlErrorLeaveTitle'),
        {
          confirmButtonText: t('workflow.editor.discardAndLeave'),
          cancelButtonText: t('workflow.editor.continueEditing'),
          type: 'warning'
        }
      )
      doc.discard()
      return true
    } catch {
      return false
    }
  }

  try {
    await ElMessageBox.confirm(
      t('workflow.editor.unsavedBody'),
      t('workflow.editor.unsavedTitle'),
      {
        distinguishCancelAndClose: true,
        confirmButtonText: t('workflow.editor.saveAndLeave'),
        cancelButtonText: t('workflow.editor.discardChanges'),
        type: 'warning'
      }
    )
    return await persistSession({ showSuccess: false, syncCreatedRoute: false })
  } catch (action) {
    if (action === 'cancel') {
      doc.discard()
      return true
    }
    return false
  }
}

// ═══ 生命周期 ═══

onMounted(async () => {
  // 切换下拉需要全量列表 —— 但用共享缓存,避免和列表页重复 IPC
  void list.refreshIfNeeded()
  window.addEventListener('keydown', handleKeyShortcut)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyShortcut)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // pickAutosave 自带 onUnmounted 清理,无需手动 cancel
  dispose()
  doc.close()
})

watch(
  () => route.params.id,
  (rawId) => {
    const id = typeof rawId === 'string' && rawId ? rawId : undefined
    void handleRouteIdChange(id)
  },
  { immediate: true }
)

watch(
  () => doc.isLoaded.value,
  (loaded) => {
    if (loaded) editGuide.tryAutoStart()
  },
  { immediate: true }
)

watch(
  () => pick.inspectedNode.value,
  (node) => {
    if (node) pickGuide.tryAutoStart()
  }
)

watch(stageFrozen, (frozen) => {
  if (frozen) frozenGuide.tryAutoStart()
})

watch(
  () => ({
    deviceId: selectedDevice.value?.id ?? null,
    hostIp: selectedDevice.value?.host_ip ?? null,
    isLoaded: doc.isLoaded.value,
    engineOnline: engineStatus.value === 'online'
  }),
  (state) => {
    if (!state.deviceId || !state.hostIp || !state.isLoaded) {
      dispose()
      return
    }
    if (!state.engineOnline) {
      return
    }
    void syncStatus(doc.text.value)
  },
  { immediate: true }
)

onBeforeRouteLeave(() => canLeave())
onBeforeRouteUpdate(() => canLeave())

// ═══ 顶栏 / 切换 / 换云机 ═══

function handleBack(): void {
  void router.push({ name: 'Automation' })
}

async function handleSwitchWorkflow(id: string): Promise<void> {
  if (!doc.isNew.value && currentWorkflow.value?.id === id) return
  await router.push({ name: 'WorkflowEdit', params: { id } })
}

function handleNewWorkflow(): void {
  deviceSel.openForNew()
}

function handleChangeDevice(): void {
  if (isRunning.value || deployDialogOpen.value) return
  deviceSel.openForChange()
}

async function handleDeviceAppConfirm(payload: {
  device: Device
  app: AppInfo
  name?: string
}): Promise<void> {
  const result = deviceSel.confirm(payload)

  if (result.kind === 'change-device') {
    doc.setAppBinding({ defaultDeviceId: result.device.id })
    ElMessage.success(
      t('workflow.editor.switchedTo', { name: result.device.user_name || result.device.id })
    )
    return
  }

  // 新建:seed 走 sessionStorage 透传到下一次 route 解析
  setPendingNewWorkflowSeed(result.seed)
  await router.push({ name: 'WorkflowEdit', params: { id: NEW_WORKFLOW_ROUTE_ID } })
}

// ═══ 编辑器事件 ═══

function handleYamlUpdate(value: string): void {
  doc.setText(value)
}
function handleEditStep(id: string, patch: Partial<Omit<Step, 'id'>>): void {
  doc.updateStep(id, patch)
}
function handleEditStepBody(id: string, action: string, body: unknown): void {
  doc.editStepBody(id, action, body)
}
function handleDeleteStep(id: string): void {
  doc.removeStep(id)
}
function handleDuplicateStep(id: string): void {
  doc.duplicate(id)
}
function handleReorderSteps(parentId: string | null, from: number, to: number): void {
  doc.reorder(parentId, from, to)
}
function handleInsertAfter(id: string): void {
  insertion.requestInsertAfter(id)
  ElMessage.info(t('workflow.editor.pickElementHint'))
}

/** Esc 关闭 pick 时一并清 pending,避免"取消后再选,结果跑到旧槽位" */
function handleClosePick(): void {
  pick.close()
  insertion.reset()
}

// ═══ 手动添加步骤(ActionPicker) ═══
type PickerTarget = { kind: 'root' } | { kind: 'container'; parentId: string }

const actionPickerOpen = ref(false)
const pickerTarget = ref<PickerTarget | null>(null)

function openActionPicker(target: PickerTarget): void {
  pickerTarget.value = target
  actionPickerOpen.value = true
}

function handleAddStepRoot(): void {
  openActionPicker({ kind: 'root' })
}
function handleAddStepInContainer(parentId: string): void {
  openActionPicker({ kind: 'container', parentId })
}
function handleActionPicked(actionId: string): void {
  const target = pickerTarget.value
  if (!target) return
  if (target.kind === 'root') {
    doc.addStep(actionId)
  } else {
    doc.addStep(actionId, { parentStepId: target.parentId })
  }
  pickerTarget.value = null
  // 手动添加 = 用户明确意图,跟 pick 一样走去抖自动保存
  pickAutosave.schedule()
}

/**
 * 选元素 → 落步骤后的去抖自动保存
 *
 * 选元素是用户的「明确意图」(不像 YAML 编辑那样反复试),落步骤后应当持久化,
 * 避免连选 5 个、断电、全丢。状态/计时器由 useDebouncedSave 管理(自动清理)。
 * 失败静默,用户从 dirty 圆点感知。
 */
const pickAutosave = useDebouncedSave(
  () => persistSession({ showSuccess: false, showError: false }),
  600
)

function handleApplyElement(payload: ElementPopoverApplyPayload): void {
  if (!pick.apply(payload, insertion.target.value)) return
  insertion.reset()
  ElMessage.success(t('workflow.editor.elementAdded'))
  pickAutosave.schedule()
}

// ═══ flow-engine 部署 ═══

const deployDialogOpen = ref(false)

function handleInstallEngine(): void {
  deployDialogOpen.value = true
}

watch(deployDialogOpen, (open) => {
  if (!open) retryEngineHealth()
})

// ═══ 运行 / 停止 ═══

async function handleRun(): Promise<void> {
  if (doc.hasYamlError.value) {
    ElMessage.error(t('workflow.editor.yamlValidationFailed'))
    return
  }
  if (!canRun.value) {
    ElMessage.warning(t('workflow.editor.selectDeviceAndAddSteps'))
    return
  }

  const saved = await persistSession({ showSuccess: false })
  if (!saved) return

  const result = await run(doc.text.value)
  if (!result.success) {
    ElMessage.error(result.error || t('workflow.runFailed', '运行失败'))
  }
}

async function handleStop(): Promise<void> {
  const result = await cancel()
  if (result.success) {
    ElMessage.info(t('workflow.stopped', '已停止'))
  } else {
    ElMessage.error(result.error || t('workflow.stopFailed', '停止失败'))
  }
}
</script>

<template>
  <div class="wf-edit-view">
    <EditTopBar
      :workflow="displayWorkflow"
      :is-dirty="doc.isDirty.value"
      :run-state="runState"
      :workflow-list="list.items.value"
      :workflow-list-loading="list.loading.value"
      :pick-mode="!!displayWorkflow && !!selectedDevice && !doc.hasYamlError.value"
      :engine-status="engineStatus"
      :engine-version="engineVersion"
      :deploying="deployDialogOpen"
      @back="handleBack"
      @switch-workflow="handleSwitchWorkflow"
      @new-workflow="handleNewWorkflow"
      @change-device="handleChangeDevice"
      @rename="(name) => doc.rename(name)"
    />

    <EngineStatusBanner :status="engineStatus" @install="handleInstallEngine" />

    <main class="wf-edit-body">
      <section class="stage" @click.self="handleClosePick">
        <!--
          v-if 用 displayWorkflow(meta 加载即可),YAML 解析错时不再隐藏云机;
          拾取禁用交给 DeviceStage 内部 toolbar 显示提示 + disable button
        -->
        <DeviceStage
          v-if="displayWorkflow"
          v-model:frozen="effectiveStageFrozen"
          :device="selectedDevice"
          :picking-disabled="doc.hasYamlError.value"
          :highlight-node-id="pick.activeCandidateId.value"
          @element-inspect="pick.inspect"
        />

        <div v-if="pick.inspectedNode.value" class="popover-slot">
          <ElementPopoverContainer
            :node="pick.inspectedNode.value"
            :screen="pick.screen.value"
            :tree="pick.treeContext.value"
            :pick="pick.pickResult.value"
            v-model:activeId="pick.activeCandidateId.value"
            @apply="handleApplyElement"
            @close="handleClosePick"
          />
        </div>
      </section>

      <WorkflowSidePanel
        v-model:yaml-cursor-line="yamlCursorLine"
        :steps="doc.steps.value"
        :yaml-text="doc.text.value"
        :yaml-errors="doc.yamlErrors.value"
        :line-statuses="lineStatuses"
        :line-errors="lineErrors"
        :read-only="isRunning"
        @update:yaml="handleYamlUpdate"
        @edit-step="handleEditStep"
        @edit-step-body="handleEditStepBody"
        @delete-step="handleDeleteStep"
        @duplicate-step="handleDuplicateStep"
        @reorder="handleReorderSteps"
        @insert-after="handleInsertAfter"
        @add-step-root="handleAddStepRoot"
        @add-step-in-container="handleAddStepInContainer"
      />
    </main>

    <EditActionBar
      :run-state="runState"
      :can-run="canRun"
      :run-disabled-reason="runDisabledReason"
      :is-dirty="doc.isDirty.value"
      :has-yaml-error="doc.hasYamlError.value"
      :saving="doc.isSaving.value"
      @run="handleRun"
      @stop="handleStop"
      @save="handleSave"
    />

    <DeviceAppSelectorDialog
      v-model:open="deviceSel.dialogOpen.value"
      :require-name="deviceSel.isNewMode.value"
      @confirm="handleDeviceAppConfirm"
    />

    <ActionPickerDialog v-model:open="actionPickerOpen" @pick="handleActionPicked" />

    <FlowEngineDeployDialog v-model="deployDialogOpen" :host-ip="selectedDevice?.host_ip ?? ''" />
  </div>
</template>

<style scoped>
.wf-edit-view {
  height: calc(100vh - 56px);
  /*
   * flex 垂直堆叠:TopBar · Banner(可选 0 高) · Body(flex:1) · ActionBar。
   * 用 flex 替代 grid-template-rows 是因为 banner v-if=false 时渲染成注释节点
   * 不算 grid item,会让 auto-placement 错位,留出一行空白。flex 天然跳过注释。
   * 同时不再硬编码各行像素(56/72),行高由组件自身决定,改样式不用同步动 grid。
   */
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color-page);
  overflow: hidden;
}

.wf-edit-body {
  display: grid;
  /* stage 自适应(只放设备时窄,弹卡出现时撑开),side panel 拿剩余空间 */
  grid-template-columns: auto 1fr;
  overflow: hidden;
  min-height: 0;
  position: relative;
  flex: 1 1 0;
}

.stage {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  background: var(--el-bg-color);
}

.stage > :first-child {
  /* 云机:固定窄宽,与设备真实纵横比贴合 */
  width: 380px;
  flex-shrink: 0;
}

.popover-slot {
  /* 弹卡夹在云机和右栏之间 */
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  overflow: hidden;
}
</style>
