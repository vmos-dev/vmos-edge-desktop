<template>
  <div class="battery-container">
    <div class="battery-form-panel">
      <div class="form-content">
        <el-form ref="formRef" :model="batteryForm" label-width="auto" label-position="top">
          <!-- 充电电量 -->
          <el-form-item :label="t('phone.battery.chargeLevel')">
            <div class="slider-wrapper">
              <el-slider v-model="batteryForm.level" :min="0" :max="100" />
              <span class="slider-value">{{ batteryForm.level }}</span>
            </div>
          </el-form-item>

          <!-- 充电器连接 -->
          <el-form-item :label="t('phone.battery.chargerConnection')">
            <el-select v-model="batteryForm.plugged" :placeholder="t('phone.battery.pleaseSelect')" style="width: 100%">
              <el-option
                v-for="item in pluggedOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>

          <!-- 电池健康状态 -->
          <el-form-item :label="t('phone.battery.healthStatus')">
            <el-select v-model="batteryForm.health" :placeholder="t('phone.battery.pleaseSelect')" style="width: 100%">
              <el-option
                v-for="item in healthOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>

          <!-- 电池状态 -->
          <el-form-item :label="t('phone.battery.batteryStatus')">
            <el-select v-model="batteryForm.status" :placeholder="t('phone.battery.pleaseSelect')" style="width: 100%">
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>

          <!-- 提交按钮 -->
          <el-form-item class="submit-form-item">
            <el-button type="primary" @click="handleSubmit" :icon="Check" :loading="submitting">
              {{ t('phone.battery.apply') }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElForm, ElFormItem, ElSelect, ElOption, ElSlider, ElButton } from 'element-plus'
import { Check } from '@element-plus/icons-vue'

const { t } = useI18n()
import {
  request,
  API_CONTROL_CONFIG,
  buildDeviceApiUrl,
  getErrorMessage,
  type BatteryInfoResponse,
  type SetBatteryRequest
} from '@shared/api'
import type { Device } from '@shared/ipc/data.types'

defineOptions({ name: 'Battery' })

/**
 * 选项接口定义
 * value: 表单使用的数字值
 */
interface OptionItem {
  label: string
  value: number
}

// 注入设备信息
const phoneDevice = inject<Ref<Device | undefined>>('phoneDevice')
const deviceIdRef = inject<Ref<string>>('deviceId')

/**
 * 获取当前设备连接信息 (IP 和 ID)
 */
const getDeviceInfo = () => {
  const device = phoneDevice?.value
  if (!device) throw new Error(t('phone.multimedia.deviceInfoUnavailable'))
  const hostIp = device.host_ip || ''
  const dbId = device.db_id || deviceIdRef?.value || ''
  if (!hostIp || !dbId) throw new Error(t('phone.multimedia.deviceIpOrIdUnavailable'))
  return { hostIp, dbId }
}

// 表单数据接口
interface BatteryForm {
  level: number
  plugged: number
  status: number
  health: number
}

// 响应式表单数据
const batteryForm = reactive<BatteryForm>({
  level: 50,
  plugged: 0,
  status: 4,
  health: 2
})

const submitting = ref(false)
const loading = ref(false)

/**
 * 电池状态选项数组
 * status: 1=未知、2=充电中、3=放电中、4=未充电、5=已满
 */
const statusOptions = computed<OptionItem[]>(() => [
  { label: t('phone.battery.status.unknown'), value: 1 },
  { label: t('phone.battery.status.charging'), value: 2 },
  { label: t('phone.battery.status.discharging'), value: 3 },
  { label: t('phone.battery.status.notCharging'), value: 4 },
  { label: t('phone.battery.status.full'), value: 5 }
])

/**
 * 电池健康状态选项数组
 * health: 1=未知、2=良好、3=过热、4=损坏、5=过压、6=未知故障、7=过冷
 */
const healthOptions = computed<OptionItem[]>(() => [
  { label: t('phone.battery.health.unknown'), value: 1 },
  { label: t('phone.battery.health.good'), value: 2 },
  { label: t('phone.battery.health.overheat'), value: 3 },
  { label: t('phone.battery.health.dead'), value: 4 },
  { label: t('phone.battery.health.overVoltage'), value: 5 },
  { label: t('phone.battery.health.unknownFailure'), value: 6 },
  { label: t('phone.battery.health.cold'), value: 7 }
])

/**
 * 充电器连接选项数组
 * plugged: 0=未连接、1=AC、2=USB、4=无线充电
 */
const pluggedOptions = computed<OptionItem[]>(() => [
  { label: t('phone.battery.plugged.none'), value: 0 },
  { label: t('phone.battery.plugged.ac'), value: 1 },
  { label: t('phone.battery.plugged.usb'), value: 2 },
  { label: t('phone.battery.plugged.wireless'), value: 4 }
])

/**
 * 获取电池信息
 * 调用 /battery/get 接口并回显到表单
 */
const fetchBatteryInfo = async () => {
  try {
    loading.value = true
    const { hostIp, dbId } = getDeviceInfo()
    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.GET_BATTERY)
    const res = await request.get<BatteryInfoResponse>(url)

    if (res && res.data) {
      const data = res.data
      // 回显数据，API 返回的就是数字值，直接使用
      batteryForm.level = data.level
      batteryForm.plugged = data.plugged
      batteryForm.status = data.status
      batteryForm.health = data.health
    }
  } catch (error: any) {
    console.error('获取电池信息失败:', error)
    // 首次加载失败可能是服务未启动等原因，提示用户
    ElMessage.error(getErrorMessage(error) || t('phone.battery.getBatteryInfoFailed'))
  } finally {
    loading.value = false
  }
}

/**
 * 提交电池设置
 * 调用 /battery/set 接口更新设备电池状态
 */
const handleSubmit = async () => {
  try {
    if (submitting.value) return
    submitting.value = true
    const { hostIp, dbId } = getDeviceInfo()
    try {
      // 关闭电池模拟
      await request.post(
        buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.SET_SYSTEM_PROP),
        {
          properties: {
            'ro.build.cloud.mock_battery_disabled': '1'
          }
        }
      )
    } catch (error: any) {}
    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.SET_BATTERY)

    // 构建请求载荷，使用新的API格式
    const payload: SetBatteryRequest = {
      level: batteryForm.level,
      status: batteryForm.status,
      health: batteryForm.health,
      plugged: batteryForm.plugged
    }

    const res = await request.post<BatteryInfoResponse>(url, payload)

    // 如果返回了最新状态，更新表单数据
    if (res && res.data) {
      const data = res.data
      batteryForm.level = data.level
      batteryForm.plugged = data.plugged
      batteryForm.status = data.status
      batteryForm.health = data.health
    }

    ElMessage.success(t('phone.multimedia.operationSuccess'))
  } catch (error: any) {
    console.error('设置电池信息失败:', error)
    ElMessage.error(getErrorMessage(error) || t('phone.battery.setBatteryInfoFailed'))
  } finally {
    submitting.value = false
  }
}

// 组件挂载时自动获取电池信息
onMounted(() => {
  fetchBatteryInfo()
})
</script>

<style scoped lang="scss">
.battery-container {
  width: 100%;
  height: 100%;
  padding: 20px;
  background: var(--el-bg-color);
  box-sizing: border-box;
  overflow-y: auto;
}

.form-content {
  padding: 0;
}

.battery-form {
  // 表单整体样式优化
  :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--el-text-color-regular);
    font-weight: 500;
    margin-bottom: 8px;
    padding-right: 12px;
  }

  :deep(.el-form-item) {
    margin-bottom: 24px;
  }

  // 输入框和下拉框统一样式
  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    border-radius: 4px;
  }

  :deep(.el-select) {
    width: 100%;
  }
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;

  .el-slider {
    flex: 1;
    min-width: 0; // 允许收缩，确保能正常显示
  }

  .slider-value {
    font-size: 14px;
    color: var(--el-text-color-regular);
    font-weight: 500;
    min-width: 36px;
    text-align: right;
    flex-shrink: 0; // 防止数值被压缩
  }
}

.submit-form-item {
  margin-top: 32px;
  margin-bottom: 0;

  :deep(.el-form-item__content) {
    justify-content: flex-end;
  }

  .submit-btn {
    min-width: 100px;
    height: 32px;
    font-size: 13px;
    border-radius: 4px;
    padding: 8px 16px;
  }
}
</style>
