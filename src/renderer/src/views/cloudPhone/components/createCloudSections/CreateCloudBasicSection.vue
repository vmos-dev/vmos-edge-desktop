<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Image } from '@shared/ipc/data.types'
import ImageSelect from '../ImageSelect.vue'
import MachineSettingsSelector from '../MachineSettingsSelector.vue'
import type { AdiWithUpload, MachineModelChangePayload } from '../machineSettings.types'
import CreateCloudSectionCard from './CreateCloudSectionCard.vue'

export interface CreateCloudBasicSectionExpose {
  getSelectedImage: () => (Image & { isUploaded: boolean }) | undefined
  refreshImageOptions: () => Promise<void>
  getSelectedModel: () => AdiWithUpload | null
  reloadMachineSettings: () => Promise<void>
}

defineProps<{
  visible: boolean
  hostIp: string
  adiResolutionOptions: Array<{ label: string; value: string }>
  fixedResolutionOptions: Array<{ label: string; value: string }>
  fpsOptions: Array<{ label: string; value: number }>
}>()

const emit = defineEmits<{
  'machine-model-change': [payload: MachineModelChangePayload]
  'manage-image': []
}>()

const { t } = useI18n()
const form = defineModel<Record<string, any>>('form', { required: true })

const imageSelectRef = ref<InstanceType<typeof ImageSelect> | null>(null)
const machineSelectorRef = ref<InstanceType<typeof MachineSettingsSelector> | null>(null)
const currentAndroidVersion = ref('')

const handleManageImage = () => {
  emit('manage-image')
}

const handleImageChange = (image: Image & { isUploaded: boolean }) => {
  if (image) {
    machineSelectorRef.value?.reload(image.androidVersion)
  }
}

const handleMachineModelChange = (payload: MachineModelChangePayload) => {
  emit('machine-model-change', payload)
}

const handleResolutionChange = (value: string) => {
  if (value === 'custom') {
    form.value.customResolution = ''
  }
}

const refreshImageOptions = async () => {
  await imageSelectRef.value?.getImageOptions()
}

const getSelectedImage = () => imageSelectRef.value?.getSelectedImage()

const getSelectedModel = () => machineSelectorRef.value?.getSelectedModel() ?? null

const reloadMachineSettings = async () => {
  await nextTick()
  if (!currentAndroidVersion.value) {
    return
  }
  await machineSelectorRef.value?.reload(currentAndroidVersion.value)
}

defineExpose<CreateCloudBasicSectionExpose>({
  getSelectedImage,
  refreshImageOptions,
  getSelectedModel,
  reloadMachineSettings
})
</script>

<template>
  <CreateCloudSectionCard :title="t('cloudPhone.createBasicSectionTitle')">
    <el-form-item class="image-select-item" prop="image_repository">
      <template #label>
        <div class="label-row">
          <div>
            <span class="required-mark">*</span>
            {{ t('cloudPhone.selectImage') }}
          </div>
          <el-link type="primary" :underline="false" class="manage-link" @click="handleManageImage">
            {{ t('cloudPhone.goToImageManagement') }}
          </el-link>
        </div>
      </template>
      <ImageSelect
        v-if="visible"
        ref="imageSelectRef"
        v-model="form.image_repository"
        v-model:android-version="currentAndroidVersion"
        :host-ip="hostIp || undefined"
        @change="handleImageChange"
      />
    </el-form-item>

    <el-form-item :label="t('cloudPhone.deviceType')" prop="device_type" required>
      <vmos-tabs
        v-model="form.device_type"
        :tabs="[
          { label: t('cloudPhone.realDevice'), value: 'real' },
          { label: t('cloudPhone.virtualDevice'), value: 'virtual' }
        ]"
        height="38px"
      />
    </el-form-item>

    <template v-if="form.device_type === 'real'">
      <MachineSettingsSelector
        ref="machineSelectorRef"
        v-model:machine-mode="form.machine_mode"
        v-model:brand="form.brand"
        v-model:adi-id="form.adiID"
        v-model:adi-name="form.adi_name"
        v-model:adi-pass="form.adi_pass"
        :host-ip="hostIp"
        :android-version="currentAndroidVersion"
        host-adi-failure-policy="throw"
        brand-prop="brand"
        adi-prop="adiID"
        @model-change="handleMachineModelChange"
      />
    </template>

    <el-row :gutter="20" align="bottom">
      <el-col :span="12">
        <el-form-item :label="t('cloudPhone.resolution')" prop="resolutionStr">
          <el-select
            v-model="form.resolutionStr"
            filterable
            style="width: 100%"
            :placeholder="t('cloudPhone.resolutionPlaceholder')"
            @change="handleResolutionChange"
          >
            <el-option :label="t('cloudPhone.customResolution')" value="custom" />
            <el-option-group
              v-if="form.device_type === 'real' && adiResolutionOptions.length > 0"
              :label="t('cloudPhone.modelResolution')"
            >
              <el-option
                v-for="item in adiResolutionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-option-group>
            <el-option-group :label="t('cloudPhone.commonResolution')">
              <el-option
                v-for="item in fixedResolutionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item :label="t('cloudPhone.fps')" prop="fps">
          <el-select v-model="form.fps" style="width: 100%">
            <el-option
              v-for="item in fpsOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>

    <el-row v-if="form.resolutionStr === 'custom'" :gutter="20">
      <el-col :span="24">
        <el-form-item :label="t('cloudPhone.customResolution')" prop="customResolution">
          <el-input
            v-model="form.customResolution"
            :placeholder="t('cloudPhone.customResolutionPlaceholder')"
            clearable
          />
          <div class="resolution-tip">{{ t('cloudPhone.resolutionFormatTip') }}</div>
        </el-form-item>
      </el-col>
    </el-row>

    <el-row :gutter="20" align="bottom">
      <el-col :span="6">
        <el-form-item class="no-label-item">
          <el-checkbox v-model="form.enableGms" :label="t('cloudPhone.enableGms')" />
        </el-form-item>
      </el-col>
      <el-col v-if="form.enableGms" :span="6">
        <el-form-item class="no-label-item">
          <div class="checkbox-with-tip">
            <el-checkbox
              v-model="form.enableGmsAutoUpdate"
              :label="t('cloudPhone.gmsAutoUpdate')"
            />
            <el-tooltip :content="t('cloudPhone.gmsAutoUpdateTip')" placement="top">
              <span class="question-mark">?</span>
            </el-tooltip>
          </div>
        </el-form-item>
      </el-col>
    </el-row>
  </CreateCloudSectionCard>
</template>

<style scoped lang="scss">
.image-select-item {
  :deep(.el-form-item__label) {
    width: 100% !important;

    &::before {
      display: none;
    }
  }
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.required-mark {
  color: var(--el-color-danger);
}

.manage-link {
  font-size: 12px;
}

.checkbox-with-tip {
  display: flex;
  align-items: center;
  gap: 4px;
}

.question-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--el-text-color-secondary);
  color: var(--el-bg-color);
  font-size: 12px;
  cursor: help;
}

.no-label-item {
  display: flex;
  align-items: flex-end;
  height: 100%;
  padding-bottom: 2px;
}

.resolution-tip {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
