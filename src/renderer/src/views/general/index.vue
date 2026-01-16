<template>
  <div class="general-container">
    <div class="setting-card">
      <div class="group-header">
        <h3 class="group-title">主窗口大小设置</h3>
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
              <el-icon><Check /></el-icon>
            </div>
            <span class="option-label">{{ preset.label }}</span>
            <span class="option-desc">{{ preset.desc }}</span>
          </div>
        </div>
        <div class="setting-desc">设置程序启动时的窗口大小。修改后需重启客户端生效。</div>
        <div class="config-item" style="margin-top: 24px">
          <el-checkbox v-model="form.minimizeToTray" @change="handleMinimizeToTrayChange"
            >关闭窗口时最小化到系统托盘</el-checkbox
          >
        </div>
      </div>

      <!-- 云机窗口设置大类 -->
      <div class="group-header" style="margin-top: 40px">
        <h3 class="group-title">云机窗口设置</h3>
        <div class="group-divider"></div>
      </div>

      <!-- 子分组：初始化大小设置 -->
      <div class="subgroup-header" style="margin-top: 24px">
        <h4 class="subgroup-title">初始化大小设置 (设备按比例自适应)</h4>
      </div>

      <div class="group-content">
        <!-- 使用 div 模拟卡片选项，不使用 el-radio 原生样式 -->
        <div class="card-options">
          <div
            v-for="preset in presetOptions"
            :key="preset.value"
            class="option-card"
            :class="{ active: currentPreset === preset.value }"
            @click="handlePresetSelect(preset.value)"
          >
            <div class="option-check" v-if="currentPreset === preset.value">
              <el-icon><Check /></el-icon>
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
              <el-icon><Check /></el-icon>
            </div>
            <span class="option-label">自定义</span>

            <div class="custom-input-area" @click.stop>
              <span class="input-label">最长边</span>
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
          设置云手机投屏画面的最大边长（范围 300 - 2000px）。修改后将在下次连接设备时生效。
        </div>

        <div class="setting-subsection" style="margin-top: 24px">
          <div class="subgroup-header" style="margin-top: 24px">
            <h4 class="subgroup-title">操作设置</h4>
          </div>
          <div class="card-options" style="display: flex; gap: 40px; align-items: flex-start">
            <div class="config-item" style="margin-bottom: 0">
              <div class="config-label" style="min-width: auto; margin-right: 12px">
                <span>滚轮灵敏度</span>
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
                <span class="setting-desc" style="margin: 0; margin-left: 12px; color: #909399"
                  >数值越大滚轮越慢 (0.001 - 800)</span
                >
              </div>
            </div>

            <div class="config-item" style="margin-bottom: 0">
              <el-checkbox v-model="form.keepHoverMove" @change="handleKeepHoverMoveChange"
                >开启安卓悬停（Hover）交互效果</el-checkbox
              >
            </div>
          </div>
        </div>
      </div>

      <!-- 子分组：视频与渲染配置 -->
      <div class="subgroup-header" style="margin-top: 32px">
        <h4 class="subgroup-title">视频与渲染配置</h4>
      </div>

      <div class="group-content">
        <!-- <div class="setting-subsection">
          <div class="subsection-title">视频编解码配置</div>
          <div class="card-options">
            <div
              v-for="option in videoCodecOptions"
              :key="option.value"
              class="option-card"
              :class="{ active: form.videoCodecPreference === option.value }"
              @click="handleVideoCodecChange(option.value)"
            >
              <div class="option-check" v-if="form.videoCodecPreference === option.value">
                <el-icon><Check /></el-icon>
              </div>
              <span class="option-label">{{ option.label }}</span>
              <span class="option-desc">{{ option.desc }}</span>
            </div>
          </div>
        </div>

        <div class="setting-subsection" style="margin-top: 24px">
          <div class="subsection-title">画面渲染配置</div>
          <div class="card-options">
            <div
              v-for="option in renderOptions"
              :key="option.value"
              class="option-card"
              :class="{ active: form.renderPreference === option.value }"
              @click="handleRenderChange(option.value)"
            >
              <div class="option-check" v-if="form.renderPreference === option.value">
                <el-icon><Check /></el-icon>
              </div>
              <span class="option-label">{{ option.label }}</span>
              <span class="option-desc">{{ option.desc }}</span>
            </div>
          </div>
        </div> -->

        <div class="setting-subsection" style="margin-top: 0">
          <div class="card-options">
            <el-checkbox
              v-model="form.hardwareAcceleration"
              @change="handleHardwareAccelerationChange"
              >禁用硬件加速（使用 CPU 渲染）</el-checkbox
            >
          </div>
          <span class="setting-desc"
            >当设备仅有集成显卡或显卡驱动兼容性较差时，
            启用硬件加速可能导致画面异常或稳定性问题，<br />
            禁用后将使用 CPU 进行渲染，稳定性更高，但性能可能有所下降。
            修改后需重启客户端生效。</span
          >
        </div>
      </div>

      <el-form ref="configFormRef" :model="configForm" :rules="configRules">
        <div class="group-header" style="margin-top: 40px">
          <h3 class="group-title">检测代理</h3>
          <div class="group-divider"></div>
        </div>
        <div class="group-content">
          <div class="proxy-check-config">
            <div class="config-item">
              <div class="config-label">
                <span>检测策略</span>
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
                <span>API Key</span>
              </div>
              <el-form-item prop="apiKey" style="margin: 0; width: 100%; max-width: 500px">
                <el-input
                  v-model="configForm.apiKey"
                  :placeholder="currentUrlRequiresKey ? '请输入 API Key（必填）' : '请输入 API Key'"
                  @blur="handleProxyCheckApiKeyChange"
                />
              </el-form-item>
            </div>
            <div class="config-item">
              <div class="config-label">
                <span>检测超时</span>
              </div>
              <el-form-item prop="timeout" style="margin: 0">
                <div class="timeout-input-wrapper">
                  <el-input-number
                    v-model="configForm.timeout"
                    :min="10"
                    :max="10000"
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
          <h3 class="group-title">截图配置</h3>
          <div class="group-divider"></div>
        </div>
        <div class="group-content">
          <div class="proxy-check-config">
            <div class="config-item">
              <div class="config-label">
                <span>存储目录</span>
              </div>
              <el-form-item prop="url" style="margin: 0; width: 100%; max-width: 500px">
                <el-input
                  v-model="configForm.screenshotStoragePath"
                  placeholder="请输入截图存储目录"
                  readonly
                >
                  <template #suffix>
                    <el-button @click="handleScreenshotStoragePathChange" link :icon="Folder"
                      >修改</el-button
                    >
                    <el-button @click="handleOpenScreenshotStoragePath" link :icon="FolderOpened"
                      >打开</el-button
                    >
                  </template>
                </el-input>
              </el-form-item>
            </div>
          </div>
        </div>
      </el-form>
      <div class="group-header" style="margin-top: 40px">
        <h3 class="group-title">导出日志</h3>
        <div class="group-divider"></div>
      </div>

      <div class="group-content">
        <div class="log-action-area">
          <el-button type="primary" @click="handleExportLog" plain :loading="exporting">
            <el-icon class="el-icon--left"><Download /></el-icon>
            导出日志
          </el-button>
          <span class="setting-desc" style="margin-top: 0; margin-left: 12px">
            将客户端运行日志导出为文件，用于故障排查。
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import {
  ElInputNumber,
  ElMessage,
  ElIcon,
  ElButton,
  ElInput,
  ElForm,
  ElFormItem,
  ElRadio,
  ElRadioGroup,
  ElCheckbox
} from 'element-plus'
import { Check, Download, Folder, FolderOpened } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { CONFIG_KEYS } from '@shared/constant'

defineOptions({ name: 'General' })

const form = ref({
  maxDisplaySide: 600,
  // videoCodecPreference: 'no-preference',
  // renderPreference: 'low-power',
  hardwareAcceleration: false,
  mainWindowSize: 'standard',
  wheelSpeed: 100,
  keepHoverMove: false,
  minimizeToTray: false
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

// 测试网址选项
const testUrlOptions = [
  {
    label: '默认',
    requiresKey: false,
    providerType: 'default',
    desc: '仅检测网络连通性，无法识别代理出口 IP 和地区。'
  },
  {
    label: 'IPinfo',
    requiresKey: false,
    providerType: 'ipinfo',
    desc: '可检测代理出口 IP 和地区，默认可用，无需 API Key，额度用完后再填写。'
  }
]
const currentDesc = computed(() => {
  const selectedOption = testUrlOptions.find(
    (option) => option.providerType === configForm.value.providerType
  )
  return selectedOption?.desc || ''
})

// 判断当前选择的厂商是否需要 key
const currentUrlRequiresKey = computed(() => {
  const selectedOption = testUrlOptions.find(
    (option) => option.providerType === configForm.value.providerType
  )
  return selectedOption?.requiresKey || false
})

// 动态生成验证规则
const configRules = ref<FormRules>({
  providerType: [{ required: true, message: '请选择检测厂商', trigger: 'change' }],
  apiKey: [],
  timeout: [
    { required: true, message: '请输入测试超时时间', trigger: 'change' },
    {
      type: 'number',
      min: 10,
      max: 10000,
      message: '超时时间范围：10 - 10000ms',
      trigger: 'change'
    }
  ],
  screenshotStoragePath: [{ required: true, message: '请输入截图存储目录', trigger: 'blur' }]
})

// 监听 providerType 变化，动态更新 apiKey 验证规则
watch(
  () => configForm.value.providerType,
  (providerType) => {
    const selectedOption = testUrlOptions.find((option) => option.providerType === providerType)
    if (selectedOption?.requiresKey) {
      configRules.value.apiKey = [{ required: true, message: '请输入验证 Key', trigger: 'blur' }]
    } else {
      configRules.value.apiKey = []
    }
    // 清除之前的验证状态
    if (configFormRef.value) {
      configFormRef.value.clearValidate('apiKey')
    }
  },
  { immediate: true }
)

// const videoCodecOptions = [
//   { value: 'no-preference', label: '默认', desc: '由系统自动选择' },
//   { value: 'prefer-hardware', label: '硬件解码', desc: '优先尝试使用GPU进行编解码' },
//   { value: 'prefer-software', label: '软件解码', desc: '优先尝试使用CPU进行编解码' }
// ]

// const renderOptions = [
//   { value: 'default', label: '默认', desc: '由系统自动选择' },
//   { value: 'high-performance', label: '高性能', desc: '优先尝试使用高性能 GPU' },
//   { value: 'low-power', label: '节能', desc: '优先尝试使用低功耗 GPU' }
// ]

const presetOptions = [
  { value: 'low', label: '小窗口', desc: '最长边 480' },
  { value: 'medium', label: '中窗口', desc: '最长边 600' },
  { value: 'high', label: '大窗口', desc: '最长边 960' }
]

const mainWindowPresetOptions = [
  { value: 'standard', label: '紧凑', desc: '1250 x 800' },
  { value: 'large', label: '标准', desc: '1440 x 900' },
  { value: 'extra-large', label: '宽屏', desc: '1920 x 1080' }
]

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

    // 加载主窗口大小配置
    const mainWindowSizeRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.MAIN_WINDOW_SIZE
    )
    if (mainWindowSizeRes.success && mainWindowSizeRes.data) {
      form.value.mainWindowSize = mainWindowSizeRes.data
      currentMainWindowPreset.value = mainWindowSizeRes.data
    }

    // const videoCodecRes = await ipc.invoke<string>(
    //   CONFIG_EVENTS.GET_CONFIGS,
    //   CONFIG_KEYS.VIDEO_CODEC_PREFERENCE
    // )
    // if (videoCodecRes.success && videoCodecRes.data) {
    //   form.value.videoCodecPreference = videoCodecRes.data
    // }

    // const renderRes = await ipc.invoke<string>(
    //   CONFIG_EVENTS.GET_CONFIGS,
    //   CONFIG_KEYS.RENDER_PREFERENCE
    // )
    // if (renderRes.success && renderRes.data) {
    //   form.value.renderPreference = renderRes.data
    // }

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
  } catch (error) {
    console.error('Failed to load config:', error)
    ElMessage.error('加载配置失败')
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

const saveConfig = async (value: number) => {
  try {
    const res = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
      key: CONFIG_KEYS.MAX_DISPLAY_SIDE,
      value: String(value)
    })

    if (!res.success) {
      ElMessage.error('保存失败: ' + (res.error || '未知错误'))
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
      ElMessage.error('保存失败: ' + (res.error || '未知错误'))
    }
  } catch (error) {
    console.error(`Save config ${key} failed:`, error)
  }
}

// const handleVideoCodecChange = (val: string) => {
//   form.value.videoCodecPreference = val
//   saveGenericConfig(CONFIG_KEYS.VIDEO_CODEC_PREFERENCE, val)
// }

// const handleRenderChange = (val: string) => {
//   form.value.renderPreference = val
//   saveGenericConfig(CONFIG_KEYS.RENDER_PREFERENCE, val)
// }

const handlePresetSelect = (val: string) => {
  currentPreset.value = val
  if (val === 'custom') {
    // 切换到自定义，保持数值不变，等待手动修改
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
  // 确保处于自定义模式
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
            ElMessage.error('保存失败: ' + (res.error || '未知错误'))
            return
          }

          // providerType 改变后，如果新类型需要 key，则验证 key 字段
          if (currentUrlRequiresKey.value && configFormRef.value) {
            configFormRef.value.validateField('apiKey')
          }
        } catch (error) {
          console.error('Save proxy check provider type failed:', error)
          ElMessage.error('保存检测厂商失败')
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
            ElMessage.error('保存失败: ' + (res.error || '未知错误'))
          }
        } catch (error) {
          console.error('Save proxy check api key failed:', error)
          ElMessage.error('保存验证 Key 失败')
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
          ElMessage.error('保存代理检测超时时间失败')
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
        } catch (error) {}
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
    const res = await ipc.invoke<{ success: boolean; message?: string }>(
      SHARED_EVENTS.EXPORT_TODAY_LOG
    )
    if (res.success) {
      ElMessage.success('日志导出成功')
    }
  } catch (error) {
    console.error('Export log failed:', error)
    ElMessage.error('导出日志时发生错误')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.general-container {
  background: #f5f7fa; /* 恢复浅灰背景 */
  height: 100%;
  padding: 15px;
  box-sizing: border-box;
  overflow-y: auto;
}

.setting-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  padding: 32px;
  height: 100%; /* 恢复固定高度 */
  overflow-y: auto;
  margin: 0 auto;
}

.group-header {
  margin-bottom: 24px;

  .group-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: #409eff;
      margin-right: 12px;
      border-radius: 2px;
    }
  }

  .group-divider {
    height: 1px;
    background-color: #ebeef5;
    width: 100%;
  }
}

.subgroup-header {
  margin-bottom: 16px;

  .subgroup-title {
    font-size: 14px;
    font-weight: 500;
    color: #606266;
    margin: 0;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 14px;
      background: #909399;
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
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s ease;
  min-width: 120px;
  user-select: none;

  &:hover {
    border-color: #c0c4cc;
    background-color: #fafafa;
  }

  &.active {
    border-color: #409eff;
    background-color: #ecf5ff;

    .option-label {
      color: #409eff;
    }

    .option-desc {
      color: #79bbff;
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
    border-color: transparent transparent #409eff transparent;

    .el-icon {
      position: absolute;
      right: 0px;
      top: 7px;
      color: #fff;
      font-size: 11px;
    }
  }

  .option-label {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
    margin-bottom: 3px;
  }

  .option-desc {
    font-size: 11px;
    color: #909399;
  }
}

/* 自定义卡片特殊样式 */
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
      color: #606266;
    }
  }
}

.subsection-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.setting-desc {
  margin-top: 24px;
  font-size: 12px;
  color: #f56c6c;
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
    color: #606266;

    .info-icon {
      color: #909399;
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
      color: #909399;
    }
  }
}
</style>
