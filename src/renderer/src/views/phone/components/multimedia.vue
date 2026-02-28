<template>
  <div class="multimedia-container">
    <div class="setting-card">
      <!-- 核心推流控制 -->
      <div class="group-header">
        <h3 class="group-title">{{ t('phone.multimedia.systemCaptureTitle') }}</h3>
        <div class="group-divider"></div>
      </div>

      <div class="group-content">
        <!-- 开启状态 -->
        <div class="config-item">
          <div class="config-label">
            <span>{{ t('phone.multimedia.captureStatus') }}</span>
          </div>
          <div class="config-value">
            <el-tag :type="statusTagType" effect="light">
              {{ isStreaming ? t('phone.multimedia.enabled') : t('phone.multimedia.disabled') }}
            </el-tag>
          </div>
        </div>

        <div class="config-item" v-if="isStreaming">
          <div class="config-label">
            <span>{{ t('phone.multimedia.captureType') }}</span>
          </div>
          <div class="config-value">
            <el-tag :type="statusTagType" size="small" effect="light">{{ streamTypeText }}</el-tag>
          </div>
        </div>

        <div class="config-item">
          <div class="config-label">{{ t('phone.multimedia.rtspAddress') }}</div>
          <div class="config-value">
            <div class="rtsp-display system" v-if="rtspUrl">{{ rtspUrl }}</div>
          </div>
        </div>
      </div>

      <!-- 核心推流控制 -->
      <div class="group-header">
        <h3 class="group-title">{{ t('phone.multimedia.streamingControl') }}</h3>
        <div class="group-divider"></div>
      </div>
      <div class="group-content">
        <div class="config-item">
          <div class="config-label">
            <span>{{ t('phone.multimedia.streamingStatus') }}</span>
          </div>
          <div class="config-value">
            <el-tag
              :type="videoInject.isInjecting ? 'success' : 'info'"
              size="small"
              effect="light"
              >{{
                videoInject.isInjecting
                  ? t('phone.multimedia.enabled')
                  : t('phone.multimedia.disabled')
              }}</el-tag
            >
          </div>
        </div>
        <template v-if="videoInject.isInjecting">
          <div class="config-item">
            <div class="config-label">
              <span>{{ t('phone.multimedia.streamingAddress') }}</span>
            </div>
            <div class="config-value">
              <div class="rtsp-display custom">{{ videoInject.injectUrl }}</div>
            </div>
          </div>

          <div class="config-item">
            <div class="config-label">
              <span>{{ t('phone.multimedia.streamingType') }}</span>
            </div>
            <div class="config-value">
              <el-tag :type="statusTagType" size="small" effect="light">{{
                injectTypeText
              }}</el-tag>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="config-item">
            <div class="config-label">
              <span>{{ t('phone.multimedia.customStreamingAddress') }}</span>
            </div>
            <div class="config-value">
              <el-input
                v-model="customRtspUrl"
                class="rtsp-input"
                :placeholder="t('phone.multimedia.customStreamingPlaceholder')"
                :disabled="streamingLoading"
              />
            </div>
          </div>
        </template>
      </div>
      <div class="submit">
        <el-button
          type="primary"
          @click="handleInject"
          round
          plain
          :loading="streamingLoading"
          icon="VideoPlay"
          v-if="!videoInject.isInjecting"
          >{{ t('phone.multimedia.startStreaming') }}</el-button
        >
        <el-button
          type="danger"
          @click="handleCloseInject"
          round
          plain
          :loading="streamingLoading"
          icon="CircleClose"
          v-else
          >{{ t('phone.multimedia.stopStreaming') }}</el-button
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, type Ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStreamSettings } from '@renderer/hooks/useStreamSettings'
import { ElMessage, ElInput, ElTag } from 'element-plus'
import { request } from '@shared/api/request'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'
import type { Device } from '@shared/ipc/data.types'
import { getErrorMessage } from '@shared/api'

const { t } = useI18n()

// 从父组件获取设备信息
const phoneDevice = inject<Ref<Device | undefined>>('phoneDevice')
const deviceIdRef = inject<Ref<string>>('deviceId')
// 当前注入状态
const videoInject = ref({
  isInjecting: false,
  injectType: '',
  injectUrl: ''
})

const customRtspUrl = ref('')

// 获取设备信息
const getDeviceInfo = () => {
  const device = phoneDevice?.value
  if (!device) {
    throw new Error(t('phone.multimedia.deviceInfoUnavailable'))
  }

  const hostIp = device.host_ip || ''
  const dbId = device.db_id || deviceIdRef?.value || ''

  if (!hostIp || !dbId) {
    throw new Error(t('phone.multimedia.deviceIpOrIdUnavailable'))
  }

  return { hostIp, dbId }
}

const streamingLoading = ref(false)

const { streamType, isStreaming, publisherState, rtspUrl } = useStreamSettings()

// 计算是否使用自定义地址

// 开启
const handleInject = async () => {
  try {
    if (streamingLoading.value) return
    const { hostIp, dbId } = getDeviceInfo()
    //优先取自定义地址
    const rtspAddress = customRtspUrl.value || rtspUrl.value

    if (!rtspAddress) {
      ElMessage.warning(t('phone.multimedia.setStreamingAddressFirst'))
      return
    }
    // 判断rtsp地址是否合法
    // if (!rtspAddress.startsWith('rtsp://')) {
    //   ElMessage.warning(t('phone.multimedia.streamingAddressFormatIncorrect'))
    //   return
    // }
    streamingLoading.value = true
    const apiUrl = buildApiUrl(hostIp, `${API_CONFIG.PATHS.VIDEO_INJECT}/${dbId}`)
    await request.post(
      apiUrl,
      {
        url: rtspAddress
      },
      {
        timeout: 60 * 60 * 1000
      }
    )

    ElMessage.success(t('phone.multimedia.operationSuccess'))
    customRtspUrl.value = ''
    getVideoInjectStatus()
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error) || t('phone.multimedia.startStreamingFailed'))
  } finally {
    streamingLoading.value = false
  }
}

// 关闭
const handleCloseInject = async () => {
  try {
    if (streamingLoading.value) return
    const { hostIp, dbId } = getDeviceInfo()

    const apiUrl = buildApiUrl(hostIp, `${API_CONFIG.PATHS.CLOSE_VIDEO_INJECT}/${dbId}`)
    await request.get(apiUrl)

    ElMessage.success(t('phone.multimedia.operationSuccess'))
    getVideoInjectStatus()
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error) || t('phone.multimedia.stopStreamingFailed'))
  } finally {
    streamingLoading.value = false
  }
}

const streamTypeText = computed(() => {
  switch (streamType.value) {
    case 'av':
      return t('phone.multimedia.audioVideo')
    case 'video':
      return t('phone.multimedia.video')
    case 'audio':
      return t('phone.multimedia.audio')
  }
})

const injectTypeText = computed(() => {
  switch (videoInject.value.injectType) {
    case 'image':
      return t('phone.multimedia.image')
    case 'video':
      return t('phone.multimedia.videoStreaming')
    case 'stream':
      return t('phone.multimedia.rtspStreaming')
  }
  return t('phone.multimedia.unknown')
})

const statusTagType = computed(() => {
  // 如果推流未开启，直接显示 info
  if (!isStreaming.value) {
    return 'info'
  }

  // 根据 publisherState 显示不同颜色
  switch (publisherState.value) {
    case 'streaming':
      return 'success'
    case 'connecting':
    case 'reconnecting':
      return 'warning'
    case 'error':
      return 'danger'
    default:
      return 'info'
  }
})

const timeout = 5000

const getVideoInjectStatus = async (silent = false) => {
  try {
    const { hostIp, dbId } = getDeviceInfo()
    const apiUrl = buildApiUrl(hostIp, `${API_CONFIG.PATHS.GET_VIDEO_INJECT_STATUS}/${dbId}`)
    const response = await request.get(apiUrl, undefined, {
      timeout
    })
    if (response) {
      Object.assign(videoInject.value, {
        isInjecting: response?.data?.isInjecting,
        injectType: response?.data?.injectType,
        injectUrl: response?.data?.injectUrl
      })
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(getErrorMessage(error) || t('phone.multimedia.getVideoInjectStatusFailed'))
    }
    console.error(t('phone.multimedia.getVideoInjectStatusFailed'), error)
  }
}

let statusTimer: any = null

onMounted(() => {
  getVideoInjectStatus()
  statusTimer = setInterval(() => {
    getVideoInjectStatus(true)
  }, timeout)
})

onUnmounted(() => {
  if (statusTimer) {
    clearInterval(statusTimer)
    statusTimer = null
  }
})
</script>

<style scoped lang="scss">
.multimedia-container {
  padding: 20px;
  background: var(--el-bg-color);
  box-sizing: border-box;
}

.setting-card {
  max-width: 800px;
  margin: 0 auto;
}

/* 完美同步 General 设置页的设计 */
.group-header {
  margin-bottom: 24px;

  .group-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: var(--el-color-primary);
      margin-right: 12px;
      border-radius: 2px;
    }
  }

  .group-divider {
    height: 1px;
    background-color: var(--el-border-color);
    width: 100%;
  }
}

.config-item {
  display: flex;
  align-items: flex-start;
  align-items: center;
  margin-bottom: 24px;
  gap: 10px;

  .config-label {
    min-width: 120px;
    font-size: 14px;
    color: var(--el-text-color-regular);
  }

  .config-value {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--el-text-color-regular);
    min-width: 0;
  }

  .setting-desc {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.6;
  }
}

.rtsp-display {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 4px;
  word-break: break-all;
  line-height: 1.5;
  flex: 1;

  &.system {
    background-color: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }

  &.custom {
    background-color: var(--el-color-warning-light-9);
    color: var(--el-color-warning);
  }
}

.status-tag {
  flex-shrink: 0;
}

.source-badge {
  flex-shrink: 0;
  margin-left: 8px;
}

.status-summary {
  background: var(--el-bg-color-page);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color);

  .summary-row {
    display: flex;
    margin-bottom: 12px;
    font-size: 13px;

    &:last-child {
      margin-bottom: 0;
    }

    .label {
      color: var(--el-text-color-secondary);
      width: 80px;
    }

    .value {
      color: var(--el-text-color-regular);
      font-weight: 500;
    }

    .active-text {
      color: var(--el-color-success);
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}

/* 呼吸灯效果 */
.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: var(--el-color-success);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
  }

  70% {
    box-shadow: 0 0 0 8px rgba(103, 194, 58, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0);
  }
}

.url-input {
  :deep(.el-input-group__append) {
    background-color: var(--el-bg-color-page);
    color: var(--el-text-color-regular);

    &:hover {
      color: var(--el-color-primary);
    }
  }
}
.submit {
  display: flex;
  justify-content: center;
  margin-top: 50px;
}
</style>
