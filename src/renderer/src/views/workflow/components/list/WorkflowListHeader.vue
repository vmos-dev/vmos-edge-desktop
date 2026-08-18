<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElInput } from 'element-plus'
import { Plus, Search, RefreshRight } from '@element-plus/icons-vue'
import type { WorkflowGroupSummary } from '../../composables/useWorkflowGroups'

interface Props {
  summary: WorkflowGroupSummary
  loading?: boolean
}

interface Emits {
  (e: 'new'): void
  (e: 'refresh'): void
}

const props = defineProps<Props>()
defineEmits<Emits>()
const { t } = useI18n()

const keyword = defineModel<string>('keyword', { default: '' })

const subtitle = computed(() =>
  t('automation.listHeader.subtitle', {
    workflows: props.summary.workflowCount,
    apps: props.summary.appCount
  })
)
</script>

<template>
  <header class="wf-topbar">
    <div class="topbar-lead">
      <p class="topbar-meta">{{ subtitle }}</p>
    </div>

    <div class="topbar-actions">
      <ElInput
        v-model="keyword"
        :prefix-icon="Search"
        :placeholder="t('automation.listHeader.searchPlaceholder')"
        clearable
        class="topbar-search"
      />

      <button
        type="button"
        class="icon-btn"
        :disabled="loading"
        :aria-label="t('automation.listHeader.refresh')"
        @click="$emit('refresh')"
      >
        <RefreshRight :class="{ spinning: loading }" />
      </button>

      <ElButton type="primary" :icon="Plus" class="new-btn" @click="$emit('new')">
        {{ t('automation.listHeader.create') }}
      </ElButton>
    </div>
  </header>
</template>

<style scoped>
.wf-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 28px;
  border-bottom: 1px solid var(--wf-hairline);
  background: var(--wf-topbar-surface);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
  z-index: 10;
}

.topbar-lead {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topbar-meta {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.topbar-search {
  width: 280px;
  transition: width 200ms ease;
}

.topbar-search:focus-within {
  width: 320px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: all 160ms ease;
}

.icon-btn :deep(svg) {
  width: 16px;
  height: 16px;
}

.icon-btn:hover:not(:disabled) {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color);
  transform: translateY(-1px);
}

.icon-btn:active:not(:disabled) {
  transform: translateY(0);
}

.icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.new-btn {
  height: 34px;
  padding: 0 18px;
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--el-color-primary) 20%, transparent);
  transition: all 200ms ease;
}

.new-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--el-color-primary) 30%, transparent);
}

.new-btn:active {
  transform: translateY(0);
}

:deep(.topbar-search .el-input__wrapper) {
  min-height: 34px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
  background: var(--el-fill-color-blank);
  padding: 0 12px;
}

:deep(.topbar-search .el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px var(--el-color-primary) inset,
    0 0 0 3px var(--el-color-primary-light-8);
}

@media (prefers-reduced-motion: reduce) {
  .icon-btn,
  .new-btn,
  .topbar-search {
    transition: none;
  }

  .spinning {
    animation: none;
  }
}

@media (max-width: 720px) {
  .wf-topbar {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 16px 20px;
  }

  .topbar-actions {
    justify-content: space-between;
  }

  .topbar-search {
    flex: 1;
    width: auto;
  }

  .topbar-search:focus-within {
    width: auto;
  }
}
</style>
