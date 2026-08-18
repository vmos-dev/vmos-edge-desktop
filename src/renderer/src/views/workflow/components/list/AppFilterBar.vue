<script setup lang="ts">
/**
 * 应用侧边栏 · Finder 风纵向列表
 *
 * "全部" 行 + 每个应用一行,选中通过底色 + 左缘细竖线强调。
 * 点击触发过滤,由父组件维护 activeId(null = 全部)。
 */
import { useI18n } from 'vue-i18n'
import type { WorkflowGroupNavItem } from '../../composables/useWorkflowGroups'

interface Props {
  items: readonly WorkflowGroupNavItem[]
  activeId: string | null
  total: number
}

interface Emits {
  (e: 'navigate', id: string | null): void
}

defineProps<Props>()
defineEmits<Emits>()
const { t } = useI18n()
</script>

<template>
  <aside class="wf-sidebar" :aria-label="t('workflow.filterBar.ariaLabel')">
    <nav class="sidebar-list" role="tablist">
      <button
        type="button"
        class="row"
        :class="{ active: activeId === null }"
        role="tab"
        :aria-selected="activeId === null"
        @click="$emit('navigate', null)"
      >
        <span class="row-label">{{ t('workflow.filterBar.all') }}</span>
        <span class="row-count">{{ total }}</span>
      </button>

      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="row"
        :class="{ active: activeId === item.id }"
        role="tab"
        :aria-selected="activeId === item.id"
        :title="item.label"
        @click="$emit('navigate', item.id)"
      >
        <img v-if="item.appIcon" class="row-icon" :src="item.appIcon" :alt="item.label" />
        <span v-else class="row-icon row-icon-fallback" aria-hidden="true">
          {{ item.label.slice(0, 1).toUpperCase() }}
        </span>
        <span class="row-label">{{ item.label }}</span>
        <span class="row-count">{{ item.count }}</span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.wf-sidebar {
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  border-right: 1px solid var(--wf-hairline);
  background: var(--wf-sidebar-surface);
  overflow-y: auto;
}

.wf-sidebar::-webkit-scrollbar {
  width: 4px;
}

.wf-sidebar::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 10px;
}

.wf-sidebar:hover::-webkit-scrollbar-thumb {
  background: var(--el-border-color-lighter);
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  height: 38px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.row:hover {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}

.row:active {
  transform: scale(0.98);
}

.row:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.row.active {
  background: var(--el-color-primary);
  color: #fff;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--el-color-primary) 25%, transparent);
}

.row.active:hover {
  background: var(--el-color-primary);
  opacity: 0.95;
}

.row.active::before {
  display: none;
}

.row-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.row-icon-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--wf-surface-tint);
  color: var(--el-text-color-regular);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.row.active .row-icon-fallback {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.row-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.row-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
  background: var(--el-fill-color);
  padding: 2px 6px;
  border-radius: 6px;
}

.row.active .row-count {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .row {
    transition: none;
  }
}
</style>
