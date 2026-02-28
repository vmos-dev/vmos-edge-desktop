<template>
  <vmos-dialog
    v-model="visible"
    :title="title"
    width="600px"
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
            :auto-upload="true"
            :before-upload="handleBeforeUpload"
            :http-request="handleUpload"
            :show-file-list="false"
            :accept="allowedExtensions.map((ext) => `.${ext}`).join(',') || '*/*'"
          >
            <div class="upload-zone-content">
              <el-icon class="upload-icon"><upload-filled /></el-icon>
              <div class="upload-text">
                <p class="upload-primary-text">
                  {{ t('host.clickUploadOrDrag', { type: operationType === 'cbs' ? t('host.cbs') : t('host.kernel') }) }}
                </p>
                <p class="upload-secondary-text">
                  {{ t('host.supportedFormats', { formats: allowedExtensions.map((ext) => `.${ext}`).join(', ') || t('host.allFiles') }) }}
                </p>
              </div>
            </div>
            <template #tip>
              <div class="upload-tip">
                <el-icon><InfoFilled /></el-icon>
                <span>{{ t('host.maxConcurrentUpload', { count: concurrency }) }}</span>
              </div>
            </template>
          </el-upload>
        </div>
      </div>
      <!-- 文件列表区域 -->
      <div class="file-list">
        <div class="file-list-header">
          <div class="title">
            <div class="header-left">
              <span class="list-title">{{ t('host.upgradeList') }}</span>
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
                <div class="file-host-ip">{{ task.hostIp }}</div>
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
            <el-empty :description="t('host.noHost')" :image-size="120" />
          </div>
        </div>
      </div>
    </div>
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
import type { Host } from '@shared/ipc/data.types'
import { buildApiUrl, API_CONFIG } from '@shared/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const props = withDefaults(
  defineProps<{
    allowedExtensions?: string[]
    concurrency?: number
    title?: string
  }>(),
  {
    allowedExtensions: () => [],
    concurrency: () => 10
  }
)

const targetHosts = ref<Host[]>([])
const operationType = ref<'cbs' | 'kernel'>('cbs')

const allowedExtensions = computed(() => {
  return operationType.value === 'cbs' ? ['cbs'] : ['img']
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
  if (props.title) {
    return props.title
  }
  const hostCount = new Set(targetHosts.value.map((host) => host.ip)).size
  return t('host.batchUpgradeTitle', { 
    type: operationType.value === 'cbs' ? t('host.cbs') : t('host.kernel'),
    count: hostCount 
  })
})

// 判断所有任务是否都处理完成
const isAllTasksCompleted = computed(() => {
  return tasks.value.every((t) => ['success', 'error', 'cancelled'].includes(t.status))
})

const removeTask = (id: number) => {
  uploadQueue.deleteTask(id)
  updateTasks()
}

const clearAll = () => {
  uploadQueue.clearAllTasks()
  updateTasks()
}

const handleBeforeUpload = (file: File) => {
  const fileName = file.name
  const fileExtension = fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase()
  if (!allowedExtensions.value.includes(fileExtension)) {
    return false
  }
  return true
}

const handleUpload = (options: any) => {
  return new Promise<void>((resolve) => {
    const { file } = options
    targetHosts.value.forEach((host) => {
      const formData = new FormData()
      formData.append('file', file)
      uploadQueue.add({
        url: buildApiUrl(
          host.ip,
          operationType.value === 'cbs'
            ? API_CONFIG.PATHS.UPDATE_CBS
            : API_CONFIG.PATHS.UPDATE_KERNEL
        ),
        hostIp: host.ip ?? '',
        file,
        formData
      })
    })
    uploadRef.value?.clearFiles()
    resolve()
  })
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
  targetHosts.value = []
  tasks.value = []
  uploadQueue.clearAllTasks()
  uploadRef.value?.clearFiles()
  visible.value = false
}
const init = (hosts: Host[], type: 'cbs' | 'kernel') => {
  targetHosts.value = hosts

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

/* ==================== 文件列表 ==================== */
.file-list {
  flex: 1;
  display: flex;
  flex-direction: column;
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
</style>
