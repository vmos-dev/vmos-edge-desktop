<script setup lang="ts">
/**
 * StepItem · 步骤列表中的一行(48px)
 *
 * 视觉灵感:Apple Shortcuts 卡片 + Linear 行布局
 *  - 左 3px 类别色条
 *  - 28×28 类别色圆 icon
 *  - 13px medium action 名(默认色)
 *  - 13px regular summary(slate-600 同等;EP `text-color-regular`)
 *  - 复合容器:右侧 ElTag 显示 「× 3」「2 分支」等
 *  - hover:行底色 = 类别 bg50;hover-only 的 [view] [delete] 按钮
 *
 * 不依赖 emoji / 不依赖稳定度色点;一切来自 ACTION_REGISTRY + actionCategoryStyle。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElIcon, ElTag } from 'element-plus'
import { Delete, View } from '@element-plus/icons-vue'
import type { Step } from '../types'
import { actionLabel, actionSummary, getActionDefinition } from '../utils/actionRegistry'
import { categoryStyle } from '../utils/actionCategoryStyle'

interface Props {
  step: Step
  index: number
}

const props = defineProps<Props>()
const { t } = useI18n()
defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'duplicate'): void
  (e: 'view-yaml'): void
}>()

const definition = computed(() => getActionDefinition(props.step.action))
const style = computed(() => categoryStyle(definition.value?.category))

const label = computed(() => actionLabel(props.step.action))

/** 摘要:Step 模型已把 body 拆到 selector / params,这里以"对象等价物"喂 registry.summary */
const summary = computed(() => {
  const step = props.step
  const fakeBody: unknown = step.selector?.primary?.value ?? step.params ?? step.raw
  return actionSummary(step.action, fakeBody)
})

/** 容器 chip:repeat × 3 / 2 分支 / 重试 1 次 */
const containerChip = computed<string | null>(() => {
  const def = definition.value
  if (!def) return null
  if (Array.isArray(props.step.children) || Array.isArray(props.step.branches)) {
    const text = def.summary(props.step.params ?? props.step.branches)
    return text || null
  }
  return null
})
</script>

<template>
  <div
    class="step-row"
    :class="{ disabled: step.disabled }"
    role="button"
    :tabindex="0"
    @click="$emit('edit')"
    @keydown.enter.prevent="$emit('edit')"
  >
    <!-- 左侧色条(类别色),3px 宽 -->
    <span class="stripe" :style="{ background: style.c500 }" aria-hidden="true" />

    <!-- 类别图标圆 -->
    <span
      class="cat-icon"
      :style="{ background: style.bg50, color: style.c700 }"
      aria-hidden="true"
    >
      <ElIcon :size="14"><component :is="style.icon" /></ElIcon>
    </span>

    <!-- 序号 -->
    <span class="num">{{ index + 1 }}</span>

    <!-- 主内容(action + summary) -->
    <span class="content">
      <span class="action">{{ label }}</span>
      <span v-if="summary" class="summary" :title="summary">{{ summary }}</span>
    </span>

    <!-- 容器 chip(按 category 上色) -->
    <ElTag
      v-if="containerChip"
      size="small"
      effect="light"
      :style="{
        background: style.bg100,
        color: style.c700,
        border: 'none'
      }"
      class="chip"
    >
      {{ containerChip }}
    </ElTag>

    <span class="grow" />

    <!-- hover-only 操作按钮 -->
    <ElButton
      class="hover-btn"
      :icon="View"
      size="small"
      link
      :title="t('workflow.stepItem.viewYaml')"
      :aria-label="t('workflow.stepItem.viewYaml')"
      @click.stop="$emit('view-yaml')"
    />
    <ElButton
      class="hover-btn danger-btn"
      :icon="Delete"
      size="small"
      link
      :title="t('workflow.stepItem.deleteStep')"
      :aria-label="t('workflow.stepItem.deleteStep')"
      @click.stop="$emit('delete')"
    />
  </div>
</template>

<style scoped>
.step-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 12px 0 14px;
  border-radius: 8px;
  cursor: pointer;
  outline: none;
  background: transparent;
  transition: background 0.15s ease;
}

.step-row:hover {
  background: v-bind('style.bg50');
}

.step-row:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.step-row.disabled {
  opacity: 0.45;
}

.stripe {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
}

.cat-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.num {
  flex-shrink: 0;
  width: 18px;
  text-align: right;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

.content {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.action {
  flex-shrink: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.01em;
}

.summary {
  font-size: 13px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.chip {
  flex-shrink: 0;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.grow {
  flex: 1 1 0;
  min-width: 0;
}

.hover-btn {
  opacity: 0;
  transition: opacity 0.15s;
}
.step-row:hover .hover-btn,
.step-row:focus-within .hover-btn {
  opacity: 1;
}

.danger-btn :deep(.el-icon) {
  color: var(--el-text-color-placeholder);
}
.danger-btn:hover :deep(.el-icon) {
  color: var(--el-color-danger);
}
</style>
