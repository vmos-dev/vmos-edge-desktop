<template>
  <vmos-dialog
    v-model="visible"
    top="2vh"
    :title="title"
    width="800px"
    :show-close="isAllTasksCompleted"
    @closed="handleClose"
  >
    <div class="upload-file">
      <div class="upload-file-content">
        <!-- 上传区域 -->
        <div class="upload-area">
          <el-upload
            ref="uploadRef"
            class="upload-zone"
            drag
            multiple
            v-model:file-list="uploadFileList"
            :auto-upload="false"
            :show-file-list="false"
            :accept="allowedExtensions?.map((ext) => `.${ext}`).join(',') || '*/*'"
          >
            <div class="upload-zone-content">
              <el-icon class="upload-icon"><upload-filled /></el-icon>
              <div class="upload-text">
                <p class="upload-primary-text">{{ t('cloudPhone.clickUploadOrDragFile') }}</p>
                <p class="upload-secondary-text">
                  {{ t('cloudPhone.batchUploadSupported', { formats: allowedExtensions?.map((ext) => `.${ext}`).join(', ') || t('cloudPhone.allFiles') }) }}
                </p>
              </div>
            </div>
            <template #tip>
              <div class="upload-tip">
                <el-icon><InfoFilled /></el-icon>
                <span>{{ t('cloudPhone.maxConcurrentUpload', { count: concurrency }) }}</span>
              </div>
            </template>
          </el-upload>
        </div>

        <!-- 已选文件区域 -->
        <div class="select-device" v-if="uploadFileList.length > 0">
          <div class="select-device-header">
            <span class="select-device-title">
              <el-icon><DocumentAdd /></el-icon>
              {{ t('cloudPhone.selectedFiles') }}
              <span class="file-count-badge">{{ uploadFileList.length }}</span>
            </span>
            <el-button
              v-if="isAllTasksCompleted"
              link
              type="danger"
              size="small"
              @click="clearAllFiles"
            >
              {{ t('common.clearAll') }}
            </el-button>
          </div>
          <div class="select-device-content">
            <div
              class="select-device-item"
              v-for="(file, index) in uploadFileList"
              :key="file.name"
            >
              <el-icon class="file-icon"><DocumentAdd /></el-icon>
              <span class="file-name" :title="file.name">{{ file.name }}</span>
              <span class="file-info">{{ formatFileSize(file.size || 0) }}</span>
              <el-icon
                class="delete-btn"
                @click="removeFile(index)"
                :title="t('common.delete')"
                v-if="isAllTasksCompleted"
              >
                <Delete />
              </el-icon>
            </div>
          </div>
        </div>
        <div v-else>
          <el-empty :description="t('cloudPhone.selectFileTip', { type: subTitle })" :image-size="120" />
        </div>
      </div>
      <!-- 文件列表区域 -->
      <div class="file-list">
        <div class="file-list-header">
          <div class="title">
            <div class="header-left">
              <span class="list-title">{{ subTitle }}{{ t('cloudPhone.list') }}</span>
            </div>
            <el-button v-if="tasks.length > 0" link type="danger" size="small" @click="clearAll">
              {{ t('common.clearAll') }}
            </el-button>
          </div>
          <div class="upload-stats">
            <span class="stats-item total">
              <el-icon><DocumentAdd /></el-icon>
              {{ t('common.total') }}: {{ tasks.length }}
            </span>
            <span class="stats-item waiting" v-if="waitingCount > 0">
              <el-icon><Clock /></el-icon>
              {{ t('common.waiting') }}: {{ waitingCount }}
            </span>
            <span class="stats-item uploading" v-if="uploadingCount > 0">
              <el-icon class="rotating"><Loading /></el-icon>
              {{ t('common.processing') }}: {{ uploadingCount }}
            </span>
            <span class="stats-item success" v-if="successCount > 0">
              <el-icon><CircleCheck /></el-icon>
              {{ t('common.success') }}: {{ successCount }}
            </span>
            <span class="stats-item error" v-if="errorCount > 0">
              <el-icon><CircleClose /></el-icon>
              {{ t('common.failed') }}: {{ errorCount }}
            </span>
          </div>
        </div>
        <!-- 文件项展示 - 添加滚动容器 -->
        <div class="file-list-content">
          <div
            class="file-item"
            v-for="task in sortedTasks"
            :key="task.id"
            :class="{
              'status-uploading': task.status === 'uploading',
              'status-pushing': task.status === 'pushing',
              'status-success': task.status === 'success',
              'status-error': task.status === 'error',
              'status-waiting': task.status === 'waiting'
            }"
          >
            <!-- 背景进度条 - 移到最下层 -->
            <div
              class="progress-background"
              v-if="task.status === 'uploading' || task.status === 'pushing'"
              :style="{
                background: `linear-gradient(to right, 
                var(--el-color-primary-alpha-1) 0%, 
                var(--el-color-primary-alpha-2) ${task.progress * 100 * 0.5}%,
                var(--el-color-primary-alpha-3) ${task.progress * 100}%, 
                transparent ${task.progress * 100}%)`
              }"
            ></div>

            <!-- 左侧：图标 + 文件名 + 文件大小 -->
            <div class="file-left">
              <div class="file-icon-wrapper">
                <el-icon class="file-icon" :class="getIconClass(task)">
                  <component :is="getIconComponent(task)" />
                </el-icon>
              </div>
              <div class="file-info">
                <div class="file-host-ip">
                  <span class="ip-text">{{ task.hostIp }}</span>
                  <div v-if="task.status === 'success' && task.meta" class="result-stats">
                    <span v-if="getTaskStats(task).success > 0" class="success-tag">
                      {{ t('cloudPhone.successCount') }} {{ getTaskStats(task).success }}
                    </span>
                    <el-popover
                      v-if="getTaskStats(task).fail > 0"
                      placement="bottom"
                      :title="t('cloudPhone.failDetails')"
                      :width="600"
                      trigger="hover"
                    >
                      <template #reference>
                        <span class="fail-tag"> {{ t('cloudPhone.failCount') }} {{ getTaskStats(task).fail }} </span>
                      </template>
                      <div class="fail-list">
                        <div
                          v-for="(item, idx) in getTaskStats(task).failReasons"
                          :key="idx"
                          class="fail-item"
                        >
                          <span class="device-id">{{ item.id }}</span>
                          <span class="error-msg">{{ item.msg }}</span>
                        </div>
                      </div>
                    </el-popover>
                  </div>
                </div>
                <div class="file-name-size">
                  <div class="file-name" :title="task.file.name">{{ task.file.name }}</div>
                  <div class="file-size">{{ formatFileSize(task.file.size) }}</div>
                </div>
              </div>
            </div>

            <!-- 右侧：状态 + 百分比 + 删除 -->
            <div class="file-right">
              <div class="status-info">
                <div class="status-line">
                  <el-icon
                    v-if="task.status === 'uploading' || task.status === 'pushing'"
                    class="status-icon rotating"
                  >
                    <Loading />
                  </el-icon>
                  <span v-if="task.status === 'uploading'" class="progress-text">
                    {{ (task.progress * 100).toFixed(0) }}%
                  </span>
                  <span v-else class="status-text" :class="`status-${task.status}`">
                    {{ getStatusText(task.status) }}
                    <el-tooltip
                      v-if="task.status === 'error'"
                      placement="left"
                      effect="dark"
                      trigger="click"
                    >
                      <template #content>
                        <div
                          class="error-info-content"
                          style="max-width: 300px; max-height: 200px; overflow-y: auto"
                        >
                          <p>{{ task.errorInfo || t('common.unknownError') }}</p>
                        </div>
                      </template>
                      <el-icon class="error-info-icon"><InfoFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </div>
              </div>

              <el-icon
                v-if="task.status === 'waiting'"
                class="delete-btn"
                @click="removeTask(task.id)"
                :title="t('common.delete')"
              >
                <Delete />
              </el-icon>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="tasks.length === 0" class="empty-state">
            <el-empty :description="t('cloudPhone.noHost')" :image-size="120" />
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false" v-if="isAllTasksCompleted">{{ t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        @click="handleInstall"
        :loading="!isAllTasksCompleted"
        :disabled="uploadFileList.length === 0"
        >{{ isAllTasksCompleted ? (operationType === 'install' ? t('cloudPhone.oneClickInstall') : t('cloudPhone.oneClickUpload')) : (operationType === 'install' ? t('cloudPhone.installing') : t('cloudPhone.uploading')) }}</el-button
      >
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import {
  UploadFilled,
  DocumentAdd,
  CircleCheck,
  CircleClose,
  Loading,
  InfoFilled,
  Clock,
  Delete
} from '@element-plus/icons-vue'
import { UploadQueue, UploadTask, UploadStatus } from '@renderer/utils/upload'
import { ref, computed } from 'vue'
import { ElUpload } from 'element-plus'
import type { UploadFile } from 'element-plus'
import type { Device } from '@shared/ipc/data.types'
import { buildApiUrl, API_CONFIG } from '@shared/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const uploadFileList = ref<UploadFile[]>([])
const operationType = ref<'install' | 'upload'>('install')
const props = withDefaults(defineProps<{ concurrency?: number }>(), { concurrency: () => 8 })

const targetDevices = ref<Device[]>([])

const allowedExtensions = computed(() => {
  return operationType.value === 'install' ? ['apk', 'xapk'] : []
})

const subTitle = computed(() => {
  return operationType.value === 'install' ? t('cloudPhone.install') : t('cloudPhone.upload')
})
const uploadQueue = new UploadQueue({ concurrency: props.concurrency })
const tasks = ref<UploadTask[]>([])

const uploadRef = ref<InstanceType<typeof ElUpload>>()

// 获取状态优先级
const getStatusPriority = (status: UploadStatus): number => {
  switch (status) {
    case 'uploading':
    case 'pushing':
      return 1 // 最高优先级：进行中
    case 'waiting':
      return 2 // 等待中
    case 'error':
      return 3 // 失败
    case 'success':
      return 4 // 成功
    case 'cancelled':
      return 5 // 已取消
    default:
      return 6
  }
}

// 按状态排序的任务列表
const sortedTasks = computed(() => {
  return [...tasks.value].sort((a, b) => {
    const priorityA = getStatusPriority(a.status)
    const priorityB = getStatusPriority(b.status)
    // 如果优先级相同，按 id 排序（保持原有顺序）
    if (priorityA === priorityB) {
      return a.id - b.id
    }
    return priorityA - priorityB
  })
})

// 统计数据
const successCount = computed(() => tasks.value.filter((t) => t.status === 'success').length)
const uploadingCount = computed(
  () => tasks.value.filter((t) => t.status === 'uploading' || t.status === 'pushing').length
)
const waitingCount = computed(() => tasks.value.filter((t) => t.status === 'waiting').length)
const errorCount = computed(() => tasks.value.filter((t) => t.status === 'error').length)

const title = computed(() => {
  const hostCount = new Set(targetDevices.value.map((device) => device.host_ip)).size
  // 多少主机和云机需要安装文件
  return operationType.value === 'install' 
    ? t('cloudPhone.batchInstallTitle', { hostCount, deviceCount: targetDevices.value.length })
    : t('cloudPhone.batchUploadTitle', { hostCount, deviceCount: targetDevices.value.length })
})

// 判断所有任务是否都处理完成
const isAllTasksCompleted = computed(() => {
  return tasks.value.every((t) => ['success', 'error', 'cancelled'].includes(t.status))
})

const removeTask = (id: number) => {
  uploadQueue.deleteTask(id)
  updateTasks()
}

const removeFile = (index: number) => {
  if (index >= 0 && index < uploadFileList.value.length) {
    uploadFileList.value.splice(index, 1)
  }
}

const clearAllFiles = () => {
  uploadFileList.value = []
}

const clearAll = () => {
  uploadQueue.clearAllTasks()
  updateTasks()
}

const handleInstall = () => {
  if (!isAllTasksCompleted.value) return
  // 设备按主机分组
  const groupedDevices = targetDevices.value.reduce(
    (acc, device) => {
      acc[device.host_ip ?? ''] = [...(acc[device.host_ip ?? ''] || []), device]
      return acc
    },
    {} as Record<string, Device[]>
  )

  for (const [hostIp, devices] of Object.entries(groupedDevices)) {
    for (const uploadFile of uploadFileList.value) {
      if (!uploadFile.raw) continue
      const formData = new FormData()
      formData.append('file', uploadFile.raw)

      formData.append('db_ids', devices.map((device) => device.db_id ?? '').join(','))
      uploadQueue.add({
        url: buildApiUrl(
          hostIp,
          operationType.value === 'install'
            ? API_CONFIG.PATHS.UPLOAD_BATCH
            : API_CONFIG.PATHS.UPLOAD_SINGLE
        ),
        hostIp: hostIp ?? '',
        formData,
        file: uploadFile.raw
      })
    }
  }
}

// 获取任务统计信息
const getTaskStats = (task: UploadTask) => {
  const list = task.meta
  const result = { success: 0, fail: 0, failReasons: [] as { id: string; msg: string }[] }

  if (!Array.isArray(list)) return result

  list.forEach((item: any) => {
    if (item.code == 200) {
      result.success++
    } else {
      result.fail++
      result.failReasons.push({
        id: item.db_id || t('cloudPhone.unknownDevice'),
        msg: item.msg || t('common.unknownError')
      })
    }
  })

  return result
}

// 更新任务列表
const updateTasks = () => {
  tasks.value = [...uploadQueue.getTasks()]
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 获取状态文本
const getStatusText = (status: UploadStatus): string => {
  const statusMap: Record<UploadStatus, string> = {
    waiting: t('host.waitingStatus'),
    uploading: t('host.uploading'),
    pushing: t('host.pushing'),
    success: t('common.success'),
    error: t('common.failed'),
    cancelled: t('host.cancelled')
  }
  return statusMap[status] || status
}

// 获取图标组件
const getIconComponent = (task: UploadTask) => {
  switch (task.status) {
    case 'uploading':
    case 'pushing':
      return Loading
    case 'success':
      return CircleCheck
    case 'error':
      return CircleClose
    case 'waiting':
      return Clock
    default:
      return DocumentAdd
  }
}

// 获取图标样式类
const getIconClass = (task: UploadTask) => {
  switch (task.status) {
    case 'uploading':
    case 'pushing':
      return 'icon-uploading'
    case 'success':
      return 'icon-success'
    case 'error':
      return 'icon-error'
    case 'waiting':
      return 'icon-waiting'
    default:
      return 'icon-default'
  }
}

uploadQueue.on('status', () => {
  updateTasks()
})

uploadQueue.on('finish', () => {
  updateTasks()
})

const handleClose = () => {
  targetDevices.value = []
  tasks.value = []
  uploadQueue.clearAllTasks()
  uploadRef.value?.clearFiles()
  visible.value = false
}
const init = (devices: Device[], type: 'install' | 'upload') => {
  targetDevices.value = devices
  operationType.value = type
  visible.value = true
}

defineExpose({
  init
})
</script>

<style lang="scss" scoped>
.upload-file {
  width: 100%;
  height: 100%;
  display: flex;
  background: var(--el-bg-color);

  overflow: hidden;
}
.upload-file-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
/* ==================== 上传区域 ==================== */
.upload-area {
  flex-shrink: 0;
  background: var(--el-bg-color);

  .upload-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .upload-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .upload-stats {
      display: flex;
      gap: 16px;

      .stats-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--el-text-color-regular);

        .el-icon {
          font-size: 14px;

          &.rotating {
            animation: rotate 2s linear infinite;
          }
        }

        &:first-child .el-icon {
          color: var(--el-text-color-secondary);
        }
        &:nth-child(2) .el-icon {
          color: var(--el-color-success);
        }
        &:nth-child(3) .el-icon {
          color: var(--el-color-primary);
        }
      }
    }
  }

  .upload-zone {
    .upload-zone-content {
      padding: 10px 20px;
      text-align: center;

      .upload-icon {
        font-size: 32px;
        color: var(--el-text-color-placeholder);
        margin-bottom: 12px;
        transition: all 0.3s ease;
      }

      .upload-text {
        .upload-primary-text {
          margin: 0 0 6px 0;
          font-size: 14px;
          color: var(--el-text-color-primary);
          font-weight: 500;
        }

        .upload-secondary-text {
          margin: 0;
          font-size: 11px;
          color: var(--el-text-color-secondary);
        }
      }
    }

    :deep(.el-upload-dragger) {
      border: 2px dashed var(--el-border-color);
      border-radius: 8px;
      background: var(--el-bg-color-page);
      transition: all 0.3s ease;
      padding: 20px 0;
      &:hover {
        border-color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);

        .upload-icon {
          color: var(--el-color-primary);
          transform: scale(1.1);
        }
      }
    }

    .upload-tip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);

      .el-icon {
        font-size: 14px;
      }
    }
  }

  .upload-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    justify-content: center;

    .el-button {
      min-width: 100px;
      padding: 6px 12px;
      font-size: 12px;
    }
  }
}

/* ==================== 已选文件区域 ==================== */
.select-device {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 8px;
  background: var(--el-bg-color);
  min-height: 0;
  overflow: hidden;

  .select-device-header {
    flex-shrink: 0;
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .select-device-title {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-regular);

      .el-icon {
        font-size: 14px;
        color: var(--el-color-primary);
      }

      .file-count-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9px;
        font-size: 10px;
        font-weight: 600;
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        line-height: 1;
      }
    }
  }

  .select-device-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
    min-height: 0;
    max-height: 250px;

    .select-device-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      background: var(--el-bg-color-page);
      border: 1px solid var(--el-border-color);
      border-radius: 4px;
      margin-bottom: 4px;
      transition: all 0.2s ease;
      cursor: default;

      &:hover {
        border-color: var(--el-color-primary-light-7);
        background: var(--el-color-primary-light-9);
      }

      &:last-child {
        margin-bottom: 0;
      }

      .file-icon {
        flex-shrink: 0;
        font-size: 14px;
        color: var(--el-color-primary);
      }

      .file-name {
        flex: 1;
        min-width: 0;
        font-size: 12px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-info {
        flex-shrink: 0;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        margin-left: auto;
      }

      .delete-btn {
        flex-shrink: 0;
        color: var(--el-text-color-placeholder);
        cursor: pointer;
        font-size: 14px;
        margin-left: 8px;
        padding: 2px;
        border-radius: 4px;
        transition: all 0.2s ease;

        &:hover {
          color: var(--el-color-danger);
          background: var(--el-color-danger-light-9);
          transform: scale(1.1);
        }
      }
    }
  }
}

/* ==================== 文件列表 ==================== */
.file-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0px 20px 8px;
  overflow: hidden;

  .file-list-header {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--el-bg-color-page);
    .title {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
      overflow: hidden;
    }

    .list-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      white-space: nowrap;
    }

    .upload-stats {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;

      .stats-item {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px 6px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        background: var(--el-bg-color-page);
        transition: all 0.3s ease;

        .el-icon {
          font-size: 14px;

          &.rotating {
            animation: rotate 1.5s linear infinite;
          }
        }

        &.total {
          color: var(--el-text-color-regular);
          background: var(--el-fill-color-light);
          .el-icon {
            color: var(--el-text-color-secondary);
          }
        }

        &.waiting {
          color: var(--el-color-warning);
          background: var(--el-color-warning-light-9);
          .el-icon {
            color: var(--el-color-warning);
          }
        }

        &.uploading {
          color: var(--el-color-primary);
          background: var(--el-color-primary-light-9);
          .el-icon {
            color: var(--el-color-primary);
          }
        }

        &.success {
          color: var(--el-color-success);
          background: var(--el-color-primary-light-9);
          .el-icon {
            color: var(--el-color-success);
          }
        }

        &.error {
          color: var(--el-color-danger);
          background: var(--el-color-danger-light-9);
          .el-icon {
            color: var(--el-color-danger);
          }
        }
      }
    }
  }

  .file-list-content {
    flex: 1;
    overflow-y: auto;
    max-height: 350px;
  }
}

/* 每一行文件项卡片 */
.file-item {
  position: relative;
  padding: 5px 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.25s ease;
  overflow: hidden;
  min-height: 42px;

  &:hover {
    border-color: var(--el-color-primary-light-7);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &.status-uploading,
  &.status-pushing {
    border-color: var(--el-color-primary-light-6);
  }

  &.status-success {
    border-color: var(--el-color-success-light-7);
    background: var(--el-color-success-light-9);
  }

  &.status-error {
    border-color: var(--el-color-danger-light-7);
    background: var(--el-color-danger-light-9);
  }

  &.status-waiting {
    border-color: var(--el-color-warning-light-7);
  }

  /* 背景进度条效果 - 增强可见度 */
  .progress-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 6px;
    animation: progress-shine 2s ease-in-out infinite;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

/* 左侧文件信息 */
.file-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;

  .file-icon-wrapper {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: var(--el-bg-color-page);

    .file-icon {
      font-size: 16px;
      transition: all 0.3s ease;

      &.icon-default {
        color: var(--el-color-primary);
      }

      &.icon-uploading {
        color: var(--el-color-primary);
        animation: pulse 1.5s infinite;
      }

      &.icon-success {
        color: var(--el-color-success);
      }

      &.icon-error {
        color: var(--el-color-danger);
      }

      &.icon-waiting {
        color: var(--el-color-warning);
      }
    }
  }

  .file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    .file-host-ip {
      font-size: 12px;
      font-weight: 500;
      color: var(--el-text-color-primary);
      display: flex;
      align-items: center;
      gap: 8px;

      .result-stats {
        display: flex;
        gap: 6px;

        .success-tag {
          color: var(--el-color-success);
          background: var(--el-color-success-light-9);
          padding: 0 4px;
          border-radius: 4px;
          font-size: 11px;
        }

        .fail-tag {
          color: var(--el-color-danger);
          background: var(--el-color-danger-light-9);
          padding: 0 4px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          &:hover {
            text-decoration: underline;
          }
        }
      }
    }

    .file-name-size {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .file-name {
        font-size: 11px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-size {
        font-size: 11px;
        flex-shrink: 0;
        color: var(--el-text-color-secondary);
      }
    }
  }
}

/* 右侧状态信息 */
.file-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;

  .status-info {
    text-align: right;
    min-width: 60px;

    .status-line {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;

      .status-icon {
        font-size: 14px;
        color: var(--el-color-primary);

        &.rotating {
          animation: rotate 1.2s linear infinite;
        }
      }

      .progress-text {
        font-size: 12px;
        color: var(--el-color-primary);
        font-weight: 600;
        line-height: 1;
      }

      .status-text {
        font-size: 11px;
        font-weight: 500;
        line-height: 1.3;

        &.status-waiting {
          color: var(--el-color-warning);
        }

        &.status-uploading,
        &.status-pushing {
          color: var(--el-color-primary);
        }

        &.status-success {
          color: var(--el-color-success);
        }

        &.status-error {
          color: var(--el-color-danger);
        }

        .error-info-icon {
          margin-left: 4px;
          cursor: pointer;
          font-size: 14px;
          vertical-align: text-bottom;
          outline: none;
        }
      }
    }
  }

  .delete-btn {
    color: var(--el-text-color-placeholder);
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.2s ease;

    &:hover {
      color: var(--el-color-danger);
      background: var(--el-color-danger-light-9);
      transform: scale(1.1);
    }
  }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 30px 20px;
  color: var(--el-text-color-secondary);

  .empty-icon {
    font-size: 48px;
    color: var(--el-border-color);
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 14px;
    margin: 0;
  }
}

/* ==================== 动画效果 ==================== */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes progress-shine {
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.8;
  }
}

.fail-list {
  max-height: 250px;
  overflow-y: auto;

  .fail-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid var(--el-bg-color-page);
    font-size: 12px;

    &:last-child {
      border-bottom: none;
    }

    .device-id {
      color: var(--el-text-color-primary);
      font-weight: 500;
      margin-right: 8px;
    }

    .error-msg {
      color: var(--el-color-danger);
      flex: 1;
      text-align: right;
      word-break: break-all;
    }
  }
}
</style>
