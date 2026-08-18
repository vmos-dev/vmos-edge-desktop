<template>
  <VmosDrawer
    v-model="visible"
    :title="t('cloudPhone.createDeviceTitle', { ip: host?.ip ? ` | ${host.ip}` : '' })"
    size="820px"
    :show-close="!uploadLoading"
    class="create-cloud-drawer-instance"
    @closed="handleClose"
  >
    <div class="create-cloud-drawer">
      <el-form
        ref="formRef"
        :model="createCloudForm"
        :rules="rules"
        label-width="auto"
        label-position="top"
        class="create-cloud-form"
        @submit.prevent
      >
        <div class="create-cloud-drawer-body">
          <div class="create-cloud-overview">
            <div class="overview-item">
              <div class="overview-label">IP</div>
              <div class="overview-value">{{ host?.ip || '-' }}</div>
            </div>
            <div class="overview-item overview-item-right">
              <div class="overview-label">{{ t('cloudPhone.deviceType') }}</div>
              <div class="overview-value">{{ currentDeviceTypeLabel }}</div>
            </div>
          </div>

          <CreateCloudBasicSection
            ref="basicSectionRef"
            v-model:form="createCloudForm"
            :visible="visible"
            :host-ip="host?.ip || ''"
            :adi-resolution-options="adiResolutionOptions"
            :fixed-resolution-options="fixedResolutionOptions"
            :fps-options="fpsOptions"
            @machine-model-change="handleMachineModelChange"
            @manage-image="handleManageLinkClick"
          />

          <CreateCloudNetworkSection
            v-model:form="createCloudForm"
            v-model:proxy-enabled="proxyEnabled"
            v-model:proxy-form="createProxyForm"
            v-model:proxy-mode="proxyMode"
            v-model:custom-form="customProxyForm"
            :hide-locale-section="hideLocaleSection"
            :dns-type-options="dnsTypeOptions"
            :countries="countries"
            :filtered-time-zones="filteredTimeZones"
            :filtered-languages="filteredLanguages"
            :is-zh-c-n="isZhCN"
            @manage-proxy="handleManageProxyClick"
            @proxy-info-change="handleProxyInfoChange"
            @ip-simulator-change="handleIpSimulatorChange"
            @locale-switch-change="handleLanguageCountryTimezoneChange"
            @custom-proxy-info="customProxyInfo = $event"
          />

          <CreateCloudAdvancedSection
            v-model:form="createCloudForm"
            v-model:upload-loading="uploadLoading"
            :host-ip="host?.ip || ''"
            :show-custom-cert="createCloudForm.device_type === 'real'"
          />

          <CreateCloudSubmitSection v-model:form="createCloudForm" :preview-names="previewNames" />
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <div class="drawer-footer-meta">
          {{
            createCloudForm.user_name
              ? t('cloudPhone.willCreate', { count: createCloudForm.count })
              : host?.ip || ''
          }}
        </div>
        <div class="drawer-actions">
          <el-button :disabled="uploadLoading" @click="visible = false">
            {{ t('common.cancel') }}
          </el-button>
          <el-button type="primary" :disabled="uploadLoading" @click="handleSubmit">
            {{ t('common.confirm') }}
          </el-button>
        </div>
      </div>
    </template>
  </VmosDrawer>
</template>

<script setup lang="ts">
import { ref, reactive, watch, toRaw, onUnmounted, computed } from 'vue'
import type { Host, Image, Proxy } from '@shared/ipc/data.types'
import { ElMessage, ElLoading } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api/request'
import { Adi, ADI_EVENTS } from '@shared/ipc/adi.types'
import { ResolutionModel } from '@renderer/utils/constant'
import { getErrorMessage } from '@shared/api'
import { useRouter } from 'vue-router'
import { countries } from '../data/countries'
import { timeZones } from '../data/timezones'
import { languages } from '../data/languages'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import axios from 'axios'
import type { AdiWithUpload, MachineModelChangePayload } from './machineSettings.types'
import store from 'store'
import { useI18n } from 'vue-i18n'
import { useLocale } from '@renderer/hooks/useLocale'
import {
  createDefaultProxyForm,
  type ProxyFormModel,
  buildCustomProxyPayload,
  saveCustomProxyWithToast
} from '../services/proxyService'
import { buildCreateProxySubmit } from './createProxy/createCloudProxySubmit'
import {
  createDefaultCustomProxyForm,
  type CustomProxyFormModel
} from '@renderer/components/proxy/customProxyTypes'
import {
  applyProxyLocaleOwnership,
  createDefaultLocaleFields,
  shouldHideLocaleSection
} from './createProxy/createProxyState'
import CreateCloudBasicSection, {
  type CreateCloudBasicSectionExpose
} from './createCloudSections/CreateCloudBasicSection.vue'
import CreateCloudNetworkSection from './createCloudSections/CreateCloudNetworkSection.vue'
import CreateCloudAdvancedSection from './createCloudSections/CreateCloudAdvancedSection.vue'
import CreateCloudSubmitSection from './createCloudSections/CreateCloudSubmitSection.vue'

const { t } = useI18n()
const { isZhCN } = useLocale()

const CREATE_CLOUD_FORM_KEY = 'createCloudForm'

const router = useRouter()

const host = ref<Host>()

const visible = ref(false)
const formRef = ref()
const basicSectionRef = ref<CreateCloudBasicSectionExpose | null>(null)
const strategicInformation = ref<{ timezone: string; country: string }>({
  timezone: '',
  country: ''
})

const dnsTypeOptions = computed(() => [
  { label: t('cloudPhone.aliyunDns'), value: '223.5.5.5' },
  { label: t('cloudPhone.googleDns'), value: '8.8.8.8' },
  { label: t('cloudPhone.custom'), value: 'custom' }
])

// 固定分辨率选项（所有类型都支持）
const fixedResolutionOptions = ref<{ label: string; value: string }[]>(
  (ResolutionModel as readonly string[]).map((item) => ({
    label: item,
    value: item
  }))
)

// ADI分辨率选项（仅云真机支持，从机型模板获取）
const adiResolutionOptions = ref<{ label: string; value: string }[]>([])

const uploadLoading = ref(false)
const proxyEnabled = ref(false)
const createProxyForm = ref<ProxyFormModel>(createDefaultProxyForm())
const proxyMode = ref<'select' | 'custom'>('select')
const customProxyForm = ref<CustomProxyFormModel>(createDefaultCustomProxyForm())
const customProxyInfo = ref<Record<string, any> | null>(null)
const createProxyContext = ref<{ proxy: Proxy | null; proxyList: Proxy[] }>({
  proxy: null,
  proxyList: []
})
let loadingInstance: { close: () => void; setText: (text: string) => void } | null = null

const fpsOptions = [
  { label: '30', value: 30 },
  { label: '60', value: 60 }
]

/**
 * 根据当前语言获取默认 DNS
 * 中国语言（zh-CN, zh-TW, zh-HK等）：使用阿里云 DNS (223.5.5.5)
 * 其他语言：使用 Google DNS (8.8.8.8)
 * @returns 默认 DNS 地址
 */
const getDefaultDns = (): string => {
  // 获取系统语言
  const language = navigator.language || (navigator as any).userLanguage || 'en-US'

  // 判断是否是中文语言（包括简体中文、繁体中文等）
  const isChinese = /^zh/i.test(language)

  console.log('language', language, isChinese)
  // 中国语言使用阿里云 DNS，其他语言使用 Google DNS
  return isChinese ? '223.5.5.5' : '8.8.8.8'
}

/**
 * 获取表单默认数据
 * @returns 默认的表单数据对象
 */
const defaultData = () => {
  const defaultDns = getDefaultDns()

  return {
    // 品牌机型相关（仅虚拟机使用）
    adiID: '',
    adi_name: '',
    adi_pass: '',
    brand: '',
    machine_mode: 'random',
    // GMS和网络配置
    enableGms: false,
    enableGmsAutoUpdate: false,
    bool_macvlan: false,
    bool_ping_disabled: false,
    bool_start: false,
    // 基础配置
    count: 1,
    dns: defaultDns,
    dnsType: defaultDns,
    image_repository: '',
    // Macvlan网络配置
    gateway: '',
    netmask: '',
    subnet: '',
    macvlan_start_ip: '',
    // 分辨率和帧率
    fps: 30,
    resolutionStr: '', // 分辨率选择：固定分辨率、ADI分辨率或custom（自定义）
    customResolution: '', // 自定义分辨率输入（格式：宽度x高度xDPI）
    // 其他配置
    user_name: '',
    cert_hash: '',
    device_type: 'real', // 云机类型：real（云真机）或 virtual（虚拟机）
    bool_custom_properties: false,
    userProp: '',
    bool_language_country_timezone: false,
    bool_custom_cert: false,
    // 默认新加坡
    locale: 'zh',
    timezone: 'Asia/Singapore',
    country: 'SG'
  }
}

const createCloudForm = reactive<any>(defaultData())

const rules = computed(() => ({
  user_name: [
    { required: true, message: t('cloudPhone.deviceNamePlaceholder'), trigger: 'blur' },
    { min: 2, message: t('cloudPhone.deviceNameMinLength'), trigger: 'blur' },
    { max: 200, message: t('cloudPhone.deviceNameMaxLength'), trigger: 'blur' },
    {
      // 这个正则表达式的含义：允许由字母（大小写）、数字、下划线、点、短横线、@符号和中文字符组成，长度至少为1个字符，且可以是这些字符的任意组合。
      pattern: /^[a-zA-Z0-9_.@\-\u4e00-\u9fa5]+$/,
      message: t('cloudPhone.deviceNameFormat'),
      trigger: 'blur'
    }
  ],
  image_repository: [{ required: true, message: t('cloudPhone.selectImage'), trigger: 'blur' }],
  dnsType: [{ required: true, message: t('cloudPhone.selectDnsType'), trigger: 'blur' }],
  dns: [{ required: true, message: t('cloudPhone.dnsPlaceholder'), trigger: 'blur' }],
  // 品牌机型验证（仅云真机需要）
  brand: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (createCloudForm.device_type === 'real' && !value) {
          callback(new Error(t('cloudPhone.selectBrand')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
      required: true
    }
  ],
  adiID: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (createCloudForm.device_type === 'real' && !value) {
          callback(new Error(t('cloudPhone.selectModel')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
      required: true
    }
  ],
  // 自定义分辨率验证
  customResolution: [
    {
      validator: (_rule: any, value: string, callback: (error?: Error) => void) => {
        if (createCloudForm.resolutionStr === 'custom') {
          if (!value) {
            callback(new Error(t('cloudPhone.enterCustomResolution')))
          } else if (!/^\d+x\d+x\d+$/.test(value)) {
            callback(new Error(t('cloudPhone.resolutionFormatError')))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: 'blur',
      required: true
    }
  ],
  macvlan_start_ip: [
    { required: true, message: t('cloudPhone.startIpPlaceholder'), trigger: 'blur' },
    {
      pattern:
        /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      message: t('cloudPhone.invalidIpFormat'),
      trigger: 'blur'
    }
  ],
  netmask: [{ required: true, message: t('cloudPhone.netmaskPlaceholder'), trigger: 'blur' }],
  gateway: [{ required: true, message: t('cloudPhone.gatewayPlaceholder'), trigger: 'blur' }],
  subnet: [{ required: true, message: t('cloudPhone.subnetPlaceholder'), trigger: 'blur' }],
  resolutionStr: [
    {
      trigger: 'blur',
      required: true,
      message: t('cloudPhone.selectResolution')
    }
  ],
  fps: [{ required: true, message: t('cloudPhone.selectFps'), trigger: 'blur' }],
  count: [{ required: true, message: t('cloudPhone.enterDeviceCount'), trigger: 'blur' }],
  userProp: [
    {
      required: true,
      message: t('cloudPhone.enterCustomProperties'),
      trigger: ['blur', 'change']
    }
  ],
  locale: [{ required: true, message: t('cloudPhone.languagePlaceholder'), trigger: 'blur' }],
  timezone: [{ required: true, message: t('cloudPhone.timezonePlaceholder'), trigger: 'blur' }],
  country: [{ required: true, message: t('cloudPhone.regionPlaceholder'), trigger: 'blur' }],
  cert_hash: [{ required: true, message: t('cloudPhone.selectCert'), trigger: ['blur', 'change'] }]
}))

const filteredTimeZones = computed(() => {
  if (!createCloudForm.country) {
    return []
  }
  return timeZones.filter((item) => item.countryCode === createCloudForm.country)
})

const hideLocaleSection = computed(() =>
  shouldHideLocaleSection(proxyEnabled.value, createProxyForm.value.ipSimulatorDisabled)
)
const currentDeviceTypeLabel = computed(() =>
  createCloudForm.device_type === 'real'
    ? t('cloudPhone.realDevice')
    : t('cloudPhone.virtualDevice')
)
const previewNames = computed(() =>
  Array.from({ length: Number(createCloudForm.count) || 0 }, (_, index) =>
    getPreviewName(index + 1)
  )
)

// ==========================================
// 监听器（Watchers）
// ==========================================
const filteredLanguages = computed(() => {
  // 根据 languageCode 去重
  const seen = new Set<string>()
  return languages.filter((item) => !seen.has(item.languageCode) && seen.add(item.languageCode))
})
/**
 * 监听DNS类型变化，自动填充DNS地址
 */
watch(
  () => createCloudForm.dnsType,
  (val) => {
    const dns = dnsTypeOptions.value.find((item) => item.value === val)?.value ?? ''
    createCloudForm.dns = dns !== 'custom' ? dns : ''
  }
)

// 监听自定义证书开关变化
watch(
  () => createCloudForm.bool_custom_cert,
  () => {
    createCloudForm.cert_hash = ''
  }
)

/**
 * 监听地区变化，清空不匹配的时区和语言，并默认选择第一个
 */
watch(
  () => createCloudForm.country,
  (newCountry) => {
    if (newCountry) {
      const countryTimezones = timeZones.filter((item) => item.countryCode === newCountry)

      // 检查当前选择的时区是否在新地区的选项中
      const currentTimezone = createCloudForm.timezone

      const timezoneExists = countryTimezones.find((item) => item.timeZone === currentTimezone)
      if (!timezoneExists) {
        createCloudForm.timezone = countryTimezones[0]?.timeZone || ''
      }
      // 检查当前选择的语言是否在语言列表中
      const currentLanguage = createCloudForm.locale
      const languageExists = filteredLanguages.value.find(
        (item) => item.languageCode === currentLanguage
      )
      if (!languageExists) {
        createCloudForm.locale = filteredLanguages.value[0]?.languageCode || ''
      }
    } else {
      createCloudForm.locale = ''
      createCloudForm.timezone = ''
    }
  }
)

/**
 * 监听云机类型变化
 * 切换类型时，清空不属于当前类型的参数，并默认选中第一个选项
 */
watch(
  () => createCloudForm.device_type,
  async (deviceType) => {
    createCloudForm.brand = ''
    createCloudForm.adiID = ''
    createCloudForm.adi_name = ''
    createCloudForm.adi_pass = ''
    adiResolutionOptions.value = []
    // 清空分辨率相关字段
    createCloudForm.resolutionStr = ''
    createCloudForm.customResolution = ''

    // 虚拟机默认分辨率
    if (deviceType === 'virtual') {
      createCloudForm.resolutionStr = '720x1280x320'
      return
    }

    if (createCloudForm.image_repository) {
      await basicSectionRef.value?.reloadMachineSettings()
    }
  }
)

/**
 * 监听分辨率选择变化
 * 当选择非自定义时，清空自定义分辨率输入
 */
watch(
  () => createCloudForm.resolutionStr,
  (val) => {
    if (val !== 'custom') {
      createCloudForm.customResolution = ''
    }
  }
)

watch(
  () => hideLocaleSection.value,
  (value, oldValue) => {
    if (value === oldValue) {
      return
    }

    applyProxyLocaleOwnership(createCloudForm, value)
    formRef.value?.clearValidate?.(['country', 'timezone', 'locale'])
  }
)

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

const handleMachineModelChange = ({ model }: MachineModelChangePayload) => {
  if (createCloudForm.device_type !== 'real') return

  if (model?.layout) {
    createCloudForm.resolutionStr = model.layout
    createCloudForm.customResolution = ''
    updateAdiResolutionOptions(model)
    return
  }

  adiResolutionOptions.value = []
  if (fixedResolutionOptions.value.length > 0 && createCloudForm.resolutionStr !== 'custom') {
    createCloudForm.resolutionStr = fixedResolutionOptions.value[0].value
  }
}
const handleUploadAdiProgress = (percent: number) => {
  loadingInstance?.setText(t('cloudPhone.uploadingModelTemplate', { percent: percent.toFixed(0) }))
}
const handleUploadImageProgress = (percent: number) => {
  loadingInstance?.setText(t('cloudPhone.uploadingImage', { percent: percent.toFixed(0) }))
  if (percent == 100) {
    loadingInstance?.setText(t('cloudPhone.firstLoadImageTip'))
  }
}

const createLoading = () => {
  const target = document.querySelector('.create-cloud-drawer-instance') as HTMLElement
  if (target) {
    loadingInstance = ElLoading.service({
      target,
      lock: true,
      text: t('cloudPhone.creating'),
      background: 'var(--el-mask-color-extra-light)'
    })
  }
}

onUnmounted(() => {
  loadingInstance?.close()
  loadingInstance = null
})

// 获取主机网络配置

const getHostNetworkConfig = async () => {
  request
    .get(buildApiUrl(host.value?.ip || '', API_CONFIG.PATHS.GET_HOST_NETWORK_CONFIG))
    .then((res) => {
      const { gateway, host_ip, netmask, subnet } = res.data || {}
      Object.assign(createCloudForm, {
        gateway,
        host_ip,
        netmask,
        macvlan_start_ip: host_ip,
        subnet
      })
    })
}

const getImageOptions = async () => {
  await basicSectionRef.value?.refreshImageOptions()
}

/**
 * 更新ADI分辨率选项（根据选中的品牌）
 * 每个品牌只有一个ADI分辨率（所有机型共享）
 * @param brandList 品牌下的机型列表
 */
const updateAdiResolutionOptions = (model: any) => {
  if (!model?.layout) {
    adiResolutionOptions.value = []
    return
  }

  adiResolutionOptions.value = [
    {
      label: model.layout,
      value: model.layout
    }
  ]
}

// Methods
const init = (row: Host) => {
  host.value = row

  const lastCreateCloudForm = store.get(CREATE_CLOUD_FORM_KEY)

  if (lastCreateCloudForm) {
    Object.assign(createCloudForm, {
      image_repository: lastCreateCloudForm.image_repository,
      dnsType: lastCreateCloudForm.dnsType,
      device_type: lastCreateCloudForm.device_type,
      user_name: lastCreateCloudForm.user_name,
      enableGms: !lastCreateCloudForm.bool_gms_disabled,
      enableGmsAutoUpdate: lastCreateCloudForm.bool_gms_upgrade_enable,
      bool_macvlan: lastCreateCloudForm.bool_macvlan,
      bool_ping_disabled: lastCreateCloudForm.bool_ping_disabled ?? false,
      bool_start: lastCreateCloudForm.bool_start,
      count: lastCreateCloudForm.count,
      dns: lastCreateCloudForm.dns?.[0] ?? createCloudForm.dns,
      bool_custom_cert: lastCreateCloudForm.bool_custom_cert,
      bool_language_country_timezone: lastCreateCloudForm.bool_language_country_timezone,
      locale: lastCreateCloudForm.locale,
      timezone: lastCreateCloudForm.timezone,
      country: lastCreateCloudForm.country,
      resolutionStr: lastCreateCloudForm.resolutionStr,
      customResolution: lastCreateCloudForm.customResolution,
      bool_custom_properties: lastCreateCloudForm.bool_custom_properties,
      userProp: lastCreateCloudForm.userProp ? JSON.parse(lastCreateCloudForm.userProp) : '',
      fps: lastCreateCloudForm.fps
    })

    if (lastCreateCloudForm.bool_language_country_timezone) {
      obtainExportInformation()
    }
  }
  getHostNetworkConfig()

  visible.value = true
}

const handleClose = () => {
  Object.assign(createCloudForm, defaultData())
  proxyEnabled.value = false
  createProxyForm.value = createDefaultProxyForm()
  proxyMode.value = 'select'
  customProxyForm.value = createDefaultCustomProxyForm()
  customProxyInfo.value = null
  createProxyContext.value = {
    proxy: null,
    proxyList: []
  }
  strategicInformation.value = {
    timezone: '',
    country: ''
  }
  adiResolutionOptions.value = []
  formRef.value?.resetFields?.()
}

const getPreviewName = (index: number) => {
  if (createCloudForm.count === 1) return createCloudForm.user_name
  return `${createCloudForm.user_name}_${index}`
}

const handleSubmit = async () => {
  if (!formRef.value) return
  // 1️⃣ 表单校验（标准写法）
  await formRef.value.validate()
  try {
    if (proxyEnabled.value) {
      if (proxyMode.value === 'select') {
        if (!createProxyForm.value.id) {
          throw new Error(t('cloudPhone.selectProxyPlaceholder'))
        }
      } else if (!customProxyForm.value.parsed) {
        throw new Error(t('cloudPhone.parseFailed'))
      }

      // 中转代理独立于代理来源，两种模式都要校验
      if (createProxyForm.value.isTransferAgent && !createProxyForm.value.transferAgentId) {
        throw new Error(t('cloudPhone.selectTransferAgent'))
      }
    }

    createLoading()
    // 2️⃣ 校验 ADI / Image 是否已上传
    const uploads: {
      adi?: AdiWithUpload
      image?: Image
    } = {}
    const adi = basicSectionRef.value?.getSelectedModel() ?? null

    if (createCloudForm.device_type === 'real' && !adi) {
      if (createCloudForm.machine_mode === 'random') {
        throw new Error(t('cloudPhone.noAvailableModelTemplates'))
      }
      throw new Error(t('cloudPhone.selectModel'))
    }

    if (adi && !adi.isUploaded) {
      uploads.adi = adi
    }

    const image = basicSectionRef.value?.getSelectedImage()

    if (image && !image.isUploaded) {
      uploads.image = image
    }
    // 上传 adi
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
    //
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

    // 4️⃣ 解析分辨率（支持固定分辨率、ADI分辨率和自定义分辨率）
    let resolutionStr = createCloudForm.resolutionStr

    // 如果选择自定义，使用自定义分辨率输入
    if (resolutionStr === 'custom') {
      if (!createCloudForm.customResolution) {
        throw new Error(t('cloudPhone.enterCustomResolution'))
      }
      resolutionStr = createCloudForm.customResolution
    }

    // 解析分辨率格式：宽度x高度xDPI
    const [width, height, dpi] = (resolutionStr || '').split('x').map((v) => Number(v))

    if (![width, height, dpi].every(Number.isFinite)) {
      throw new Error(t('cloudPhone.resolutionFormatError'))
    }

    loadingInstance?.setText(t('cloudPhone.creating'))

    // 5️⃣ 构造提交数据
    const submitData: any = {
      // 品牌机型（仅云真机需要）
      adiName: createCloudForm.device_type === 'real' ? adi?.name : undefined,
      adiPass: createCloudForm.device_type === 'real' ? adi?.pwd : undefined,
      // GMS和网络配置
      bool_gms_disabled: !createCloudForm.enableGms,
      bool_gms_upgrade_enable: createCloudForm.enableGms
        ? createCloudForm.enableGmsAutoUpdate
        : undefined,
      bool_macvlan: createCloudForm.bool_macvlan,
      bool_ping_disabled: createCloudForm.bool_macvlan
        ? createCloudForm.bool_ping_disabled
        : undefined,
      bool_start: createCloudForm.bool_start,
      // 基础配置
      count: createCloudForm.count,
      dns: createCloudForm.dns ? [createCloudForm.dns] : [],
      image_repository: createCloudForm.image_repository,
      // Macvlan网络配置
      // macvlan_network: createCloudForm.subnet,
      macvlan_start_ip: createCloudForm.macvlan_start_ip,
      // 其他配置
      cert_hash: createCloudForm.cert_hash,
      user_name: createCloudForm.user_name,
      device_type: createCloudForm.device_type,
      locale: createCloudForm.locale,
      timezone: createCloudForm.timezone,
      country: createCloudForm.country,
      bool_language_country_timezone: createCloudForm.bool_language_country_timezone,
      bool_custom_cert: createCloudForm.bool_custom_cert,
      resolutionStr: createCloudForm.resolutionStr,
      customResolution: createCloudForm.customResolution,
      dnsType: createCloudForm.dnsType,
      fps: createCloudForm.fps,
      bool_custom_properties: createCloudForm.bool_custom_properties,
      userProp: createCloudForm.userProp ? JSON.stringify(createCloudForm.userProp) : '',
      // 分辨率配置
      resolution: {
        width,
        height,
        dpi,
        fps: createCloudForm.fps
      }
    }

    // 获取推流设置并添加到 scdArgs（JSON 字符串）
    const fpsRes = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.STREAM_FPS)
    const bitrateRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.STREAM_BITRATE
    )
    const fps = fpsRes.success && fpsRes.data ? fpsRes.data : '30'
    const bitrate = bitrateRes.success && bitrateRes.data ? bitrateRes.data : '2'
    // 码率转换为字节，1MB = 1024 * 1024 字节
    // 使用字符串形式避免 JSON.stringify 将大数字转换为科学计数法
    const bitrateBytes = parseInt(bitrate) * 1024 * 1024
    submitData.scdArgs = JSON.stringify({
      video_bit_rate: String(bitrateBytes),
      max_fps: fps
    })

    let proxy: Record<string, any> | undefined

    if (proxyEnabled.value && proxyMode.value === 'custom' && customProxyForm.value.parsed) {
      proxy = buildCustomProxyPayload(
        customProxyForm.value.parsed,
        createProxyForm.value,
        customProxyInfo.value,
        proxyEnabled.value && createProxyForm.value.ipSimulatorDisabled
          ? { ipSimulatorMode: 'custom-params', extraDataKey: 'extraData', isRestart: false }
          : undefined,
        t('proxy.parseConfigFailed'),
        createProxyContext.value.proxyList
      )
    } else {
      proxy = buildCreateProxySubmit({
        proxyEnabled: proxyEnabled.value,
        proxyForm: createProxyForm.value,
        proxyList: createProxyContext.value.proxyList,
        parseConfigFailedMessage: t('proxy.parseConfigFailed')
      })
    }

    if (proxy) {
      submitData.proxy = proxy
    }

    if (hideLocaleSection.value) {
      submitData.bool_language_country_timezone = false
      submitData.country = ''
      submitData.timezone = ''
      submitData.locale = ''
    }

    // 移除undefined字段，避免提交不必要的数据
    Object.keys(submitData).forEach((key) => {
      if (submitData[key] === undefined) {
        delete submitData[key]
      }
    })

    await request.post(
      buildApiUrl(host.value?.ip || '', API_CONFIG.PATHS.CREATE_CLOUD_PHONE),
      submitData,
      {
        timeout: 60 * 1000
      }
    )

    const persistedCreateForm = {
      ...submitData
    }

    if (hideLocaleSection.value) {
      Object.assign(persistedCreateForm, createDefaultLocaleFields())
    }

    delete persistedCreateForm.proxy

    store.set(CREATE_CLOUD_FORM_KEY, persistedCreateForm)

    // 异步保存自定义代理到代理列表
    if (proxyEnabled.value && proxyMode.value === 'custom' && customProxyForm.value.parsed) {
      saveCustomProxyWithToast(
        customProxyForm.value,
        customProxyForm.value.parsed,
        t('cloudPhone.proxySavedButFailed')
      )
    }

    ElMessage.success(t('cloudPhone.createDeviceSuccess'))
    visible.value = false
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error, t('cloudPhone.createDeviceFailed')))
  } finally {
    try {
      await getImageOptions()
    } catch (error) {
      console.error(error)
    }
    loadingInstance?.close()
    loadingInstance = null
  }
}

const handleManageLinkClick = () => {
  visible.value = false
  router.push('/image')
}

const handleManageProxyClick = () => {
  visible.value = false
  router.push('/proxy')
}

const handleProxyInfoChange = (payload: { proxy: Proxy | null; proxyList: Proxy[] } | null) => {
  createProxyContext.value = payload || {
    proxy: null,
    proxyList: []
  }
}

const handleIpSimulatorChange = () => {
  formRef.value?.clearValidate?.(['country', 'timezone', 'locale'])
}

// 获取 出口IP信息
const obtainExportInformation = async () => {
  const providerTypeRes = await ipc.invoke<string>(
    CONFIG_EVENTS.GET_CONFIGS,
    CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE
  )

  if (providerTypeRes.success && providerTypeRes.data == 'ipinfo') {
    const apiKeyRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.PROXY_CHECK_API_KEY
    )

    const response = await axios.get('https://ipinfo.io/json', {
      params: apiKeyRes.data ? { token: apiKeyRes.data } : undefined,
      timeout: 5000
    })

    const data = response?.data
    if (data) {
      // 是否找得到地区
      const countryExists = countries.some((item) => item.countryCode === data.country)
      if (!countryExists) {
        // 默认使用新加坡
        createCloudForm.country = 'SG'
        strategicInformation.value.country = 'SG'
        strategicInformation.value.timezone = 'Asia/Singapore'
        createCloudForm.timezone = 'Asia/Singapore'
        createCloudForm.locale = 'zh'
        return
      }
      strategicInformation.value.country = data.country
      createCloudForm.country = data.country

      // 找得到时区
      const timezoneExists = timeZones.some(
        (item) => item.countryCode === data.country && item.timeZone === data.timezone
      )
      if (!timezoneExists) {
        return
      }

      strategicInformation.value.timezone = data.timezone
      createCloudForm.timezone = data.timezone
    }
  }
}
const handleLanguageCountryTimezoneChange = (value: boolean) => {
  if (value) {
    if (strategicInformation.value.country && strategicInformation.value.timezone) {
      Object.assign(createCloudForm, {
        timezone: strategicInformation.value.timezone,
        country: strategicInformation.value.country
      })
      return
    }
    obtainExportInformation()
  } else {
    Object.assign(createCloudForm, createDefaultLocaleFields())
  }
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.create-cloud-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.create-cloud-drawer {
  height: 100%;
  background: var(--el-bg-color-page);
}

.create-cloud-drawer-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
}

.create-cloud-overview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.overview-item {
  min-width: 0;
}

.overview-item-right {
  text-align: right;
}

.overview-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.overview-value {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.drawer-footer-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.drawer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
</style>
