<script setup lang="ts">
/**
 * 编辑页顶栏:← 返回 · [▼ 工作流切换] · 包名/版本 + 脏标记 · 状态徽章 · 换云机
 */
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElIcon } from 'element-plus'
import { ArrowLeft, Iphone, QuestionFilled } from '@element-plus/icons-vue'
import type { Workflow, WorkflowListItem } from '@shared/ipc/workflow.types'
import type { RunState } from '../../types'
import type { FlowEngineStatus } from '../../composables/useFlowEngineHealth'
import WorkflowSwitcher from './WorkflowSwitcher.vue'

interface Props {
  workflow: Workflow | null
  isDirty: boolean
  runState: RunState
  /** 切换下拉里展示的全量工作流列表 */
  workflowList: readonly WorkflowListItem[]
  workflowListLoading?: boolean
  /** true = 有云机连上;status 显示「选元素模式」 */
  pickMode: boolean
  /** flow-engine 状态(online / offline / not-installed / unknown) */
  engineStatus?: FlowEngineStatus
  /** flow-engine 版本,仅 online 时有值 */
  engineVersion?: string | null
  /** 部署对话框是否打开(打开时锁定设备切换) */
  deploying?: boolean
}

interface Emits {
  (e: 'back'): void
  (e: 'switch-workflow', id: string): void
  (e: 'new-workflow'): void
  (e: 'change-device'): void
  (e: 'rename', name: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t, locale } = useI18n()

const titleName = computed(() => props.workflow?.name ?? t('workflow.topBar.untitled'))
const currentId = computed(() => props.workflow?.id ?? null)

function openSyntaxGuide(): void {
  const lang = locale.value.startsWith('zh') ? 'zh' : 'en'
  window.open(`https://help.vmosedge.com/${lang}/sdk/automation/`, '_blank')
}

const editing = ref(false)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function startEditing(): void {
  editingName.value = titleName.value
  editing.value = true
  nextTick(() => nameInputRef.value?.select())
}

function confirmRename(): void {
  if (!editing.value) return
  editing.value = false
  const trimmed = editingName.value.trim()
  if (trimmed && trimmed !== titleName.value) {
    emit('rename', trimmed)
  }
}

function cancelEditing(): void {
  editing.value = false
}

const status = computed<{ text: string; tone: 'idle' | 'pick' | 'running' | 'error' | 'success' }>(
  () => {
    switch (props.runState) {
      case 'running':
        return { text: t('workflow.topBar.running'), tone: 'running' }
      case 'error':
        return { text: t('workflow.topBar.runError'), tone: 'error' }
      case 'success':
        return { text: t('workflow.topBar.runSuccess'), tone: 'success' }
      default:
        if (props.pickMode) return { text: t('workflow.topBar.pickMode'), tone: 'pick' }
        return { text: t('workflow.topBar.idle'), tone: 'idle' }
    }
  }
)

/** chip 的渲染数据由 engineStatus 派生(单一真相源) */
const engineChip = computed<{
  tone: 'online' | 'offline' | 'not-installed'
  label: string
  title: string
} | null>(() => {
  const s = props.engineStatus
  switch (s) {
    case 'online':
      return {
        tone: 'online',
        label: props.engineVersion ? `v${props.engineVersion}` : t('workflow.topBar.engineOnline'),
        title: `${t('workflow.topBar.engineOnlineTitle')}${props.engineVersion ? ' · v' + props.engineVersion : ''}`
      }
    case 'offline':
      return {
        tone: 'offline',
        label: t('workflow.topBar.engineOffline'),
        title: t('workflow.topBar.engineOfflineTitle')
      }
    case 'not-installed':
      return {
        tone: 'not-installed',
        label: t('workflow.topBar.engineNotInstalled'),
        title: t('workflow.topBar.engineNotInstalledTitle')
      }
    case 'update-available':
      return {
        tone: 'not-installed',
        label: t('workflow.topBar.engineUpdateAvailable'),
        title: t('workflow.topBar.engineUpdateAvailableTitle')
      }
    case 'unknown':
    case undefined:
      return null
    default: {
      // 加新 FlowEngineStatus 时这里会编译报错,强制在此做渲染决策
      const _exhaustive: never = s
      return _exhaustive
    }
  }
})
</script>

<template>
  <header class="top-bar" :class="{ running: runState === 'running', error: runState === 'error' }">
    <ElButton
      link
      :icon="ArrowLeft"
      :aria-label="t('workflow.topBar.backToList')"
      @click="$emit('back')"
    />

    <input
      v-if="editing"
      ref="nameInputRef"
      v-model="editingName"
      class="name-input"
      maxlength="50"
      @keydown.enter.prevent="confirmRename"
      @keydown.esc.prevent="cancelEditing"
      @blur="confirmRename"
    />

    <WorkflowSwitcher
      v-else
      :current-name="titleName"
      :current-id="currentId"
      :items="workflowList"
      :loading="workflowListLoading"
      @select="(id) => $emit('switch-workflow', id)"
      @new="$emit('new-workflow')"
      @dblclick-name="startEditing"
    />

    <div v-if="workflow" class="meta">
      <span class="meta-pkg" :title="workflow.appId">{{ workflow.appId }}</span>
      <span v-if="workflow.appVersion" class="meta-ver">v{{ workflow.appVersion }}</span>
      <span
        v-if="isDirty"
        class="dirty-dot"
        :title="t('workflow.topBar.unsavedChanges')"
        :aria-label="t('workflow.topBar.unsavedChanges')"
        >•</span
      >
    </div>

    <div class="spacer" />

    <div class="status" :class="status.tone">
      <span class="dot" />
      <span>{{ status.text }}</span>
    </div>

    <div
      v-if="pickMode && engineChip"
      class="engine-chip"
      :class="`engine-${engineChip.tone}`"
      :title="engineChip.title"
    >
      <span class="engine-dot" />
      <span class="engine-label">engine</span>
      <span class="engine-ver">{{ engineChip.label }}</span>
    </div>

    <div class="actions">
      <button
        v-if="workflow"
        type="button"
        class="device-btn"
        :disabled="runState === 'running' || deploying"
        :title="
          runState === 'running'
            ? t('workflow.topBar.cantSwitchRunning')
            : deploying
              ? t('workflow.topBar.cantSwitchDeploying')
              : t('workflow.topBar.changeDevice')
        "
        @click="$emit('change-device')"
      >
        <ElIcon :size="14"><Iphone /></ElIcon>
        <span>{{ t('workflow.topBar.changeDevice') }}</span>
      </button>

      <button
        v-if="workflow"
        type="button"
        class="device-btn"
        :title="t('workflow.topBar.syntaxGuide')"
        @click="openSyntaxGuide"
      >
        <ElIcon :size="14"><QuestionFilled /></ElIcon>
        <span>{{ t('workflow.topBar.syntaxGuide') }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 56px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  flex-shrink: 0;
  transition:
    background 0.3s,
    border-color 0.3s;
}
.top-bar.running {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--el-color-success) 10%, var(--el-bg-color)) 0%,
    var(--el-bg-color) 50%,
    color-mix(in srgb, var(--el-color-success) 10%, var(--el-bg-color)) 100%
  );
  border-bottom-color: color-mix(in srgb, var(--el-color-success) 30%, transparent);
}
.top-bar.error {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--el-color-danger) 10%, var(--el-bg-color)) 0%,
    var(--el-bg-color) 50%,
    color-mix(in srgb, var(--el-color-danger) 10%, var(--el-bg-color)) 100%
  );
  border-bottom-color: color-mix(in srgb, var(--el-color-danger) 30%, transparent);
}

.name-input {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--el-color-primary);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  outline: none;
  box-shadow: 0 0 0 3px var(--el-color-primary-light-8);
  max-width: 280px;
}

.meta {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.meta-pkg {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta-ver {
  color: var(--el-text-color-regular);
  font-weight: 500;
}
.dirty-dot {
  color: var(--el-color-warning);
  font-size: 22px;
  font-weight: 700;
  line-height: 0;
  position: relative;
  top: -2px;
}

.spacer {
  flex: 1;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
}
.status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.status.idle {
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
}
/* 所有淡色徽章改用 color-mix 叠加 —— 项目里 -light-9 恒用白混,dark 下偏白 */
.status.pick {
  background: color-mix(in srgb, var(--el-color-primary) 14%, transparent);
  color: var(--el-color-primary);
}
.status.running {
  background: var(--el-color-success);
  color: white;
}
.status.running .dot {
  animation: pulse 1.2s infinite;
}
@media (prefers-reduced-motion: reduce) {
  .status.running .dot {
    animation: none;
  }
}
.status.success {
  background: color-mix(in srgb, var(--el-color-success) 14%, transparent);
  color: var(--el-color-success);
}
.status.error {
  background: var(--el-color-danger);
  color: white;
}

.engine-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.engine-chip.engine-online {
  background: color-mix(in srgb, var(--el-color-success) 14%, transparent);
  color: var(--el-color-success);
}
.engine-chip.engine-offline {
  background: var(--el-fill-color);
  color: var(--el-text-color-placeholder);
}
.engine-chip.engine-not-installed {
  background: color-mix(in srgb, var(--el-color-danger) 14%, transparent);
  color: var(--el-color-danger);
}
.engine-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.engine-label {
  opacity: 0.7;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.engine-ver {
  font-family: 'SF Mono', 'Menlo', monospace;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.85);
  }
}

.actions {
  display: flex;
  gap: 8px;
}

.device-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 999px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.device-btn:hover,
.device-btn:focus-visible {
  border-color: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  color: var(--el-color-primary);
  outline: none;
}

.device-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.device-btn :deep(.el-icon) {
  color: inherit;
}

@media (prefers-reduced-motion: reduce) {
  .device-btn {
    transition: none;
  }
}
</style>
