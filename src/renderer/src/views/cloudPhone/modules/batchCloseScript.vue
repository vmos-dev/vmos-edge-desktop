<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.closeScriptExecution')"
    width="700px"
    :show-close="!isProcessing"
    @closed="handleClose"
  >
    <div class="batch-close-script-container">
      <div class="confirm-tip">
        {{ t('cloudPhone.closeScriptConfirm', { count: deviceCount }) }}
      </div>

      <!-- 任务详情：设备列表与执行结果一起展示 -->
      <div class="results-container">
        <el-scrollbar max-height="300px">
          <el-collapse v-model="activeNames" class="results-collapse">
            <el-collapse-item
              v-for="(task, index) in displayList"
              :key="task.id"
              :name="task.id"
              :class="getResultClass(task.status)"
              style="padding-bottom: 0px"
            >
              <template #title>
                <div class="result-item-title">
                  <span class="result-index">{{ index + 1 }}.</span>
                  <el-icon :class="getStatusIconClass(task.status)">
                    <component :is="getStatusIcon(task.status)" />
                  </el-icon>
                  <span class="device-info">
                    {{ task.meta?.device?.user_name }} - {{ task.meta?.device?.db_id }}
                  </span>
                  <span v-if="task.status === 'processing'" class="status-text">{{
                    t('cloudPhone.executing')
                  }}</span>
                  <span v-else-if="task.status === 'success'" class="status-text success">
                    {{ t('cloudPhone.executeSuccess') }}
                  </span>
                  <span
                    v-else-if="task.status === 'error' || task.status === 'cancelled'"
                    class="status-text error"
                  >
                    {{ t('cloudPhone.executeFailed') }}
                  </span>
                  <span v-else class="status-text">{{ t('common.waiting') }}</span>
                </div>
              </template>

              <div class="result-content">
                <div v-if="'error' in task && task.error" class="error-message">
                  <pre>{{ getErrorMessage(task.error) }}</pre>
                </div>
                <div v-else-if="task.status === 'success'" class="empty-message">
                  {{ t('cloudPhone.scriptStopped') }}
                </div>
                <div v-else class="empty-message">{{ t('cloudPhone.waiting') }}</div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer-content">
        <div class="queue-status" v-if="isExecuted && (isProcessing || displayList.length > 0)">
          <div class="status-item processing">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.executing') }}</span>
            <span class="count">{{
              displayList.filter((t) => t.status === 'processing').length
            }}</span>
          </div>
          <div class="status-item success">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.executeSuccess') }}</span>
            <span class="count">{{
              displayList.filter((t) => t.status === 'success').length
            }}</span>
          </div>
          <div class="status-item error">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.executeFailed') }}</span>
            <span class="count">{{
              displayList.filter((t) => t.status === 'error' || t.status === 'cancelled').length
            }}</span>
          </div>
          <div class="status-item waiting">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.waiting') }}</span>
            <span class="count">{{
              displayList.filter((t) => t.status === 'waiting').length
            }}</span>
          </div>
        </div>
        <div class="dialog-actions">
          <el-button type="primary" @click="handleSubmit" :loading="isProcessing">
            {{ t('cloudPhone.confirmStop') }}
          </el-button>
        </div>
      </div>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import type { Device } from '@shared/ipc/data.types'
import { getErrorMessage } from '@shared/api'
import { RequestQueue, type RequestTask } from '@renderer/utils/requestQueue'
import { useI18n } from 'vue-i18n'
import { AutomationService } from '@renderer/views/automation/services/automationService'

const { t } = useI18n()

const visible = ref(false)
const devices = ref<Device[]>([])
const isExecuted = ref(false)
const activeNames = ref<number[]>([])

// 队列控制并发
const queue = new RequestQueue({ concurrency: 10 })
const taskList = ref<RequestTask[]>([])
const isProcessing = ref(false)

const deviceCount = computed(() => devices.value.length)

// 任务详情：执行前展示设备列表(待执行)，执行后展示 taskList 状态
const displayList = computed(() => {
  if (isExecuted.value && taskList.value.length > 0) {
    return taskList.value
  }
  return devices.value.map((d, i) => ({
    id: `pre-${i}`,
    status: 'waiting' as const,
    meta: { device: d }
  }))
})

queue.on('change', (list) => {
  taskList.value = [...list]
})

queue.on('finish', () => {
  if (isProcessing.value) {
    const success = taskList.value.filter((t) => t.status === 'success').length
    const fail = taskList.value.filter(
      (t) => t.status === 'error' || t.status === 'cancelled'
    ).length

    if (fail > 0) {
      ElMessage.warning(t('cloudPhone.executeCompleted', { success, fail }))
      activeNames.value = taskList.value
        .filter((t) => t.status === 'error' || t.status === 'cancelled')
        .map((t) => t.id)
    } else {
      ElMessage.success(t('cloudPhone.closeScriptSuccess', { count: success }))
    }
    isProcessing.value = false
  }
})

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'processing':
      return Loading
    case 'success':
      return SuccessFilled
    case 'error':
    case 'cancelled':
      return CircleCloseFilled
    default:
      return Loading
  }
}

const getStatusIconClass = (status: string) => {
  return `status-icon status-icon-${status === 'waiting' ? 'loading' : status}`
}

const getResultClass = (status: string) => {
  return `result-item result-item-${status === 'waiting' ? 'loading' : status}`
}

const handleClose = () => {
  queue.clearAllTasks()
  isExecuted.value = false
  activeNames.value = []
  isProcessing.value = false
}

const handleSubmit = () => {
  if (isProcessing.value) return

  queue.clearAllTasks()
  isExecuted.value = true
  isProcessing.value = true

  devices.value.forEach((device) => {
    const url = AutomationService.getDeviceApiUrl(device, 'workflow/cancel')
    queue.add({
      url,
      method: 'POST',
      data: {},
      meta: { device },
      timeout: 10000
    })
  })
}

const init = (targetDevices: Device[]) => {
  devices.value = targetDevices
  visible.value = true
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.batch-close-script-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.confirm-tip {
  font-size: 14px;
  color: var(--el-text-color-regular);
  padding: 8px 0;
}

.results-container {
  border-top: 1px solid var(--el-border-color);
  padding-top: 10px;
}

.results-collapse {
  border: none;
  :deep(.el-collapse-item__content) {
    padding-bottom: 0px;
  }

  :deep(.el-collapse-item) {
    margin-bottom: 8px;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    overflow: hidden;

    &.result-item-loading,
    &.result-item-waiting {
      background-color: var(--el-color-primary-light-9);
    }

    &.result-item-success {
      background-color: var(--el-color-primary-light-9);
    }

    &.result-item-error,
    &.result-item-cancelled {
      background-color: var(--el-color-danger-light-9);
    }
  }

  :deep(.el-collapse-item__header) {
    height: auto;
    min-height: 36px;
    line-height: 1.5;
    padding: 8px 12px;
    border: none;
    background-color: transparent;
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
    background-color: var(--el-bg-color);
  }
}

.result-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  font-size: 13px;

  .result-index {
    color: var(--el-text-color-regular);
    font-size: 13px;
    min-width: 18px;
  }

  .status-icon {
    font-size: 18px;

    &.status-icon-processing {
      color: var(--el-color-primary);
      animation: rotating 2s linear infinite;
    }

    &.status-icon-success {
      color: var(--el-color-success);
    }

    &.status-icon-error,
    &.status-icon-cancelled {
      color: var(--el-color-danger);
    }

    &.status-icon-loading {
      color: var(--el-text-color-secondary);
    }
  }

  .device-info {
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .status-text {
    margin-left: auto;
    margin-right: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    &.success {
      color: var(--el-color-success);
    }

    &.error {
      color: var(--el-color-danger);
    }
  }
}

.result-content {
  font-size: 13px;

  .error-message pre {
    background-color: var(--el-color-danger-light-9);
    border-top: 1px solid var(--el-color-danger-light-7);
    padding: 12px;
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    color: var(--el-color-danger);
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.5;
    max-height: 300px;
    overflow-y: auto;
  }

  .empty-message {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    padding: 12px;
    text-align: center;
  }
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.dialog-footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.queue-status {
  display: flex;
  align-items: center;
  gap: 16px;

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .count {
      font-weight: 600;
      min-width: 14px;
    }

    &.processing {
      color: var(--el-color-primary);
      .dot {
        background-color: var(--el-color-primary);
      }
    }
    &.success {
      color: var(--el-color-success);
      .dot {
        background-color: var(--el-color-success);
      }
    }
    &.error {
      color: var(--el-color-danger);
      .dot {
        background-color: var(--el-color-danger);
      }
    }
    &.waiting {
      color: var(--el-text-color-secondary);
      .dot {
        background-color: var(--el-text-color-secondary);
      }
    }
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-left: auto;
}
</style>
