<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BatchTaskItem, BatchTaskItemStatus } from '@shared/ipc/batchTask.types'

const props = defineProps<{
  items: BatchTaskItem[]
  selectedDeviceId: string | null
  filterStatus?: BatchTaskItemStatus
}>()

const emit = defineEmits<{
  select: [deviceId: string]
  cancel: [deviceId: string]
}>()

const { t } = useI18n()

const filteredItems = computed(() => {
  if (!props.filterStatus) return props.items
  return props.items.filter((item) => item.status === props.filterStatus)
})

function statusColor(status: BatchTaskItemStatus): string {
  switch (status) {
    case 'RUNNING':
      return 'var(--el-color-primary)'
    case 'COMPLETED':
      return 'var(--el-color-success)'
    case 'FAILED':
    case 'SUBMIT_FAILED':
      return 'var(--el-color-danger)'
    case 'CANCELLED':
      return 'var(--el-text-color-placeholder)'
    case 'PENDING':
      return 'var(--el-color-warning)'
    default:
      return 'var(--el-border-color)'
  }
}

function statusLabel(status: BatchTaskItemStatus): string {
  switch (status) {
    case 'RUNNING':
      return t('taskCenter.status.running')
    case 'COMPLETED':
      return t('taskCenter.status.completed')
    case 'FAILED':
      return t('taskCenter.status.failed')
    case 'SUBMIT_FAILED':
      return t('taskCenter.status.submitFailed')
    case 'CANCELLED':
      return t('taskCenter.status.cancelled')
    case 'PENDING':
      return t('taskCenter.status.pending')
    default:
      return status
  }
}

function progressText(item: BatchTaskItem): string {
  if (item.progressTotal === 0) return ''
  return `${item.progressCompleted}/${item.progressTotal}`
}
</script>

<template>
  <div class="device-list">
    <div class="device-list-header">
      <span class="device-count"
        >{{ filteredItems.length }} {{ t('taskCenter.table.devices') }}</span
      >
    </div>
    <div class="device-list-body">
      <div
        v-for="item in filteredItems"
        :key="item.deviceId"
        class="device-item"
        :class="{ selected: item.deviceId === selectedDeviceId }"
        @click="emit('select', item.deviceId)"
      >
        <div class="device-dot" :style="{ background: statusColor(item.status) }" />
        <div class="device-body">
          <div class="device-top">
            <span class="device-name">{{ item.deviceName }}</span>
            <span v-if="progressText(item)" class="device-progress">{{ progressText(item) }}</span>
          </div>
          <div class="device-bottom">
            <span class="device-status" :style="{ color: statusColor(item.status) }">
              {{ statusLabel(item.status) }}
            </span>
            <el-button
              v-if="item.status === 'RUNNING' || item.status === 'PENDING'"
              link
              type="danger"
              size="small"
              @click.stop="emit('cancel', item.deviceId)"
            >
              {{ t('taskCenter.table.cancel') }}
            </el-button>
          </div>
        </div>
      </div>
      <div v-if="filteredItems.length === 0" class="device-empty">
        <el-empty :image-size="60" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.device-list-header {
  padding: 16px 20px 12px;
}

.device-count {
  font-size: var(--app-text-small-size);
  font-weight: 600;
  color: var(--el-text-color-placeholder);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.device-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.device-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 2px;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: var(--app-radius-base);
  transition: all 0.15s ease;
}

.device-item:hover {
  background: var(--el-fill-color-light);
}

.device-item.selected {
  background: var(--el-color-primary-light-9);
}

.device-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}

.device-item.selected .device-dot {
  box-shadow: 0 0 0 3px var(--el-color-primary-light-7);
}

.device-body {
  flex: 1;
  min-width: 0;
}

.device-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.device-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-progress {
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
  background: var(--el-fill-color-lighter);
  padding: 1px 8px;
  border-radius: 10px;
}

.device-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.device-status {
  font-size: 11px;
  font-weight: 500;
}

.device-empty {
  padding: 40px 0;
}
</style>
