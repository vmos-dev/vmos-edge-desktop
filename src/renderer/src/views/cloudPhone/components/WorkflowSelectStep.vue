<script setup lang="ts">
import { ref, computed, onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { invoke } from '@renderer/core/ipc'
import { WORKFLOW_EVENTS } from '@shared/ipc/workflow.types'
import type { WorkflowListItem } from '@shared/ipc/workflow.types'

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
}>()

const { t } = useI18n()
const workflows = ref<WorkflowListItem[]>([])
const loading = shallowRef(false)
const searchQuery = shallowRef('')

const grouped = computed(() => {
  const q = searchQuery.value.toLowerCase()
  const filtered = q
    ? workflows.value.filter(
        (w) => w.name.toLowerCase().includes(q) || w.appName.toLowerCase().includes(q)
      )
    : workflows.value
  const map = new Map<string, { icon?: string; items: WorkflowListItem[] }>()
  for (const w of filtered) {
    const key = w.appName || 'Other'
    if (!map.has(key)) map.set(key, { icon: w.appIcon, items: [] })
    map.get(key)!.items.push(w)
  }
  return map
})

function iconFallback(item: WorkflowListItem): string {
  const text = item.appName?.trim() || item.name?.trim() || 'W'
  return text.slice(0, 1).toUpperCase()
}

function updatedLabel(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < 2 * min) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  const d = new Date(ts)
  return d.getFullYear() === new Date().getFullYear()
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

onMounted(async () => {
  loading.value = true
  try {
    const resp = await invoke<WorkflowListItem[]>(WORKFLOW_EVENTS.LIST)
    if (resp.success && resp.data) {
      workflows.value = resp.data
    }
  } finally {
    loading.value = false
  }
})

function selectWorkflow(id: string) {
  emit('update:modelValue', id)
}
</script>

<template>
  <div class="wf-select" v-loading="loading">
    <el-input
      v-model="searchQuery"
      :placeholder="t('taskCenter.batchExecute.searchWorkflow')"
      clearable
      class="wf-search"
    />

    <div class="wf-list">
      <template v-for="[appName, group] in grouped" :key="appName">
        <div class="wf-group">
          <img v-if="group.icon" class="group-icon" :src="group.icon" :alt="appName" />
          <span v-else class="group-icon-fallback">{{ appName.slice(0, 1).toUpperCase() }}</span>
          <span class="group-name">{{ appName }}</span>
          <span class="group-count">{{ group.items.length }}</span>
        </div>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="wf-row"
          :class="{ selected: item.id === modelValue }"
          @click="selectWorkflow(item.id)"
        >
          <div class="wf-icon">
            <img v-if="item.appIcon" :src="item.appIcon" :alt="item.appName" />
            <span v-else class="wf-icon-fallback">{{ iconFallback(item) }}</span>
          </div>
          <div class="wf-content">
            <span class="wf-name">{{ item.name }}</span>
            <span class="wf-detail">
              <span class="wf-steps">{{
                t('taskCenter.batchExecute.steps', { count: item.stepCount })
              }}</span>
              <span v-if="item.updatedAt" class="wf-dot">·</span>
              <span v-if="item.updatedAt" class="wf-time">{{ updatedLabel(item.updatedAt) }}</span>
            </span>
          </div>
          <div class="wf-check" v-if="item.id === modelValue">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
      </template>
      <div v-if="grouped.size === 0 && !loading" class="wf-empty">
        <el-empty :image-size="60" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wf-select {
  min-height: 320px;
}

.wf-search {
  margin-bottom: 14px;
}

.wf-search :deep(.el-input__wrapper) {
  border-radius: var(--app-radius-base);
}

.wf-list {
  max-height: 370px;
  overflow-y: auto;
}

/* ── 分组头 ── */
.wf-group {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 4px 8px;
}

.wf-group:first-child {
  padding-top: 4px;
}

.group-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.group-icon-fallback {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.group-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.3px;
}

.group-count {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

/* ── 工作流行 ── */
.wf-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.wf-row:hover {
  background: var(--el-fill-color-light);
}

.wf-row.selected {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-5);
}

/* ── 图标 ── */
.wf-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: transform 0.2s ease;
}

.wf-row:hover .wf-icon {
  transform: scale(1.05);
}

.wf-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wf-icon-fallback {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-color-primary);
  letter-spacing: -0.02em;
}

.wf-row.selected .wf-icon {
  box-shadow: 0 2px 6px var(--el-color-primary-light-7);
}

/* ── 文本内容 ── */
.wf-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wf-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.wf-row.selected .wf-name {
  color: var(--el-color-primary);
}

.wf-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  line-height: 1.2;
}

.wf-steps {
  font-variant-numeric: tabular-nums;
}

.wf-dot {
  opacity: 0.5;
}

.wf-time {
  font-variant-numeric: tabular-nums;
}

/* ── 选中勾 ── */
.wf-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wf-check svg {
  width: 12px;
  height: 12px;
}

.wf-empty {
  padding: 40px 0;
}
</style>
