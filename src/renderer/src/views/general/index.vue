<template>
  <div class="general-container">
    <div class="setting-card">
      <!-- 外观设置 -->
      <div class="group-header">
        <div
          style="display: flex; justify-content: space-between; align-items: center; width: 100%"
        >
          <h3 class="group-title">{{ t('settings.appearance') }}</h3>
          <el-button link type="primary" size="small" @click="handleResetTheme">
            <el-icon class="el-icon--left"><RefreshLeft /></el-icon>
            {{ t('settings.reset') }}
          </el-button>
        </div>
        <div class="group-divider"></div>
      </div>

      <div class="group-content">
        <!-- 主题模式 -->
        <div class="config-item">
          <div class="config-label">
            <span>{{ t('settings.themeMode') }}</span>
          </div>
          <el-radio-group v-model="themeMode" @change="handleThemeModeChange">
            <el-radio-button value="light">{{ t('settings.light') }}</el-radio-button>
            <el-radio-button value="dark">{{ t('settings.dark') }}</el-radio-button>
            <el-radio-button value="system">{{ t('settings.system') }}</el-radio-button>
          </el-radio-group>
        </div>

        <!-- 主题色 -->
        <div class="config-item">
          <div class="config-label">
            <span>{{ t('settings.themeColor') }}</span>
          </div>
          <div class="color-presets">
            <div
              v-for="color in themeColorPresets"
              :key="color"
              class="color-item"
              :style="{ backgroundColor: color }"
              :class="{ active: themeColor === color }"
              @click="setThemeColor(color)"
            >
              <el-icon v-if="themeColor === color"><Check /></el-icon>
            </div>
            <el-color-picker
              v-model="themeColor"
              @change="handleCustomColorChange"
              size="default"
            />
          </div>
        </div>
      </div>

      <div class="group-header" style="margin-top: 40px">
        <h3 class="group-title">{{ t('settings.mainWindowSize') }}</h3>
        <div class="group-divider"></div>
      </div>

      <div class="group-content">
        <div class="card-options">
          <div
            v-for="preset in mainWindowPresetOptions"
            :key="preset.value"
            class="option-card"
            :class="{ active: currentMainWindowPreset === preset.value }"
            @click="handleMainWindowPresetSelect(preset.value)"
          >
            <div class="option-check" v-if="currentMainWindowPreset === preset.value">
              <el-icon>
                <Check />
              </el-icon>
            </div>
            <span class="option-label">{{ preset.label }}</span>
            <span class="option-desc">{{ preset.desc }}</span>
          </div>
        </div>
        <div class="setting-desc">{{ t('settings.windowSizeDesc') }}</div>
        <div class="config-item" style="margin-top: 24px">
          <el-checkbox v-model="form.minimizeToTray" @change="handleMinimizeToTrayChange">{{
            t('settings.minimizeToTray')
          }}</el-checkbox>
        </div>
      </div>

      <!-- 采集设置 -->
      <div class="group-header">
        <h3 class="group-title">{{ t('settings.captureSettings') }}</h3>
        <div class="group-divider"></div>
      </div>
      <div class="group-content">
        <!-- 采集类型 -->
        <div class="config-item">
          <div class="config-label">
            <span>{{ t('settings.captureType') }}</span>
          </div>
          <el-radio-group v-model="streamType" :disabled="isStreaming">
            <el-checkbox
              label="av"
              :model-value="streamType === 'av'"
              :disabled="isStreaming"
              @change="() => (streamType = 'av')"
              >{{ t('settings.audioVideo') }}</el-checkbox
            >
            <el-checkbox
              label="video"
              :model-value="streamType === 'video'"
              :disabled="isStreaming"
              @change="() => (streamType = 'video')"
              >{{ t('settings.videoOnly') }}</el-checkbox
            >
            <el-checkbox
              label="audio"
              :model-value="streamType === 'audio'"
              :disabled="isStreaming"
              @change="() => (streamType = 'audio')"
              :checked="isStreaming"
              >{{ t('settings.audioOnly') }}</el-checkbox
            >
          </el-radio-group>
        </div>

        <!-- 摄像头 -->
        <div class="config-item" v-if="streamType !== 'audio'">
          <div class="config-label">
            <span>{{ t('settings.camera') }}</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px">
            <div style="display: flex; gap: 8px; align-items: center">
              <el-select
                v-model="selectedVideoDevice"
                :placeholder="t('settings.selectCamera')"
                style="width: 300px"
                :disabled="isStreaming"
              >
                <el-option
                  v-for="item in videoDevices"
                  :key="item.deviceId"
                  :label="item.label || `Camera ${item.deviceId.slice(0, 4)}`"
                  :value="item.deviceId"
                />
              </el-select>
              <el-button type="primary" size="small" @click="getDevices" :disabled="isStreaming">{{
                t('settings.refresh')
              }}</el-button>
            </div>
          </div>
        </div>

        <!-- 麦克风 -->
        <div class="config-item" v-if="streamType !== 'video'">
          <div class="config-label">
            <span>{{ t('settings.microphone') }}</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center">
            <el-select
              v-model="selectedAudioDevice"
              :placeholder="t('settings.selectMicrophone')"
              style="width: 300px"
              :disabled="isStreaming"
            >
              <el-option
                v-for="item in audioDevices"
                :key="item.deviceId"
                :label="item.label || `Microphone ${item.deviceId.slice(0, 4)}`"
                :value="item.deviceId"
              />
            </el-select>
            <el-button type="primary" size="small" @click="getDevices" :disabled="isStreaming">{{
              t('settings.refresh')
            }}</el-button>
          </div>
        </div>

        <!-- 开启采集 -->
        <div class="config-item">
          <div class="config-label">
            <span>{{ t('settings.enableCapture') }}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px">
            <el-switch
              v-model="isStreaming"
              @change="handleStreamingChange"
              :loading="streamingLoading"
            />
            <el-tag v-if="isStreaming" :type="statusTagType" size="small">{{ statusText }}</el-tag>
          </div>
        </div>

        <!-- RTSP地址 -->
        <div class="config-item" v-if="rtspUrl">
          <div class="config-label">
            <span>{{ t('settings.rtspAddress') }}</span>
          </div>
          <el-input v-model="rtspUrl" readonly style="width: 400px">
            <template #append>
              <el-button :icon="CopyDocument" @click="copyRtspUrl" />
            </template>
          </el-input>
        </div>
      </div>

      <!-- 云机设置 -->
      <div class="group-header" style="margin-top: 40px">
        <h3 class="group-title">{{ t('settings.cloudWindowSettings') }}</h3>
        <div class="group-divider"></div>
      </div>

      <!-- 初始大小 -->
      <div class="subgroup-header" style="margin-top: 24px">
        <h4 class="subgroup-title">{{ t('settings.initSizeSettings') }}</h4>
      </div>

      <div class="group-content">
        <!-- 自定义卡片样式 -->
        <div class="card-options">
          <div
            v-for="preset in presetOptions"
            :key="preset.value"
            class="option-card"
            :class="{ active: currentPreset === preset.value }"
            @click="handlePresetSelect(preset.value)"
          >
            <div class="option-check" v-if="currentPreset === preset.value">
              <el-icon>
                <Check />
              </el-icon>
            </div>
            <span class="option-label">{{ preset.label }}</span>
            <span class="option-desc" v-if="preset.desc">{{ preset.desc }}</span>
          </div>

          <!-- 自定义选项 -->
          <div
            class="option-card custom"
            :class="{ active: currentPreset === 'custom' }"
            @click="handlePresetSelect('custom')"
          >
            <div class="option-check" v-if="currentPreset === 'custom'">
              <el-icon>
                <Check />
              </el-icon>
            </div>
            <span class="option-label">{{ t('settings.custom') }}</span>

            <div class="custom-input-area" @click.stop>
              <span class="input-label">{{ t('settings.maxSide') }}</span>
              <el-input-number
                v-model="form.maxDisplaySide"
                :min="300"
                :max="2000"
                :step="50"
                controls-position="right"
                size="small"
                :disabled="currentPreset !== 'custom'"
                @change="handleCustomChange"
                style="width: 110px"
              />
            </div>
          </div>
        </div>

        <div class="setting-desc">
          {{ t('settings.maxSideDesc') }}
        </div>

        <div class="setting-subsection" style="margin-top: 24px">
          <div class="subgroup-header" style="margin-top: 24px">
            <h4 class="subgroup-title">{{ t('settings.operationSettings') }}</h4>
          </div>
          <div class="card-options" style="display: flex; gap: 40px; align-items: flex-start">
            <div class="config-item" style="margin-bottom: 0">
              <div class="config-label" style="min-width: auto; margin-right: 12px">
                <span>{{ t('settings.wheelSensitivity') }}</span>
              </div>
              <div class="timeout-input-wrapper">
                <el-input-number
                  v-model="form.wheelSpeed"
                  :min="0.001"
                  :max="800"
                  :step="0.1"
                  controls-position="right"
                  @change="handleWheelSpeedChange"
                  style="width: 140px"
                />
                <span
                  class="setting-desc"
                  style="margin: 0; margin-left: 12px; color: var(--el-text-color-secondary)"
                  >{{ t('settings.wheelSensitivityDesc') }}</span
                >
              </div>
            </div>

            <div class="config-item" style="margin-bottom: 0">
              <el-checkbox v-model="form.keepHoverMove" @change="handleKeepHoverMoveChange">{{
                t('settings.enableHover')
              }}</el-checkbox>
            </div>
          </div>
        </div>
      </div>

      <!-- 推流设置 -->
      <div class="subgroup-header" style="margin-top: 32px">
        <h4 class="subgroup-title">{{ t('settings.streamSettings') }}</h4>
      </div>

      <div class="group-content">
        <div class="setting-subsection" style="margin-top: 0">
          <div class="card-options" style="display: flex; gap: 40px; align-items: flex-start">
            <div class="config-item" style="margin-bottom: 0">
              <div class="config-label" style="min-width: auto; margin-right: 12px">
                <span>{{ t('settings.streamFps') }}</span>
              </div>
              <div class="timeout-input-wrapper">
                <el-input-number
                  v-model="form.streamFps"
                  :min="1"
                  :max="60"
                  :step="1"
                  controls-position="right"
                  @change="handleStreamFpsChange"
                  style="width: 140px"
                />
                <span
                  class="setting-desc"
                  style="margin: 0; margin-left: 12px; color: var(--el-text-color-secondary)"
                  >{{ t('settings.streamFpsDesc') }}</span
                >
              </div>
            </div>

            <div class="config-item" style="margin-bottom: 0">
              <div class="config-label" style="min-width: auto; margin-right: 12px">
                <span>{{ t('settings.streamBitrate') }}</span>
              </div>
              <div class="timeout-input-wrapper">
                <el-input-number
                  v-model="form.streamBitrate"
                  :min="1"
                  :max="16"
                  :step="1"
                  controls-position="right"
                  @change="handleStreamBitrateChange"
                  style="width: 140px"
                />
                <span
                  class="setting-desc"
                  style="margin: 0; margin-left: 12px; color: var(--el-text-color-secondary)"
                  >{{ t('settings.streamBitrateDesc') }}</span
                >
                <span class="timeout-unit" style="margin-left: 4px">{{
                  t('settings.mbUnit')
                }}</span>
              </div>
            </div>
          </div>
          <div class="setting-desc" style="margin-top: 16px">
            {{ t('settings.streamSettingsDesc') }}
          </div>
        </div>
      </div>

      <!-- 视频渲染 -->
      <div class="subgroup-header" style="margin-top: 32px">
        <h4 class="subgroup-title">{{ t('settings.videoRenderConfig') }}</h4>
      </div>

      <div class="group-content">
        <div class="setting-subsection" style="margin-top: 0">
          <div class="card-options">
            <el-checkbox
              v-model="form.hardwareAcceleration"
              @change="handleHardwareAccelerationChange"
              >{{ t('settings.disableHardwareAccel') }}</el-checkbox
            >
          </div>
          <span class="setting-desc">{{ t('settings.hardwareAccelDesc') }}</span>
        </div>
      </div>

      <el-form ref="configFormRef" :model="configForm" :rules="configRules">
        <div class="group-header" style="margin-top: 40px">
          <h3 class="group-title">{{ t('settings.proxyCheck') }}</h3>
          <div class="group-divider"></div>
        </div>
        <div class="group-content">
          <div class="proxy-check-config">
            <div class="config-item">
              <div class="config-label">
                <span>{{ t('settings.checkStrategy') }}</span>
              </div>
              <el-form-item prop="providerType" style="margin: 0; width: 100%; max-width: 500px">
                <el-radio-group
                  v-model="configForm.providerType"
                  @change="handleProxyCheckProviderTypeChange"
                  style="width: 100%"
                >
                  <el-radio
                    v-for="option in testUrlOptions"
                    :key="option.providerType"
                    :label="option.label"
                    :value="option.providerType"
                  >
                    {{ option.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
            </div>
            <div class="config-item" v-if="configForm.providerType !== 'default'">
              <div class="config-label">
                <span>{{ t('settings.apiKey') }}</span>
              </div>
              <el-form-item prop="apiKey" style="margin: 0; width: 100%; max-width: 500px">
                <el-input
                  v-model="configForm.apiKey"
                  :placeholder="
                    currentUrlRequiresKey
                      ? t('settings.apiKeyRequired')
                      : t('settings.apiKeyPlaceholder')
                  "
                  @blur="handleProxyCheckApiKeyChange"
                />
              </el-form-item>
            </div>
            <div class="config-item">
              <div class="config-label">
                <span>{{ t('settings.checkTimeout') }}</span>
              </div>
              <el-form-item prop="timeout" style="margin: 0">
                <div class="timeout-input-wrapper">
                  <el-input-number
                    v-model="configForm.timeout"
                    :min="10"
                    :max="100000"
                    :step="100"
                    controls-position="right"
                    @change="handleProxyCheckTimeoutChange"
                    style="width: 150px"
                  />
                  <span class="timeout-unit">ms</span>
                </div>
              </el-form-item>
            </div>
            <div class="setting-desc">{{ currentDesc }}</div>
          </div>
        </div>
        <div class="group-header" style="margin-top: 40px">
          <h3 class="group-title">{{ t('settings.screenshotConfig') }}</h3>
          <div class="group-divider"></div>
        </div>
        <div class="group-content">
          <div class="proxy-check-config">
            <div class="config-item">
              <div class="config-label">
                <span>{{ t('settings.storageDir') }}</span>
              </div>
              <el-form-item prop="url" style="margin: 0; width: 100%; max-width: 500px">
                <el-input
                  v-model="configForm.screenshotStoragePath"
                  :placeholder="t('settings.storageDirPlaceholder')"
                  readonly
                >
                  <template #suffix>
                    <el-button @click="handleScreenshotStoragePathChange" link :icon="Folder">{{
                      t('settings.modify')
                    }}</el-button>
                    <el-button @click="handleOpenScreenshotStoragePath" link :icon="FolderOpened">{{
                      t('settings.open')
                    }}</el-button>
                  </template>
                </el-input>
              </el-form-item>
            </div>
          </div>
        </div>
      </el-form>

      <div class="group-header" style="margin-top: 40px">
        <h3 class="group-title">{{ t('settings.exportLog') }}</h3>
        <div class="group-divider"></div>
      </div>

      <div class="group-content">
        <div class="log-action-area">
          <el-button type="primary" @click="handleExportLog" plain :loading="exporting">
            <el-icon class="el-icon--left">
              <Download />
            </el-icon>
            {{ t('settings.exportLog') }}
          </el-button>
          <span class="setting-desc" style="margin-top: 0; margin-left: 12px">
            {{ t('settings.exportLogDesc') }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useStreamSettings } from '@renderer/hooks/useStreamSettings'
import { useTheme, type ThemeMode } from '@renderer/hooks/useTheme'
import {
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElIcon,
  ElButton,
  ElInput,
  ElForm,
  ElFormItem,
  ElRadio,
  ElRadioGroup,
  ElRadioButton,
  ElCheckbox,
  ElSelect,
  ElOption,
  ElSwitch,
  ElTag,
  ElColorPicker
} from 'element-plus'
import {
  Check,
  Download,
  Folder,
  FolderOpened,
  CopyDocument,
  RefreshLeft
} from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { MEDIAMTX_GET_STATUS } from '@shared/ipc/channels'
import { CONFIG_KEYS } from '@shared/constant'
import { useI18n } from 'vue-i18n'
import type { MediaServerStatus } from '@shared/ipc/mediaMtx.types'
import { copyToClipboard } from '@renderer/utils'

const { t } = useI18n()

defineOptions({ name: 'General' })

const { themeMode, themeColor, setThemeMode, setThemeColor, resetTheme } = useTheme()

const themeColorPresets = [
  '#409eff', // VMOS 经典蓝
  '#0052d9', // 企业级深蓝 (腾讯风格)
  '#00a870', // 清新薄荷绿
  '#ed7b2f', // 琥珀金
  '#e34d59', // 柔和绯红
  '#646c7c', // 灰蓝色 (专业商务)
  '#722ed1', // 极客紫 (AntD 风格)
  '#13c2c2', // 科技青
  '#2f54eb' // 深邃蓝
]

const handleThemeModeChange = (val: any) => {
  setThemeMode(val as ThemeMode)
}

const handleCustomColorChange = (val: string | null) => {
  if (val) {
    setThemeColor(val)
  }
}

const handleResetTheme = async () => {
  try {
    await ElMessageBox.confirm(t('settings.resetDesc'), t('common.tips'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    await resetTheme()
    ElMessage.success(t('common.operationSuccess'))
  } catch {
    // ignore cancel
  }
}

const form = ref({
  maxDisplaySide: 600,
  hardwareAcceleration: false,
  mainWindowSize: 'standard',
  wheelSpeed: 100,
  keepHoverMove: false,
  minimizeToTray: false,
  streamFps: 30,
  streamBitrate: 2
})

const currentPreset = ref<string>('medium')
const currentMainWindowPreset = ref<string>('standard')
const exporting = ref(false)
const configFormRef = ref<FormInstance>()
const configForm = ref({
  providerType: 'ipinfo',
  apiKey: '',
  timeout: 5000,
  screenshotStoragePath: ''
})
const testUrlOptions = computed(() => [
  {
    label: t('settings.default'),
    requiresKey: false,
    providerType: 'default',
    desc: t('settings.defaultDesc')
  },
  {
    label: t('settings.ipinfo'),
    requiresKey: false,
    providerType: 'ipinfo',
    desc: t('settings.ipapiDesc')
  },
  {
    label: t('settings.ipmap'),
    requiresKey: false,
    providerType: 'ipmap',
    desc: t('settings.ipapiDesc')
  }
])
const currentDesc = computed(() => {
  const selectedOption = testUrlOptions.value.find(
    (option) => option.providerType === configForm.value.providerType
  )
  return selectedOption?.desc || ''
})

// 判断当前选择的厂商是否需要 key
const currentUrlRequiresKey = computed(() => {
  const selectedOption = testUrlOptions.value.find(
    (option) => option.providerType === configForm.value.providerType
  )
  return selectedOption?.requiresKey || false
})

// 动态生成验证规则
const configRules = computed(() => {
  // 根据当前选择的 providerType 动态生成 apiKey 验证规则
  const selectedOption = testUrlOptions.value.find(
    (option) => option.providerType === configForm.value.providerType
  )
  const apiKeyRules: any[] = selectedOption?.requiresKey
    ? [{ required: true, message: t('settings.enterApiKey'), trigger: 'blur' }]
    : []

  return {
    providerType: [{ required: true, message: t('settings.selectProvider'), trigger: 'change' }],
    apiKey: apiKeyRules,
    timeout: [
      { required: true, message: t('settings.enterTimeout'), trigger: 'change' },
      {
        type: 'number' as const,
        min: 10,
        max: 100000,
        message: t('settings.timeoutRange'),
        trigger: 'change'
      }
    ] as any,
    screenshotStoragePath: [
      { required: true, message: t('settings.enterStorageDir'), trigger: 'blur' }
    ]
  } as any
})
watch(
  () => configForm.value.providerType,
  () => {
    // 清除之前的验证状态
    if (configFormRef.value) {
      configFormRef.value.clearValidate('apiKey')
    }
  },
  { immediate: true }
)
const presetOptions = computed(() => [
  { value: 'low', label: t('settings.smallWindow'), desc: `${t('settings.maxSide')} 480` },
  { value: 'medium', label: t('settings.mediumWindow'), desc: `${t('settings.maxSide')} 600` },
  { value: 'high', label: t('settings.largeWindow'), desc: `${t('settings.maxSide')} 960` }
])

const mainWindowPresetOptions = computed(() => [
  { value: 'standard', label: t('settings.compact'), desc: '1250 x 800' },
  { value: 'large', label: t('settings.standard'), desc: '1440 x 900' },
  { value: 'extra-large', label: t('settings.wideScreen'), desc: '1920 x 1080' }
])

const PRESETS = {
  low: 480,
  medium: 600,
  high: 960
}

const updatePresetFromValue = (val: number) => {
  if (val === PRESETS.low) currentPreset.value = 'low'
  else if (val === PRESETS.medium) currentPreset.value = 'medium'
  else if (val === PRESETS.high) currentPreset.value = 'high'
  else currentPreset.value = 'custom'
}

const loadConfig = async () => {
  try {
    const res = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.MAX_DISPLAY_SIDE)
    if (res.success && res.data) {
      const val = parseInt(res.data) || 600
      form.value.maxDisplaySide = val
      updatePresetFromValue(val)
    }

    // 加载窗口配置
    const mainWindowSizeRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.MAIN_WINDOW_SIZE
    )
    if (mainWindowSizeRes.success && mainWindowSizeRes.data) {
      form.value.mainWindowSize = mainWindowSizeRes.data
      currentMainWindowPreset.value = mainWindowSizeRes.data
    }
    // 加载代理检测配置
    const providerTypeRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE
    )
    if (providerTypeRes.success && providerTypeRes.data) {
      configForm.value.providerType = providerTypeRes.data
    } else {
      // 如果没有配置，使用默认值
      configForm.value.providerType = 'default'
      await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
        key: CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE,
        value: 'default'
      })
    }

    const apiKeyRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.PROXY_CHECK_API_KEY
    )
    if (apiKeyRes.success && apiKeyRes.data) {
      configForm.value.apiKey = apiKeyRes.data
    }

    const timeoutRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.PROXY_CHECK_TIMEOUT
    )
    if (timeoutRes.success && timeoutRes.data) {
      configForm.value.timeout = parseInt(timeoutRes.data, 10)
    }

    const screenshotStoragePathRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.SCREENSHOT_STORAGE_PATH
    )
    if (screenshotStoragePathRes.success && screenshotStoragePathRes.data) {
      configForm.value.screenshotStoragePath = screenshotStoragePathRes.data
    }

    const hardwareAccelerationRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.DISABLE_HARDWARE_ACCELERATION
    )
    if (hardwareAccelerationRes.success && hardwareAccelerationRes.data) {
      form.value.hardwareAcceleration = hardwareAccelerationRes.data === '1'
    } else {
      form.value.hardwareAcceleration = false
      saveGenericConfig(CONFIG_KEYS.DISABLE_HARDWARE_ACCELERATION, '0')
    }

    const wheelSpeedRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.WHEEL_SPEED
    )
    if (wheelSpeedRes.success && wheelSpeedRes.data) {
      form.value.wheelSpeed = parseFloat(wheelSpeedRes.data)
    } else {
      form.value.wheelSpeed = 100
      saveGenericConfig(CONFIG_KEYS.WHEEL_SPEED, '100')
    }

    const keepHoverMoveRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.KEEP_HOVER_MOVE
    )
    if (keepHoverMoveRes.success && keepHoverMoveRes.data) {
      form.value.keepHoverMove = keepHoverMoveRes.data === '1'
    } else {
      form.value.keepHoverMove = false
      saveGenericConfig(CONFIG_KEYS.KEEP_HOVER_MOVE, '0')
    }

    const minimizeToTrayRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.MINIMIZE_TO_TRAY
    )
    if (minimizeToTrayRes.success && minimizeToTrayRes.data) {
      form.value.minimizeToTray = minimizeToTrayRes.data === '1'
    } else {
      form.value.minimizeToTray = false
      saveGenericConfig(CONFIG_KEYS.MINIMIZE_TO_TRAY, '0')
    }

    const streamFpsRes = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.STREAM_FPS)
    if (streamFpsRes.success && streamFpsRes.data) {
      form.value.streamFps = parseInt(streamFpsRes.data, 10) || 60
    } else {
      form.value.streamFps = 60
      saveGenericConfig(CONFIG_KEYS.STREAM_FPS, '60')
    }

    const streamBitrateRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.STREAM_BITRATE
    )
    if (streamBitrateRes.success && streamBitrateRes.data) {
      form.value.streamBitrate = parseInt(streamBitrateRes.data, 10) || 8
    } else {
      form.value.streamBitrate = 8
      saveGenericConfig(CONFIG_KEYS.STREAM_BITRATE, '8')
    }
  } catch (error) {
    console.error('Failed to load config:', error)
    ElMessage.error(t('settings.loadConfigFailed'))
  }
}

const handleHardwareAccelerationChange = (val: any) => {
  form.value.hardwareAcceleration = val
  saveGenericConfig(CONFIG_KEYS.DISABLE_HARDWARE_ACCELERATION, val ? '1' : '0')
}

const handleWheelSpeedChange = (val: number | undefined) => {
  if (val === undefined) return
  form.value.wheelSpeed = val
  saveGenericConfig(CONFIG_KEYS.WHEEL_SPEED, String(val))
}

const handleKeepHoverMoveChange = (val: any) => {
  form.value.keepHoverMove = val
  saveGenericConfig(CONFIG_KEYS.KEEP_HOVER_MOVE, val ? '1' : '0')
}

const handleMinimizeToTrayChange = (val: any) => {
  form.value.minimizeToTray = val
  saveGenericConfig(CONFIG_KEYS.MINIMIZE_TO_TRAY, val ? '1' : '0')
}

const handleStreamFpsChange = (val: number | undefined) => {
  if (val === undefined) return
  form.value.streamFps = val
  saveGenericConfig(CONFIG_KEYS.STREAM_FPS, String(val))
}

const handleStreamBitrateChange = (val: number | undefined) => {
  if (val === undefined) return
  form.value.streamBitrate = val
  saveGenericConfig(CONFIG_KEYS.STREAM_BITRATE, String(val))
}

const saveConfig = async (value: number) => {
  try {
    const res = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
      key: CONFIG_KEYS.MAX_DISPLAY_SIDE,
      value: String(value)
    })

    if (!res.success) {
      ElMessage.error(t('settings.saveFailed') + ': ' + (res.error || t('settings.unknownError')))
    }
  } catch (error) {
    console.error('Save config failed:', error)
  }
}

const saveGenericConfig = async (key: string, value: string) => {
  try {
    console.log('saveGenericConfig', key, value)
    const res = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
      key,
      value
    })

    if (!res.success) {
      ElMessage.error(t('settings.saveFailed') + ': ' + (res.error || t('settings.unknownError')))
    }
  } catch (error) {
    console.error(`Save config ${key} failed:`, error)
  }
}

const handlePresetSelect = (val: string) => {
  currentPreset.value = val
  if (val === 'custom') {
    saveConfig(form.value.maxDisplaySide)
    return
  }

  const presetVal = PRESETS[val as keyof typeof PRESETS]
  if (presetVal) {
    form.value.maxDisplaySide = presetVal
    saveConfig(presetVal)
  }
}

const handleMainWindowPresetSelect = (val: string) => {
  currentMainWindowPreset.value = val
  form.value.mainWindowSize = val
  saveGenericConfig(CONFIG_KEYS.MAIN_WINDOW_SIZE, val)
}

const handleCustomChange = (val: number | undefined) => {
  if (!val) return
  currentPreset.value = 'custom'
  saveConfig(val)
}

const handleProxyCheckProviderTypeChange = async () => {
  if (!configFormRef.value) return
  try {
    await configFormRef.value.validateField('providerType', async (valid) => {
      if (valid) {
        try {
          // 保存厂商类型
          const res = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
            key: CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE,
            value: configForm.value.providerType
          })
          if (!res.success) {
            ElMessage.error(
              t('settings.saveFailed') + ': ' + (res.error || t('settings.unknownError'))
            )
            return
          }

          // providerType 改变后，如果新类型需要 key，则验证 key 字段
          if (currentUrlRequiresKey.value && configFormRef.value) {
            configFormRef.value.validateField('apiKey')
          }
        } catch (error) {
          console.error('Save proxy check provider type failed:', error)
          ElMessage.error(t('settings.saveProviderFailed'))
        }
      }
    })
  } catch (error) {
    console.error('Validate proxy check provider type failed:', error)
  }
}

const handleProxyCheckApiKeyChange = async () => {
  if (!configFormRef.value) return
  try {
    await configFormRef.value.validateField('apiKey', async (valid) => {
      if (valid) {
        try {
          const res = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
            key: CONFIG_KEYS.PROXY_CHECK_API_KEY,
            value: configForm.value.apiKey
          })
          if (!res.success) {
            ElMessage.error(
              t('settings.saveFailed') + ': ' + (res.error || t('settings.unknownError'))
            )
          }
        } catch (error) {
          console.error('Save proxy check api key failed:', error)
          ElMessage.error(t('settings.saveApiKeyFailed'))
        }
      }
    })
  } catch (error) {
    console.error('Validate proxy check api key failed:', error)
  }
}

const handleProxyCheckTimeoutChange = async () => {
  if (!configFormRef.value) return

  try {
    await configFormRef.value.validateField('timeout', async (valid) => {
      if (valid) {
        try {
          const res = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
            key: CONFIG_KEYS.PROXY_CHECK_TIMEOUT,
            value: String(configForm.value.timeout)
          })
          if (!res.success) {
            ElMessage.error(res.error)
          }
        } catch (error) {
          console.error('Save proxy check timeout failed:', error)
          ElMessage.error(t('settings.saveTimeoutFailed'))
        }
      }
    })
  } catch (error) {
    console.error('Validate proxy check timeout failed:', error)
  }
}
const handleScreenshotStoragePathChange = async () => {
  if (!configFormRef.value) return
  try {
    await configFormRef.value.validateField('screenshotStoragePath', async (valid) => {
      if (valid) {
        try {
          const result = await ipc.invoke(SHARED_EVENTS.SELECT_FILE, {
            properties: ['openDirectory']
          })
          if (result.success && result.data) {
            const res = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
              key: CONFIG_KEYS.SCREENSHOT_STORAGE_PATH,
              value: result.data
            })
            if (res.success) {
              loadConfig()
            }
          }
        } catch (error) {
          console.error('Open screenshot storage path selector failed:', error)
        }
      }
    })
  } catch (error) {
    console.error('Validate screenshot storage path failed:', error)
  }
}
const handleOpenScreenshotStoragePath = async () => {
  if (!configForm.value.screenshotStoragePath) return
  ipc.send(SHARED_EVENTS.OPEN_FOLDER, configForm.value.screenshotStoragePath)
}
const handleExportLog = async () => {
  if (exporting.value) return
  exporting.value = true
  try {
    const res = await ipc.invoke<{ filePath: string }>(SHARED_EVENTS.EXPORT_TODAY_LOG)
    if (res.success) {
      ElMessage.success(t('settings.exportSuccess'))
      return
    }
  } catch (error) {
    console.error('Export log failed:', error)
    ElMessage.error(t('settings.exportFailed'))
  } finally {
    exporting.value = false
  }
}

// 采集逻辑
const {
  streamType,
  selectedVideoDevice,
  selectedAudioDevice,
  isStreaming,
  videoDevices,
  audioDevices,
  publisherState,
  rtspUrl,
  refreshDevices,
  startPublishing,
  stopPublishing
} = useStreamSettings()

const streamingLoading = ref(false)

const statusText = computed(() => {
  switch (publisherState.value) {
    case 'idle':
      return t('settings.notCapturing')
    case 'connecting':
      return t('settings.connecting')
    case 'streaming':
      return t('settings.capturing')
    case 'reconnecting':
      return t('settings.reconnecting')
    case 'error':
      return t('settings.error')
    default:
      return ''
  }
})

const statusTagType = computed(() => {
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

const getDevices = async () => {
  await refreshDevices()
}

const handleStreamingChange = async (val: string | number | boolean) => {
  streamingLoading.value = true
  try {
    if (val) {
      const url = await startPublishing()
      rtspUrl.value = url
    } else {
      await stopPublishing()
      rtspUrl.value = ''
    }
  } catch (e) {
    console.error('Streaming toggle failed:', e)
    ElMessage.error(val ? t('settings.startCaptureFailed') : t('settings.stopCaptureFailed'))
  } finally {
    streamingLoading.value = false
  }
}

const copyRtspUrl = () => {
  if (!rtspUrl.value) return
  copyToClipboard(rtspUrl.value, () => {
    ElMessage.success(t('settings.rtspAddressCopied'))
  })
}

// 同步服务状态
const syncServerStatus = async () => {
  try {
    const res = await ipc.invoke<MediaServerStatus>(MEDIAMTX_GET_STATUS)
    const serverRunning = res.success && res.data?.running

    if (isStreaming.value) {
      // 想要推流，但目前没有处于 streaming 状态 (可能是刚打开页面、刷新、或推流中断)
      if (publisherState.value !== 'streaming' && publisherState.value !== 'connecting') {
        // 如果服务器没开，或者虽然开了但本地没连上，都尝试 startPublishing
        const url = await startPublishing()
        rtspUrl.value = url
      }
    } else {
      // 不想要推流，但服务器还在运行 (可能上个页面开启后未正常关闭)，则清理
      if (serverRunning) {
        await stopPublishing()
      }
    }
  } catch (e) {
    console.error('Sync status failed', e)
  }
}

onMounted(() => {
  loadConfig()
  getDevices()
  syncServerStatus()
})
</script>

<style scoped lang="scss">
.general-container {
  background: var(--el-bg-color-page);
  height: 100%;
  padding: 15px;
  box-sizing: border-box;
  overflow-y: auto;
}

.setting-card {
  background: var(--el-bg-color);
  border-radius: var(--app-radius-base);
  padding: 32px;
  height: 100%;
  overflow-y: auto;
  margin: 0 auto;
}

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
    background-color: var(--el-border-color-lighter);
    width: 100%;
  }
}

.subgroup-header {
  margin-bottom: 16px;

  .subgroup-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-regular);
    margin: 0;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 14px;
      background: var(--el-text-color-placeholder);
      margin-right: 10px;
      border-radius: 2px;
    }
  }
}

.card-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.option-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  background: var(--el-bg-color);
  transition: all 0.2s ease;
  min-width: 120px;
  user-select: none;

  &:hover {
    border-color: var(--el-border-color-hover);
    background-color: var(--el-fill-color-light);
  }

  &.active {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);

    .option-label {
      color: var(--el-color-primary);
    }

    .option-desc {
      color: var(--el-color-primary-light-3);
    }
  }

  .option-check {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 0 20px 20px;
    border-color: transparent transparent var(--el-color-primary) transparent;

    .el-icon {
      position: absolute;
      right: 0px;
      top: 7px;
      color: var(--el-bg-color);
      font-size: 11px;
    }
  }

  .option-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 3px;
  }

  .option-desc {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}

/* 自定义样式 */
.option-card.custom {
  flex-direction: row;
  align-items: center;
  gap: 16px;
  min-width: auto;
  padding-right: 24px;

  .option-label {
    margin-bottom: 0;
  }

  .custom-input-area {
    display: flex;
    align-items: center;
    gap: 8px;

    .input-label {
      font-size: 12px;
      color: var(--el-text-color-regular);
    }
  }
}

.subsection-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.setting-desc {
  margin-top: 24px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.log-action-area {
  display: flex;
  align-items: center;
  padding-left: 4px;
}

.proxy-check-config {
  padding-left: 4px;
}

.config-item {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;

  .config-label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 120px;
    font-size: 14px;
    color: var(--el-text-color-regular);

    .info-icon {
      color: var(--el-text-color-placeholder);
      font-size: 14px;
      cursor: help;
    }
  }

  .timeout-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;

    .timeout-unit {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }
  }
}

.color-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;

  .color-item {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    border: 2px solid transparent;

    .el-icon {
      color: var(--el-bg-color);
      font-size: 14px;
      font-weight: bold;
    }

    &:hover {
      transform: scale(1.1);
    }

    &.active {
      border-color: var(--el-text-color-primary);
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
    }
  }
}

:deep(.el-radio-button__inner) {
  padding: 8px 16px;
}
</style>
