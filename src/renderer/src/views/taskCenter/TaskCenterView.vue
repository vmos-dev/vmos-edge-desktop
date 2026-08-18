<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { invoke } from '@renderer/core/ipc'
import { BATCH_TASK_EVENTS } from '@shared/ipc/batchTask.types'
import type { BatchTaskStatus } from '@shared/ipc/batchTask.types'
import { useBatchTaskList } from './composables/useBatchTaskList'
import TaskStatsBar from './components/TaskStatsBar.vue'
import TaskTable from './components/TaskTable.vue'

const { t } = useI18n()
const router = useRouter()
const { tasks, stats, loading, filterStatus, refresh } = useBatchTaskList()

function setFilter(status: BatchTaskStatus | undefined) {
  filterStatus.value = status
  refresh()
}

function handleDetail(id: string) {
  router.push(`/automation/task/${id}`)
}

async function handleCancel(id: string) {
  await invoke(BATCH_TASK_EVENTS.CANCEL, { batchTaskId: id })
  refresh()
}

async function handleDelete(id: string) {
  await invoke(BATCH_TASK_EVENTS.DELETE, id)
  refresh()
}
</script>

<template>
  <div class="task-center-view">
    <TaskStatsBar :stats="stats" />

    <div class="filter-bar">
      <div class="filter-tabs">
        <span class="filter-tab" :class="{ active: !filterStatus }" @click="setFilter(undefined)">
          {{ t('taskCenter.stats.total') }}
        </span>
        <span
          class="filter-tab"
          :class="{ active: filterStatus === 'RUNNING' }"
          @click="setFilter('RUNNING')"
        >
          {{ t('taskCenter.stats.running') }}
        </span>
        <span
          class="filter-tab"
          :class="{ active: filterStatus === 'DONE' }"
          @click="setFilter('DONE')"
        >
          {{ t('taskCenter.stats.done') }}
        </span>
        <span
          class="filter-tab"
          :class="{ active: filterStatus === 'CANCELLED' }"
          @click="setFilter('CANCELLED')"
        >
          {{ t('taskCenter.status.cancelled') }}
        </span>
      </div>
    </div>

    <TaskTable
      :tasks="tasks"
      :loading="loading"
      @detail="handleDetail"
      @cancel="handleCancel"
      @delete="handleDelete"
    />
  </div>
</template>

<style scoped>
.task-center-view {
  padding: 20px 28px;
  height: 100%;
  overflow-y: auto;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--app-padding-base);
}

.filter-tabs {
  display: flex;
  gap: 2px;
  background: var(--el-fill-color-light);
  border-radius: var(--app-radius-base);
  padding: 3px;
}

.filter-tab {
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.25s ease;
  user-select: none;
}

.filter-tab:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color);
}

.filter-tab.active {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
</style>
