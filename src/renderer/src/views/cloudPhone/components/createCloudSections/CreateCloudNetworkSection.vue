<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ProxyFormModel } from '@renderer/views/cloudPhone/services/proxyService'
import type { Proxy } from '@shared/ipc/data.types'
import type { CustomProxyFormModel } from '@renderer/components/proxy/customProxyTypes'
import CreateProxySection from '../createProxy/CreateProxySection.vue'
import CreateCloudSectionCard from './CreateCloudSectionCard.vue'

type CountryOption = {
  countryCode: string
  countryName: string
  countryNameEnglish: string
}

type TimezoneOption = {
  countryCode: string
  timeZone: string
  displayText: string
  displayTextEnglish: string
}

type LanguageOption = {
  languageCode: string
  displayText: string
  displayTextEnglish: string
}

defineProps<{
  hideLocaleSection: boolean
  dnsTypeOptions: Array<{ label: string; value: string }>
  countries: CountryOption[]
  filteredTimeZones: TimezoneOption[]
  filteredLanguages: LanguageOption[]
  isZhCN: boolean
  proxyMode: 'select' | 'custom'
  customForm: CustomProxyFormModel
}>()

const emit = defineEmits<{
  'manage-proxy': []
  'proxy-info-change': [payload: { proxy: Proxy | null; proxyList: Proxy[] } | null]
  'ip-simulator-change': [boolean]
  'locale-switch-change': [boolean]
  'update:proxyMode': ['select' | 'custom']
  'update:customForm': [CustomProxyFormModel]
  'custom-proxy-info': [Record<string, any> | null]
}>()

const { t } = useI18n()
const form = defineModel<Record<string, any>>('form', { required: true })
const proxyEnabled = defineModel<boolean>('proxyEnabled', { required: true })
const proxyForm = defineModel<ProxyFormModel>('proxyForm', { required: true })

const handleLocaleSwitchChange = (value: boolean | string | number) => {
  emit('locale-switch-change', Boolean(value))
}
</script>

<template>
  <CreateCloudSectionCard :title="t('cloudPhone.createNetworkSectionTitle')">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item :label="t('cloudPhone.dnsType')" prop="dnsType">
          <el-select v-model="form.dnsType" style="width: 100%">
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
          <el-input v-model="form.dns" :placeholder="t('cloudPhone.dnsPlaceholder')" />
        </el-form-item>
      </el-col>
    </el-row>

    <CreateProxySection
      v-model:enabled="proxyEnabled"
      v-model:form="proxyForm"
      :proxy-mode="proxyMode"
      :custom-form="customForm"
      @manage-proxy="emit('manage-proxy')"
      @proxy-info-change="emit('proxy-info-change', $event)"
      @ip-simulator-change="emit('ip-simulator-change', $event)"
      @update:proxy-mode="emit('update:proxyMode', $event)"
      @update:custom-form="emit('update:customForm', $event)"
      @custom-proxy-info="emit('custom-proxy-info', $event)"
    />

    <template v-if="!hideLocaleSection">
      <el-form-item class="toggle-form-item">
        <template #label>
          <div class="label-row">
            <span class="label-with-tip">
              <span>{{ t('cloudPhone.regionTimezoneLanguage') }}</span>
              <el-tooltip :content="t('cloudPhone.regionTimezoneLanguageTip')" placement="top">
                <span class="question-mark">?</span>
              </el-tooltip>
            </span>
            <el-switch
              v-model="form.bool_language_country_timezone"
              @change="handleLocaleSwitchChange"
            />
          </div>
        </template>
      </el-form-item>

      <el-row v-if="form.bool_language_country_timezone" :gutter="20" class="sub-grid">
        <el-col :span="12">
          <el-form-item :label="t('cloudPhone.region')" prop="country">
            <el-select
              v-model="form.country"
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
              v-model="form.timezone"
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
              v-model="form.locale"
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
    </template>

    <el-form-item class="toggle-form-item">
      <template #label>
        <div class="label-row">
          <span class="label-with-tip">
            <span>{{ t('cloudPhone.lanIp') }}</span>
            <el-tooltip :content="t('cloudPhone.lanIpTip')" placement="top">
              <span class="question-mark">?</span>
            </el-tooltip>
          </span>
          <el-switch v-model="form.bool_macvlan" />
        </div>
      </template>
    </el-form-item>

    <template v-if="form.bool_macvlan">
      <el-form-item class="toggle-form-item sub-toggle">
        <template #label>
          <div class="label-row">
            <span class="label-with-tip">
              <span>{{ t('cloudPhone.pingDisabled') }}</span>
              <el-tooltip :content="t('cloudPhone.pingDisabledTip')" placement="top">
                <span class="question-mark">?</span>
              </el-tooltip>
            </span>
            <el-switch v-model="form.bool_ping_disabled" />
          </div>
        </template>
      </el-form-item>

      <el-row :gutter="20" class="sub-grid">
        <el-col :span="12">
          <el-form-item :label="t('cloudPhone.startIp')" prop="macvlan_start_ip">
            <el-input
              v-model="form.macvlan_start_ip"
              :placeholder="t('cloudPhone.startIpPlaceholder')"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('cloudPhone.netmask')" prop="netmask">
            <el-input
              v-model="form.netmask"
              :placeholder="t('cloudPhone.netmaskPlaceholder')"
              readonly
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('cloudPhone.gateway')" prop="gateway">
            <el-input
              v-model="form.gateway"
              :placeholder="t('cloudPhone.gatewayPlaceholder')"
              readonly
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('cloudPhone.subnet')" prop="subnet">
            <el-input
              v-model="form.subnet"
              :placeholder="t('cloudPhone.subnetPlaceholder')"
              readonly
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>
    </template>
  </CreateCloudSectionCard>
</template>

<style scoped lang="scss">
.toggle-form-item {
  margin-bottom: 12px;
}

.sub-toggle {
  padding-left: 10px;
  margin-bottom: 8px;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.sub-grid {
  padding-left: 10px;
}
</style>
