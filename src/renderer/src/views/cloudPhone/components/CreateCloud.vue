<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.createDeviceTitle', { ip: host?.ip ? ` | ${host.ip}` : '' })"
    width="650px"
    :show-close="!uploadLoading"
    class="create-cloud-dialog-instance"
    @closed="handleClose"
  >
    <div class="create-cloud-dialog">
      <el-form
        ref="formRef"
        :model="createCloudForm"
        :rules="rules"
        label-width="auto"
        label-position="top"
        class="create-cloud-form"
        @submit.prevent
      >
        <!-- Image Selection -->
        <el-form-item class="image-select-item" prop="image_repository">
          <template #label>
            <div class="label-row">
              <div>
                <span style="color: var(--el-color-danger)">*</span>
                {{ t('cloudPhone.selectImage') }}
              </div>
              <el-link
                type="primary"
                :underline="false"
                class="manage-link"
                @click="handleManageLinkClick"
                >{{ t('cloudPhone.goToImageManagement') }}</el-link
              >
            </div>
          </template>
          <ImageSelect
            v-if="visible"
            v-model="createCloudForm.image_repository"
            v-model:android-version="currentAndroidVersion"
            :host-ip="host?.ip"
            @change="handleImageChange"
            ref="imageSelectRef"
          />
        </el-form-item>

        <!-- DNS -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.dnsType')" prop="dnsType">
              <el-select v-model="createCloudForm.dnsType" style="width: 100%">
                <el-option
                  v-for="item in dnsTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.dnsAddress')" prop="dns">
              <el-input
                v-model="createCloudForm.dns"
                :placeholder="t('cloudPhone.dnsPlaceholder')"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 云机类型选择 -->
        <el-form-item :label="t('cloudPhone.deviceType')" prop="device_type" required>
          <vmos-tabs
            :tabs="[
              { label: t('cloudPhone.realDevice'), value: 'real' },
              { label: t('cloudPhone.virtualDevice'), value: 'virtual' }
            ]"
            height="38px"
            v-model="createCloudForm.device_type"
          />
        </el-form-item>

        <template v-if="createCloudForm.device_type === 'real'">
          <el-form-item prop="machine_mode" :label="t('cloudPhone.machineSettings')">
            <el-radio-group
              v-model="createCloudForm.machine_mode"
              @change="handleMachineModeChange"
            >
              <el-radio :label="t('cloudPhone.random')" value="random" />
              <el-radio :label="t('cloudPhone.custom')" value="custom" />
            </el-radio-group>
          </el-form-item>

          <!-- 品牌机型选择（仅云真机支持） -->
          <el-row :gutter="20" v-show="createCloudForm.machine_mode === 'custom'">
            <el-col :span="12">
              <el-form-item :label="t('cloudPhone.brand')" prop="brand">
                <el-select
                  v-model="createCloudForm.brand"
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
                  v-model="createCloudForm.adiID"
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

        <!-- 分辨率选择（根据云机类型显示不同选项） -->
        <el-row :gutter="20" align="bottom">
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.resolution')" prop="resolutionStr">
              <el-select
                v-model="createCloudForm.resolutionStr"
                filterable
                style="width: 100%"
                :placeholder="t('cloudPhone.resolutionPlaceholder')"
                @change="handleResolutionChange"
              >
                <!-- 自定义分辨率选项（放在最顶上，所有类型都支持） -->
                <el-option :label="t('cloudPhone.customResolution')" value="custom" />
                <!-- 机型分辨率选项（仅云真机支持，从品牌机型获取） -->
                <el-option-group
                  v-if="createCloudForm.device_type === 'real' && adiResolutionOptions.length > 0"
                  :label="t('cloudPhone.modelResolution')"
                >
                  <el-option
                    v-for="item in adiResolutionOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-option-group>
                <!-- 固定分辨率选项（所有类型都支持） -->
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
              <el-select v-model="createCloudForm.fps" style="width: 100%">
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

        <!-- 自定义分辨率输入（当选择自定义时显示） -->
        <el-row :gutter="20" v-if="createCloudForm.resolutionStr === 'custom'">
          <el-col :span="24">
            <el-form-item :label="t('cloudPhone.customResolution')" prop="customResolution">
              <el-input
                v-model="createCloudForm.customResolution"
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
              <el-checkbox v-model="createCloudForm.enableGms" :label="t('cloudPhone.enableGms')" />
            </el-form-item>
          </el-col>
          <el-col :span="6" v-if="createCloudForm.enableGms">
            <el-form-item class="no-label-item">
              <div style="display: flex; align-items: center; gap: 4px">
                <el-checkbox
                  v-model="createCloudForm.enableGmsAutoUpdate"
                  :label="t('cloudPhone.gmsAutoUpdate')"
                />
                <el-tooltip :content="t('cloudPhone.gmsAutoUpdateTip')" placement="top">
                  <span class="question-mark">?</span>
                </el-tooltip>
              </div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item style="margin-bottom: 0">
          <template #label>
            <div class="label-row">
              <span style="margin-right: 4px">{{ t('cloudPhone.regionTimezoneLanguage') }}</span>
              <el-tooltip :content="t('cloudPhone.regionTimezoneLanguageTip')" placement="top">
                <span class="question-mark">?</span>
              </el-tooltip>
              <el-switch
                v-model="createCloudForm.bool_language_country_timezone"
                @change="handleLanguageCountryTimezoneChange"
                style="margin-left: 10px"
              />
            </div>
          </template>
        </el-form-item>

        <el-row
          :gutter="20"
          v-if="createCloudForm.bool_language_country_timezone"
          style="padding-left: 10px"
        >
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.region')" prop="country">
              <el-select
                v-model="createCloudForm.country"
                filterable
                :placeholder="t('cloudPhone.regionPlaceholder')"
              >
                <el-option
                  v-for="item in countries"
                  :key="item.countryCode"
                  :label="`${isZhCN ? item.countryName : item.countryNameEnglish} (${item.countryCode})`"
                  :value="item.countryCode"
                />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.timezone')" prop="timezone">
              <el-select
                v-model="createCloudForm.timezone"
                filterable
                :placeholder="t('cloudPhone.timezonePlaceholder')"
              >
                <el-option
                  v-for="item in filteredTimeZones"
                  :key="item.timeZone"
                  :label="isZhCN ? item.displayText : item.displayTextEnglish"
                  :value="item.timeZone"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.language')" prop="locale">
              <el-select
                v-model="createCloudForm.locale"
                filterable
                :placeholder="t('cloudPhone.languagePlaceholder')"
              >
                <el-option
                  v-for="item in filteredLanguages"
                  :key="item.languageCode"
                  :label="`${isZhCN ? item.displayText : item.displayTextEnglish} (${item.languageCode})`"
                  :value="item.languageCode"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- Macvlan -->
        <el-form-item style="margin-bottom: 0">
          <template #label>
            <div class="label-row">
              <span style="margin-right: 4px">{{ t('cloudPhone.lanIp') }}</span>
              <el-tooltip :content="t('cloudPhone.lanIpTip')" placement="top">
                <span class="question-mark">?</span>
              </el-tooltip>
              <el-switch v-model="createCloudForm.bool_macvlan" style="margin-left: 10px" />
            </div>
          </template>
        </el-form-item>

        <!-- Optional fields when macvlan is enabled -->
        <el-row :gutter="20" v-if="createCloudForm.bool_macvlan" style="padding-left: 10px">
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.startIp')" prop="macvlan_start_ip">
              <el-input
                v-model="createCloudForm.macvlan_start_ip"
                :placeholder="t('cloudPhone.startIpPlaceholder')"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.netmask')" prop="netmask">
              <el-input
                v-model="createCloudForm.netmask"
                :placeholder="t('cloudPhone.netmaskPlaceholder')"
                readonly
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.gateway')" prop="gateway">
              <el-input
                v-model="createCloudForm.gateway"
                :placeholder="t('cloudPhone.gatewayPlaceholder')"
                readonly
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('cloudPhone.subnet')" prop="subnet">
              <el-input
                v-model="createCloudForm.subnet"
                :placeholder="t('cloudPhone.subnetPlaceholder')"
                readonly
                clearable
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 自定义实例属性 -->
        <el-form-item style="margin-bottom: 0">
          <template #label>
            <div class="label-row">
              <span style="margin-right: 4px">{{ t('cloudPhone.customSystemProperties') }}</span>
              <el-tooltip :content="t('cloudPhone.customSystemPropertiesTip')" placement="top">
                <span class="question-mark">?</span>
              </el-tooltip>
              <el-switch
                v-model="createCloudForm.bool_custom_properties"
                @change="createCloudForm.userProp = ''"
                style="margin-left: 10px"
              />
            </div>
          </template>
        </el-form-item>
        <el-form-item prop="userProp" v-if="createCloudForm.bool_custom_properties">
          <vmos-json v-model="createCloudForm.userProp" />
        </el-form-item>

        <el-form-item style="margin-bottom: 0" v-if="createCloudForm.device_type === 'real'">
          <template #label>
            <div class="label-row">
              <span style="margin-right: 4px">{{ t('cloudPhone.customCert') }}</span>
              <el-switch v-model="createCloudForm.bool_custom_cert" style="margin-left: 10px" />
            </div>
          </template>
        </el-form-item>
        <!-- 证书文件 -->
        <el-form-item
          :label="t('cloudPhone.certFile')"
          prop="cert_hash"
          style="margin-left: 10px"
          v-if="createCloudForm.device_type === 'real' && createCloudForm.bool_custom_cert"
        >
          <upload-cert
            v-model="createCloudForm.cert_hash"
            :host-ip="host?.ip || ''"
            v-model:upload-loading="uploadLoading"
          />
        </el-form-item>

        <!-- Name -->
        <el-form-item :label="t('cloudPhone.deviceName')" prop="user_name">
          <el-input
            v-model="createCloudForm.user_name"
            :placeholder="t('cloudPhone.deviceNamePlaceholder')"
            maxlength="200"
            show-word-limit
            clearable
          />
        </el-form-item>

        <!-- Count -->
        <el-form-item :label="t('cloudPhone.deviceCount')" prop="count">
          <div class="count-row">
            <el-input-number
              v-model="createCloudForm.count"
              :min="1"
              :max="12"
              controls-position="right"
              class="custom-input-number"
            />
            <span class="count-tip">{{ t('cloudPhone.maxCreateCount') }}</span>
            <el-checkbox v-model="createCloudForm.bool_start" :label="t('cloudPhone.autoStart')" />
          </div>
        </el-form-item>

        <!-- Preview -->
        <div class="preview-section" v-if="createCloudForm.user_name">
          <div>{{ t('cloudPhone.willCreate', { count: createCloudForm.count }) }}:</div>
          <div class="preview-list">
            <div v-for="i in createCloudForm.count" :key="i" class="preview-item">
              {{ getPreviewName(i) }}
            </div>
          </div>
        </div>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false" :disabled="uploadLoading">{{
          t('common.cancel')
        }}</el-button>
        <el-button type="primary" @click="handleSubmit" :disabled="uploadLoading">{{
          t('common.confirm')
        }}</el-button>
      </div>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, toRaw, onUnmounted, computed } from 'vue'
import { Host } from '@shared/ipc/data.types'
import { ElMessage, ElLoading } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import { Image } from '@shared/ipc/data.types'
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
import ImageSelect from './ImageSelect.vue'
import store from 'store'
import { useI18n } from 'vue-i18n'
import { useLocale } from '@renderer/hooks/useLocale'

const { t } = useI18n()
const { isZhCN } = useLocale()

const CREATE_CLOUD_FORM_KEY = 'createCloudForm'

const router = useRouter()

const host = ref<Host>()

const visible = ref(false)
const formRef = ref()
const imageSelectRef = ref()
// const imageOptions = ref<(Image & { isUploaded: boolean })[]>([]) // Unused, logic moved to child and synced via v-model if needed, but here we only need `currentAndroidVersion` for brand logic

// const imageOptions = ref<(Image & { isUploaded: boolean })[]>([]) // Still used for default selection logic in watch

const strategicInformation = ref<{ timezone: string; country: string }>({
  timezone: '',
  country: ''
})

const dnsTypeOptions = computed(() => [
  { label: t('cloudPhone.aliyunDns'), value: '223.5.5.5' },
  { label: t('cloudPhone.googleDns'), value: '8.8.8.8' },
  { label: t('cloudPhone.custom'), value: 'custom' }
])

// 品牌选项列表
const brandOptions = ref<any>([])

// 机型选项列表
const modelOptions = ref<any>([])

// 所有可用机型列表
const allAvailableModels = ref<(Adi & { isUploaded: boolean })[]>([])

// 固定分辨率选项（所有类型都支持）
const fixedResolutionOptions = ref<{ label: string; value: string }[]>([])

// ADI分辨率选项（仅云真机支持，从机型模板获取）
const adiResolutionOptions = ref<{ label: string; value: string }[]>([])

const uploadLoading = ref(false)
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
    brand: '',
    machine_mode: 'random',
    // GMS和网络配置
    enableGms: false,
    enableGmsAutoUpdate: false,
    bool_macvlan: false,
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
      // 这个正则表达式的含义：允许由字母（大小写）、数字、下划线、点、短横线和中文字符组成，长度至少为1个字符，且可以是这些字符的任意组合。
      pattern: /^[a-zA-Z0-9_.\-\u4e00-\u9fa5]+$/,
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
      validator: (_rule: any, value: string, callback: Function) => {
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
      validator: (_rule: any, value: string, callback: Function) => {
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
      validator: (_rule: any, value: string, callback: Function) => {
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
 * 监听机型变化（仅云真机）
 * 当选择机型时，自动设置对应的分辨率（如果机型有layout字段）
 */
watch(
  () => createCloudForm.adiID,
  (val) => {
    // 仅云真机需要处理机型变化
    if (createCloudForm.device_type !== 'real') return

    const model = modelOptions.value.find((item: any) => item.id == val)
    if (model && model.layout) {
      // 如果机型有layout（分辨率），自动设置为ADI分辨率
      createCloudForm.resolutionStr = model.layout
      createCloudForm.customResolution = '' // 清空自定义分辨率
      updateAdiResolutionOptions(model)
    }
  }
)

/**
 * 监听云机类型变化
 * 切换类型时，清空不属于当前类型的参数，并默认选中第一个选项
 */
watch(
  () => createCloudForm.device_type,
  async () => {
    createCloudForm.brand = ''
    createCloudForm.adiID = ''
    modelOptions.value = []
    adiResolutionOptions.value = []
    // 清空分辨率相关字段
    createCloudForm.resolutionStr = ''
    createCloudForm.customResolution = ''

    // 根据新类型重新初始化选项
    if (createCloudForm.image_repository && currentAndroidVersion.value) {
      await getBrandOptions(currentAndroidVersion.value)
    }

    // 虚拟机默认分辨率
    if (createCloudForm.device_type === 'virtual') {
      createCloudForm.resolutionStr = '720x1280x320'
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

const handleMachineModeChange = () => {
  if (createCloudForm.machine_mode === 'random') {
    randomizeModel()
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
  const target = document.querySelector('.create-cloud-dialog-instance') as HTMLElement
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

// 暴露当前选中的 Android 版本，供父组件获取品牌列表使用
const currentAndroidVersion = ref('')

const handleImageChange = (image: Image & { isUploaded: boolean }) => {
  if (image) {
    getBrandOptions(image.androidVersion)
  }
}
const getImageOptions = async (refresh: boolean = false) => {
  if (refresh) {
    await imageSelectRef.value?.getImageOptions()
  }
}

/**
 * 处理品牌变化（仅云真机）
 * 选择品牌后，自动更新机型选项和ADI分辨率选项（只显示该品牌的分辨率）
 * @param value 选中的品牌值
 */
const handleBrandChange = (value: string) => {
  // 清空机型选择
  createCloudForm.adiID = ''
  // 清空分辨率（因为品牌变化可能导致分辨率变化）
  createCloudForm.resolutionStr = ''
  createCloudForm.customResolution = ''

  // 根据品牌更新机型选项
  const brand = brandOptions.value.find((item: any) => item.brand === value)
  if (brand) {
    modelOptions.value = brand.list

    // 更新ADI分辨率选项：只显示该品牌的分辨率（每个品牌只有一个）
    updateAdiResolutionOptions(brand?.list?.[0])

    // 默认选中第一个机型
    if (modelOptions.value.length > 0) {
      createCloudForm.adiID = modelOptions.value[0].id
      // 如果第一个机型有layout，自动设置为分辨率
      if (modelOptions.value[0].layout) {
        createCloudForm.resolutionStr = modelOptions.value[0].layout
      } else if (fixedResolutionOptions.value.length > 0) {
        // 否则默认选中第一个固定分辨率
        createCloudForm.resolutionStr = fixedResolutionOptions.value[0].value
      }
    } else if (fixedResolutionOptions.value.length > 0) {
      // 如果没有机型，默认选中第一个固定分辨率
      createCloudForm.resolutionStr = fixedResolutionOptions.value[0].value
    }
  }
}

/**
 * 处理分辨率选择变化
 * @param value 选中的分辨率值
 */
const handleResolutionChange = (value: string) => {
  // 如果选择自定义，清空之前的自定义输入
  if (value === 'custom') {
    createCloudForm.customResolution = ''
  }
}

const filterAndGroupByBrand = (
  data: Adi[],
  asopVersion: string,
  adiIds: number[]
): { brand: string; list: Adi[] }[] => {
  const brandMap = new Map<string, Adi[]>()

  data.forEach((item: Adi) => {
    // ① 查询条件：镜像版本
    if (item.asopVersion !== asopVersion) return

    // ② 品牌分组
    if (!brandMap.has(item.brand)) {
      brandMap.set(item.brand, [])
    }

    brandMap.get(item.brand)!.push(item)
  })

  return Array.from(brandMap.entries()).map(([brand, list]) => ({
    brand,
    list:
      list.map((item: Adi) => ({
        ...item,
        isUploaded: adiIds.includes(Number(item.id))
      })) || ([] as Adi[])
  }))
}

/**
 * 初始化分辨率选项
 * 只初始化固定分辨率，ADI分辨率需要根据选中的品牌动态更新
 * @param data ADI数据列表（暂不使用，保留参数以保持接口一致性）
 * @param asopVersion Android版本（暂不使用，保留参数以保持接口一致性）
 */
const initResolutionOptions = (_data: Adi[], _asopVersion: string) => {
  // 初始化固定分辨率选项（所有类型都支持）
  fixedResolutionOptions.value = (ResolutionModel as readonly string[]).map((item) => ({
    label: item,
    value: item
  }))

  // ADI分辨率选项不在这里初始化，需要根据选中的品牌动态更新
  // 每个品牌只有一个ADI分辨率，只显示当前选中品牌的分辨率
  adiResolutionOptions.value = []
}

/**
 * 更新ADI分辨率选项（根据选中的品牌）
 * 每个品牌只有一个ADI分辨率（所有机型共享）
 * @param brandList 品牌下的机型列表
 */
const updateAdiResolutionOptions = (model: any) => {
  if (!model) return
  adiResolutionOptions.value = [
    {
      label: model.layout,
      value: model.layout
    }
  ]
}

const randomizeModel = () => {
  if (allAvailableModels.value.length > 0) {
    const randomIndex = Math.floor(Math.random() * allAvailableModels.value.length)
    const randomModel = allAvailableModels.value[randomIndex]
    if (randomModel) {
      createCloudForm.adiID = randomModel.id
      createCloudForm.resolutionStr = randomModel.layout
      const brand = brandOptions.value.find((item: any) => item.brand === randomModel.brand)

      if (brand) {
        modelOptions.value = brand.list
        createCloudForm.brand = brand.brand
      }
    }
  }
}
/**
 * 获取品牌选项（仅云真机需要）
 * @param asopVersion Android版本
 * @param refresh 是否为刷新操作
 */
const getBrandOptions = async (asopVersion: string) => {
  if (!asopVersion || createCloudForm.device_type !== 'real') return

  try {
    // 获取所有ADI数据
    const res = await ipc.invoke<Adi[]>(ADI_EVENTS.GET_ADIS)

    if (res.success) {
      // 初始化分辨率选项（固定分辨率和ADI分辨率）
      initResolutionOptions(res.data || [], asopVersion)

      // 获取主机已上传的机型模板列表
      const adiList = await request.get(
        buildApiUrl(host.value?.ip || '', API_CONFIG.PATHS.GET_HOST_ADI_TEMPLATE_LIST)
      )
      const adiIds = adiList?.data?.list?.map((item: any) => Number(item.adiID)) || []

      // 筛选符合当前镜像版本的机型
      allAvailableModels.value =
        res.data
          ?.filter((item: Adi) => item.asopVersion === asopVersion)
          .map((item: Adi) => ({
            ...item,
            isUploaded: adiIds.includes(Number(item.id))
          })) || []

      // 按品牌分组并标记已上传状态
      const options = filterAndGroupByBrand(res.data || [], asopVersion, adiIds)

      // 更新品牌选项
      brandOptions.value = options

      // 如果选择自定义，更新品牌选项
      if (createCloudForm.machine_mode === 'custom') {
        // 1️⃣ 确定最终 brand（找得到用自己的，找不到用第一个）
        const currentBrand =
          options.find((item) => item.brand === createCloudForm.brand) ?? options[0]

        createCloudForm.brand = currentBrand?.brand ?? ''
        modelOptions.value = currentBrand?.list ?? []

        const defaultModel = modelOptions.value?.[0]

        // 2️⃣ 在当前品牌下查找机型
        const selectedModel = modelOptions.value.find((item) => item.id === createCloudForm.adiID)

        if (selectedModel) {
          // 找得到 → 用用户的
          updateAdiResolutionOptions(selectedModel)
        } else if (defaultModel) {
          // 找不到 → 回退第一个
          createCloudForm.adiID = defaultModel.id
          createCloudForm.resolutionStr = defaultModel.layout
          updateAdiResolutionOptions(defaultModel)
        } else {
          // 没有任何机型
          createCloudForm.adiID = ''
          createCloudForm.resolutionStr = ''
          adiResolutionOptions.value = []
        }
      } else {
        randomizeModel()
      }
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t('cloudPhone.getAdiListFailed'))
  }
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
  strategicInformation.value = {
    timezone: '',
    country: ''
  }
  brandOptions.value = []
  modelOptions.value = []
  adiResolutionOptions.value = []
  fixedResolutionOptions.value = []
  currentAndroidVersion.value = ''
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
    createLoading()
    // 2️⃣ 校验 ADI / Image 是否已上传
    const uploads: {
      adi?: Adi
      image?: Image
    } = {}
    const adi = modelOptions.value.find((item: any) => item.id === createCloudForm.adiID)

    if (adi && !adi.isUploaded) {
      uploads.adi = adi
    }

    const image = imageSelectRef.value?.getSelectedImage()

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
      adiID: createCloudForm.device_type === 'real' ? Number(createCloudForm.adiID) : undefined,
      // GMS和网络配置
      bool_gms_disabled: !createCloudForm.enableGms,
      bool_gms_upgrade_enable: createCloudForm.enableGms
        ? createCloudForm.enableGmsAutoUpdate
        : undefined,
      bool_macvlan: createCloudForm.bool_macvlan,
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

    store.set(CREATE_CLOUD_FORM_KEY, submitData)

    ElMessage.success(t('cloudPhone.createDeviceSuccess'))
    visible.value = false
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error, t('cloudPhone.createDeviceFailed')))
  } finally {
    try {
      await getImageOptions(true)
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
const handleLanguageCountryTimezoneChange = (value: string) => {
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
    createCloudForm.locale = 'zh'
    createCloudForm.timezone = 'Asia/Singapore'
    createCloudForm.country = 'SG'
  }
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.create-cloud-dialog {
  padding: 10px;
  max-height: 600px;
  overflow-y: auto;
}
.dialog-header-info {
  color: var(--el-color-primary);
  margin-bottom: 10px;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.create-cloud-form {
  .image-select-item {
    :deep(.el-form-item__label) {
      width: 100% !important;
      &::before {
        display: none;
      }
    }
  }
}
.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.manage-link {
  font-size: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
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

.no-label-item {
  display: flex;
  align-items: flex-end;
  height: 100%;
  padding-bottom: 2px;
}

.count-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.count-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  flex: 1;
}

.resolution-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.preview-section {
  margin-top: 20px;
  background-color: var(--el-bg-color-page);
  padding: 10px;
  border-radius: 4px;
}

.preview-list {
  margin-top: 5px;
  max-height: 100px;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.preview-item {
  font-size: 13px;
  color: var(--el-text-color-primary);
  // 强制换行
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
}

.sub-options {
  margin-top: 10px;
  width: 100%;
}

/* Override default input number width if needed */
.custom-input-number {
  width: 120px;
}
</style>
