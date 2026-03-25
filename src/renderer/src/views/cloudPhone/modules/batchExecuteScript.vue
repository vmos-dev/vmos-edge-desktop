<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.batchExecuteScript')"
    width="700px"
    :show-close="!isProcessing"
    @closed="handleClose"
  >
    <div class="batch-script-container">
      <!-- 脚本选择区 -->
      <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" label-position="top">
        <el-form-item :label="t('cloudPhone.selectScript')" prop="scriptId">
          <el-select
            v-model="form.scriptId"
            :placeholder="t('cloudPhone.selectScriptPlaceholder')"
            style="width: 100%"
            filterable
            :disabled="isProcessing"
            @focus="fetchScripts"
          >
            <el-option v-for="item in scripts" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <div class="tip">{{ t('cloudPhone.batchScriptTip', { count: deviceCount }) }}</div>
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
            {{ t('common.cancel') }}
          </el-button>
          <el-button type="primary" @click="handleSubmit" :loading="isProcessing">
            {{ t('cloudPhone.confirmExecute') }}
          </el-button>
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
import { getErrorMessage } from '@shared/api'
import { RequestQueue, type RequestTask } from '@renderer/utils/requestQueue'
import { useI18n } from 'vue-i18n'
import { ipc } from '@renderer/core/ipc'
import { AUTOMATION_SCRIPT_EVENTS } from '@shared/ipc/automationScript.types'
import type { AutomationScriptRecord } from '@shared/ipc/automationScript.types'
import { AutomationService } from '@renderer/views/automation/services/automationService'

const { t } = useI18n()

const visible = ref(false)
const devices = ref<Device[]>([])
const scripts = ref<AutomationScriptRecord[]>([])
const isExecuted = ref(false)
const activeNames = ref<number[]>([])

// 队列控制并发，参考 execCommand
const queue = new RequestQueue({ concurrency: 10 })
const taskList = ref<RequestTask[]>([])
const isProcessing = ref(false)

const deviceCount = computed(() => devices.value.length)

const form = ref({
  scriptId: ''
})

const formRef = ref<InstanceType<typeof ElForm>>()

const rules = computed(() => ({
  scriptId: [{ required: true, message: t('cloudPhone.selectScriptFirst'), trigger: 'change' }]
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

const fetchScripts = async () => {
  if (scripts.value.length > 0) return
  try {
    const res = await ipc.invoke<AutomationScriptRecord[]>(AUTOMATION_SCRIPT_EVENTS.GET_SCRIPTS)
    if (res.success && res.data?.length) {
      scripts.value = res.data
    }
  } catch (e) {
    console.error('[BatchExecuteScript] fetchScripts failed', e)
  }
}

const handleClose = () => {
  queue.clearAllTasks()
  form.value.scriptId = ''
  isExecuted.value = false
  activeNames.value = []
  formRef.value?.resetFields()
  isProcessing.value = false
  scripts.value = []
}

const handleCancel = () => {
  visible.value = false
}

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || isProcessing.value) return

    const scriptId = form.value.scriptId
    const script = scripts.value.find((s) => s.id === scriptId)
    if (!script) {
      ElMessage.warning(t('cloudPhone.selectScriptFirst'))
      return
    }

    let workflow: any
    try {
      workflow = JSON.parse(script.content)
    } catch (e) {
      ElMessage.error(t('cloudPhone.scriptParseFailed'))
      return
    }

    if (!workflow?.flow?.length) {
      ElMessage.error(t('cloudPhone.scriptEmpty'))
      return
    }

    // 每次执行前清空上一次的执行记录
    queue.clearAllTasks()
    taskList.value = []
    activeNames.value = []
    isExecuted.value = true
    isProcessing.value = true

    devices.value.forEach((device) => {
      const url = AutomationService.getDeviceApiUrl(device, 'workflow/execute')
      queue.add({
        url,
        method: 'POST',
        data: workflow,
        meta: { device },
        timeout: 30000 // HTTP 请求超时，批量为异步下发任务
      })
    })
  })
}

const init = (targetDevices: Device[]) => {
  devices.value = targetDevices
  scripts.value = []
  form.value.scriptId = ''
  visible.value = true
  fetchScripts()
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.batch-script-container {
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

  .error-message pre,
  .success-message pre {
    background-color: var(--el-bg-color-page);
    border-top: 1px solid var(--el-border-color);
    padding: 12px;
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.5;
    max-height: 300px;
    overflow-y: auto;
  }

  .error-message pre {
    background-color: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
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
