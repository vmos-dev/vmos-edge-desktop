<template>
  <vmos-dialog v-model="visible" title="主机详情" width="520px" @close="handleClose">
    <div class="host-detail-container">
      <!-- 主机基本信息 -->
      <div class="detail-section">
        <div class="detail-item">
          <span class="detail-label">主机ID:</span>
          <span class="detail-value">{{ hostDetail.id || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">主机IP:</span>
          <span class="detail-value">{{ hostDetail.ip || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">型号:</span>
          <span class="detail-value">{{ hostDetail.model || '-' }}</span>
        </div>
      </div>

      <!-- 资源使用情况 -->
      <div class="detail-section">
        <div class="section-title">资源使用情况</div>

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

        <!-- 内存 -->
        <div class="resource-item">
          <div class="resource-header">
            <span class="resource-label">内存:</span>
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
            <span class="resource-label">虚拟内存 (swap):</span>
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
        </div>

        <!-- 本地存储 -->
        <div class="resource-item">
          <div class="resource-header">
            <span class="resource-label">本地存储:</span>
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
            <span class="resource-label">硬盘存储:</span>
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
        <div class="section-title">系统版本信息</div>
        <div class="detail-item">
          <span class="detail-label">Debian系统版本:</span>
          <span class="detail-value">{{ hostDetail.debianVersion || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Debian内核版本:</span>
          <span class="detail-value">{{ hostDetail.debianKernelVersion || '-' }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">CBS版本:</span>
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
              <el-link style="font-size: 13px" size="small" type="primary" :underline="false"
                >更新</el-link
              >
            </el-upload>
          </span>
        </div>
      </div>
    </div>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { ElMessage, ElUpload } from 'element-plus'
import { request } from '@shared/api/request'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { formatBytes } from '@renderer/utils/index'
import type { Host } from '@shared/ipc/data.types'

interface HostDetail {
  id: string
  ip: string
  model?: string
  cpuPercent?: number
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
    cbsVersion: ''
  }
}
const hostDetail = reactive<HostDetail>(defaultHostDetail())
const updateCBSRef = ref<InstanceType<typeof ElUpload>>()
const saveLoading = ref(false)
/**
 * 根据百分比获取进度条颜色
 */
function getProgressColor(percent: number): string {
  if (percent < 50) return '#67c23a'
  if (percent < 80) return '#e6a23c'
  return '#f56c6c'
}

/**
 * 将MB转换为字节
 */
function mbToBytes(mb: number): number {
  return mb * 1024 * 1024
}

const handleClose = () => {
  Object.assign(hostDetail, defaultHostDetail())
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
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    )
    hostDetail.cbsVersion = res?.data?.current_version || ''
    ElMessage.success('已下发更新，请等待10s后查看')
  } catch (error) {
    ElMessage.error('更新CBS版本失败，请检查文件是否正确')
  } finally {
    saveLoading.value = false
    updateCBSRef.value?.clearFiles()
  }
}

/**
 * 获取主机详情
 */
async function fetchHostDetail(host: Host) {
  if (loading.value) return
  loading.value = true
  try {
    // 从row中设置基本信息
    hostDetail.id = host.id
    hostDetail.ip = host.ip

    // 从 /v1/get_hardware_cfg 获取基本信息（型号、系统版本等）
    const hardwareUrl = buildApiUrl(host.ip, API_CONFIG.PATHS.GET_HARDWARE_CFG)
    const hardwareResponse = await request.get(hardwareUrl, {})

    if (hardwareResponse.data) {
      const hardwareData = hardwareResponse.data

      Object.assign(hostDetail, {
        // 系统版本信息
        debianVersion: hardwareData.os_version || '',
        debianKernelVersion: hardwareData.kernel_version || '',
        cbsVersion: hardwareData.version || '',
        model: hardwareData.model || ''
      })
    }

    // 从 /v1/systeminfo 获取资源使用情况

    const systemInfoUrl = buildApiUrl(host.ip, API_CONFIG.PATHS.GET_SYSTEM_INFO)
    const systemInfoResponse = await request.get(systemInfoUrl, {})

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

let timer: NodeJS.Timeout

watch(
  () => visible.value,
  (newVal) => {
    if (newVal) {
      if (timer) {
        clearInterval(timer)
      }
      timer = setInterval(() => {
        fetchHostDetail(host.value!)
      }, 3500)
    } else {
      clearInterval(timer)
    }
  }
)

/**
 * 初始化并显示详情
 */
const init = async (row: Host) => {
  host.value = row
  fetchHostDetail(row)
  visible.value = true
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
  color: #303133;
  margin-bottom: 6px;
  padding-bottom: 2px;
  border-bottom: 1px solid #ebeef5;
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
    color: #606266;
    min-width: 120px;
    margin-right: 12px;
    flex-shrink: 0;
  }

  .detail-value {
    color: #303133;
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

    .resource-label {
      font-size: 13px;
      color: #606266;
      flex-shrink: 0;
    }

    .resource-percent {
      font-size: 13px;
      font-weight: 600;
      color: #303133;
      flex-shrink: 0;
      margin-left: 8px;
    }
  }

  .resource-usage {
    margin-top: 2px;
    font-size: 11px;
    color: #909399;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

:deep(.el-progress-bar__outer) {
  background-color: #f0f2f5;
}

:deep(.el-progress-bar__inner) {
  transition: width 0.3s ease;
}
</style>
