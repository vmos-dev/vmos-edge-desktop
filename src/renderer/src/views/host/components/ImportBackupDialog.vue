<template>
  <vmos-dialog
    v-model="visible"
    :title="dialogTitle"
    width="600px"
    :show-close="canClose"
    @closed="handleClose"
  >
    <div class="upload-file">
      <div class="upload-file-content">
        <div class="upload-area">
          <el-upload
            ref="uploadRef"
            class="upload-zone"
            drag
            multiple
            :auto-upload="true"
            :before-upload="handleBeforeUpload"
            :http-request="handleUpload"
            :show-file-list="false"
            accept=".tar"
          >
            <div class="upload-zone-content">
              <el-icon class="upload-icon"><upload-filled /></el-icon>
              <div class="upload-text">
                <p class="upload-primary-text">{{ t('host.importBackupClickToUpload') }}</p>
              </div>
            </div>
            <template #tip>
              <div class="upload-tip">
                <el-icon><InfoFilled /></el-icon>
                <span>{{ t('host.importBackupTip', { count: props.concurrency }) }}</span>
              </div>
            </template>
          </el-upload>
        </div>
      </div>

      <div class="file-list">
        <div class="file-list-header">
          <div class="title">
            <div class="header-left">
              <span class="list-title">{{ t('host.importBackupList') }}</span>
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
            <span v-if="waitingCount > 0" class="stats-item waiting">
              <el-icon><Clock /></el-icon>
              {{ t('common.waiting') }}: {{ waitingCount }}
            </span>
            <span v-if="uploadingCount > 0" class="stats-item uploading">
              <el-icon class="rotating"><Loading /></el-icon>
              {{ t('common.processing') }}: {{ uploadingCount }}
            </span>
            <span v-if="successCount > 0" class="stats-item success">
              <el-icon><CircleCheck /></el-icon>
              {{ t('common.success') }}: {{ successCount }}
            </span>
            <span v-if="errorCount > 0" class="stats-item error">
              <el-icon><CircleClose /></el-icon>
              {{ t('common.failed') }}: {{ errorCount }}
            </span>
          </div>
        </div>

        <div class="file-list-content">
          <div
            v-for="task in sortedTasks"
            :key="task.id"
            class="file-item"
            :class="{
              'status-checking': task.status === 'checking',
              'status-uploading': task.status === 'uploading',
              'status-success': task.status === 'success',
              'status-error': task.status === 'error',
              'status-waiting': task.status === 'waiting'
            }"
          >
            <div
              v-if="task.status === 'uploading'"
              class="progress-background"
              :style="{
                background: `linear-gradient(to right,
                  var(--el-color-primary-alpha-1) 0%,
                  var(--el-color-primary-alpha-2) ${task.progress * 100 * 0.5}%,
                  var(--el-color-primary-alpha-3) ${task.progress * 100}%,
                  transparent ${task.progress * 100}%)`
              }"
            ></div>

            <div class="file-left">
              <div class="file-icon-wrapper">
                <el-icon class="file-icon" :class="getIconClass(task)">
                  <component :is="getIconComponent(task)" />
                </el-icon>
              </div>
              <div class="file-info">
                <div class="file-name" :title="task.fileName">{{ task.fileName }}</div>
                <div class="file-size">{{ formatFileSize(task.fileSize) }}</div>
              </div>
            </div>

            <div class="file-right">
              <div class="status-info">
                <div class="status-line">
                  <el-icon
                    v-if="task.status === 'checking' || task.status === 'uploading'"
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
                        <div style="max-width: 300px; max-height: 200px; overflow-y: auto">
                          <p>{{ task.errorInfo || t('common.unknownError') }}</p>
                        </div>
                      </template>
                      <el-icon class="error-info-icon"><InfoFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </div>
              </div>

              <el-icon
                v-if="task.status !== 'success'"
                class="delete-btn"
                :title="t('common.delete')"
                @click="deleteTask(task.id)"
              >
                <Delete />
              </el-icon>
            </div>
          </div>

          <div v-if="tasks.length === 0" class="empty-state">
            <el-empty :description="t('host.importBackupEmpty')" :image-size="120" />
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
import { ref, shallowRef, computed, markRaw } from 'vue'
import { ElUpload, ElMessage } from 'element-plus'
import type { UploadRawFile, UploadRequestOptions } from 'element-plus'
import type { Host } from '@shared/ipc/data.types'
import { API_CONFIG, buildApiUrl, getErrorMessage, request } from '@shared/api'
import { useI18n } from 'vue-i18n'
import { ensureBackupImportSpace } from '../utils/backupSpace'

const { t } = useI18n()

type TaskStatus = 'waiting' | 'checking' | 'uploading' | 'success' | 'error'

interface ImportBackupTask {
  id: number
  fileName: string
  fileSize: number
  file: File
  status: TaskStatus
  progress: number
  errorInfo?: string
  controller: AbortController
}

const props = withDefaults(
  defineProps<{
    concurrency?: number
  }>(),
  {
    concurrency: 1
  }
)

const emit = defineEmits<{
  imported: []
}>()

const visible = shallowRef(false)
const targetHost = shallowRef<Host | null>(null)
const tasks = ref<ImportBackupTask[]>([])
const uploadRef = ref<InstanceType<typeof ElUpload>>()

let taskIdCounter = 0
let activeCount = 0
let hasEmittedImported = false

const dialogTitle = computed(() =>
  t('host.importBackupTitle', { hostIp: targetHost.value?.ip ?? '' })
)

const canClose = computed(() => {
  if (tasks.value.length === 0) return true
  return tasks.value.every((task) => task.status === 'success' || task.status === 'error')
})

const sortedTasks = computed(() => {
  const priority: Record<TaskStatus, number> = {
    checking: 1,
    uploading: 1,
    waiting: 2,
    error: 3,
    success: 4
  }
  return [...tasks.value].sort((a, b) => {
    const pa = priority[a.status]
    const pb = priority[b.status]
    return pa !== pb ? pa - pb : a.id - b.id
  })
})

const waitingCount = computed(() => tasks.value.filter((x) => x.status === 'waiting').length)
const uploadingCount = computed(
  () => tasks.value.filter((x) => x.status === 'checking' || x.status === 'uploading').length
)
const successCount = computed(() => tasks.value.filter((x) => x.status === 'success').length)
const errorCount = computed(() => tasks.value.filter((x) => x.status === 'error').length)

const tryStartNext = () => {
  while (activeCount < props.concurrency) {
    const next = tasks.value.find((x) => x.status === 'waiting')
    if (!next) break
    startTask(next)
  }
}

const startTask = async (task: ImportBackupTask) => {
  const host = targetHost.value
  if (!host) return

  activeCount++
  task.status = 'checking'
  task.progress = 0

  try {
    await ensureBackupImportSpace(host, t, task.controller.signal)

    task.status = 'uploading'
    const formData = new FormData()
    formData.append('file', task.file)

    await request.post(buildApiUrl(host.ip, API_CONFIG.PATHS.IMPORT_BACKUP), formData, {
      timeout: 0,
      signal: task.controller.signal,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!event.total) return
        task.progress = event.loaded / event.total
      }
    })
    task.progress = 1
    task.status = 'success'
    if (!hasEmittedImported) {
      hasEmittedImported = true
      emit('imported')
    }
  } catch (err: any) {
    // 任务已被 deleteTask/clearAll splice 时，对象仍在此闭包中但不在列表里；
    // 在 orphan 上写 status 无副作用，因此不再分支判断，统一置错状态。
    task.errorInfo = getErrorMessage(err, t('host.importBackupFailed'))
    task.status = 'error'
  } finally {
    activeCount = Math.max(0, activeCount - 1)
    tryStartNext()
  }
}

const deleteTask = (taskId: number) => {
  const index = tasks.value.findIndex((x) => x.id === taskId)
  if (index === -1) return

  const task = tasks.value[index]
  const isRunning = task.status === 'checking' || task.status === 'uploading'

  if (isRunning) {
    task.controller.abort()
  }

  tasks.value.splice(index, 1)

  if (!isRunning) {
    tryStartNext()
  }
}

const clearAll = () => {
  tasks.value.forEach((task) => {
    if (task.status === 'checking' || task.status === 'uploading') {
      task.controller.abort()
    }
  })
  tasks.value = []
  activeCount = 0
  uploadRef.value?.clearFiles()
}

const handleBeforeUpload = (file: UploadRawFile) => {
  if (!/\.tar$/i.test(file.name)) {
    ElMessage.warning(t('host.importBackupOnlyTar'))
    return false
  }
  return true
}

const handleUpload = async (options: UploadRequestOptions) => {
  const file = options.file
  tasks.value.push({
    id: taskIdCounter++,
    fileName: file.name,
    fileSize: file.size,
    file: markRaw(file),
    status: 'waiting',
    progress: 0,
    controller: markRaw(new AbortController())
  })
  uploadRef.value?.clearFiles()
  tryStartNext()
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getStatusText = (status: TaskStatus): string => {
  const map: Record<TaskStatus, string> = {
    waiting: t('host.waitingStatus'),
    checking: t('host.importBackupChecking'),
    uploading: t('host.uploading'),
    success: t('common.success'),
    error: t('common.failed')
  }
  return map[status] || status
}

const getIconComponent = (task: ImportBackupTask) => {
  switch (task.status) {
    case 'checking':
    case 'uploading':
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

const getIconClass = (task: ImportBackupTask) => {
  switch (task.status) {
    case 'checking':
    case 'uploading':
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

const handleClose = () => {
  clearAll()
  targetHost.value = null
  visible.value = false
  hasEmittedImported = false
}

const hasRunningTasks = () =>
  tasks.value.some((x) => x.status === 'checking' || x.status === 'uploading')

const init = (host: Host) => {
  targetHost.value = host
  hasEmittedImported = false
  visible.value = true
}

defineExpose({ init, hasRunningTasks, cancelAll: clearAll })
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

.upload-area {
  flex-shrink: 0;
  background: var(--el-bg-color);

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
}

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

  &.status-checking,
  &.status-uploading {
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

      &.icon-default {
        color: var(--el-color-primary);
      }
    }
  }

  .file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;

    .file-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--el-text-color-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }

    .file-size {
      font-size: 11px;
      flex-shrink: 0;
      color: var(--el-text-color-secondary);
    }
  }
}

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

        &.status-checking,
        &.status-uploading {
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

.empty-state {
  text-align: center;
  padding: 30px 20px;
  color: var(--el-text-color-secondary);
}

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
