<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CircleCheck,
  CircleClose,
  Loading,
  Clock,
  InfoFilled,
  UploadFilled,
  Close
} from '@element-plus/icons-vue'
import { UploadQueue, type UploadTask } from '@renderer/utils/upload'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import {
  downloadCbsPackage,
  getErrorMessage,
  type CbsRemoteConfig,
  type HostCbsInfo
} from '@renderer/utils/cbsUpdateService'

interface Props {
  remoteConfig: CbsRemoteConfig
  outdatedHosts: HostCbsInfo[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  dismiss: []
}>()
const visible = defineModel<boolean>({ default: false })

const { t, locale } = useI18n()

type Phase = 'selection' | 'downloading' | 'upgrading' | 'completed'
const phase = shallowRef<Phase>('selection')

const updateDescription = computed(() => {
  const desc = props.remoteConfig.update_description
  if (!desc || typeof desc !== 'object') return ''
  return desc[locale.value] || desc['zh-CN'] || Object.values(desc)[0] || ''
})

// ── 选择状态 ──

const updatableHosts = computed(() => props.outdatedHosts.filter((h) => h.needsUpdate))

const selectedIps = shallowRef<Set<string>>(
  new Set(props.outdatedHosts.filter((h) => h.needsUpdate).map((h) => h.host.ip))
)
const selectedCount = computed(() => selectedIps.value.size)
const dismiss7Days = shallowRef(false)

const isSelected = (ip: string) => selectedIps.value.has(ip)

const toggleSelection = (ip: string, checked: boolean) => {
  const next = new Set(selectedIps.value)
  checked ? next.add(ip) : next.delete(ip)
  selectedIps.value = next
}

const toggleAll = (checked: boolean) => {
  selectedIps.value = checked ? new Set(updatableHosts.value.map((h) => h.host.ip)) : new Set()
}

const isAllSelected = computed(() => {
  return (
    updatableHosts.value.length > 0 &&
    updatableHosts.value.every((h) => selectedIps.value.has(h.host.ip))
  )
})

const isIndeterminate = computed(() => {
  const count = updatableHosts.value.filter((h) => selectedIps.value.has(h.host.ip)).length
  return count > 0 && count < updatableHosts.value.length
})

// ── 下载状态 ──

const downloadProgress = shallowRef(0)
const downloadError = shallowRef('')
let downloadAbort: AbortController | null = null

// ── 升级状态 ──

const upgradeTasks = shallowRef<UploadTask[]>([])

const upgradeStats = computed(() => {
  const stats = { total: 0, success: 0, fail: 0, uploading: 0, waiting: 0, cancelled: 0 }
  for (const task of upgradeTasks.value) {
    stats.total++
    if (task.status === 'success') stats.success++
    else if (task.status === 'error') stats.fail++
    else if (task.status === 'uploading' || task.status === 'pushing') stats.uploading++
    else if (task.status === 'waiting') stats.waiting++
    else if (task.status === 'cancelled') stats.cancelled++
  }
  return stats
})

// ── 关闭控制 ──

const allItemsDone = computed(() => {
  const tasks = upgradeTasks.value
  return (
    tasks.length > 0 &&
    tasks.every((t) => t.status === 'success' || t.status === 'error' || t.status === 'cancelled')
  )
})

const showClose = computed(() => {
  if (phase.value === 'selection' || phase.value === 'completed') return true
  if (phase.value === 'upgrading' && allItemsDone.value) return true
  return false
})

const handleClose = () => {
  if (dismiss7Days.value) emit('dismiss')
  visible.value = false
}

const cancelDownload = () => {
  downloadAbort?.abort()
  phase.value = 'selection'
  downloadError.value = ''
}

// ── 升级流程 ──

let upgradeQueue: UploadQueue | null = null

const syncTasks = () => {
  if (!upgradeQueue) return
  upgradeTasks.value = [...upgradeQueue.getTasks()]
}

const getHostId = (ip: string) => props.outdatedHosts.find((h) => h.host.ip === ip)?.host.id || ''

const cancelItem = (id: number) => {
  upgradeQueue?.cancelOne(id)
  syncTasks()
}

const startUpgrade = async () => {
  if (phase.value !== 'selection') return
  const hosts = props.outdatedHosts.filter((h) => selectedIps.value.has(h.host.ip))
  if (hosts.length === 0) return

  phase.value = 'downloading'
  downloadProgress.value = 0
  downloadError.value = ''
  downloadAbort = new AbortController()

  let blob: Blob
  let fileName: string
  try {
    const result = await downloadCbsPackage(
      props.remoteConfig.download_url,
      (p) => {
        downloadProgress.value = p < 0 ? -1 : Math.round(p * 100)
      },
      downloadAbort.signal
    )
    blob = result.blob
    fileName = result.fileName
  } catch (err) {
    if (downloadAbort.signal.aborted) return
    downloadError.value = getErrorMessage(err)
    return
  }

  phase.value = 'upgrading'

  const file = new File([blob], fileName, { type: 'application/octet-stream' })
  const queue = new UploadQueue({ concurrency: 5 })
  upgradeQueue = queue

  queue.on('status', () => {
    syncTasks()
    if (phase.value === 'upgrading' && allItemsDone.value) {
      phase.value = 'completed'
      upgradeQueue = null
    }
  })

  queue.on('finish', () => {
    syncTasks()
    phase.value = 'completed'
    upgradeQueue = null
  })

  for (const h of hosts) {
    const formData = new FormData()
    formData.append('file', file)
    queue.add({
      url: buildApiUrl(h.host.ip, API_CONFIG.PATHS.UPDATE_CBS),
      hostIp: h.host.ip,
      file,
      formData: formData as any
    })
  }

  syncTasks()
}

const retryDownload = () => {
  phase.value = 'selection'
  downloadError.value = ''
}
</script>

<template>
  <vmos-dialog
    v-model="visible"
    :title="t('host.cbsUpdateTitle')"
    width="620px"
    :show-close="showClose"
    @close="handleClose"
  >
    <div class="cbs-update-dialog">
      <!-- ═══ 更新信息区（紧凑一行） ═══ -->
      <div class="update-info-bar">
        <span class="update-info-label">{{ t('host.cbsLatestVersion', { version: '' }) }}</span>
        <el-tag type="primary" size="small" effect="dark" round>
          v{{ remoteConfig.cbs_version }}
        </el-tag>
        <span v-if="updateDescription" class="update-info-desc" :title="updateDescription">
          — {{ updateDescription }}
        </span>
      </div>

      <!-- ═══ selection ═══ -->
      <template v-if="phase === 'selection'">
        <div class="host-list-section">
          <div class="host-list-header">
            <el-checkbox
              :model-value="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="toggleAll"
            >
              {{ t('common.selectAll') }}
            </el-checkbox>
            <span class="list-title">{{ t('host.upgradeList') }} ({{ outdatedHosts.length }})</span>
          </div>
          <div class="host-list-content">
            <div
              v-for="host in outdatedHosts"
              :key="host.host.ip"
              class="host-item"
              :class="{ 'is-disabled': !host.needsUpdate }"
              @click="host.needsUpdate && toggleSelection(host.host.ip, !isSelected(host.host.ip))"
            >
              <div class="host-item-left">
                <el-checkbox
                  :model-value="isSelected(host.host.ip)"
                  :disabled="!host.needsUpdate"
                  @change="(val: boolean) => toggleSelection(host.host.ip, val)"
                  @click.stop
                />
                <div class="host-item-info">
                  <div class="host-item-name">{{ host.host.ip }}</div>
                  <div class="host-item-ip">{{ host.host.id }}</div>
                </div>
              </div>
              <div class="host-item-right">
                <span class="host-item-version">{{ host.currentVersion || '-' }}</span>
                <el-tag
                  :type="host.needsUpdate ? 'warning' : 'success'"
                  size="small"
                  effect="light"
                >
                  {{ host.needsUpdate ? t('host.cbsNeedsUpdate') : t('host.cbsUpToDate') }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ═══ downloading ═══ -->
      <template v-else-if="phase === 'downloading'">
        <div class="download-area">
          <template v-if="!downloadError">
            <div class="download-icon-wrapper">
              <el-icon class="download-icon rotating"><Loading /></el-icon>
            </div>
            <p class="download-text">{{ t('host.cbsDownloading') }}</p>
            <div class="download-progress-wrap">
              <el-progress
                :percentage="downloadProgress < 0 ? 100 : downloadProgress"
                :stroke-width="8"
                :show-text="false"
                :indeterminate="downloadProgress < 0"
                striped
                striped-flow
              />
              <span class="download-percent">
                {{ downloadProgress < 0 ? '...' : downloadProgress + '%' }}
              </span>
            </div>
          </template>
          <template v-else>
            <div class="download-icon-wrapper is-error">
              <el-icon class="download-icon"><CircleClose /></el-icon>
            </div>
            <p class="download-error-title">{{ t('host.cbsDownloadFailed') }}</p>
            <p class="download-error-detail">{{ downloadError }}</p>
            <div class="download-error-actions">
              <el-button size="small" @click="handleClose">{{ t('common.close') }}</el-button>
              <el-button type="primary" size="small" @click="retryDownload">
                {{ t('host.cbsDownloadRetry') }}
              </el-button>
            </div>
          </template>
        </div>
      </template>

      <!-- ═══ upgrading / completed ═══ -->
      <template v-else>
        <div class="upgrade-area">
          <!-- 统计栏 -->
          <div class="upgrade-stats-bar">
            <div class="upgrade-stats">
              <span class="stats-item total">
                <el-icon><UploadFilled /></el-icon>
                {{ t('common.total') }}: {{ upgradeStats.total }}
              </span>
              <span v-if="upgradeStats.waiting > 0" class="stats-item waiting">
                <el-icon><Clock /></el-icon>
                {{ t('common.waiting') }}: {{ upgradeStats.waiting }}
              </span>
              <span v-if="upgradeStats.uploading > 0" class="stats-item uploading">
                <el-icon class="rotating"><Loading /></el-icon>
                {{ t('host.cbsUpgrading') }}: {{ upgradeStats.uploading }}
              </span>
              <span v-if="upgradeStats.success > 0" class="stats-item success">
                <el-icon><CircleCheck /></el-icon>
                {{ t('common.success') }}: {{ upgradeStats.success }}
              </span>
              <span v-if="upgradeStats.fail > 0" class="stats-item error">
                <el-icon><CircleClose /></el-icon>
                {{ t('common.failed') }}: {{ upgradeStats.fail }}
              </span>
              <span v-if="upgradeStats.cancelled > 0" class="stats-item cancelled">
                <el-icon><Close /></el-icon>
                {{ t('host.cancelled') }}: {{ upgradeStats.cancelled }}
              </span>
            </div>
          </div>

          <!-- 主机任务列表 -->
          <div class="upgrade-list-content">
            <div
              v-for="task in upgradeTasks"
              :key="task.id"
              class="file-item"
              :class="{
                'status-uploading': task.status === 'uploading' || task.status === 'pushing',
                'status-success': task.status === 'success',
                'status-error': task.status === 'error',
                'status-waiting': task.status === 'waiting',
                'status-cancelled': task.status === 'cancelled'
              }"
            >
              <!-- 背景进度 -->
              <div
                v-if="task.status === 'uploading'"
                class="progress-background"
                :style="{
                  background: `linear-gradient(to right,
                    var(--el-color-primary-light-9) 0%,
                    var(--el-color-primary-light-8) ${Math.round(task.progress * 100) * 0.5}%,
                    var(--el-color-primary-light-7) ${Math.round(task.progress * 100)}%,
                    transparent ${Math.round(task.progress * 100)}%)`
                }"
              />

              <!-- 左侧 -->
              <div class="file-left">
                <div class="file-icon-wrapper">
                  <el-icon
                    class="file-icon"
                    :class="{
                      'icon-waiting': task.status === 'waiting',
                      'icon-uploading': task.status === 'uploading' || task.status === 'pushing',
                      'icon-success': task.status === 'success',
                      'icon-error': task.status === 'error',
                      'icon-cancelled': task.status === 'cancelled'
                    }"
                  >
                    <Clock v-if="task.status === 'waiting'" />
                    <Loading v-else-if="task.status === 'uploading' || task.status === 'pushing'" />
                    <CircleCheck v-else-if="task.status === 'success'" />
                    <Close v-else-if="task.status === 'cancelled'" />
                    <CircleClose v-else />
                  </el-icon>
                </div>
                <div class="file-info">
                  <div class="file-host-ip">{{ task.hostIp }}</div>
                  <div class="file-name-size">
                    <span class="file-name">{{ getHostId(task.hostIp) }}</span>
                  </div>
                </div>
              </div>

              <!-- 右侧 -->
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
                      {{ Math.round(task.progress * 100) }}%
                    </span>
                    <span v-else-if="task.status === 'pushing'" class="progress-text">
                      {{ t('host.pushing') }}
                    </span>
                    <span v-else class="status-text" :class="`status-${task.status}`">
                      {{
                        task.status === 'success'
                          ? t('common.success')
                          : task.status === 'waiting'
                            ? t('common.waiting')
                            : task.status === 'cancelled'
                              ? t('host.cancelled')
                              : t('common.failed')
                      }}
                      <el-tooltip
                        v-if="task.status === 'error' && task.errorInfo"
                        placement="left"
                        effect="dark"
                        trigger="click"
                      >
                        <template #content>
                          <div style="max-width: 300px; max-height: 200px; overflow-y: auto">
                            {{ task.errorInfo }}
                          </div>
                        </template>
                        <el-icon class="error-info-icon"><InfoFilled /></el-icon>
                      </el-tooltip>
                    </span>
                  </div>
                </div>
                <el-icon
                  v-if="
                    task.status === 'waiting' ||
                    task.status === 'uploading' ||
                    task.status === 'pushing'
                  "
                  class="cancel-item-btn"
                  @click="cancelItem(task.id)"
                >
                  <Close />
                </el-icon>
              </div>
            </div>
          </div>

          <!-- completed 结果横幅 -->
          <div v-if="phase === 'completed'" class="upgrade-result">
            <el-icon
              class="result-icon"
              :class="upgradeStats.fail > 0 || upgradeStats.cancelled > 0 ? 'is-warn' : 'is-ok'"
            >
              <CircleCheck v-if="upgradeStats.fail === 0 && upgradeStats.cancelled === 0" />
              <InfoFilled v-else />
            </el-icon>
            <span class="result-text">
              {{
                t('host.cbsUpgradeSummary', {
                  success: upgradeStats.success,
                  fail: upgradeStats.fail,
                  cancelled: upgradeStats.cancelled
                })
              }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══ footer ═══ -->
    <template #footer>
      <div class="cbs-footer">
        <el-checkbox v-if="phase === 'selection'" v-model="dismiss7Days" class="dismiss-check">
          {{ t('host.cbsDismiss7Days') }}
        </el-checkbox>
        <span v-else />
        <div class="footer-btns">
          <template v-if="phase === 'selection'">
            <el-button @click="handleClose">{{ t('common.close') }}</el-button>
            <el-button type="primary" :disabled="selectedCount === 0" @click="startUpgrade">
              {{ t('host.cbsStartUpgrade', { count: selectedCount }) }}
            </el-button>
          </template>
          <template v-else-if="phase === 'downloading'">
            <el-button @click="cancelDownload">{{ t('common.cancel') }}</el-button>
            <el-button v-if="downloadError" type="primary" @click="retryDownload">
              {{ t('host.cbsDownloadRetry') }}
            </el-button>
          </template>
          <el-button
            v-else-if="phase === 'completed' || allItemsDone"
            type="primary"
            @click="handleClose"
          >
            {{ t('common.close') }}
          </el-button>
        </div>
      </div>
    </template>
  </vmos-dialog>
</template>

<style lang="scss" scoped>
.cbs-update-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── 更新信息（紧凑一行） ── */

.update-info-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.update-info-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.update-info-desc {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── selection: 主机列表 ── */

.host-list-section {
  display: flex;
  flex-direction: column;
}

.host-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  .list-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.host-list-content {
  max-height: 55vh;
  overflow-y: auto;
  padding: 4px 0;
}

.host-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);
  }

  &.is-disabled {
    cursor: default;
    opacity: 0.6;

    &:hover {
      border-color: var(--el-border-color-lighter);
      background: transparent;
    }
  }
}

.host-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.host-item-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.host-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.host-item-ip {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.host-item-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.host-item-version {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* ── downloading ── */

.download-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 0;
  gap: 12px;
}

.download-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-error {
    background: var(--el-color-danger-light-9);

    .download-icon {
      color: var(--el-color-danger);
    }
  }
}

.download-icon {
  font-size: 24px;
  color: var(--el-color-primary);
}

.download-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin: 0;
}

.download-progress-wrap {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  .el-progress {
    width: 100%;
  }
}

.download-percent {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.download-error-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin: 0;
}

.download-error-detail {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  max-width: 400px;
  text-align: center;
  word-break: break-all;
  line-height: 1.5;
  margin: 0;
}

.download-error-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

/* ── upgrading / completed ── */

.upgrade-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.upgrade-stats-bar {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.upgrade-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

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
  }

  &.total {
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
  }

  &.waiting {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }

  &.uploading {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.success {
    color: var(--el-color-success);
    background: var(--el-color-success-light-9);
  }

  &.error {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }

  &.cancelled {
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
  }
}

.upgrade-list-content {
  max-height: 55vh;
  overflow-y: auto;
}

/* 复用 update.vue 的卡片样式 */

.file-item {
  position: relative;
  padding: 8px 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  margin-bottom: 6px;
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

  &.status-cancelled {
    border-color: var(--el-border-color-lighter);
    opacity: 0.6;
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
}

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

    &.icon-waiting {
      color: var(--el-color-warning);
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

    &.icon-cancelled {
      color: var(--el-text-color-placeholder);
    }
  }
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.file-host-ip {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.file-name-size {
  .file-name {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}

.file-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.cancel-item-btn {
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }
}

.status-info {
  text-align: right;
  min-width: 60px;
}

.status-line {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;

  .status-icon {
    font-size: 14px;
    color: var(--el-color-primary);
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

    &.status-cancelled {
      color: var(--el-text-color-placeholder);
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

/* 完成结果 */

.upgrade-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;

  .result-icon {
    font-size: 18px;

    &.is-ok {
      color: var(--el-color-success);
    }

    &.is-warn {
      color: var(--el-color-warning);
    }
  }

  .result-text {
    color: var(--el-text-color-primary);
  }

  background: var(--el-color-success-light-9);

  &:has(.is-warn) {
    background: var(--el-color-warning-light-9);
  }
}

/* ── footer ── */

.cbs-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dismiss-check {
  font-size: 13px;
}

.footer-btns {
  display: flex;
  gap: 8px;
}

/* ── 动画 ── */

.rotating {
  animation: rotate 1.5s linear infinite;
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
