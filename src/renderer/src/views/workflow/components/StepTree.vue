<script setup lang="ts">
/**
 * StepTree · 递归渲染的步骤树
 *
 * 一个层级 = 一个 vuedraggable 列表
 * 组合步骤(children / branches)递归嵌入子 StepTree,缩进 + 左边框提示层级
 * 所有交互事件冒泡到最外层(StepList 统一 emit)
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'
import type { Step } from '../types'
import { getStepBody } from '../utils/yamlOps'
import StepItem from './StepItem.vue'
import StepEditorPanel from './edit/step-form/StepEditorPanel.vue'

defineOptions({ name: 'StepTree' })

interface Props {
  steps: readonly Step[]
  /** 整篇 YAML 文本 — 编辑表单从中派生 body */
  yamlText: string
  /** 当前层的父 id(根 = null) */
  parentId?: string | null
  /** 嵌套深度,给缩进用 */
  depth?: number
  /** 当前正在编辑的 step id(由 StepList 顶层统一管理) */
  editingId?: string | null
}

interface Emits {
  (e: 'edit', id: string): void
  /** 旧式 patch 字段(label/optional/chance):兼容路径 */
  (e: 'save-edit', id: string, patch: Partial<Omit<Step, 'id'>>): void
  /** schema 表单输出的整体 body 替换 */
  (e: 'save-edit-body', id: string, action: string, body: unknown): void
  (e: 'cancel-edit'): void
  (e: 'delete-step', id: string): void
  (e: 'duplicate-step', id: string): void
  (e: 'insert-after', id: string): void
  (e: 'reorder', parentId: string | null, from: number, to: number): void
  (e: 'view-yaml', id: string): void
  /** 手动添加 — 追加到容器(repeat / retry / runFlow)的 commands */
  (e: 'add-step-in-container', parentId: string): void
}

const { t } = useI18n()
const props = withDefaults(defineProps<Props>(), {
  parentId: null,
  depth: 0,
  editingId: null
})
const emit = defineEmits<Emits>()

// vuedraggable 本地拷贝(props 只读,避免原地改父级)
const localSteps = ref<Step[]>([...props.steps])
watch(
  () => props.steps,
  (v) => {
    localSteps.value = [...v]
  },
  { deep: true }
)

// 当前编辑步骤的 body(从 yamlText 按 stepId 派生;只在编辑时计算一次)
const editingBody = computed<unknown>(() => {
  if (!props.editingId) return undefined
  return getStepBody(props.yamlText, props.editingId)
})

function handleChange(evt: { moved?: { oldIndex: number; newIndex: number } }): void {
  if (evt.moved) {
    emit('reorder', props.parentId ?? null, evt.moved.oldIndex, evt.moved.newIndex)
  }
}

function bubbleReorder(pid: string | null, from: number, to: number): void {
  emit('reorder', pid, from, to)
}

/** 该步是否是「容器」(repeat / retry / runFlow)—— 决定要不要在内部加「+ 加一步」 */
function isContainer(step: Step): boolean {
  return Array.isArray(step.children)
}
</script>

<template>
  <draggable
    :list="localSteps"
    :item-key="(s: Step) => s.id"
    :group="{ name: 'workflow-steps', pull: false, put: false }"
    handle=".drag-handle"
    ghost-class="step-ghost"
    animation="180"
    @change="handleChange"
  >
    <template #item="{ element: step, index }">
      <div class="step-wrapper">
        <StepItem
          :step="step"
          :index="index"
          @edit="emit('edit', step.id)"
          @delete="emit('delete-step', step.id)"
          @duplicate="emit('duplicate-step', step.id)"
          @view-yaml="emit('view-yaml', step.id)"
        />

        <!-- 行内编辑面板(schema-driven) -->
        <StepEditorPanel
          v-if="editingId === step.id"
          :action="step.action"
          :body="editingBody"
          @update:body="(b: unknown) => emit('save-edit-body', step.id, step.action, b)"
          @close="emit('cancel-edit')"
        />

        <!-- 嵌套 children(repeat / retry / runFlow) -->
        <div v-if="isContainer(step)" class="nested-children">
          <StepTree
            v-if="step.children && step.children.length > 0"
            :steps="step.children"
            :yaml-text="yamlText"
            :parent-id="step.id"
            :depth="(depth as number) + 1"
            :editing-id="editingId"
            @edit="(id) => emit('edit', id)"
            @save-edit="(id, patch) => emit('save-edit', id, patch)"
            @save-edit-body="(id, action, body) => emit('save-edit-body', id, action, body)"
            @cancel-edit="emit('cancel-edit')"
            @delete-step="(id) => emit('delete-step', id)"
            @duplicate-step="(id) => emit('duplicate-step', id)"
            @insert-after="(id) => emit('insert-after', id)"
            @reorder="bubbleReorder"
            @view-yaml="(id) => emit('view-yaml', id)"
            @add-step-in-container="(pid) => emit('add-step-in-container', pid)"
          />

          <ElButton
            class="add-in-container-btn"
            :icon="Plus"
            link
            size="small"
            @click="emit('add-step-in-container', step.id)"
          >
            {{ t('workflow.stepTree.addInContainer') }}
          </ElButton>
        </div>

        <!-- branch 的多分支(子步通过 add-in-container 按 arm 父 id 加;暂不支持 arm 内单独添加) -->
        <div v-if="step.branches && step.branches.length > 0" class="branches">
          <div v-for="(arm, armIdx) in step.branches" :key="armIdx" class="branch-arm">
            <div class="arm-label">
              {{ t('workflow.stepTree.branchLabel', { index: Number(armIdx) + 1 }) }}
              <span v-if="arm.when" class="arm-when">· when</span>
            </div>
            <StepTree
              :steps="arm.children"
              :yaml-text="yamlText"
              :parent-id="step.id"
              :depth="(depth as number) + 1"
              :editing-id="editingId"
              @edit="(id) => emit('edit', id)"
              @save-edit="(id, patch) => emit('save-edit', id, patch)"
              @save-edit-body="(id, action, body) => emit('save-edit-body', id, action, body)"
              @cancel-edit="emit('cancel-edit')"
              @delete-step="(id) => emit('delete-step', id)"
              @duplicate-step="(id) => emit('duplicate-step', id)"
              @insert-after="(id) => emit('insert-after', id)"
              @reorder="bubbleReorder"
              @add-step-in-container="(pid) => emit('add-step-in-container', pid)"
            />
          </div>
        </div>

        <!-- 间隙插入槽(非末尾;走元素拾取流程) -->
        <div
          v-if="index < steps.length - 1"
          class="step-insert-slot"
          @click="emit('insert-after', step.id)"
        >
          <span>{{ t('workflow.stepTree.insertElement') }}</span>
        </div>
      </div>
    </template>
  </draggable>
</template>

<style scoped>
.step-wrapper {
  position: relative;
}

/* 嵌套层缩进 + 左侧竖线 */
.nested-children {
  margin: 6px 0 6px 20px;
  padding-left: 8px;
  border-left: 2px solid var(--el-border-color-lighter);
}
.add-in-container-btn {
  margin: 4px 0 4px 8px;
}

.branches {
  margin: 6px 0;
}
.branch-arm {
  margin: 6px 0 6px 20px;
  padding-left: 8px;
  border-left: 2px dashed var(--el-color-primary-light-5);
}
.arm-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.arm-when {
  font-weight: 400;
  margin-left: 4px;
}

.step-ghost {
  opacity: 0.3;
  background: var(--el-color-primary-light-9) !important;
  border: 1.5px dashed var(--el-color-primary) !important;
}

.step-insert-slot {
  height: 6px;
  margin: 0 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  font-size: 11px;
  font-weight: 500;
  overflow: hidden;
}
.step-insert-slot:hover {
  height: 28px;
  background: var(--el-color-primary-light-9);
  border: 1px dashed var(--el-color-primary);
  color: var(--el-color-primary);
}
</style>
