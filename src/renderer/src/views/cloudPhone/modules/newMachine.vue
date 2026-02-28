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
          <div class="section-title">{{ t('cloudPhone.machineSettings') }}</div>
          <el-form-item>
            <el-radio-group v-model="machineMode">
              <el-radio label="random">{{ t('cloudPhone.random') }}</el-radio>
              <el-radio label="custom">{{ t('cloudPhone.custom') }}</el-radio>
            </el-radio-group>
          </el-form-item>

          <template v-if="machineMode === 'custom'">
            <div class="section-title">{{ t('cloudPhone.specifyModel') }}</div>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item :label="t('cloudPhone.brand')" prop="brand">
                  <el-select
                    v-model="form.brand"
                    @change="handleBrandChange"
                    filterable
                    :placeholder="t('cloudPhone.brandPlaceholder')"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in brandOptions"
                      :key="item.brand"
                      :label="item.brand"
                      :value="item.brand"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item :label="t('cloudPhone.model')" prop="adiID">
                  <el-select
                    v-model="form.adiID"
                    filterable
                    :placeholder="t('cloudPhone.modelPlaceholder')"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in modelOptions"
                      :key="item.id"
                      :label="`${item.model_name}${item.isUploaded ? t('cloudPhone.uploaded') : ''}`"
                      :value="item.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </template>
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
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api/request'
import { getErrorMessage } from '@shared/api'
import { DeviceType } from '@renderer/utils/constant'
import { getDeviceTypeText } from '@renderer/utils/i18n-maps'
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

const brandOptions = ref<any>([])
const modelOptions = ref<any>([])
const uploadLoading = ref(false)
let loadingInstance: { close: () => void; setText: (text: string) => void } | null = null

const isBatch = computed(() => devices.value.length > 1)

const isReal = ref(false)
const machineMode = ref('random') // 'random' | 'custom'
// 存储所有可用机型用于随机
const allAvailableModels = ref<(Adi & { isUploaded: boolean })[]>([])

const form = reactive<any>({
  brand: '',
  adiID: '',
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
  form.cert_hash = ''
  form.wipeData = true
  form.userProp = ''
  form.bool_custom_properties = false
  machineMode.value = 'random'
  devices.value = []
  hostsMap.value.clear()
  allAvailableModels.value = []
}

const handleBrandChange = (value: string) => {
  form.adiID = ''
  const brand = brandOptions.value.find((item: any) => item.brand === value)
  if (brand) {
    modelOptions.value = brand.list
    form.adiID = modelOptions.value?.[0]?.id ?? ''
  }
}

const getBrandOptions = async (asopVersion: string) => {
  if (!asopVersion || !isReal.value) return

  try {
    const res = await ipc.invoke<Adi[]>(ADI_EVENTS.GET_ADIS)

    if (res.success) {
      // 获取主机机型模板列表
      // 对于单机，我们只查询该设备对应的主机
      const device = devices.value[0]
      const host = hostsMap.value.get(device.host_ip || '')

      let adiIds: number[] = []
      if (host) {
        try {
          const adiList = await request.get(
            buildApiUrl(host.ip || '', API_CONFIG.PATHS.GET_HOST_ADI_TEMPLATE_LIST)
          )
          adiIds = adiList?.data?.list?.map((item: any) => Number(item.adiID)) || []
        } catch (e) {
          console.error('Failed to get host ADI list', e)
        }
      }

      // 筛选符合当前镜像版本的机型
      const filteredAdis = (res.data || []).filter((item: Adi) => item.asopVersion === asopVersion)

      // 保存所有符合条件的机型，用于随机选择
      allAvailableModels.value = filteredAdis.map((item: Adi) => ({
        ...item,
        isUploaded: adiIds.includes(Number(item.id))
      })) as any[]

      // 构建品牌选项（复用之前的逻辑，但数据源已筛选过）
      const brandMap = new Map<string, any[]>()
      filteredAdis.forEach((item: Adi) => {
        if (!brandMap.has(item.brand)) {
          brandMap.set(item.brand, [])
        }
        brandMap.get(item.brand)!.push(item)
      })

      const options = Array.from(brandMap.entries()).map(([brand, list]) => ({
        brand,
        list: list.map((item: Adi) => ({
          ...item,
          isUploaded: adiIds.includes(Number(item.id))
        }))
      }))

      brandOptions.value = options

      // Default selection
      if (!form.brand || !options.find((o) => o.brand === form.brand)) {
        form.brand = options?.[0]?.brand ?? ''
      }

      const currentBrand = options.find((item) => item.brand === form.brand)
      const modelOptionsData = currentBrand?.list ?? options?.[0]?.list ?? []

      modelOptions.value = modelOptionsData

      if (!form.adiID || !modelOptionsData.find((m: any) => m.id === form.adiID)) {
        form.adiID = modelOptionsData?.[0]?.id ?? ''
      }
    }
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error, t('cloudPhone.getAdiListFailed')))
  }
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

    let targetAdiID: number | undefined = undefined

    // 1. 确定最终使用的机型 ID（只有真机才有机型选择）
    if (!isBatch.value && isReal.value) {
      if (machineMode.value === 'custom') {
        targetAdiID = form.adiID ? Number(form.adiID) : undefined
      } else {
        // 随机模式：从所有可用机型中随机选一个
        if (allAvailableModels.value.length > 0) {
          // 用户明确表示可以随机到自己，因此移除排除逻辑，保持纯随机
          const randomIndex = Math.floor(Math.random() * allAvailableModels.value.length)
          targetAdiID = (allAvailableModels.value[randomIndex] as any).id
        } else {
          throw new Error(t('cloudPhone.noAvailableModelTemplates'))
        }
      }

      // 2. 检查并上传 ADI (如果是单机模式且是真机)
      if (targetAdiID && isReal.value) {
        // 在所有可用模型中找到选中的（无论是随机还是自定义）
        const adi = allAvailableModels.value.find((item: any) => item.id == targetAdiID) as Adi & {
          isUploaded: boolean
        }
        const device = devices.value[0]
        const host = hostsMap.value.get(device.host_ip || '')

        if (adi && !adi.isUploaded && host) {
          loadingInstance?.setText(t('cloudPhone.uploadingModelTemplateToHost'))
          const res = await ipc.invoke<Adi>(ADI_EVENTS.UPLOAD_ADI_TO_HOST, {
            adi: toRaw(adi),
            host: toRaw(host)
          })
          if (!res.success) {
            throw new Error(res.error || t('cloudPhone.uploadModelTemplateFailed'))
          }
        }
      }
    }

    loadingInstance?.setText(t('cloudPhone.executingRenewDevice'))

    // 3. 调用 IPC 进行一键新机
    const options = {
      wipeData: form.wipeData,
      adiID: targetAdiID,
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

  // 如果是单机，初始化机型选择（只有真机才获取机型列表）
  if (rows.length === 1) {
    const device = rows[0]
    isReal.value = device.device_type === DeviceType.REAL || !device.device_type
    if (isReal.value) {
      getBrandOptions(device.aosp_version || '')
    }
  } else {
    // 取第一个
    const device = rows?.[0] || {}
    isReal.value = device?.device_type === DeviceType.REAL || !device?.device_type
    // 批量模式下不获取机型列表，也就无法随机，保持原有逻辑
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
