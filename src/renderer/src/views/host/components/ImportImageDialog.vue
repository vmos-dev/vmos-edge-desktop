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
        <!-- 上传区域 -->
        <div class="upload-area">
          <!-- 正常上传状态 -->
          <el-upload
            v-if="!isDecompressing"
            ref="uploadRef"
            class="upload-zone"
            drag
            :auto-upload="true"
            :before-upload="handleBeforeUpload"
            :http-request="handleUpload"
            :show-file-list="false"
            accept=".tar.zst"
          >
            <div class="upload-zone-content">
              <el-icon class="upload-icon"><upload-filled /></el-icon>
              <div class="upload-text">
                <p class="upload-primary-text">{{ t('host.clickToUploadOrDragImage') }}</p>
              </div>
            </div>
            <template #tip>
              <div class="upload-tip">
                <el-icon><InfoFilled /></el-icon>
                <span>{{ t('host.maxConcurrentUpload', { count: concurrency }) }}</span>
              </div>
            </template>
          </el-upload>

          <!-- 解压中状态：复用上传区域空间 -->
          <div v-else class="decompress-zone">
            <div class="decompress-content">
              <el-icon class="decompress-icon rotating"><Loading /></el-icon>
              <p class="decompress-text">
                {{ t('host.decompressing', { percent: (decompressProgress * 100).toFixed(0) }) }}
              </p>
              <div class="decompress-bar-track">
                <div
                  class="decompress-bar-fill"
                  :style="{ width: decompressProgress * 100 + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件列表区域 -->
      <div class="file-list">
        <div class="file-list-header">
          <div class="title">
            <div class="header-left">
              <span class="list-title">{{ t('host.importImageList') }}</span>
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

        <!-- 任务列表 -->
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
            <!-- 背景进度条 -->
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

            <!-- 左侧：图标 + 主机IP + 文件信息 -->
            <div class="file-left">
              <div class="file-icon-wrapper">
                <el-icon class="file-icon" :class="getIconClass(task)">
                  <component :is="getIconComponent(task)" />
                </el-icon>
              </div>
              <div class="file-info">
                <div class="file-host-ip">{{ task.hostIp }}</div>
                <div class="file-name-size">
                  <div class="file-name" :title="task.fileName">{{ task.fileName }}</div>
                  <div class="file-size">{{ formatFileSize(task.fileSize) }}</div>
                </div>
              </div>
            </div>

            <!-- 右侧：状态 + 进度 + 删除 -->
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
                        <div style="max-width: 300px; max-height: 200px; overflow-y: auto">
                          <p>{{ task.errorInfo || t('common.unknownError') }}</p>
                        </div>
                      </template>
                      <el-icon class="error-info-icon"><InfoFilled /></el-icon>
                    </el-tooltip>
                  </span>
                </div>
              </div>

              <!-- 成功不可删除，其他状态均可删除 -->
              <el-icon
                v-if="task.status !== 'success'"
                class="delete-btn"
                @click="deleteTask(task.id)"
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
import { ref, computed, markRaw } from 'vue'
import { ElUpload, ElMessage } from 'element-plus'
import type { Host } from '@shared/ipc/data.types'
import { buildApiUrl, API_CONFIG } from '@shared/api'
import { extractTarGzFromZst, uploadTarGz } from '@renderer/utils/imageUpload'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

type TaskStatus = 'waiting' | 'uploading' | 'pushing' | 'success' | 'error'

interface ImportTask {
  id: number
  hostIp: string
  fileName: string
  fileSize: number
  blob: Blob
  entryName: string
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

const visible = ref(false)
const targetHosts = ref<Host[]>([])
const tasks = ref<ImportTask[]>([])
const uploadRef = ref<InstanceType<typeof ElUpload>>()
const isDecompressing = ref(false)
const decompressProgress = ref(0)

let taskIdCounter = 0
let activeCount = 0

// ========== 计算属性 ==========

const dialogTitle = computed(() => t('host.importImageTitle', { count: targetHosts.value.length }))

/** 所有任务完成（成功或失败）时才允许关闭 */
const canClose = computed(() => {
  if (isDecompressing.value) return false
  if (tasks.value.length === 0) return true
  return tasks.value.every((task) => task.status === 'success' || task.status === 'error')
})

/** 按状态优先级排序：进行中 > 等待中 > 失败 > 成功 */
const sortedTasks = computed(() => {
  const priority: Record<TaskStatus, number> = {
    uploading: 1,
    pushing: 1,
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

const waitingCount = computed(() => tasks.value.filter((t) => t.status === 'waiting').length)
const uploadingCount = computed(
  () => tasks.value.filter((t) => t.status === 'uploading' || t.status === 'pushing').length
)
const successCount = computed(() => tasks.value.filter((t) => t.status === 'success').length)
const errorCount = computed(() => tasks.value.filter((t) => t.status === 'error').length)

// ========== 队列调度 ==========

const tryStartNext = () => {
  while (activeCount < props.concurrency) {
    const next = tasks.value.find((t) => t.status === 'waiting')
    if (!next) break
    startTask(next)
  }
}

const startTask = async (task: ImportTask) => {
  activeCount++
  task.status = 'uploading'
  task.progress = 0

  try {
    await uploadTarGz(task.blob, task.entryName, {
      url: buildApiUrl(task.hostIp, API_CONFIG.PATHS.IMPORT_IMAGE),
      signal: task.controller.signal,
      onProgress: (percent: number) => {
        task.progress = percent
        if (percent >= 0.99 && task.status === 'uploading') {
          task.status = 'pushing'
        }
      }
    })
    task.progress = 1
    task.status = 'success'
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      task.errorInfo = err?.msg || err?.message || t('host.importImageFailed')
      task.status = 'error'
    }
  } finally {
    activeCount = Math.max(0, activeCount - 1)
    tryStartNext()
  }
}

// ========== 任务管理 ==========

/**
 * 删除任务：
 * - 运行中（uploading/pushing）：取消上传请求 + 从列表移除
 * - 成功：不可删除（UI 不渲染删除按钮）
 * - 失败/等待中：直接从列表移除
 */
const deleteTask = (taskId: number) => {
  const index = tasks.value.findIndex((t) => t.id === taskId)
  if (index === -1) return

  const task = tasks.value[index]
  const isRunning = task.status === 'uploading' || task.status === 'pushing'

  if (isRunning) {
    task.controller.abort()
    // activeCount 将在 startTask finally 块中递减，并触发 tryStartNext
  }

  tasks.value.splice(index, 1)

  if (!isRunning) {
    tryStartNext()
  }
}

const clearAll = () => {
  tasks.value.forEach((task) => {
    if (task.status === 'uploading' || task.status === 'pushing') {
      task.controller.abort()
    }
  })
  tasks.value = []
  activeCount = 0
  uploadRef.value?.clearFiles()
}

// ========== 文件上传处理 ==========

const handleBeforeUpload = (file: File) => {
  if (!file.name.toLowerCase().endsWith('.tar.zst')) {
    ElMessage.warning(t('host.importImageOnlyZst'))
    return false
  }
  return true
}

const handleUpload = async (options: any) => {
  const file = options.file as File
  isDecompressing.value = true
  decompressProgress.value = 0

  try {
    const { blob, name } = await extractTarGzFromZst(file, {
      onProgress: (p) => {
        decompressProgress.value = p
      }
    })
    if (!visible.value) return
    targetHosts.value.forEach((host) => {
      const task: ImportTask = {
        id: taskIdCounter++,
        hostIp: host.ip ?? '',
        fileName: file.name,
        fileSize: file.size,
        blob: markRaw(blob),
        entryName: name,
        status: 'waiting',
        progress: 0,
        controller: markRaw(new AbortController())
      }
      tasks.value.push(task)
    })
    tryStartNext()
  } catch (err: any) {
    if (visible.value) {
      ElMessage.error(err?.message || t('host.importImageFailed'))
    }
  } finally {
    uploadRef.value?.clearFiles()
    isDecompressing.value = false
  }
}

// ========== 工具函数 ==========

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getStatusText = (status: TaskStatus): string => {
  const map: Record<TaskStatus, string> = {
    waiting: t('host.waitingStatus'),
    uploading: t('host.uploading'),
    pushing: t('host.pushing'),
    success: t('common.success'),
    error: t('common.failed')
  }
  return map[status] || status
}

const getIconComponent = (task: ImportTask) => {
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

const getIconClass = (task: ImportTask) => {
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

// ========== 对话框控制 ==========

const handleClose = () => {
  clearAll()
  targetHosts.value = []
  visible.value = false
}

const init = (hosts: Host[]) => {
  targetHosts.value = [...hosts]
  visible.value = true
}

defineExpose({ init })
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

/* ==================== 解压进度（复用上传区域空间） ==================== */
.decompress-zone {
  border: 2px dashed var(--el-color-primary-light-5);
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  padding: 20px 0;
  animation: progress-shine 2s ease-in-out infinite;

  .decompress-content {
    padding: 10px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .decompress-icon {
    font-size: 32px;
    color: var(--el-color-primary);

    &.rotating {
      animation: rotate 1.2s linear infinite;
    }
  }

  .decompress-text {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-color-primary);
  }

  .decompress-bar-track {
    width: 180px;
    height: 4px;
    background: var(--el-color-primary-light-7);
    border-radius: 2px;
    overflow: hidden;
  }

  .decompress-bar-fill {
    height: 100%;
    background: var(--el-color-primary);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
}

/* ==================== 上传区域 ==================== */
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

/* ==================== 任务行 ==================== */
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

/* ==================== 左侧文件信息 ==================== */
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

/* ==================== 右侧状态 ==================== */
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

/* ==================== 空状态 ==================== */
.empty-state {
  text-align: center;
  padding: 30px 20px;
  color: var(--el-text-color-secondary);
}

/* ==================== 动画 ==================== */
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
