<template>
  <vmos-dialog v-model="visible" :title="t('host.hostInfo')" width="520px" @close="handleClose">
    <div class="host-detail-container">
      <!-- 主机基本信息 -->
      <div class="detail-section">
        <div class="detail-item">
          <span class="detail-label">{{ t('host.columnHostId') }}:</span>
          <span class="detail-value">{{ hostDetail.id || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">{{ t('host.columnHostIp') }}:</span>
          <span class="detail-value">{{ hostDetail.ip || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">{{ t('host.model') }}:</span>
          <span class="detail-value">{{ hostDetail.model || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">{{ t('host.shareStatus') }}:</span>
          <span class="detail-value">
            <el-tag :type="hostDetail.isShare ? 'success' : 'info'" size="small">
              {{ hostDetail.isShare ? t('host.shareOpened') : t('host.shareClosed') }}
            </el-tag>
          </span>
        </div>
        <div v-if="hostDetail.isShare" class="detail-item">
          <span class="detail-label">{{ t('host.shareAddress') }}:</span>
          <span class="detail-value">{{ hostDetail.shareUrl || '-' }}</span>
        </div>
      </div>

      <!-- 资源使用情况 -->
      <div class="detail-section">
        <div class="section-title">{{ t('host.resourceUsage') }}</div>

        <!-- CPU -->
        <div class="resource-item">
          <div class="resource-header">
            <span class="resource-label">CPU:</span>
            <span class="resource-percent">{{ (hostDetail.cpuPercent || 0).toFixed(1) }}%</span>
          </div>
          <el-progress
            :show-text="false"
            :percentage="hostDetail.cpuPercent || 0"
            :color="getProgressColor(hostDetail.cpuPercent || 0)"
            :stroke-width="8"
          />
        </div>

        <!-- CPU 温度 -->
        <div class="resource-item">
          <div class="resource-header">
            <span class="resource-label">{{ t('host.cpuTemp') }}:</span>
            <span class="resource-percent">{{ hostDetail.cpuTemp || 0 }}°C</span>
          </div>
          <el-progress
            :show-text="false"
            :percentage="Math.min(hostDetail.cpuTemp || 0, 100)"
            :color="getTempColor(hostDetail.cpuTemp || 0)"
            :stroke-width="8"
          />
        </div>

        <!-- 内存 -->
        <div class="resource-item">
          <div class="resource-header">
            <span class="resource-label">{{ t('host.memory') }}:</span>
            <span class="resource-percent">{{ hostDetail.memoryPercent || 0 }}%</span>
          </div>
          <el-progress
            :show-text="false"
            :percentage="hostDetail.memoryPercent || 0"
            :color="getProgressColor(hostDetail.memoryPercent || 0)"
            :stroke-width="8"
          />
          <div class="resource-usage">
            {{ formatBytes(hostDetail.memoryUsed || 0) }}/{{
              formatBytes(hostDetail.memoryTotal || 0)
            }}
          </div>
        </div>

        <!-- 虚拟内存(swap) -->
        <div class="resource-item">
          <div class="resource-header">
            <div class="resource-label-wrap">
              <span class="resource-label">{{ t('host.swap') }}:</span>
              <el-link
                type="primary"
                :underline="false"
                class="swap-edit-link"
                @click="swapEditing = !swapEditing"
                >{{ t('host.swapEdit') }}</el-link
              >
            </div>
            <span class="resource-percent">{{ hostDetail.swapPercent || 0 }}%</span>
          </div>
          <el-progress
            :show-text="false"
            :percentage="hostDetail.swapPercent || 0"
            :color="getProgressColor(hostDetail.swapPercent || 0)"
            :stroke-width="8"
          />
          <div class="resource-usage">
            {{ formatBytes(hostDetail.swapUsed || 0) }}/{{ formatBytes(hostDetail.swapTotal || 0) }}
          </div>
          <div v-if="swapEditing" class="swap-row">
            <span class="swap-bound">2G</span>
            <el-slider
              v-model="swapSize"
              :min="2"
              :max="16"
              :step="1"
              :show-tooltip="false"
              :disabled="swapLoading"
            />
            <span class="swap-bound">16G</span>
            <span class="swap-value">{{ swapSize }}G</span>
            <el-button
              type="primary"
              :icon="Check"
              :loading="swapLoading"
              circle
              size="small"
              @click="handleSetSwap"
            />
          </div>
        </div>

        <!-- 本地存储 -->
        <div class="resource-item">
          <div class="resource-header">
            <span class="resource-label">{{ t('host.localStorage') }}:</span>
            <span class="resource-percent">{{ hostDetail.localStoragePercent || 0 }}%</span>
          </div>
          <el-progress
            :show-text="false"
            :percentage="hostDetail.localStoragePercent || 0"
            :color="getProgressColor(hostDetail.localStoragePercent || 0)"
            :stroke-width="8"
          />
          <div class="resource-usage">
            {{ formatBytes(hostDetail.localStorageUsed || 0) }}/{{
              formatBytes(hostDetail.localStorageTotal || 0)
            }}
          </div>
        </div>

        <!-- 硬盘存储 -->
        <div class="resource-item">
          <div class="resource-header">
            <span class="resource-label">{{ t('host.diskStorage') }}:</span>
            <span class="resource-percent">{{ hostDetail.diskPercent || 0 }}%</span>
          </div>
          <el-progress
            :show-text="false"
            :percentage="hostDetail.diskPercent || 0"
            :color="getProgressColor(hostDetail.diskPercent || 0)"
            :stroke-width="8"
          />
          <div class="resource-usage">
            {{ formatBytes(hostDetail.diskUsed || 0) }}/{{ formatBytes(hostDetail.diskTotal || 0) }}
          </div>
        </div>
      </div>

      <!-- 系统版本信息 -->
      <div class="detail-section">
        <div class="section-title">{{ t('host.systemVersionInfo') }}</div>
        <div class="detail-item">
          <span class="detail-label">{{ t('host.debianVersion') }}:</span>
          <span class="detail-value">{{ hostDetail.debianVersion || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">{{ t('host.debianKernelVersion') }}:</span>
          <span class="detail-value">{{ hostDetail.debianKernelVersion || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">{{ t('host.cbsVersion') }}:</span>
          <span class="detail-value">
            {{ hostDetail.cbsVersion || '-' }}
            <el-upload
              ref="updateCBSRef"
              v-if="hostDetail.cbsVersion"
              action="#"
              :disabled="saveLoading"
              :auto-upload="true"
              :http-request="handleUpdateCBS"
              :show-file-list="false"
              :accept="'.cbs'"
            >
              <el-link style="font-size: 13px" size="small" type="primary" :underline="false">{{
                t('host.update')
              }}</el-link>
            </el-upload>
          </span>
        </div>
      </div>
    </div>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onUnmounted } from 'vue'
import { ElMessage, ElUpload } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { request } from '@shared/api/request'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { formatBytes } from '@renderer/utils/index'
import type { Host } from '@shared/ipc/data.types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface HostDetail {
  id: string
  ip: string
  model?: string
  cpuPercent?: number
  cpuTemp?: number
  memoryPercent?: number
  memoryUsed?: number
  memoryTotal?: number
  swapPercent?: number
  swapUsed?: number
  swapTotal?: number
  localStoragePercent?: number
  localStorageUsed?: number
  localStorageTotal?: number
  diskPercent?: number
  diskUsed?: number
  diskTotal?: number
  debianVersion?: string
  debianKernelVersion?: string
  cbsVersion?: string
  isShare?: boolean
  shareUrl?: string
}

const visible = ref(false)
const host = ref<Host>()
const loading = ref(false)
const defaultHostDetail = (): HostDetail => {
  return {
    id: '',
    ip: '',
    model: '',
    cpuPercent: 0,
    cpuTemp: 0,
    memoryPercent: 0,
    memoryUsed: 0,
    memoryTotal: 0,
    swapPercent: 0,
    swapUsed: 0,
    swapTotal: 0,
    localStoragePercent: 0,
    localStorageUsed: 0,
    localStorageTotal: 0,
    diskPercent: 0,
    diskUsed: 0,
    diskTotal: 0,
    debianVersion: '',
    debianKernelVersion: '',
    cbsVersion: '',
    isShare: false,
    shareUrl: ''
  }
}
const hostDetail = reactive<HostDetail>(defaultHostDetail())
const updateCBSRef = ref<InstanceType<typeof ElUpload>>()
const saveLoading = ref(false)

// Swap 设置
const swapSize = ref(2)
const swapLoading = ref(false)
const swapEditing = ref(false)
let swapSizeInitialized = false

const handleSetSwap = async () => {
  if (swapLoading.value) return
  swapLoading.value = true
  try {
    await request.get(
      buildApiUrl(host.value!.ip, `${API_CONFIG.PATHS.SET_SWAP_SIZE}/${swapSize.value}`),
      {}
    )
    ElMessage.success(t('host.swapSetSuccess'))
    swapEditing.value = false
  } catch {
    ElMessage.error(t('host.swapSetFailed'))
  } finally {
    swapLoading.value = false
  }
}

/**
 * 根据百分比获取进度条颜色
 */
function getProgressColor(percent: number): string {
  if (percent < 50) return 'var(--el-color-success)'
  if (percent < 80) return 'var(--el-color-warning)'
  return 'var(--el-color-danger)'
}

function getTempColor(temp: number): string {
  if (temp < 50) return 'var(--el-color-success)'
  if (temp < 70) return 'var(--el-color-warning)'
  return 'var(--el-color-danger)'
}

/**
 * 将MB转换为字节
 */
function mbToBytes(mb: number): number {
  return mb * 1024 * 1024
}

const handleClose = () => {
  stopPolling()
  Object.assign(hostDetail, defaultHostDetail())
  swapSize.value = 2
  swapEditing.value = false
  swapSizeInitialized = false
}

/**
 * 更新CBS版本
 */
const handleUpdateCBS = async (options: any) => {
  if (saveLoading.value) return
  const { file } = options
  const formData = new FormData()
  formData.append('file', file)
  saveLoading.value = true
  try {
    const res: any = await request.post(
      buildApiUrl(host.value!.ip, API_CONFIG.PATHS.UPDATE_CBS),
      formData,
      {
        timeout: 3 * 60 * 1000,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    )
    hostDetail.cbsVersion = res?.data?.current_version || ''
    ElMessage.success(t('host.updateCbsSuccess'))
  } catch (error) {
    ElMessage.error(t('host.updateCbsFailed'))
  } finally {
    saveLoading.value = false
    updateCBSRef.value?.clearFiles()
  }
}

/**
 * 获取主机详情
 */
async function fetchHostDetail(host: Host) {
  if (!visible.value || loading.value) return
  loading.value = true
  try {
    // 从row中设置基本信息
    hostDetail.id = host.id
    hostDetail.ip = host.ip

    // 从 /v1/get_hardware_cfg 获取基本信息（型号、系统版本等）
    const hardwareUrl = buildApiUrl(host.ip, API_CONFIG.PATHS.GET_HARDWARE_CFG)
    const hardwareResponse = await request.get(hardwareUrl, {})
    if (!visible.value) return

    if (hardwareResponse.data) {
      const hardwareData = hardwareResponse.data

      Object.assign(hostDetail, {
        // 系统版本信息
        debianVersion: hardwareData.os_version || '',
        debianKernelVersion: hardwareData.kernel_version || '',
        cbsVersion: hardwareData.version || '',
        model: hardwareData.model || '',
        isShare: !!hardwareData.isShare,
        shareUrl: hardwareData.url || '',
        cpuTemp: hardwareData.cputemp || 0
      })
    }

    // 从 /v1/systeminfo 获取资源使用情况

    const systemInfoUrl = buildApiUrl(host.ip, API_CONFIG.PATHS.GET_SYSTEM_INFO)
    const systemInfoResponse = await request.get(systemInfoUrl, {})
    if (!visible.value) return

    if (systemInfoResponse.data) {
      const data = systemInfoResponse.data

      // CPU百分比
      const cpuPercent = data.cpu || 0

      // 内存信息（API返回的是MB，需要转换为字节）
      const memTotalMB = data.mem_total || 0
      const memPercent = data.mem_percent || 0
      const memTotalBytes = mbToBytes(memTotalMB)
      const memUsedBytes = mbToBytes((memTotalMB * memPercent) / 100)

      // 虚拟内存(swap)信息（API返回的是MB）
      const swapTotalMB = data.swap_total || 0
      const swapPercent = data.swap_percent || 0
      const swapTotalBytes = mbToBytes(swapTotalMB)
      const swapUsedBytes = mbToBytes((swapTotalMB * swapPercent) / 100)

      // 首次获取时，用当前 swap 大小初始化输入框（MB → GB，钳制到 2-16）
      if (!swapSizeInitialized && swapTotalMB > 0) {
        swapSize.value = Math.max(2, Math.min(16, Math.round(swapTotalMB / 1024)))
        swapSizeInitialized = true
      }

      // 本地存储(mmc)信息（API返回的是MB）
      const mmcTotalMB = data.mmc_total || 0
      const mmcPercent = data.mmc_percent || 0
      const mmcTotalBytes = mbToBytes(mmcTotalMB)
      const mmcUsedBytes = mbToBytes((mmcTotalMB * mmcPercent) / 100)

      // 硬盘存储(ssd)信息（API返回的是MB）
      const ssdTotalMB = data.ssd_total || 0
      const ssdPercent = data.ssd_percent || 0
      const ssdTotalBytes = mbToBytes(ssdTotalMB)
      const ssdUsedBytes = mbToBytes((ssdTotalMB * ssdPercent) / 100)

      Object.assign(hostDetail, {
        // CPU
        cpuPercent: cpuPercent,
        // 内存
        memoryPercent: memPercent,
        memoryUsed: memUsedBytes,
        memoryTotal: memTotalBytes,
        // 虚拟内存(swap)
        swapPercent: swapPercent,
        swapUsed: swapUsedBytes,
        swapTotal: swapTotalBytes,
        // 本地存储(mmc)
        localStoragePercent: mmcPercent,
        localStorageUsed: mmcUsedBytes,
        localStorageTotal: mmcTotalBytes,
        // 硬盘存储(ssd)
        diskPercent: ssdPercent,
        diskUsed: ssdUsedBytes,
        diskTotal: ssdTotalBytes
      })
    }
  } finally {
    loading.value = false
  }
}

let timer: any = null

const stopPolling = () => {
  if (!timer) return
  clearTimeout(timer)
  timer = null
}

const startPolling = () => {
  stopPolling()
  const poll = async () => {
    if (!visible.value || !host.value) {
      stopPolling()
      return
    }
    await fetchHostDetail(host.value)
    if (visible.value && host.value) {
      timer = setTimeout(poll, 3500)
    }
  }
  timer = setTimeout(poll, 3500)
}

watch(
  () => visible.value,
  (newVal) => {
    if (newVal) {
      startPolling()
    } else {
      stopPolling()
    }
  }
)

onUnmounted(() => {
  stopPolling()
})

/**
 * 初始化并显示详情
 */
const init = (row: Host) => {
  stopPolling()
  host.value = row
  const isAlreadyVisible = visible.value
  visible.value = true
  fetchHostDetail(row)
  // 如果弹框已经是打开状态，watch 不会触发，需要手动开启轮询
  if (isAlreadyVisible) {
    startPolling()
  }
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.host-detail-container {
  padding: 0;
}

.detail-section {
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 6px;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--el-border-color);
}

.detail-item {
  display: flex;
  align-items: center;
  margin-bottom: 3px;
  font-size: 13px;
  line-height: 1.2;
  min-height: 18px;

  &:last-child {
    margin-bottom: 0;
  }

  .detail-label {
    color: var(--el-text-color-regular);
    min-width: 120px;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .detail-value {
    color: var(--el-text-color-primary);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 5px;
  }
}

.resource-item {
  margin-bottom: 8px;
  min-height: 36px;

  &:last-child {
    margin-bottom: 0;
  }

  .resource-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
    line-height: 1.2;

    .resource-label-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .resource-label {
      font-size: 13px;
      color: var(--el-text-color-regular);
      flex-shrink: 0;
    }

    .swap-edit-link {
      font-size: 12px;
    }

    .resource-percent {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      flex-shrink: 0;
      margin-left: 8px;
    }
  }

  .swap-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;

    .el-slider {
      flex: 1;
    }

    .swap-bound {
      font-size: 11px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .swap-value {
      font-size: 12px;
      font-weight: 600;
      color: var(--el-color-primary);
      white-space: nowrap;
      flex-shrink: 0;
    }
  }

  .resource-usage {
    margin-top: 2px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

:deep(.el-progress-bar__outer) {
  background-color: var(--el-bg-color-page);
}

:deep(.el-progress-bar__inner) {
  transition: width 0.3s ease;
}
</style>
