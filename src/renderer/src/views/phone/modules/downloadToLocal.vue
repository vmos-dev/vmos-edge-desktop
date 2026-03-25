<template>
  <div class="download-local">
    <template v-if="device">
      <div v-loading="loading" class="browser-section">
        <div class="browser-toolbar">
          <div class="toolbar-main">
            <div class="path-bar">
              <div class="path-breadcrumbs">
                <template v-for="(segment, index) in pathSegments" :key="segment.path">
                <button
                  type="button"
                  class="path-crumb"
                  :class="{ active: segment.path === currentPath }"
                  @click="handleNavigate(segment.path)"
                >
                  <el-icon v-if="segment.path === DISPLAY_ROOT_PATH" class="path-crumb-icon">
                    <Folder />
                  </el-icon>
                  <span class="path-crumb-text">{{ segment.label }}</span>
                </button>
                  <el-icon v-if="index < pathSegments.length - 1" class="path-separator">
                    <ArrowRight />
                  </el-icon>
                </template>
              </div>
            </div>

            <button
              type="button"
              class="download-trigger"
              :title="downloadButtonTitle"
              :disabled="!selectedFiles.length || queueLoading"
              @click="handleAddToQueue"
            >
              <el-icon>
                <component :is="queueLoading ? Loading : Download" />
              </el-icon>
            </button>
          </div>

          <div class="browser-summary">
            <span>{{ t('phone.fileCount', { count: sortedEntries.length }) }}</span>
            <span v-if="selectedFiles.length" class="selected-summary">
              {{ t('phone.selectedFileCount', { count: selectedFiles.length }) }}
            </span>
          </div>
        </div>

        <div v-if="sortedEntries.length > 0" class="file-grid">
          <button
            v-if="canGoBack"
            type="button"
            class="file-card file-card-parent"
            @click="handleNavigate(parentPath)"
          >
            <div class="file-card-icon file-card-icon-parent">
              <el-icon><ArrowLeft /></el-icon>
            </div>
            <span class="file-card-name">{{ t('phone.parentDirectory') }}</span>
          </button>

          <button
            v-for="item in sortedEntries"
            :key="item.absolute_path"
            type="button"
            class="file-card"
            :class="{
              selected: isFileSelected(item),
              directory: item.is_directory,
              file: item.is_file
            }"
            @click="handleSelect(item)"
          >
            <span
              v-if="item.is_file"
              class="file-check"
              :class="{ checked: isFileSelected(item) }"
            >
              <el-icon v-if="isFileSelected(item)"><Check /></el-icon>
            </span>

            <div
              class="file-card-icon"
              :class="{ folder: item.is_directory, document: item.is_file }"
            >
              <el-icon v-if="item.is_directory"><Folder /></el-icon>
              <el-icon v-else><Document /></el-icon>
            </div>

            <div class="file-card-content">
              <div class="file-card-name" :title="item.name">{{ item.name }}</div>
              <div class="file-card-meta">
                <span>{{ item.is_directory ? t('phone.folder') : formatFileSize(item.size) }}</span>
              </div>
            </div>
          </button>
        </div>

        <div v-else class="empty-state">
          <el-empty :description="t('phone.noFilesInDirectory')" :image-size="100" />
        </div>
      </div>

      <div v-if="queueTasks.length > 0" class="queue-panel">
        <div class="queue-header">
          <div class="queue-header-main">
            <div class="queue-title-row">
              <span class="queue-title">{{ t('phone.downloadQueue') }}</span>
              <span v-if="downloadDirectoryPath" class="queue-directory" :title="downloadDirectoryPath">
                {{ t('phone.downloadDirectory') }}: {{ compactPath(downloadDirectoryPath, 18, 18) }}
              </span>
            </div>
            <div class="queue-summary">
              <span>{{ t('common.total') }}: {{ queueTasks.length }}</span>
              <span>{{ t('phone.queueWaiting') }}: {{ waitingCount }}</span>
              <span>{{ t('phone.queueDownloading') }}: {{ downloadingCount }}</span>
              <span>{{ t('common.success') }}: {{ successCount }}</span>
              <span>{{ t('common.failed') }}: {{ errorCount }}</span>
            </div>
          </div>

          <el-button
            v-if="hasCompletedTasks"
            link
            type="primary"
            size="small"
            @click="handleClearCompleted"
          >
            {{ t('phone.clearCompleted') }}
          </el-button>
        </div>

        <div class="queue-list">
          <div v-for="task in queueTasks" :key="task.id" class="queue-item">
            <div class="queue-item-main">
              <div class="queue-item-title-row">
                <span class="queue-item-name" :title="task.savedFileName || task.fileName">
                  {{ task.savedFileName || task.fileName }}
                </span>
                <div class="queue-item-status-wrap">
                  <span class="queue-item-status" :class="`status-${task.status}`">
                    {{ getTaskStatusText(task.status) }}
                  </span>
                  <el-tooltip
                    v-if="task.status === 'error' && task.error"
                    placement="top"
                    trigger="click"
                  >
                    <template #content>
                      <div class="queue-error-tooltip">
                        {{ task.error }}
                      </div>
                    </template>
                    <el-icon class="queue-error-icon" :title="t('phone.viewFailureReason')">
                      <WarningFilled />
                    </el-icon>
                  </el-tooltip>
                </div>
              </div>

              <div class="queue-item-path" :title="task.remotePath">
                {{ compactPath(task.remotePath, 26, 18) }}
              </div>

              <div class="queue-item-meta">
                <span>
                  {{ formatFileSize(task.receivedBytes) }}
                  <template v-if="task.totalBytes"> / {{ formatFileSize(task.totalBytes) }}</template>
                </span>
                <span>{{ formatSpeed(task.speedBps) }}</span>
                <span>{{ formatEta(task.etaSeconds) }}</span>
              </div>

              <el-progress
                v-if="['preparing', 'downloading', 'saving'].includes(task.status)"
                :percentage="task.totalBytes ? Math.round(task.progress * 100) : 100"
                :indeterminate="task.status === 'preparing' || !task.totalBytes"
                :stroke-width="6"
                :format="
                  () =>
                    task.totalBytes
                      ? `${Math.round(task.progress * 100)}%`
                      : t('phone.progressUnknown')
                "
              />
            </div>

            <el-button link type="danger" size="small" @click="handleDeleteTask(task)">
              {{ t('common.delete') }}
            </el-button>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <el-empty :description="t('phone.downloadEntryPlaceholder')" :image-size="100" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Device } from '@shared/ipc/data.types'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Document,
  Download,
  Folder,
  Loading,
  WarningFilled
} from '@element-plus/icons-vue'
import { API_CONTROL_CONFIG, buildDeviceApiUrl, getErrorMessage, request } from '@shared/api'
import {
  FILE_EXPORT_CONCURRENCY,
  FileExportQueue,
  type FileExportTask,
  type FileExportTaskStatus
} from '@renderer/utils/fileExport'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  device?: Device
}>()

const { t } = useI18n()

interface DeviceFileItem {
  name: string
  absolute_path: string
  is_directory: boolean
  is_file: boolean
  size: number
  last_modified: number
  can_read: boolean
  can_write: boolean
  can_execute: boolean
}

interface FileListResponse {
  data: {
    path: string
    count: number
    files: DeviceFileItem[]
  }
}

const DEFAULT_PATH = '/sdcard'
const ROOT_PATH = '/'
const DISPLAY_ROOT_PATH = DEFAULT_PATH

const loading = ref(false)
const queueLoading = ref(false)
const currentPath = ref(DEFAULT_PATH)
const entries = ref<DeviceFileItem[]>([])
const selectedFilePaths = ref<string[]>([])
const queueTasks = ref<FileExportTask[]>([])
const downloadDirectoryToken = ref('')
const downloadDirectoryPath = ref('')

let exportQueue: FileExportQueue | null = null

const sortedEntries = computed(() => {
  return [...entries.value].sort((a, b) => {
    if (a.is_directory !== b.is_directory) {
      return a.is_directory ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
})

const normalizePath = (path?: string) => {
  if (!path || path === ROOT_PATH) return ROOT_PATH
  const normalized = path.replace(/\/+/g, '/').replace(/\/$/, '')
  return normalized || ROOT_PATH
}

const normalizeBrowserPath = (path?: string) => {
  const normalizedPath = normalizePath(path)
  if (normalizedPath === ROOT_PATH) return DISPLAY_ROOT_PATH
  if (
    normalizedPath === DISPLAY_ROOT_PATH ||
    normalizedPath.startsWith(`${DISPLAY_ROOT_PATH}/`)
  ) {
    return normalizedPath
  }
  return DISPLAY_ROOT_PATH
}

const canGoBack = computed(() => normalizeBrowserPath(currentPath.value) !== DISPLAY_ROOT_PATH)

const parentPath = computed(() => {
  const normalizedPath = normalizeBrowserPath(currentPath.value)
  if (normalizedPath === DISPLAY_ROOT_PATH) return DISPLAY_ROOT_PATH

  const parts = normalizedPath.split('/').filter(Boolean)
  if (parts.length <= 1) return DISPLAY_ROOT_PATH

  return `/${parts.slice(0, -1).join('/')}`
})

const pathSegments = computed(() => {
  const normalizedPath = normalizeBrowserPath(currentPath.value)
  const parts = normalizedPath.split('/').filter(Boolean)
  let acc = ''

  const fullSegments = parts.map((part) => {
    acc += `/${part}`
    return {
      label: part,
      path: acc
    }
  })

  const displaySegments =
    parts.length > 0 && parts[0] === DEFAULT_PATH.replace('/', '')
      ? fullSegments.slice(1)
      : fullSegments

  return [
    {
      label: t('phone.rootDirectory'),
      path: DISPLAY_ROOT_PATH
    },
    ...displaySegments
  ]
})

const selectedFiles = computed(() => {
  if (selectedFilePaths.value.length === 0) return []
  const selected = new Set(selectedFilePaths.value)
  return entries.value.filter((item) => selected.has(item.absolute_path) && item.is_file)
})

const waitingCount = computed(
  () => queueTasks.value.filter((task) => task.status === 'waiting').length
)
const downloadingCount = computed(
  () =>
    queueTasks.value.filter((task) =>
      ['preparing', 'downloading', 'saving'].includes(task.status)
    ).length
)
const successCount = computed(
  () => queueTasks.value.filter((task) => task.status === 'success').length
)
const errorCount = computed(() => queueTasks.value.filter((task) => task.status === 'error').length)
const hasCompletedTasks = computed(
  () => queueTasks.value.some((task) => ['success', 'error'].includes(task.status))
)

const downloadButtonTitle = computed(() => {
  if (queueLoading.value) return t('phone.downloadingSelected')
  if (!selectedFiles.value.length) return t('phone.selectFileToDownload')
  return t('phone.addToDownloadQueue')
})

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}

const formatSpeed = (speedBps: number) => {
  if (!speedBps || speedBps <= 0) return '-'
  return `${formatFileSize(speedBps)}/s`
}

const formatEta = (etaSeconds: number | null) => {
  if (etaSeconds === null || etaSeconds < 0 || !Number.isFinite(etaSeconds)) return '-'
  const seconds = Math.round(etaSeconds)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours}h ${remainMinutes}m`
}

const compactPath = (path: string, head = 20, tail = 16) => {
  if (!path) return ''
  if (path.length <= head + tail + 1) return path
  return `${path.slice(0, head)}...${path.slice(-tail)}`
}

const isFileSelected = (item: DeviceFileItem) => {
  return selectedFilePaths.value.includes(item.absolute_path)
}

const getTaskStatusText = (status: FileExportTaskStatus) => {
  const map: Record<FileExportTaskStatus, string> = {
    waiting: t('phone.queueWaiting'),
    preparing: t('phone.queuePreparing'),
    downloading: t('phone.queueDownloading'),
    saving: t('phone.queueSaving'),
    success: t('phone.queueSuccess'),
    error: t('phone.queueError')
  }

  return map[status]
}

const initQueue = () => {
  if (exportQueue || !downloadDirectoryToken.value) return

  exportQueue = new FileExportQueue({
    directoryToken: downloadDirectoryToken.value,
    concurrency: FILE_EXPORT_CONCURRENCY
  })

  exportQueue.on('change', (tasks: FileExportTask[]) => {
    queueTasks.value = tasks
  })
}

const pickDirectoryIfNeeded = async () => {
  if (downloadDirectoryToken.value) return true

  const selectedDirectory = await window.backupFs.selectDirectory()
  if (!selectedDirectory) {
    return false
  }

  downloadDirectoryToken.value = selectedDirectory.token
  downloadDirectoryPath.value = selectedDirectory.path
  initQueue()
  return true
}

const fetchDirectory = async (path = DEFAULT_PATH) => {
  if (!props.device?.host_ip || !props.device?.id) return

  loading.value = true
  const normalizedPath = normalizeBrowserPath(path)

  try {
    const url = buildDeviceApiUrl(
      props.device.host_ip,
      props.device.id,
      API_CONTROL_CONFIG.PATHS.FILE_LIST
    )
    const res = await request.get<FileListResponse>(url, {
      path: normalizedPath,
      show_hidden: false
    })

    currentPath.value = normalizeBrowserPath(res.data.path || normalizedPath)
    entries.value = (res.data.files || []).filter((item) => {
      const itemPath = normalizePath(item.absolute_path)
      return (
        itemPath === DISPLAY_ROOT_PATH || itemPath.startsWith(`${DISPLAY_ROOT_PATH}/`)
      )
    })
    selectedFilePaths.value = []
  } catch (error) {
    entries.value = []
    ElMessage.error(getErrorMessage(error) || t('phone.getDirectoryFailed'))
  } finally {
    loading.value = false
  }
}

const handleNavigate = (path: string) => {
  fetchDirectory(normalizeBrowserPath(path))
}

const handleSelect = (item: DeviceFileItem) => {
  if (item.is_directory) {
    fetchDirectory(normalizeBrowserPath(item.absolute_path))
    return
  }

  if (isFileSelected(item)) {
    selectedFilePaths.value = selectedFilePaths.value.filter((path) => path !== item.absolute_path)
  } else {
    selectedFilePaths.value = [...selectedFilePaths.value, item.absolute_path]
  }
}

const handleAddToQueue = async () => {
  if (!selectedFiles.value.length) {
    ElMessage.warning(t('phone.selectFileToDownload'))
    return
  }

  queueLoading.value = true

  try {
    const canContinue = await pickDirectoryIfNeeded()
    if (!canContinue || !exportQueue || !props.device) return

    const existingPaths = new Set(queueTasks.value.map((task) => task.remotePath))
    let addedCount = 0

    selectedFiles.value.forEach((file) => {
      if (existingPaths.has(file.absolute_path)) return

      exportQueue?.add({
        device: props.device as Device,
        remotePath: file.absolute_path,
        fileName: file.name,
        size: file.size
      })
      addedCount++
    })

    selectedFilePaths.value = []

    if (addedCount > 0) {
      ElMessage.success(t('phone.addedToDownloadQueue', { count: addedCount }))
      return
    }

    ElMessage.info(t('phone.filesAlreadyInQueue'))
  } finally {
    queueLoading.value = false
  }
}

const handleDeleteTask = async (task: FileExportTask) => {
  if (!exportQueue) return
  await exportQueue.cancelAndRemove(task.id)
}

const handleClearCompleted = async () => {
  if (!exportQueue) return
  const completedIds = queueTasks.value
    .filter((task) => ['success', 'error'].includes(task.status))
    .map((task) => task.id)

  for (const taskId of completedIds) {
    await exportQueue.cancelAndRemove(taskId)
  }
}

const clearQueue = async () => {
  if (exportQueue) {
    await exportQueue.clearAll()
  }

  exportQueue = null
  queueTasks.value = []
  downloadDirectoryToken.value = ''
  downloadDirectoryPath.value = ''
}

watch(
  () => props.device?.id,
  async () => {
    currentPath.value = DEFAULT_PATH
    entries.value = []
    selectedFilePaths.value = []
    await clearQueue()

    if (props.device?.id) {
      fetchDirectory(DEFAULT_PATH)
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  void clearQueue()
})
</script>

<style scoped lang="scss">
.download-local {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 12px;
  background: var(--el-bg-color);
  overflow: hidden;
}

.browser-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.browser-toolbar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.toolbar-main {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.path-bar {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
  min-height: 42px;
  padding: 0 10px;
  border: 1px solid #dce3ef;
  border-radius: 14px;
  background: linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 20px rgba(15, 23, 42, 0.04);
}

.path-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.path-breadcrumbs::-webkit-scrollbar {
  display: none;
}

.path-crumb {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  padding: 5px 8px;
  background: transparent;
  color: #556071;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;

  &:hover {
    background: #eef3ff;
    color: #315cff;
  }

  &.active {
    background: #315cff;
    color: #fff;
  }
}

.path-crumb-icon {
  font-size: 13px;
}

.path-crumb-text {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-separator {
  flex-shrink: 0;
  color: #a3abbb;
  font-size: 10px;
}

.download-trigger {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color);
  border-radius: 14px;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;

  .el-icon {
    font-size: 18px;
  }

  &:hover:not(:disabled) {
    border-color: #315cff;
    color: #315cff;
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: not-allowed;
    color: var(--el-text-color-placeholder);
    border-color: var(--el-border-color-lighter);
  }
}

.browser-summary {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.selected-summary {
  white-space: nowrap;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 10px;
}

.file-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 66px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: #f7f7f8;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba(15, 23, 42, 0.05);
  }

  &.selected {
    border-color: #315cff;
    background: #f6f8ff;
  }
}

.file-card-parent {
  background: #f3f5f8;
}

.file-check {
  position: absolute;
  top: 7px;
  right: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid #c7d1e5;
  border-radius: 50%;
  background: #fff;
  color: transparent;

  &.checked {
    border-color: #315cff;
    background: #315cff;
    color: #fff;
  }

  .el-icon {
    font-size: 10px;
  }
}

.file-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex-shrink: 0;

  &.folder {
    background: linear-gradient(180deg, #ffd56a 0%, #f5bf52 100%);
    color: #b87400;
    box-shadow: 0 6px 12px rgba(245, 191, 82, 0.18);
  }

  &.document,
  &.file-card-icon-parent {
    background: linear-gradient(180deg, #edf1ff 0%, #dbe4ff 100%);
    color: #315cff;
  }

  .el-icon {
    font-size: 18px;
  }
}

.file-card-content {
  flex: 1;
  min-width: 0;
}

.file-card-name {
  font-size: 13px;
  font-weight: 500;
  color: #343a40;
  line-height: 1.3;
  word-break: break-word;
}

.file-card-meta {
  margin-top: 2px;
  font-size: 10px;
  color: #8b93a6;
}

.queue-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 220px;
  max-height: 240px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  background: #fcfcfd;
  overflow: hidden;
}

.queue-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: #fff;
}

.queue-header-main {
  min-width: 0;
  flex: 1;
}

.queue-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.queue-title {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.queue-directory {
  min-width: 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.queue-list {
  flex: 1;
  padding: 8px;
  overflow: auto;
}

.queue-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #eef1f6;

  & + & {
    margin-top: 8px;
  }
}

.queue-item-main {
  flex: 1;
  min-width: 0;
}

.queue-item-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.queue-item-status-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.queue-item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.queue-item-status {
  flex-shrink: 0;
  font-size: 11px;

  &.status-waiting {
    color: var(--el-text-color-secondary);
  }

  &.status-preparing,
  &.status-downloading,
  &.status-saving {
    color: var(--el-color-primary);
  }

  &.status-success {
    color: var(--el-color-success);
  }

  &.status-error {
    color: var(--el-color-danger);
  }
}

.queue-error-icon {
  flex-shrink: 0;
  color: var(--el-color-danger);
  cursor: pointer;
  font-size: 14px;
}

.queue-error-tooltip {
  max-width: 280px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.queue-item-path {
  margin-top: 4px;
  font-size: 11px;
  color: #7d8697;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 5px;
  font-size: 10px;
  color: #9aa3b2;
}

:deep(.queue-item .el-progress) {
  margin-top: 6px;
}

.queue-empty,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 160px;
}

@media (max-width: 480px) {
  .toolbar-main {
    justify-content: stretch;
  }

  .file-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .queue-panel {
    max-height: 280px;
  }

  .queue-title-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
