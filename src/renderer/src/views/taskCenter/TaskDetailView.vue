<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { invoke } from '@renderer/core/ipc'
import { BATCH_TASK_EVENTS } from '@shared/ipc/batchTask.types'
import { useBatchTaskDetail } from './composables/useBatchTaskDetail'
import { useBatchTaskItemSteps } from './composables/useBatchTaskItemSteps'
import { itemStatusTagType } from './utils/stepParsing'
import { mergeEnv } from './utils/envResolver'
import DeviceList from './components/DeviceList.vue'
import StepTimeline from './components/StepTimeline.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const batchTaskId = route.params.id as string
const { data, loading, selectedDeviceId, refresh } = useBatchTaskDetail(batchTaskId)

const task = computed(() => data.value?.task ?? null)
const items = computed(() => data.value?.items ?? [])
const selectedItem = computed(() => items.value.find((i) => i.deviceId === selectedDeviceId.value))
const selectedItemStatus = computed(() => selectedItem.value?.status)

const { steps, loading: stepsLoading } = useBatchTaskItemSteps(
  batchTaskId,
  selectedDeviceId,
  selectedItemStatus
)

const resolvedEnv = computed(() => {
  let deviceEnv: Record<string, string> = {}
  const json = selectedItem.value?.envJson
  if (json)
    try {
      deviceEnv = JSON.parse(json)
    } catch {
      /* ignore */
    }
  return mergeEnv(task.value?.yamlText ?? '', deviceEnv)
})

function goBack() {
  router.push('/automation?tab=tasks')
}

function handleSelectDevice(deviceId: string) {
  selectedDeviceId.value = deviceId
}

async function handleCancelDevice(deviceId: string) {
  await invoke(BATCH_TASK_EVENTS.CANCEL_ITEM, { batchTaskId, deviceId })
  refresh()
}

async function handleCancelAll() {
  await invoke(BATCH_TASK_EVENTS.CANCEL, { batchTaskId })
  refresh()
}
</script>

<template>
  <div class="task-detail-view" v-loading="loading">
    <div class="detail-header">
      <el-button link class="back-btn" @click="goBack">
        <el-icon size="16">
          <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z"
            />
          </svg>
        </el-icon>
      </el-button>
      <div v-if="task" class="header-summary">
        <h3 class="task-name">{{ task.name }}</h3>
        <span class="task-meta">{{ task.workflowName }}</span>
      </div>
      <div class="header-actions" v-if="task?.status === 'RUNNING'">
        <el-button type="danger" size="small" round @click="handleCancelAll">
          {{ t('taskCenter.detail.cancelAll') }}
        </el-button>
      </div>
    </div>

    <div class="detail-body" v-if="task">
      <div class="device-panel">
        <DeviceList
          :items="items"
          :selected-device-id="selectedDeviceId"
          @select="handleSelectDevice"
          @cancel="handleCancelDevice"
        />
      </div>
      <div class="steps-panel">
        <div class="steps-header" v-if="selectedDeviceId">
          <div class="steps-header-left">
            <span class="steps-title">{{ t('taskCenter.detail.currentStep') }}</span>
            <span class="steps-device-name">{{ selectedItem?.deviceName }}</span>
          </div>
          <el-tag
            v-if="selectedItem"
            :type="itemStatusTagType(selectedItem.status)"
            size="small"
            round
          >
            {{ selectedItem.status }}
          </el-tag>
        </div>
        <div class="steps-body">
          <StepTimeline :steps="steps" :loading="stepsLoading" :env="resolvedEnv" />
        </div>
        <div v-if="!selectedDeviceId && !stepsLoading" class="steps-empty">
          <el-empty :image-size="80" :description="t('taskCenter.detail.currentStep')" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-detail-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color-page);
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
}

.back-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--app-radius-base) !important;
  background: var(--el-fill-color-light) !important;
  color: var(--el-text-color-regular) !important;
  flex-shrink: 0;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--el-fill-color) !important;
  color: var(--el-text-color-primary) !important;
}

.header-summary {
  flex: 1;
  min-width: 0;
}

.task-name {
  margin: 0;
  font-size: var(--app-text-h3-size);
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-meta {
  display: block;
  font-size: var(--app-text-small-size);
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
}

.detail-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  gap: 0;
}

.device-panel {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
}

.steps-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.steps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.steps-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.steps-title {
  font-size: var(--app-text-body-size);
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
}

.steps-device-name {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  padding: 2px 10px;
  border-radius: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.steps-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.steps-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
