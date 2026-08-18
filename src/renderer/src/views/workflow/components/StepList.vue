<script setup lang="ts">
/**
 * 步骤列表容器(顶层)
 *
 * 职责:
 *  - header / empty state / 滚动容器
 *  - 统一 editingId 状态(所有层级共享一个当前编辑步骤)
 *  - "+ 添加步骤"入口(底部 / 空态 CTA)
 *  - 把各种步骤事件聚合转发给父级
 * 嵌套渲染交给 StepTree
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { Step } from '../types'
import StepTree from './StepTree.vue'

interface Props {
  steps: readonly Step[]
  /** 整篇 YAML 文本 — 编辑表单从中派生 body */
  yamlText: string
}

interface Emits {
  /** 旧式 patch 路径(label / optional / chance 通用字段);保留兼容,新代码用 edit-step-body */
  (e: 'edit-step', id: string, patch: Partial<Omit<Step, 'id'>>): void
  /** schema 表单输出的整体 body 替换 */
  (e: 'edit-step-body', id: string, action: string, body: unknown): void
  (e: 'delete-step', id: string): void
  (e: 'duplicate-step', id: string): void
  /** 拾元素插入(走 device picker) */
  (e: 'insert-after', id: string): void
  (e: 'reorder', parentId: string | null, from: number, to: number): void
  /** 跳到 YAML 并定位 */
  (e: 'view-yaml', id: string): void
  /** 手动添加 — 在根末尾追加 */
  (e: 'add-step-root'): void
  /** 手动添加 — 追加到容器(repeat / retry / runFlow)的 commands 里 */
  (e: 'add-step-in-container', parentId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const count = computed(() => countTree(props.steps))
const editingId = ref<string | null>(null)

function countTree(list: readonly Step[]): number {
  let n = 0
  for (const s of list) {
    n += 1
    if (s.children) n += countTree(s.children)
    if (s.branches) for (const arm of s.branches) n += countTree(arm.children)
  }
  return n
}

function handleEditToggle(id: string): void {
  editingId.value = editingId.value === id ? null : id
}

function handleUpdateStep(id: string, patch: Partial<Omit<Step, 'id'>>): void {
  emit('edit-step', id, patch)
}

function handleEditBody(id: string, action: string, body: unknown): void {
  emit('edit-step-body', id, action, body)
}

function handleCloseEditor(): void {
  editingId.value = null
}
</script>

<template>
  <div class="step-list-panel">
    <div class="step-list-header">
      <div class="title">{{ t('workflow.stepList.title') }}</div>
      <div class="count">{{ t('workflow.statusBar.steps', { count }) }}</div>
    </div>

    <div v-if="count === 0" class="step-list-empty">
      <div class="empty-hint">{{ t('workflow.stepList.emptyHint') }}</div>
      <ElButton type="primary" :icon="Plus" @click="emit('add-step-root')">{{
        t('workflow.stepList.addStep')
      }}</ElButton>
    </div>

    <div v-else class="step-list-body">
      <StepTree
        :steps="steps"
        :yaml-text="yamlText"
        :editing-id="editingId"
        :parent-id="null"
        :depth="0"
        @edit="handleEditToggle"
        @save-edit="handleUpdateStep"
        @save-edit-body="handleEditBody"
        @cancel-edit="handleCloseEditor"
        @delete-step="(id) => emit('delete-step', id)"
        @duplicate-step="(id) => emit('duplicate-step', id)"
        @insert-after="(id) => emit('insert-after', id)"
        @reorder="(pid, from, to) => emit('reorder', pid, from, to)"
        @view-yaml="(id) => emit('view-yaml', id)"
        @add-step-in-container="(pid) => emit('add-step-in-container', pid)"
      />

      <div class="add-step-foot">
        <ElButton :icon="Plus" plain size="small" @click="emit('add-step-root')">
          {{ t('workflow.stepList.addStep') }}
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-list-panel {
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.step-list-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.step-list-header .title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.step-list-header .count {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.step-list-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  text-align: center;
  padding: 40px 20px;
}
.step-list-empty .empty-hint {
  color: var(--el-text-color-placeholder);
}

.step-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.add-step-foot {
  margin-top: 8px;
  padding: 4px;
  text-align: center;
}
</style>
