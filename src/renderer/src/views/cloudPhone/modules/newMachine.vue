<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.renewDeviceTitle')"
    width="600px"
    :show-close="!uploadLoading"
    @closed="handleClose"
    class="new-machine-dialog"
  >
    <div class="new-machine-content">
      <!-- 批量提示 -->
      <div v-if="isBatch" class="batch-info">
        <el-alert
          :title="t('cloudPhone.batchOperationTip', { count: devices.length })"
          type="info"
          :closable="false"
          show-icon
        />
      </div>

      <!-- 单机信息 -->
      <div v-else class="info-section">
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.deviceNameLabel') }}</span>
          <span class="value">{{ devices[0]?.user_name }}</span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.deviceIdLabel') }}</span>
          <span class="value">{{ devices[0]?.db_id }}</span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.androidVersionLabel') }}</span>
          <span class="value">Android {{ devices[0]?.aosp_version }}</span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.deviceTypeLabel') }}</span>
          <span class="value">{{
            devices[0]?.device_type === DeviceType.VIRTUAL
              ? DeviceTypeMap[DeviceType.VIRTUAL]
              : DeviceTypeMap[DeviceType.REAL]
          }}</span>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="isBatch ? {} : rules"
        label-width="auto"
        label-position="top"
        @submit.prevent
      >
        <!-- 单机模式：选择机型 -->
        <template v-if="!isBatch && isReal">
          <MachineSettingsSelector
            ref="machineSelectorRef"
            :host-ip="devices[0]?.host_ip || ''"
            :android-version="devices[0]?.aosp_version || ''"
            host-adi-failure-policy="continue"
            brand-prop="brand"
            adi-prop="adiID"
            v-model:machine-mode="machineMode"
            v-model:brand="form.brand"
            v-model:adi-id="form.adiID"
            v-model:adi-name="form.adiName"
            v-model:adi-pass="form.adiPass"
          />
          <el-form-item :label="t('cloudPhone.cert')" prop="cert_hash" v-if="isReal">
            <upload-cert
              v-model="form.cert_hash"
              v-model:upload-loading="uploadLoading"
              :host-ip="devices[0]?.host_ip || ''"
            />
          </el-form-item>
        </template>
        <el-form-item style="margin-bottom: 0">
          <template #label>
            <div class="label-row">
              <span style="margin-right: 4px">{{ t('cloudPhone.customSystemProperties') }}</span>
              <el-tooltip :content="t('cloudPhone.customSystemPropertiesTip')" placement="top">
                <span class="question-mark">?</span>
              </el-tooltip>
              <el-switch
                v-model="form.bool_custom_properties"
                @change="form.userProp = ''"
                style="margin-left: 10px"
              />
            </div>
          </template>
        </el-form-item>
        <el-form-item prop="userProp" v-if="form.bool_custom_properties">
          <vmos-json v-model="form.userProp" />
        </el-form-item>
        <!-- 清理数据 -->
        <el-form-item prop="wipeData">
          <div class="wipe-data-row">
            <span>{{ t('cloudPhone.wipeData') }}</span>
            <el-switch v-model="form.wipeData" />
          </div>
          <div class="form-tip">{{ t('cloudPhone.wipeDataTip') }}</div>
        </el-form-item>
      </el-form>

      <!-- Warning -->
      <div class="warning-box">
        <el-icon class="warning-icon"><Warning /></el-icon>
        <div class="warning-content">
          <div class="warning-title">{{ t('cloudPhone.attention') }}</div>
          <div class="warning-list">
            <div>{{ t('cloudPhone.renewWarning1') }}</div>
            <div v-if="form.wipeData" class="danger-text">{{ t('cloudPhone.renewWarning2') }}</div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false" :disabled="uploadLoading">{{
        t('common.cancel')
      }}</el-button>
      <el-button
        type="primary"
        :loading="loading"
        :disabled="uploadLoading"
        @click="handleSubmit"
        >{{ t('common.confirm') }}</el-button
      >
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, toRaw, onUnmounted, watch } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { Device, Host, DATA_EVENTS } from '@shared/ipc/data.types'
import { Adi, ADI_EVENTS } from '@shared/ipc/adi.types'
import { ElForm, ElMessage, ElLoading } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { getErrorMessage } from '@shared/api'
import { DeviceType } from '@renderer/utils/constant'
import { getDeviceTypeText } from '@renderer/utils/i18n-maps'
import MachineSettingsSelector from '../components/MachineSettingsSelector.vue'
import type { AdiWithUpload, MachineMode } from '../components/machineSettings.types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 响应式的设备类型映射（根据当前语言动态生成）
const DeviceTypeMap = computed(() => {
  return {
    [DeviceType.VIRTUAL]: getDeviceTypeText(DeviceType.VIRTUAL),
    [DeviceType.REAL]: getDeviceTypeText(DeviceType.REAL)
  }
})

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()
const devices = ref<Device[]>([])
const hostsMap = ref<Map<string, Host>>(new Map())

const machineSelectorRef = ref<InstanceType<typeof MachineSettingsSelector> | null>(null)
const uploadLoading = ref(false)
let loadingInstance: { close: () => void; setText: (text: string) => void } | null = null

const isBatch = computed(() => devices.value.length > 1)

const isReal = ref(false)
const machineMode = ref<MachineMode>('random')

const form = reactive<any>({
  brand: '',
  adiID: '',
  adiName: '',
  adiPass: '',
  cert_hash: '',
  wipeData: true,
  bool_custom_properties: false,
  userProp: ''
})

const rules = computed(() => {
  if (machineMode.value === 'random') {
    return {}
  }
  return {
    brand: [{ required: true, message: t('cloudPhone.selectBrand'), trigger: 'change' }],
    adiID: [{ required: true, message: t('cloudPhone.selectModel'), trigger: 'change' }],
    userProp: [
      {
        required: true,
        message: t('cloudPhone.enterCustomProperties'),
        trigger: ['blur', 'change']
      }
    ]
  }
})

const handleClose = () => {
  formRef.value?.resetFields()
  form.brand = ''
  form.adiID = ''
  form.adiName = ''
  form.adiPass = ''
  form.cert_hash = ''
  form.wipeData = true
  form.userProp = ''
  form.bool_custom_properties = false
  machineMode.value = 'random'
  devices.value = []
  hostsMap.value.clear()
}

const createLoading = () => {
  const target = document.querySelector('.new-machine-dialog') as HTMLElement
  if (target) {
    loadingInstance = ElLoading.service({
      target,
      lock: true,
      text: t('cloudPhone.processing'),
      background: 'var(--el-mask-color-extra-light)'
    })
  }
}

watch(
  () => visible.value,
  (val) => {
    let offs: any = null
    if (val) {
      offs = [ipc.on<number>(ADI_EVENTS.UPLOAD_ADI_TO_HOST_PROGRESS, handleUploadAdiProgress)]
    } else {
      offs?.forEach((off) => off())
    }
  }
)

const handleUploadAdiProgress = (percent: number) => {
  loadingInstance?.setText(t('cloudPhone.uploadingModelTemplate', { percent: percent.toFixed(0) }))
}

onUnmounted(() => {
  loadingInstance?.close()
  loadingInstance = null
})

const handleSubmit = async () => {
  if (!isBatch.value && formRef.value) {
    await formRef.value.validate()
  }

  try {
    createLoading()

    let targetAdi: AdiWithUpload | null = null

    if (!isBatch.value && isReal.value) {
      targetAdi = machineSelectorRef.value?.getSelectedModel() ?? null

      if (!targetAdi) {
        if (machineMode.value === 'random') {
          throw new Error(t('cloudPhone.noAvailableModelTemplates'))
        }
        throw new Error(t('cloudPhone.selectModel'))
      }

      const device = devices.value[0]
      const host = hostsMap.value.get(device.host_ip || '')

      if (targetAdi && !targetAdi.isUploaded && host) {
        loadingInstance?.setText(t('cloudPhone.uploadingModelTemplateToHost'))
        const res = await ipc.invoke<Adi>(ADI_EVENTS.UPLOAD_ADI_TO_HOST, {
          adi: toRaw(targetAdi),
          host: toRaw(host)
        })
        if (!res.success) {
          throw new Error(res.error || t('cloudPhone.uploadModelTemplateFailed'))
        }
      }
    }

    loadingInstance?.setText(t('cloudPhone.executingRenewDevice'))

    const options = {
      wipeData: form.wipeData,
      adiName: targetAdi?.name,
      adiPass: targetAdi?.pwd,
      cert_hash: form.cert_hash
    }

    const res = await ipc.invoke<{ renewedDevices: Device[]; failedDevices: Device[] }>(
      DATA_EVENTS.RENEW_DEVICE,
      {
        devices: devices.value?.map((d) => toRaw(d)),
        options
      }
    )

    if (!res.success) {
      throw new Error(res.error || t('cloudPhone.renewDeviceFailed'))
    }

    const { renewedDevices, failedDevices } = res.data || {
      renewedDevices: [],
      failedDevices: []
    }

    if (failedDevices.length > 0) {
      ElMessage.warning(
        t('cloudPhone.renewDeviceResult', {
          success: renewedDevices.length,
          fail: failedDevices.length
        })
      )
    } else {
      ElMessage.success(t('cloudPhone.renewDeviceSuccess'))
    }

    visible.value = false
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error, t('cloudPhone.renewDeviceFailed')))
  } finally {
    loadingInstance?.close()
    loadingInstance = null
  }
}

const init = (rows: Device[], hosts: Map<string, Host>) => {
  devices.value = rows
  hostsMap.value = hosts

  if (rows.length === 1) {
    const device = rows[0]
    isReal.value = device.device_type === DeviceType.REAL || !device.device_type
  } else {
    const device = rows?.[0] || {}
    isReal.value = device?.device_type === DeviceType.REAL || !device?.device_type
  }

  visible.value = true
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.new-machine-content {
  padding: 0 10px;
  max-height: 550px;
  overflow-y: auto;
}

.batch-info {
  margin-bottom: 20px;
}

.info-section {
  margin-bottom: 15px;
  display: flex;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  margin-bottom: 5px;
  font-size: 14px;
  width: 50%;
  padding-right: 10px;
  box-sizing: border-box;

  .label {
    flex-shrink: 0;
    width: auto;
    margin-right: 8px;
    color: var(--el-text-color-regular);
  }

  .value {
    color: var(--el-text-color-regular);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
}

.wipe-data-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 5px;
}

.warning-box {
  background-color: var(--el-color-warning-light-9);
  padding: 8px 12px;
  border-radius: 4px;
  display: flex;
  gap: 10px;
  margin-top: 10px;

  .warning-icon {
    color: var(--el-color-warning);
    font-size: 16px;
    margin-top: 2px;
  }

  .warning-content {
    font-size: 12px;
    color: var(--el-color-warning);

    .warning-title {
      font-weight: bold;
      margin-bottom: 2px;
    }

    .danger-text {
      color: var(--el-color-danger);
      font-weight: bold;
    }
  }
}
.question-mark {
  display: inline-block;
  width: 14px;
  height: 14px;
  line-height: 14px;
  text-align: center;
  border-radius: 50%;
  background-color: var(--el-text-color-secondary);
  color: var(--el-bg-color);
  font-size: 12px;
  margin: 0 4px;
  cursor: help;
}
</style>

