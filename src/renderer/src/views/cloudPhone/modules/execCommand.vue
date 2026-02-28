<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.batchExecuteCommand')"
    width="700px"
    :show-close="!isProcessing"
    @closed="handleClose"
  >
    <div class="exec-command-container">
      <!-- 命令输入区 -->
      <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" label-position="top">
        <el-form-item :label="t('cloudPhone.batchExecuteCommand')" prop="command">
          <el-input
            v-model="form.command"
            type="textarea"
            :rows="4"
            :placeholder="t('cloudPhone.commandPlaceholder')"
            clearable
            :disabled="isProcessing || isExecuted"
          />
        </el-form-item>
        <el-form-item :label="t('cloudPhone.timeoutSeconds')" prop="timeout">
          <el-input-number
            v-model="form.timeout"
            :min="1"
            :max="600"
            :step="10"
            style="width: 150px"
            :placeholder="t('cloudPhone.timeoutPlaceholder')"
            :disabled="isProcessing || isExecuted"
          />
        </el-form-item>
        <div class="tip">{{ t('cloudPhone.executeTip', { count: deviceCount }) }}</div>
      </el-form>

      <!-- 执行结果区 -->
      <div v-if="isExecuted" class="results-container">
        <el-scrollbar max-height="300px">
          <el-collapse v-model="activeNames" class="results-collapse">
            <el-collapse-item
              v-for="(task, index) in taskList"
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
                  <span v-if="task.status === 'processing'" class="status-text">{{ t('cloudPhone.executing') }}</span>
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
                <div v-if="task.error" class="error-message">
                  <pre>{{ getErrorMessage(task.error) }}</pre>
                </div>
                <div v-else-if="task.data && task.data.message" class="success-message">
                  <pre>{{ task.data.message }}</pre>
                </div>
                <div v-else class="empty-message">{{ t('cloudPhone.noOutput') }}</div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer-content">
        <div class="queue-status" v-if="isProcessing || taskList.length > 0">
          <div class="status-item processing">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.executing') }}</span>
            <span class="count">{{
              taskList.filter((t) => t.status === 'processing').length
            }}</span>
          </div>
          <div class="status-item success">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.executeSuccess') }}</span>
            <span class="count">{{ taskList.filter((t) => t.status === 'success').length }}</span>
          </div>
          <div class="status-item error">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.executeFailed') }}</span>
            <span class="count">{{
              taskList.filter((t) => t.status === 'error' || t.status === 'cancelled').length
            }}</span>
          </div>
          <div class="status-item waiting">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.waiting') }}</span>
            <span class="count">{{ taskList.filter((t) => t.status === 'waiting').length }}</span>
          </div>
        </div>
        <div class="dialog-actions">
          <el-button @click="handleCancel" :disabled="isProcessing">
            {{ isExecuted ? t('cloudPhone.close') : t('common.cancel') }}
          </el-button>
          <el-button
            v-if="!isExecuted"
            type="primary"
            @click="handleSubmit"
            :loading="isProcessing"
          >
            {{ t('cloudPhone.confirmExecute') }}
          </el-button>
          <el-button v-else type="primary" @click="handleReset" :disabled="isProcessing"
            >{{ t('cloudPhone.reExecute') }}</el-button
          >
        </div>
      </div>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElForm, ElMessage } from 'element-plus'
import { Loading, SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import type { Device } from '@shared/ipc/data.types'
import { buildApiUrl, getErrorMessage, API_CONFIG } from '@shared/api'
import { RequestQueue, type RequestTask } from '@renderer/utils/requestQueue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const devices = ref<Device[]>([])
const isExecuted = ref(false)
const activeNames = ref<number[]>([])

// 队列相关
const queue = new RequestQueue({ concurrency: 10 })
const taskList = ref<RequestTask[]>([])
const isProcessing = ref(false)

const deviceCount = computed(() => devices.value.length)

const form = ref({
  command: '',
  timeout: 60
})

const formRef = ref<InstanceType<typeof ElForm>>()

const rules = computed(() => ({
  command: [{ required: true, message: t('cloudPhone.enterCommand'), trigger: 'blur' }],
  timeout: [{ required: true, message: t('cloudPhone.enterTimeout'), trigger: 'blur' }]
}))

// 监听队列变化
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
      // 自动展开失败的任务
      activeNames.value = taskList.value
        .filter((t) => t.status === 'error' || t.status === 'cancelled')
        .map((t) => t.id)
    } else {
      ElMessage.success(t('cloudPhone.batchExecuteCompleted', { success }))
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
  form.value.command = ''
  form.value.timeout = 60
  isExecuted.value = false
  activeNames.value = []
  formRef.value?.resetFields()
  isProcessing.value = false
}

const handleCancel = () => {
  visible.value = false
}

const handleReset = () => {
  if (isProcessing.value) return
  queue.clearAllTasks()
  isExecuted.value = false
  activeNames.value = []
}

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || isProcessing.value) return

    const combinedCommand = form.value.command.trim()
    if (!combinedCommand) {
      ElMessage.warning(t('cloudPhone.enterValidCommand'))
      return
    }

    // 先清理旧任务，此时触发 finish 事件，但 isProcessing 为 false，不会执行 finish 回调
    queue.clearAllTasks()

    isExecuted.value = true
    isProcessing.value = true

    devices.value.forEach((device) => {
      queue.add({
        url: buildApiUrl(device.host_ip || '', `${API_CONFIG.PATHS.EXEC_COMMAND}/${device.db_id}`),
        method: 'POST',
        data: {
          cmd: combinedCommand
        },
        meta: {
          device: device
        },
        timeout: form.value.timeout * 1000
      })
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
.exec-command-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}

.results-container {
  border-top: 1px solid var(--el-border-color);
  padding-top: 10px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;

  .results-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .results-summary {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
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
      color: var(--el-text-color-secondary); /* Waiting state */
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

  .error-message {
    pre {
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
  }

  .success-message {
    pre {
      background-color: var(--el-bg-color-page);
      border-top: 1px solid var(--el-border-color);
      padding: 12px;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: var(--el-text-color-primary);
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
      max-height: 300px;
      overflow-y: auto;
    }
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
