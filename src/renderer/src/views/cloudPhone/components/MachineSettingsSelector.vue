<template>
  <div class="machine-settings-selector">
    <div v-if="showTitle" class="section-title">{{ t('cloudPhone.machineSettings') }}</div>
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
          <el-form-item :label="t('cloudPhone.brand')" :prop="brandProp">
            <el-select
              v-model="brandValue"
              filterable
              :loading="loading"
              :placeholder="t('cloudPhone.brandPlaceholder')"
              style="width: 100%"
              @change="handleBrandChange"
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
          <el-form-item :label="t('cloudPhone.model')" :prop="adiProp">
            <el-select
              v-model="adiId"
              filterable
              :loading="loading"
              :placeholder="t('cloudPhone.modelPlaceholder')"
              style="width: 100%"
              @change="handleAdiChange"
            >
              <el-option-group
                v-for="group in groupedModelOptions"
                :key="group.key"
                :label="group.label"
              >
                <el-option
                  v-for="item in group.list"
                  :key="String(item.id)"
                  :label="item.model_name || item.model"
                  :value="item.id"
                >
                  <div class="model-option-row">
                    <span class="model-option-name">{{ item.model_name || item.model }}</span>
                    <span v-if="item.isUploaded" class="uploaded-text">
                      {{ t('cloudPhone.uploaded') }}
                    </span>
                  </div>
                </el-option>
              </el-option-group>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { ADI_EVENTS, type Adi, type CustomAdi } from '@shared/ipc/adi.types'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api/request'
import { getErrorMessage } from '@shared/api'
import { useI18n } from 'vue-i18n'
import type {
  AdiWithUpload,
  BrandOption,
  MachineChangeReason,
  MachineMode,
  MachineModelChangePayload
} from './machineSettings.types'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    hostIp: string
    androidVersion: string
    showTitle?: boolean
    brandProp?: string
    adiProp?: string
    hostAdiFailurePolicy?: 'throw' | 'continue'
  }>(),
  {
    showTitle: true,
    brandProp: 'brand',
    adiProp: 'adiID',
    hostAdiFailurePolicy: 'throw'
  }
)

const emits = defineEmits<{
  (e: 'model-change', payload: MachineModelChangePayload): void
  (e: 'options-loaded', payload: { allModels: AdiWithUpload[]; brandOptions: BrandOption[] }): void
}>()

const machineMode = defineModel<MachineMode>('machineMode', { default: 'random' })
const brandModel = defineModel<string>('brand', { default: '' })
const adiId = defineModel<string | number>('adiId', { default: '' })
const adiName = defineModel<string>('adiName', { default: '' })
const adiPass = defineModel<string>('adiPass', { default: '' })

const brandValue = computed<string>({
  get: () => brandModel.value || '',
  set: (value) => {
    brandModel.value = value
  }
})

const loading = ref(false)
const initialized = ref(false)
const brandOptions = ref<BrandOption[]>([])
const modelOptions = ref<AdiWithUpload[]>([])
const allAvailableModels = ref<AdiWithUpload[]>([])

type HostAdiTemplate = {
  adiID?: unknown
  adiName?: unknown
  adiPass?: unknown
  adi_name?: unknown
  adi_pass?: unknown
}

type LocalAdiTemplate = {
  id: string | number
  brand: string
  model: string
  asopVersion: string
  layout: string
  model_name?: string
  name: string
  pwd?: string
  updateTime: string
  path?: string
  isCustom: boolean
}

type ModelOptionGroup = {
  key: 'custom' | 'general'
  label: string
  list: AdiWithUpload[]
}

const normalizeId = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const normalizeCredential = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const getHostAdiName = (item: HostAdiTemplate): string => {
  return normalizeCredential(item.adiName ?? item.adi_name)
}

const getHostAdiPass = (item: HostAdiTemplate): string => {
  return normalizeCredential(item.adiPass ?? item.adi_pass)
}

const findHostTemplate = (
  adi: LocalAdiTemplate,
  hostTemplates: HostAdiTemplate[]
): HostAdiTemplate | null => {
  const localId = normalizeId(adi.id)
  const localName = normalizeCredential(adi.name)
  const localPass = normalizeCredential(adi.pwd)

  return (
    hostTemplates.find((item) => {
      const hostName = getHostAdiName(item)
      const hostPass = getHostAdiPass(item)

      // 主匹配：adiName + adiPass（你要求的规则）
      const byCredential =
        !!(hostName && hostPass && localName && localPass) &&
        hostName === localName &&
        hostPass === localPass

      // 自定义模板本地无 pwd 时，使用名称兜底匹配
      const byNameOnly = !!(localName && !localPass && hostName) && hostName === localName

      const hostId = normalizeId(item.adiID)
      const byId = !!hostId && hostId === localId

      return byCredential || byNameOnly || byId
    }) || null
  )
}

const toAdiWithUpload = (
  adi: LocalAdiTemplate,
  hostTemplates: HostAdiTemplate[]
): AdiWithUpload => {
  const matched = findHostTemplate(adi, hostTemplates)
  const hostName = matched ? getHostAdiName(matched) : ''
  const hostPass = matched ? getHostAdiPass(matched) : ''

  return {
    id: adi.id,
    brand: adi.brand,
    model: adi.model,
    asopVersion: adi.asopVersion,
    layout: adi.layout,
    name: adi.name || hostName,
    pwd: adi.pwd || hostPass,
    updateTime: adi.updateTime,
    model_name: adi.model_name || adi.model,
    path: adi.path,
    isCustom: adi.isCustom,
    isUploaded: !!matched
  }
}

const filterAndGroupByBrand = (
  data: LocalAdiTemplate[],
  asopVersion: string,
  hostTemplates: HostAdiTemplate[]
): BrandOption[] => {
  const brandMap = new Map<string, AdiWithUpload[]>()

  data.forEach((item) => {
    if (item.asopVersion !== asopVersion) return

    if (!brandMap.has(item.brand)) {
      brandMap.set(item.brand, [])
    }

    brandMap.get(item.brand)!.push(toAdiWithUpload(item, hostTemplates))
  })

  return Array.from(brandMap.entries()).map(([brand, list]) => ({
    brand,
    list
  }))
}

const mapGeneralAdis = (data: Adi[]): LocalAdiTemplate[] => {
  return data.map((item) => ({
    id: item.id,
    brand: item.brand,
    model: item.model,
    asopVersion: item.asopVersion,
    layout: item.layout,
    model_name: (item as any).model_name || item.model,
    name: item.name,
    pwd: (item as any).pwd || '',
    updateTime: item.updateTime,
    isCustom: false
  }))
}

const mapCustomAdis = (data: CustomAdi[]): LocalAdiTemplate[] => {
  return data.map((item) => ({
    id: item.id,
    brand: item.brand,
    model: item.model,
    asopVersion: item.asopVersion,
    layout: item.layout,
    model_name: item.model_name || item.model,
    name: item.name,
    pwd: '',
    updateTime: item.updateTime,
    path: item.path,
    isCustom: true
  }))
}

const sortModelsByTemplateType = (models: AdiWithUpload[]): AdiWithUpload[] => {
  const customModels: AdiWithUpload[] = []
  const generalModels: AdiWithUpload[] = []

  models.forEach((item) => {
    if (item.isCustom) {
      customModels.push(item)
      return
    }
    generalModels.push(item)
  })

  return [...customModels, ...generalModels]
}

const groupedModelOptions = computed<ModelOptionGroup[]>(() => {
  const customModels: AdiWithUpload[] = []
  const generalModels: AdiWithUpload[] = []

  modelOptions.value.forEach((item) => {
    if (item.isCustom) {
      customModels.push(item)
      return
    }
    generalModels.push(item)
  })

  const groups: ModelOptionGroup[] = []

  if (customModels.length > 0) {
    groups.push({
      key: 'custom',
      label: t('cloudPhone.customTemplateGroup'),
      list: customModels
    })
  }

  if (generalModels.length > 0) {
    groups.push({
      key: 'general',
      label: t('cloudPhone.generalTemplateGroup'),
      list: generalModels
    })
  }

  return groups
})

const isAdiUploaded = (adi: LocalAdiTemplate, hostTemplates: HostAdiTemplate[]): boolean => {
  return !!findHostTemplate(adi, hostTemplates)
}

const markUploadedState = (
  data: LocalAdiTemplate[],
  hostTemplates: HostAdiTemplate[]
): AdiWithUpload[] => {
  return data.map((item) => ({
    ...toAdiWithUpload(item, hostTemplates),
    isUploaded: isAdiUploaded(item, hostTemplates)
  }))
}

const getMergedAdis = async (): Promise<LocalAdiTemplate[]> => {
  const [generalRes, customRes] = await Promise.all([
    ipc.invoke<Adi[]>(ADI_EVENTS.GET_ADIS),
    ipc.invoke<CustomAdi[]>(ADI_EVENTS.GET_CUSTOM_ADIS)
  ])

  if (!generalRes.success) {
    throw new Error(generalRes.error || t('cloudPhone.getAdiListFailed'))
  }

  const generalAdis = mapGeneralAdis(generalRes.data || [])
  const customAdis = customRes.success ? mapCustomAdis(customRes.data || []) : []

  return [...generalAdis, ...customAdis]
}

const emitModelChange = (
  mode: MachineMode,
  reason: MachineChangeReason,
  model: AdiWithUpload | null
) => {
  emits('model-change', {
    mode,
    reason,
    model
  })
}

const setSelectedModel = (
  model: AdiWithUpload | null,
  mode: MachineMode,
  reason: MachineChangeReason
) => {
  if (model) {
    brandValue.value = model.brand
    adiId.value = model.id
    adiName.value = model.name
    adiPass.value = model.pwd
  } else {
    adiId.value = ''
    adiName.value = ''
    adiPass.value = ''
  }

  emitModelChange(mode, reason, model)
}

const setModelOptionsByBrand = (targetBrand: string): AdiWithUpload[] => {
  const target = brandOptions.value.find((item) => item.brand === targetBrand)
  modelOptions.value = sortModelsByTemplateType(target?.list ?? [])
  return modelOptions.value
}

const ensureCustomSelection = (reason: MachineChangeReason) => {
  if (brandOptions.value.length === 0) {
    brandValue.value = ''
    modelOptions.value = []
    setSelectedModel(null, 'custom', reason)
    return
  }

  if (!brandValue.value || !brandOptions.value.find((item) => item.brand === brandValue.value)) {
    brandValue.value = brandOptions.value[0]?.brand ?? ''
  }

  setModelOptionsByBrand(brandValue.value)

  const selectedModel =
    modelOptions.value.find((item) => normalizeId(item.id) === normalizeId(adiId.value)) ??
    modelOptions.value[0] ??
    null

  setSelectedModel(selectedModel, 'custom', reason)
}

const pickRandomModel = (reason: MachineChangeReason) => {
  if (allAvailableModels.value.length === 0) {
    modelOptions.value = []
    setSelectedModel(null, 'random', reason)
    return
  }

  const randomIndex = Math.floor(Math.random() * allAvailableModels.value.length)
  const randomModel = allAvailableModels.value[randomIndex] ?? null

  if (!randomModel) {
    modelOptions.value = []
    setSelectedModel(null, 'random', reason)
    return
  }

  brandValue.value = randomModel.brand
  setModelOptionsByBrand(brandValue.value)
  setSelectedModel(randomModel, 'random', reason)
}

const handleBrandChange = (value: string) => {
  brandValue.value = value
  setModelOptionsByBrand(value)
  setSelectedModel(modelOptions.value[0] ?? null, 'custom', 'brand-change')
}

const handleAdiChange = (value: string | number) => {
  adiId.value = value
  const selectedModel =
    modelOptions.value.find((item) => normalizeId(item.id) === normalizeId(value)) ?? null
  setSelectedModel(selectedModel, 'custom', 'custom-select')
}

const getHostUploadedAdiTemplates = async (): Promise<HostAdiTemplate[]> => {
  if (!props.hostIp) return []

  try {
    const adiList = await request.get(
      buildApiUrl(props.hostIp, API_CONFIG.PATHS.GET_HOST_ADI_TEMPLATE_LIST)
    )
    return adiList?.data?.list || []
  } catch (error) {
    if (props.hostAdiFailurePolicy === 'continue') {
      console.error('Failed to get host ADI template list', error)
      return []
    }
    throw error
  }
}

const reload = async (
  androidVersion: string = props.androidVersion,
  reason: MachineChangeReason = 'reload'
) => {
  if (!props.hostIp || !androidVersion) {
    brandOptions.value = []
    modelOptions.value = []
    allAvailableModels.value = []
    brandValue.value = ''
    setSelectedModel(null, machineMode.value, reason)
    emits('options-loaded', {
      allModels: [],
      brandOptions: []
    })
    return
  }

  loading.value = true
  try {
    const hostAdiTemplates = await getHostUploadedAdiTemplates()
    const mergedAdis = await getMergedAdis()

    allAvailableModels.value = markUploadedState(
      mergedAdis.filter((item) => item.asopVersion === androidVersion),
      hostAdiTemplates
    )

    brandOptions.value = filterAndGroupByBrand(mergedAdis, androidVersion, hostAdiTemplates)

    emits('options-loaded', {
      allModels: allAvailableModels.value,
      brandOptions: brandOptions.value
    })

    if (machineMode.value === 'random') {
      pickRandomModel(reason)
      return
    }

    ensureCustomSelection(reason)
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error, t('cloudPhone.getAdiListFailed')))
  } finally {
    loading.value = false
  }
}

watch(
  () => machineMode.value,
  (mode, oldMode) => {
    if (mode === oldMode) return
    if (mode === 'random') {
      pickRandomModel('mode-change')
      return
    }
    ensureCustomSelection('mode-change')
  }
)

watch(
  [() => props.androidVersion, () => props.hostIp],
  async ([androidVersion]) => {
    const reason: MachineChangeReason = initialized.value ? 'reload' : 'init'
    await reload(androidVersion, reason)
    initialized.value = true
  },
  { immediate: true }
)

const getSelectedModel = (): AdiWithUpload | null => {
  const currentId = normalizeId(adiId.value)
  if (!currentId) return null

  return (
    allAvailableModels.value.find((item) => normalizeId(item.id) === currentId) ||
    modelOptions.value.find((item) => normalizeId(item.id) === currentId) ||
    null
  )
}

defineExpose({
  reload,
  getSelectedModel
})
</script>

<style scoped lang="scss">
.section-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
}

.model-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.model-option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.uploaded-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
