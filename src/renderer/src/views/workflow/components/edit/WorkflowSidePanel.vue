<script setup lang="ts">
/**
 * 编辑页右栏 · 两 tab(可视化 / YAML)
 *
 * 选元素后的「元素详情」不在这里 —— 走 device 旁边的 popover + 底部抽屉。
 * 本组件只关心步骤树和 YAML 文本两种视图,数据全部从父级传入。
 */
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Step } from '@shared/ipc/workflow.types'
import type { LineStatusMap, LineErrorMap } from '../../composables/useFlowRunner'
import { useStepYamlMapping } from '../../composables/useStepYamlMapping'

import YamlErrorBar from '../YamlErrorBar.vue'
import StepList from '../StepList.vue'
import YamlEditor from '../YamlEditor.vue'
import EditStatusBar from './EditStatusBar.vue'

type Mode = 'visual' | 'yaml'

/**
 * 临时 flag:可视化体验完善前先隐藏 tab,只露 YAML 编辑器。
 * 把这个改回 true 即可恢复"可视化 / YAML 双 tab 切换"形态,
 * 不需要动其它任何代码(StepList 相关 props/emits 都保留接好)。
 */
const VISUAL_TAB_ENABLED = false

interface Props {
  steps: readonly Step[]
  yamlText: string
  yamlErrors: readonly string[]
  lineStatuses?: LineStatusMap
  lineErrors?: LineErrorMap
  readOnly?: boolean
}

interface Emits {
  (e: 'update:yaml', value: string): void
  /**
   * YAML 编辑器的光标行号冒泡给父级(v-model:yaml-cursor-line 用)
   * 可视化 tab 下恒为 0 —— cursor 是 yaml 视图独有的状态,暴露旧值会误导上层"插哪"决策
   */
  (e: 'update:yaml-cursor-line', line: number): void
  (e: 'edit-step', id: string, patch: Partial<Omit<Step, 'id'>>): void
  (e: 'edit-step-body', id: string, action: string, body: unknown): void
  (e: 'delete-step', id: string): void
  (e: 'duplicate-step', id: string): void
  (e: 'insert-after', id: string): void
  (e: 'reorder', parentId: string | null, from: number, to: number): void
  (e: 'add-step-root'): void
  (e: 'add-step-in-container', parentId: string): void
}

const { t } = useI18n()
const props = withDefaults(defineProps<Props>(), {
  lineStatuses: () => ({}),
  lineErrors: () => ({}),
  readOnly: false
})
const emit = defineEmits<Emits>()

const mode = ref<Mode>(VISUAL_TAB_ENABLED ? 'visual' : 'yaml')
const yamlEditorRef = useTemplateRef<InstanceType<typeof YamlEditor>>('yamlEditorRef')

const stepCount = computed(() => props.steps.length)
const yamlLineCount = computed(() => props.yamlText.split('\n').length)
const errorCount = computed(() => props.yamlErrors.length)

const { lineForStep } = useStepYamlMapping(
  computed(() => props.steps),
  computed(() => props.yamlText)
)

async function handleViewYaml(stepId: string): Promise<void> {
  mode.value = 'yaml'
  await nextTick()
  const range = lineForStep(stepId)
  if (range) yamlEditorRef.value?.revealLine(range.start)
}

// ═══ YAML 光标冒泡 ═══
//
// YamlEditor 发出 cursor 行,这里按 mode gate —— 可视化 tab 下隐藏(发 0):
// 光标是 yaml 视图独有的状态,把旧值透给父级会误导"插到光标处"策略。
//
// 用 computed + watch 确保 mode 切换时也会重新 emit,不漏边界。
const yamlCursorLineInternal = ref(0)
const effectiveYamlCursorLine = computed(() =>
  mode.value === 'yaml' ? yamlCursorLineInternal.value : 0
)
watch(effectiveYamlCursorLine, (line) => emit('update:yaml-cursor-line', line), {
  immediate: true
})
</script>

<template>
  <aside class="side-panel" :aria-label="t('workflow.sidePanel.ariaLabel')">
    <header v-if="VISUAL_TAB_ENABLED" class="tabs" role="tablist">
      <button
        type="button"
        class="tab"
        role="tab"
        :class="{ active: mode === 'visual' }"
        :aria-selected="mode === 'visual'"
        @click="mode = 'visual'"
      >
        <span class="tab-icon" aria-hidden="true">📋</span>
        <span class="tab-label">{{ t('workflow.sidePanel.visual') }}</span>
        <span class="tab-meta">{{ stepCount }}</span>
      </button>

      <button
        type="button"
        class="tab"
        role="tab"
        :class="{ active: mode === 'yaml' }"
        :aria-selected="mode === 'yaml'"
        @click="mode = 'yaml'"
      >
        <span class="tab-icon" aria-hidden="true">{{ '{ }' }}</span>
        <span class="tab-label">YAML</span>
        <span
          class="tab-dot"
          :class="errorCount > 0 ? 'err' : 'ok'"
          :title="
            errorCount > 0
              ? t('workflow.sidePanel.errors', { count: errorCount })
              : t('workflow.sidePanel.syntaxOk')
          "
        />
      </button>
    </header>

    <div class="pane-body">
      <StepList
        v-if="VISUAL_TAB_ENABLED"
        v-show="mode === 'visual'"
        :steps="steps"
        :yaml-text="yamlText"
        class="pane-content"
        @edit-step="(id, patch) => emit('edit-step', id, patch)"
        @edit-step-body="(id, action, body) => emit('edit-step-body', id, action, body)"
        @delete-step="(id) => emit('delete-step', id)"
        @duplicate-step="(id) => emit('duplicate-step', id)"
        @insert-after="(id) => emit('insert-after', id)"
        @reorder="(pid, from, to) => emit('reorder', pid, from, to)"
        @view-yaml="handleViewYaml"
        @add-step-root="emit('add-step-root')"
        @add-step-in-container="(pid) => emit('add-step-in-container', pid)"
      />

      <div v-show="mode === 'yaml'" class="yaml-wrap pane-content">
        <YamlErrorBar v-if="errorCount > 0" :errors="yamlErrors" />
        <YamlEditor
          ref="yamlEditorRef"
          :model-value="yamlText"
          :line-statuses="lineStatuses"
          :line-errors="lineErrors"
          :read-only="props.readOnly"
          class="yaml-editor"
          @update:model-value="(value) => emit('update:yaml', value)"
          @update:cursor-line="yamlCursorLineInternal = $event"
        />
      </div>
    </div>

    <EditStatusBar :step-count="stepCount" :line-count="yamlLineCount" :error-count="errorCount" />
  </aside>
</template>

<style scoped>
.side-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.tabs {
  display: flex;
  align-items: stretch;
  height: 36px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  flex-shrink: 0;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  border-right: 1px solid var(--el-border-color-lighter);
  position: relative;
  transition: background 0.15s ease;
}
.tab:hover {
  background: var(--el-fill-color);
}
.tab.active {
  background: var(--el-bg-color);
  color: var(--el-color-primary);
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--el-color-primary);
}
.tab:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.tab-icon {
  font-size: 13px;
}
.tab-label {
  letter-spacing: 0.02em;
}
.tab-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
  border-radius: 9px;
  font-weight: 500;
  font-family: 'SF Mono', 'Menlo', monospace;
}
.tab-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tab-dot.ok {
  background: var(--el-color-success);
}
.tab-dot.err {
  background: var(--el-color-danger);
}

.pane-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.pane-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.yaml-wrap {
  display: flex;
  flex-direction: column;
}
.yaml-editor {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
</style>
