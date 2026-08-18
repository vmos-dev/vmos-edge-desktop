<script setup lang="ts">
import type { ElementPropertyRow } from './types'

defineProps<{
  rows: ElementPropertyRow[]
}>()

defineEmits<{
  (e: 'copy', value: string): void
}>()
</script>

<template>
  <div class="property-list">
    <component
      :is="row.copyable ? 'button' : 'div'"
      v-for="row in rows"
      :key="row.key"
      class="property-row"
      :class="{ copyable: row.copyable }"
      :type="row.copyable ? 'button' : undefined"
      @click="row.copyable && $emit('copy', row.copyValue ?? row.value)"
    >
      <span class="key" :title="row.key">{{ row.key }}</span>
      <span class="value">{{ row.value }}</span>
    </component>
  </div>
</template>

<style scoped>
.property-list {
  display: flex;
  flex-direction: column;
  padding: 4px;
}

.property-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: transparent;
  text-align: left;
  width: 100%;
  border-radius: 6px;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.property-row:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: -2px;
}

.property-row:hover {
  background: var(--el-fill-color-lighter);
  transform: translateX(4px);
}

.property-row.copyable {
  cursor: pointer;
}

.key {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  font-family: var(--app-font-family);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  margin-right: 16px;
  padding-top: 1px;
}

.value {
  min-width: 0;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  font-family: 'SF Mono', 'Menlo', monospace;
  word-break: break-all;
  line-height: 1.4;
  text-align: right;
  opacity: 0.9;
}

.property-row.copyable:hover .value {
  color: var(--el-color-primary);
}
</style>
