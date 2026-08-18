<script setup lang="ts">
/**
 * 分组 section · 轻量化
 *
 * 只做 header + grid,不再包圆角卡片 / blur / 渐变 icon。
 */
import type { WorkflowGroupItem } from '../../composables/useWorkflowGroups'
import WorkflowCard from './WorkflowCard.vue'

interface Props {
  group: WorkflowGroupItem
  showHeader?: boolean
}

interface Emits {
  (e: 'open', id: string): void
  (e: 'delete', id: string): void
}

withDefaults(defineProps<Props>(), { showHeader: true })
const emit = defineEmits<Emits>()
</script>

<template>
  <section class="wf-group">
    <header v-if="showHeader" class="group-head">
      <img v-if="group.appIcon" class="group-icon" :src="group.appIcon" :alt="group.label" />
      <span v-else class="group-icon group-icon-fallback" aria-hidden="true">
        {{ group.label.slice(0, 1).toUpperCase() }}
      </span>

      <h2 class="group-title">{{ group.label }}</h2>
      <span class="group-count">{{ group.count }}</span>
      <p v-if="group.subtitle" class="group-subtitle">{{ group.subtitle }}</p>
    </header>

    <div class="group-grid">
      <WorkflowCard
        v-for="workflow in group.items"
        :key="workflow.id"
        :workflow="workflow"
        @open="(id) => emit('open', id)"
        @delete="(id) => emit('delete', id)"
      />
    </div>
  </section>
</template>

<style scoped>
.wf-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 4px;
}

.group-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.group-icon-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--wf-surface-tint);
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.group-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--el-text-color-primary);
}

.group-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: 5px;
}

.group-subtitle {
  margin: 0 0 0 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-placeholder);
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
</style>
