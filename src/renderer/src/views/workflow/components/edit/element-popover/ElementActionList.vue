<script setup lang="ts">
import { ElIcon } from 'element-plus'
import type { ActionRule } from '../../../types'
import type { ElementActionListItem } from './types'

defineProps<{
  items: ElementActionListItem[]
}>()

defineEmits<{
  (e: 'apply', rule: ActionRule): void
}>()
</script>

<template>
  <div class="action-list">
    <button
      v-for="item in items"
      :key="item.rule.id"
      type="button"
      class="action-row"
      @click="$emit('apply', item.rule)"
    >
      <div class="icon-box" aria-hidden="true">
        <ElIcon :size="14" color="#fff">
          <component :is="item.style.icon" />
        </ElIcon>
      </div>

      <div class="copy">
        <div class="label">{{ item.label }}</div>
        <div class="description">{{ item.description }}</div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--el-bg-color);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.action-row:hover {
  background: var(--el-fill-color-lighter);
  border-color: var(--el-color-primary-light-5);
  transform: translateX(4px);
}

.icon-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--el-color-primary);
  border-radius: 5px;
  flex-shrink: 0;
}

.copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

.description {
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.2;
}
</style>
