<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.updateImage')"
    width="500px"
    @closed="handleClose"
    class="update-edit-dialog"
  >
    <div class="update-edit-content">
      <div class="info-section">
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.deviceNameLabel') }}</span>
          <span class="value">{{ device?.user_name }}</span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.deviceIdLabel') }}</span>
          <span class="value">{{ device?.db_id }}</span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.imageVersion') }}</span>
          <span class="value">{{ device?.image?.replace(/:latest$/, '') }}</span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.androidVersionLabel') }}</span>
          <span class="value">Android {{ device?.aosp_version }}</span>
        </div>
        <div class="info-item">
          <span class="label">{{ t('cloudPhone.deviceTypeLabel') }}</span>
          <span class="value">{{
            device?.device_type === DeviceType.VIRTUAL
              ? DeviceTypeMap[DeviceType.VIRTUAL]
              : DeviceTypeMap[DeviceType.REAL]
          }}</span>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="auto"
        class="update-image-form"
        label-position="top"
        @submit.prevent
      >
        <!-- Select Image -->
        <el-form-item prop="image_repository" class="image-select-item">
          <template #label>
            <div class="label-row">
              <div>
                <span style="color: var(--el-color-danger)">*</span>
                {{ t('cloudPhone.selectImage') }}
              </div>
            </div>
          </template>
          <ImageSelect
            v-if="visible"
            v-model="form.image_repository"
            v-model:android-version="currentAndroidVersion"
            :host-ip="host?.ip"
            :exclude-version="device?.image?.replace(/:latest$/, '')"
            @change="handleImageChange"
            ref="imageSelectRef"
          />
        </el-form-item>

        <template v-if="isNeedAdi">
          <MachineSettingsSelector
            ref="machineSelectorRef"
            :host-ip="host?.ip || ''"
            :android-version="currentAndroidVersion"
            host-adi-failure-policy="throw"
            brand-prop="brand"
            adi-prop="adiID"
            v-model:machine-mode="machineMode"
            v-model:brand="form.brand"
            v-model:adi-id="form.adiID"
            v-model:adi-name="form.adiName"
            v-model:adi-pass="form.adiPass"
          />
        </template>
      </el-form>

      <!-- Warning -->
      <div class="warning-box">
        <el-icon class="warning-icon"><Warning /></el-icon>
        <div class="warning-content">
          <div class="warning-title">{{ t('cloudPhone.attention') }}</div>
          <div class="warning-list">
            <div>{{ t('cloudPhone.updateImageWarning1') }}</div>
            <div class="danger-text">{{ t('cloudPhone.updateImageWarning2') }}</div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">{{
        t('common.confirm')
      }}</el-button>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, toRaw, onUnmounted, watch, computed } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { Device, Host, Image } from '@shared/ipc/data.types'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import { Adi, ADI_EVENTS } from '@shared/ipc/adi.types'
import { ElForm, ElMessage, ElLoading } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api/request'
import { getErrorMessage } from '@shared/api'
import { ElMessageBox } from 'element-plus'
import { DeviceType } from '@renderer/utils/constant'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { getDeviceTypeText } from '@renderer/utils/i18n-maps'
import ImageSelect from '../components/ImageSelect.vue'
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
const device = ref<Device>()
const host = ref<Host>()
const machineSelectorRef = ref<InstanceType<typeof MachineSettingsSelector> | null>(null)
let loadingInstance: { close: () => void; setText: (text: string) => void } | null = null

const form = reactive<any>({
  image_repository: '',
  brand: '',
  adiID: '',
  adiName: '',
  adiPass: ''
})

const machineMode = ref<MachineMode>('random')

const rules = computed(() => {
  const baseRules = {
    image_repository: [{ required: true, message: t('cloudPhone.selectImage'), trigger: 'change' }]
  }

  if (isNeedAdi.value && machineMode.value === 'custom') {
    return {
      ...baseRules,
      brand: [{ required: true, message: t('cloudPhone.selectBrand'), trigger: 'change' }],
      adiID: [{ required: true, message: t('cloudPhone.selectModel'), trigger: 'change' }]
    }
  }

  return baseRules
})

const isReal = ref(false)

// 当前选中的安卓版本 (绑定到 ImageSelect)
const currentAndroidVersion = ref('')

// 设备的安卓版本
const deviceAndroidVersion = computed(() => {
  return device.value?.aosp_version
})

// 是否需要adi
const isNeedAdi = computed(() => {
  return (
    isReal.value &&
    currentAndroidVersion.value != deviceAndroidVersion.value &&
    currentAndroidVersion.value
  )
})

const handleClose = () => {
  currentAndroidVersion.value = ''
  formRef.value?.resetFields()
  form.image_repository = ''
  form.brand = ''
  form.adiID = ''
  form.adiName = ''
  form.adiPass = ''
  machineMode.value = 'random'
}

const imageSelectRef = ref()

const handleImageChange = (image: Image & { isUploaded: boolean }) => {
  if (image) {
    machineSelectorRef.value?.reload(image.androidVersion)
  }
}

const getImageOptions = async () => {
  await imageSelectRef.value?.getImageOptions()
}

const createLoading = () => {
  const target = document.querySelector('.update-edit-dialog') as HTMLElement
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
      offs = [
        ipc.on<number>(ADI_EVENTS.UPLOAD_ADI_TO_HOST_PROGRESS, handleUploadAdiProgress),
        ipc.on<number>(IMAGES_EVENTS.UPLOAD_IMAGE_TO_HOST_PROGRESS, handleUploadImageProgress)
      ]
    } else {
      offs?.forEach((off) => off())
    }
  }
)

const handleUploadAdiProgress = (percent: number) => {
  loadingInstance?.setText(t('cloudPhone.uploadingModelTemplate', { percent: percent.toFixed(0) }))
}
const handleUploadImageProgress = (percent: number) => {
  loadingInstance?.setText(t('cloudPhone.uploadingImage', { percent: percent.toFixed(0) }))
  if (percent == 100) {
    loadingInstance?.setText(t('cloudPhone.firstTimeLoading'))
  }
}

onUnmounted(() => {
  loadingInstance?.close()
  loadingInstance = null
})

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  const submit = async () => {
    try {
      createLoading()

      let targetAdi: AdiWithUpload | null = null

      if (isNeedAdi.value) {
        targetAdi = machineSelectorRef.value?.getSelectedModel() ?? null

        if (!targetAdi) {
          if (machineMode.value === 'random') {
            throw new Error(t('cloudPhone.noAvailableModelTemplates'))
          }
          throw new Error(t('cloudPhone.selectModel'))
        }
      }

      const uploads: {
        adi?: AdiWithUpload
        image?: Image
      } = {}

      if (targetAdi && !targetAdi.isUploaded) {
        uploads.adi = targetAdi
      }

      const image = imageSelectRef.value?.getSelectedImage()
      if (image && !image.isUploaded) {
        uploads.image = image
      }

      if (uploads.adi) {
        loadingInstance?.setText(t('cloudPhone.uploadingModelTemplateToHost'))
        const res = await ipc.invoke<Adi>(ADI_EVENTS.UPLOAD_ADI_TO_HOST, {
          adi: toRaw(uploads.adi),
          host: toRaw(host.value)
        })
        if (!res.success) {
          throw new Error(res.error || t('cloudPhone.uploadModelTemplateFailed'))
        }
      }

      if (uploads.image) {
        loadingInstance?.setText(t('cloudPhone.uploadingImageToHost'))
        const res = await ipc.invoke<Image>(IMAGES_EVENTS.UPLOAD_IMAGE_TO_HOST, {
          image: toRaw(uploads.image),
          host: toRaw(host.value)
        })
        if (!res.success) {
          throw new Error(res.error || t('cloudPhone.uploadImageFailed'))
        }
      }

      loadingInstance?.setText(t('cloudPhone.modifyingImage'))

      const fpsRes = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.STREAM_FPS)
      const bitrateRes = await ipc.invoke<string>(
        CONFIG_EVENTS.GET_CONFIGS,
        CONFIG_KEYS.STREAM_BITRATE
      )
      const fps = fpsRes.success && fpsRes.data ? fpsRes.data : '30'
      const bitrate = bitrateRes.success && bitrateRes.data ? bitrateRes.data : '2'
      const bitrateBytes = parseInt(bitrate) * 1024 * 1024

      await request.post(
        buildApiUrl(host.value?.ip || '', API_CONFIG.PATHS.UPDATE_CLOUD_PHONE_IMAGE),
        {
          db_ids: [device.value?.db_id],
          repository: form.image_repository,
          adiName: targetAdi?.name,
          adiPass: targetAdi?.pwd,
          scdArgs: JSON.stringify({
            video_bit_rate: String(bitrateBytes),
            max_fps: fps
          })
        },
        {
          timeout: 60 * 1000
        }
      )

      ElMessage.success(t('common.operationSuccess'))
      visible.value = false
    } catch (error: any) {
      ElMessage.error(getErrorMessage(error, t('cloudPhone.modifyImageFailed')))
    } finally {
      loadingInstance?.close()
      loadingInstance = null
      try {
        await getImageOptions()
      } catch (e) {
        console.error(e)
      }
    }
  }

  if (currentAndroidVersion.value != deviceAndroidVersion.value) {
    ElMessageBox.confirm(t('cloudPhone.crossVersionUpgradeWarning'), t('common.tips'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }).then(() => {
      submit()
    })
    return
  }
  submit()
}

const init = (row: Device, hostData?: Host) => {
  device.value = row
  host.value = hostData
  isReal.value = row.device_type === DeviceType.REAL || !row.device_type
  // getImageOptions() // Handled by component

  visible.value = true
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.update-edit-content {
  padding: 0 10px;
}

.info-section {
  margin-bottom: 15px;
}

.info-item {
  display: flex;
  margin-bottom: 5px;
  font-size: 14px;

  .label {
    width: 100px;
    color: var(--el-text-color-regular);
  }

  .value {
    color: var(--el-text-color-regular);
  }
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
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

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.image-select-item {
  :deep(.el-form-item__label) {
    width: 100% !important;
    &::before {
      display: none;
    }
  }
}
</style>
