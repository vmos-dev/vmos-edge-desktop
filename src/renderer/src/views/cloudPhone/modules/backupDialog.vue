<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.backupDialogTitle')"
    width="600px"
    :show-close="!hasProcessingTask"
    @closed="handleClosed"
  >
    <div class="backup-dialog">
      <div class="backup-summary">
        <span class="summary-item">{{ t('common.total') }}: {{ tasks.length }}</span>
        <span class="summary-item waiting"
          >{{ t('cloudPhone.backupStatusWaiting') }}: {{ waitingCount }}</span
        >
        <span class="summary-item preparing"
          >{{ t('cloudPhone.backupStatusPreparing') }}: {{ preparingCount }}</span
        >
        <span class="summary-item downloading">
          {{ t('cloudPhone.backupStatusDownloading') }}: {{ downloadingCount }}
        </span>
        <span class="summary-item saving"
          >{{ t('cloudPhone.backupStatusSaving') }}: {{ savingCount }}</span
        >
        <span class="summary-item success">{{ t('common.success') }}: {{ successCount }}</span>
        <span class="summary-item error">{{ t('common.failed') }}: {{ errorCount }}</span>
      </div>

      <div class="backup-list">
        <div v-for="task in tasks" :key="task.id" class="backup-item">
          <div class="task-left">
            <div class="task-title">
              <span class="device-name">{{ task.device.user_name || task.dbId }}</span>
              <span class="db-id">{{ task.dbId }}</span>
            </div>
            <div class="task-file" v-if="task.fileName">{{ task.fileName }}</div>
            <div
              class="task-metrics"
              v-if="task.status === 'downloading' || task.status === 'saving'"
            >
              <span class="metric-item">
                {{ formatBytes(task.receivedBytes) }}
                <template v-if="task.totalBytes"> / {{ formatBytes(task.totalBytes) }}</template>
              </span>
              <span class="metric-item">{{ formatSpeed(task.speedBps) }}</span>
              <span class="metric-item">{{ formatEta(task.etaSeconds) }}</span>
            </div>
          </div>

          <div class="task-right">
            <div class="task-status-wrap">
              <span class="task-status" :class="`status-${task.status}`">{{
                getStatusText(task.status)
              }}</span>
              <el-tooltip
                v-if="task.status === 'error' && task.error"
                :content="task.error"
                placement="top"
              >
                <el-icon class="task-error-icon">
                  <WarningFilled />
                </el-icon>
              </el-tooltip>
            </div>
            <el-button
              v-if="['waiting', 'preparing', 'downloading', 'saving'].includes(task.status)"
              link
              type="danger"
              size="small"
              class="task-delete-btn"
              @click="handleDelete(task)"
            >
              {{ t('common.delete') }}
            </el-button>
          </div>
          <el-progress
            v-if="
              task.status === 'preparing' ||
              task.status === 'downloading' ||
              task.status === 'saving'
            "
            :percentage="task.totalBytes ? Math.round(task.progress * 100) : 100"
            :indeterminate="task.status === 'preparing' || !task.totalBytes"
            :format="
              () =>
                task.totalBytes
                  ? `${Math.round(task.progress * 100)}%`
                  : t('cloudPhone.backupProgressUnknown')
            "
            :show-text="true"
            :stroke-width="6"
            class="task-progress"
          />
        </div>

        <div v-if="tasks.length === 0" class="empty-wrap">
          <el-empty :description="t('common.noData')" :image-size="100" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-actions" v-if="!hasProcessingTask">
        <el-button @click="visible = false">{{ t('cloudPhone.close') }}</el-button>
      </div>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Device } from '@shared/ipc/data.types'
import {
  BACKUP_CONCURRENCY,
  BackupQueue,
  type BackupTask,
  type BackupTaskStatus
} from '@renderer/utils/backup'
import { formatBytes } from '@renderer/utils'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const tasks = ref<BackupTask[]>([])
let backupQueue: BackupQueue | null = null

const hasProcessingTask = computed(() => {
  return tasks.value.some((task) =>
    ['waiting', 'preparing', 'downloading', 'saving'].includes(task.status)
  )
})
const waitingCount = computed(() => tasks.value.filter((task) => task.status === 'waiting').length)
const preparingCount = computed(
  () => tasks.value.filter((task) => task.status === 'preparing').length
)
const downloadingCount = computed(
  () => tasks.value.filter((task) => task.status === 'downloading').length
)
const savingCount = computed(() => tasks.value.filter((task) => task.status === 'saving').length)
const successCount = computed(() => tasks.value.filter((task) => task.status === 'success').length)
const errorCount = computed(() => tasks.value.filter((task) => task.status === 'error').length)

const getStatusText = (status: BackupTaskStatus) => {
  const map: Record<BackupTaskStatus, string> = {
    waiting: t('cloudPhone.backupStatusWaiting'),
    preparing: t('cloudPhone.backupStatusPreparing'),
    downloading: t('cloudPhone.backupStatusDownloading'),
    saving: t('cloudPhone.backupStatusSaving'),
    success: t('cloudPhone.backupStatusSuccess'),
    error: t('cloudPhone.backupStatusError')
  }
  return map[status]
}

const updateTaskList = (list?: BackupTask[]) => {
  if (list) {
    tasks.value = [...list]
    return
  }
  tasks.value = backupQueue?.getTasks() || []
}

const pickDirectory = async () => {
  try {
    return await window.backupFs.selectDirectory()
  } catch (error) {
    ElMessage.error((error as Error)?.message || t('cloudPhone.backupDirectoryUnsupported'))
    return null
  }
}

const formatSpeed = (speedBps: number) => {
  if (!speedBps || speedBps <= 0) return '-'
  return `${formatBytes(speedBps)}/s`
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

const handleDelete = async (task: BackupTask) => {
  if (!backupQueue) return
  if (!['waiting', 'preparing', 'downloading', 'saving'].includes(task.status)) return
  const { cancelError } = await backupQueue.cancelAndRemove(task.id)
  if (cancelError) {
    ElMessage.error(t('cloudPhone.backupCancelApiFailed', { error: cancelError }))
  }
}

const handleClosed = async () => {
  if (backupQueue) {
    await backupQueue.clearAll()
  }
  backupQueue = null
  tasks.value = []
}

const init = async (devices: Device[]) => {
  if (!devices.length) return

  const directory = await pickDirectory()
  if (!directory) {
    return
  }

  visible.value = true
  tasks.value = []

  backupQueue = new BackupQueue({
    directoryToken: directory.token,
    directoryPath: directory.path,
    concurrency: BACKUP_CONCURRENCY
  })

  backupQueue.on('change', (list: BackupTask[]) => {
    updateTaskList(list)
  })

  devices.forEach((device) => {
    backupQueue?.add(device)
  })
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.backup-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: transparent;
}

.backup-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
  background: color-mix(in srgb, var(--el-bg-color) 85%, transparent);
  backdrop-filter: blur(3px);
}

.summary-item {
  color: var(--el-text-color-regular);
}

.summary-item.waiting {
  color: var(--el-text-color-secondary);
}

.summary-item.preparing,
.summary-item.downloading,
.summary-item.saving {
  color: var(--el-color-primary);
}

.summary-item.success {
  color: var(--el-color-success);
}

.summary-item.error {
  color: var(--el-color-danger);
}

.backup-list {
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.backup-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'info side'
    'progress progress';
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--el-fill-color-extra-light);
  background: color-mix(in srgb, var(--el-bg-color) 85%, transparent);
  backdrop-filter: blur(3px);
}

.task-left {
  grid-area: info;
  min-width: 0;
}

.task-title {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.device-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.db-id {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.task-file {
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-metrics {
  margin-top: 3px;
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.metric-item {
  white-space: nowrap;
}

.task-right {
  grid-area: side;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  align-self: start;
  gap: 8px;
}

.task-status-wrap {
  min-width: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.task-status {
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  text-align: right;
}

.task-status.status-waiting {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.task-status.status-preparing,
.task-status.status-downloading,
.task-status.status-saving {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  border-color: color-mix(in srgb, var(--el-color-primary) 28%, transparent);
}

.task-status.status-success {
  color: var(--el-color-success);
  background: color-mix(in srgb, var(--el-color-success) 10%, transparent);
  border-color: color-mix(in srgb, var(--el-color-success) 28%, transparent);
}

.task-status.status-error {
  color: var(--el-color-danger);
  background: color-mix(in srgb, var(--el-color-danger) 10%, transparent);
  border-color: color-mix(in srgb, var(--el-color-danger) 28%, transparent);
}

.task-error-icon {
  color: var(--el-color-danger);
  font-size: 11px;
  cursor: help;
}

.task-progress {
  grid-area: progress;
  width: 100%;
  margin-top: 1px;
}

.task-progress :deep(.el-progress__text) {
  font-size: 11px !important;
  color: var(--el-text-color-secondary);
}

.task-delete-btn {
  font-size: 11px;
  min-height: 18px;
  padding: 0 2px;
}

.empty-wrap {
  padding: 12px 0;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .backup-item {
    grid-template-columns: 1fr;
    grid-template-areas:
      'info'
      'progress'
      'side';
  }

  .task-right {
    justify-content: space-between;
  }

  .task-status-wrap {
    min-width: 0;
  }
}
</style>
