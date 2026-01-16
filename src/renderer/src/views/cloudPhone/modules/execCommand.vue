<template>
  <vmos-dialog
    v-model="visible"
    title="批量执行命令"
    width="800px"
    :show-close="!loading"
    @closed="handleClose"
  >
    <div class="exec-command-container">
      <!-- 命令输入区 -->
      <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" label-position="top">
        <el-form-item label="执行命令" prop="command">
          <el-input
            v-model="form.command"
            type="textarea"
            :rows="6"
            placeholder="请输入需要执行的命令，多条命令请换行"
            clearable
            :disabled="isExecuted"
          />
        </el-form-item>
        <div class="tip">提示：命令将在选中的 {{ deviceCount }} 台云机上并行执行。</div>
      </el-form>

      <!-- 执行结果区 -->
      <div v-if="isExecuted" class="results-container">
        <div class="results-header">
          <span class="results-title">执行结果</span>
          <span class="results-summary">
            成功: {{ successCount }} / 失败: {{ failedCount }} / 总计: {{ deviceCount }}
          </span>
        </div>

        <el-scrollbar max-height="400px">
          <el-collapse v-model="activeNames" class="results-collapse">
            <el-collapse-item
              v-for="(result, index) in executionResults"
              :key="result.device.id"
              :name="result.device.id"
              :class="getResultClass(result.status)"
            >
              <template #title>
                <div class="result-item-title">
                  <span class="result-index">{{ index + 1 }}.</span>
                  <el-icon :class="getStatusIconClass(result.status)">
                    <component :is="getStatusIcon(result.status)" />
                  </el-icon>
                  <span class="device-info">
                    {{ result.device.user_name }} - {{ result.device.db_id }}
                  </span>
                  <span v-if="result.status === 'loading'" class="status-text">执行中...</span>
                  <span v-else-if="result.status === 'success'" class="status-text success">
                    执行成功 {{ result.duration ? `(${result.duration}ms)` : '' }}
                  </span>
                  <span v-else-if="result.status === 'error'" class="status-text error">
                    执行失败 {{ result.duration ? `(${result.duration}ms)` : '' }}
                  </span>
                </div>
              </template>

              <div class="result-content">
                <div v-if="result.error" class="error-message">
                  <pre>{{ result.error }}</pre>
                </div>
                <div v-else-if="result.data && result.data.message" class="success-message">
                  <pre>{{ result.data.message }}</pre>
                </div>
                <div v-else class="empty-message">暂无输出</div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-scrollbar>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleCancel" :disabled="loading">
        {{ isExecuted ? '关闭' : '取消' }}
      </el-button>
      <el-button v-if="!isExecuted" type="primary" @click="handleSubmit" :loading="loading">
        确认执行
      </el-button>
      <el-button v-else type="primary" @click="handleReset">重新执行</el-button>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElForm, ElMessage } from 'element-plus'
import { Loading, SuccessFilled, CircleCloseFilled } from '@element-plus/icons-vue'
import type { Device } from '@shared/ipc/data.types'
import { request, buildApiUrl, getErrorMessage } from '@shared/api'

interface ExecutionResult {
  device: Device
  status: 'loading' | 'success' | 'error'
  data?: {
    cmd: string
    db_id: string
    host_ip: string
    message?: string
  }
  error?: string
  startTime?: number
  duration?: number
}

const visible = ref(false)
const loading = ref(false)
const devices = ref<Device[]>([])
const isExecuted = ref(false)
const executionResults = ref<ExecutionResult[]>([])
const activeNames = ref<string[]>([])

const deviceCount = computed(() => devices.value.length)
const successCount = computed(
  () => executionResults.value.filter((r) => r.status === 'success').length
)
const failedCount = computed(
  () => executionResults.value.filter((r) => r.status === 'error').length
)

const form = ref({
  command: ''
})

const formRef = ref<InstanceType<typeof ElForm>>()

const rules = ref({
  command: [{ required: true, message: '请输入执行命令', trigger: 'blur' }]
})

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'loading':
      return Loading
    case 'success':
      return SuccessFilled
    case 'error':
      return CircleCloseFilled
    default:
      return Loading
  }
}

const getStatusIconClass = (status: string) => {
  return `status-icon status-icon-${status}`
}

const getResultClass = (status: string) => {
  return `result-item result-item-${status}`
}

const handleClose = () => {
  form.value.command = ''
  isExecuted.value = false
  executionResults.value = []
  activeNames.value = []
  formRef.value?.resetFields()
}

const handleCancel = () => {
  visible.value = false
}

const handleReset = () => {
  isExecuted.value = false
  executionResults.value = []
  activeNames.value = []
}

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || loading.value) return
    loading.value = true
    isExecuted.value = true

    try {
      const combinedCommand = form.value.command.trim()
      if (!combinedCommand) {
        ElMessage.warning('请输入有效的命令')
        loading.value = false
        isExecuted.value = false
        return
      }

      // 初始化执行结果
      executionResults.value = devices.value.map((device) => ({
        device,
        status: 'loading' as const,
        startTime: Date.now()
      }))

      // 并行执行所有命令
      const promises = devices.value.map(async (device, index) => {
        const hostIp = device.host_ip
        const dbId = device.db_id
        if (!hostIp || !dbId) {
          executionResults.value[index].status = 'error'
          executionResults.value[index].error = '设备信息不完整'
          executionResults.value[index].duration =
            Date.now() - (executionResults.value[index].startTime || Date.now())
          return
        }

        try {
          const response = await request.post(
            buildApiUrl(hostIp, `/android_api/v1/shell/${dbId}`),
            {
              cmd: combinedCommand
            },
            {
              timeout: 60 * 1000
            }
          )

          // 计算耗时
          const duration = Date.now() - (executionResults.value[index].startTime || Date.now())
          executionResults.value[index].duration = duration
          executionResults.value[index].status = 'success'
          executionResults.value[index].data = response.data
        } catch (error) {
          // 计算耗时
          const duration = Date.now() - (executionResults.value[index].startTime || Date.now())
          executionResults.value[index].duration = duration
          executionResults.value[index].status = 'error'
          executionResults.value[index].error = getErrorMessage(error as any, '命令执行失败')
        }
      })

      await Promise.all(promises)
      ElMessage.success('命令执行完成')
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '批量执行失败'))
    } finally {
      loading.value = false
    }
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
  color: #909399;
  margin-top: 8px;
}

.results-container {
  margin-top: 20px;
  border-top: 1px solid #e4e7ed;
  padding-top: 20px;
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
    color: #303133;
  }

  .results-summary {
    font-size: 13px;
    color: #606266;
  }
}

.results-collapse {
  border: none;

  :deep(.el-collapse-item) {
    margin-bottom: 8px;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    overflow: hidden;

    &.result-item-loading {
      background-color: #ecf5ff;
    }

    &.result-item-success {
      background-color: #f0f9ff;
    }

    &.result-item-error {
      background-color: #fef0f0;
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
    background-color: #fff;
  }
}

.result-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  font-size: 13px;

  .result-index {
    color: #606266;
    font-size: 13px;
    min-width: 18px;
  }

  .status-icon {
    font-size: 18px;

    &.status-icon-loading {
      color: #409eff;
      animation: rotating 2s linear infinite;
    }

    &.status-icon-success {
      color: #67c23a;
    }

    &.status-icon-error {
      color: #f56c6c;
    }
  }

  .device-info {
    color: #606266;
    font-size: 13px;
  }

  .status-text {
    margin-left: auto;
    margin-right: 8px;
    font-size: 12px;
    color: #909399;

    &.success {
      color: #67c23a;
    }

    &.error {
      color: #f56c6c;
    }
  }
}

.result-content {
  font-size: 13px;

  .error-message {
    pre {
      background-color: #fef0f0;
      border-top: 1px solid #fbc4c4;
      padding: 12px;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #f56c6c;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
      max-height: 300px;
      overflow-y: auto;
    }
  }

  .success-message {
    pre {
      background-color: #f5f7fa;
      border-top: 1px solid #e4e7ed;
      padding: 12px;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: #303133;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
      max-height: 300px;
      overflow-y: auto;
    }
  }

  .empty-message {
    color: #909399;
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
</style>
