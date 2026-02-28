<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.setTimeZoneLanguage')"
    :show-close="!loading"
    width="500px"
    @closed="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" label-position="top">
      <el-form-item :label="t('cloudPhone.region')" prop="country">
        <el-select v-model="form.country" filterable :placeholder="t('cloudPhone.regionPlaceholder')">
          <el-option
            v-for="item in countries"
            :key="item.countryCode"
            :label="`${isZhCN ? item.countryName : item.countryNameEnglish} (${item.countryCode})`"
            :value="item.countryCode"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('cloudPhone.timezone')" prop="timezone">
        <el-select v-model="form.timezone" filterable :placeholder="t('cloudPhone.timezonePlaceholder')">
          <el-option
            v-for="item in filteredTimeZones"
            :key="item.timeZone"
            :label="isZhCN ? item.displayText : item.displayTextEnglish"
            :value="item.timeZone"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('cloudPhone.language')" prop="locale">
        <el-select v-model="form.locale" filterable :placeholder="t('cloudPhone.languagePlaceholder')">
          <el-option
            v-for="item in filteredLanguages"
            :key="item.languageCode"
            :label="`${isZhCN ? item.displayText : item.displayTextEnglish} (${item.languageCode})`"
            :value="item.languageCode"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false" :disabled="loading">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="loading">{{ t('common.confirm') }}</el-button>
    </template>
  </vmos-dialog>
</template>
<script setup lang="ts">
import { ref, toRaw, computed, watch } from 'vue'
import { ElForm } from 'element-plus'
import { languages } from '../data/languages'
import { timeZones } from '../data/timezones'
import { countries } from '../data/countries'
import type { Device } from '@shared/ipc/data.types'
import { ElMessage, ElMessageBox } from 'element-plus'
import { request, API_CONFIG, buildApiUrl, getErrorMessage } from '@shared/api'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import { useI18n } from 'vue-i18n'
import { useLocale } from '@renderer/hooks/useLocale'

const { t } = useI18n()
const { isZhCN } = useLocale()
const visible = ref(false)
const loading = ref(false)
const form = ref({
  country: '',
  timezone: '',
  locale: ''
})
const initialForm = ref({
  country: '',
  timezone: '',
  locale: ''
})
const deviceData = ref<Device>()
const formRef = ref<InstanceType<typeof ElForm>>()
const rules = computed(() => ({
  locale: [{ required: true, message: t('cloudPhone.languagePlaceholder'), trigger: 'change' }],
  timezone: [{ required: true, message: t('cloudPhone.timezonePlaceholder'), trigger: 'change' }],
  country: [{ required: true, message: t('cloudPhone.regionPlaceholder'), trigger: 'change' }]
}))

// 根据选择的地区过滤时区
const filteredTimeZones = computed(() => {
  if (!form.value.country) {
    return []
  }
  return timeZones.filter((item) => item.countryCode === form.value.country)
})

const filteredLanguages = computed(() => {
  // 根据 languageCode 去重
  const seen = new Set<string>()
  return languages.filter((item) => !seen.has(item.languageCode) && seen.add(item.languageCode))
})

// 监听地区变化，清空不匹配的时区和语言，并默认选择第一个
watch(
  () => form.value.country,
  (newCountry) => {
    if (newCountry) {
      // 检查当前选择的时区是否在新地区的选项中
      const currentTimezone = form.value.timezone
      const timezoneExists = filteredTimeZones.value.some(
        (item) => item.timeZone === currentTimezone
      )
      if (!timezoneExists) {
        // 如果不存在，清空并默认选择第一个
        form.value.timezone = filteredTimeZones.value[0]?.timeZone || ''
      }

      // 检查当前选择的语言是否在新地区的选项中
      const currentLocale = form.value.locale
      const localeExists = filteredLanguages.value.some(
        (item) => item.languageCode === currentLocale
      )
      if (!localeExists) {
        // 如果不存在，清空并默认选择第一个
        form.value.locale = filteredLanguages.value[0]?.languageCode || ''
      }
    } else {
      // 如果地区被清空，清空时区和语言
      form.value.timezone = ''
      form.value.locale = ''
    }
  }
)

const handleClose = () => {
  formRef.value?.resetFields()
}

const handleSubmit = () => {
  formRef.value?.validate(async (valid) => {
    if (loading.value || !valid) return
    loading.value = true

    // Check changes
    const isCountryChanged = form.value.country !== initialForm.value.country
    const isLocaleChanged = form.value.locale !== initialForm.value.locale
    const isTimezoneChanged = form.value.timezone !== initialForm.value.timezone

    if (!isCountryChanged && !isLocaleChanged && !isTimezoneChanged) {
      ElMessage.warning(t('common.operationSuccess'))
      visible.value = false
      loading.value = false
      return
    }

    try {
      const promises: Promise<any>[] = []

      if (isLocaleChanged) {
        promises.push(
          request.post(
            buildApiUrl(
              deviceData.value?.host_ip || '',
              `${API_CONFIG.PATHS.SET_DEVICE_LANGUAGE}/${deviceData.value?.db_id || ''}`
            ),
            {
              country: form.value.country,
              language: form.value.locale
            }
          )
        )
      }

      if (isCountryChanged) {
        promises.push(
          request.post(
            buildApiUrl(
              deviceData.value?.host_ip || '',
              `${API_CONFIG.PATHS.SET_DEVICE_COUNTRY}/${deviceData.value?.db_id || ''}`
            ),
            {
              country: form.value.country
            }
          )
        )
      }

      if (isTimezoneChanged) {
        promises.push(
          request.post(
            buildApiUrl(
              deviceData.value?.host_ip || '',
              `${API_CONFIG.PATHS.SET_DEVICE_TIMEZONE}/${deviceData.value?.db_id || ''}`
            ),
            {
              timezone: form.value.timezone
            }
          )
        )
      }

      await Promise.all(promises)

      if (isCountryChanged) {
        ElMessageBox.confirm(
          t('cloudPhone.countryChangedRestartConfirm'),
          t('common.tips'),
          {
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel'),
            type: 'success'
          }
        )
          .then(() => {
            // 调用重启云机接口
            ipc
              .invoke<{
                restartedDevices: Device[]
                failedDevices: Device[]
              }>(DATA_EVENTS.DEVICE_RESTARTED, [toRaw(deviceData.value)])
              .then((res) => {
                if (res.success) {
                  ElMessage.success(t('common.operationSuccess'))
                } else {
                  ElMessage.error(getErrorMessage(res.error) || t('cloudPhone.restartFailed'))
                }
              })
          })
          .finally(() => {
            visible.value = false
          })
      } else {
        ElMessage.success(t('common.operationSuccess'))
        visible.value = false
      }
    } catch (error) {
      ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
    } finally {
      loading.value = false
    }
  })
}

const getDeviceCountryLanguageTimezone = async () => {
  try {
    const res = await request.get(
      buildApiUrl(
        deviceData.value?.host_ip || '',
        `${API_CONFIG.PATHS.GET_DEVICE_COUNTRY_LANGUAGE_TIMEZONE}/${deviceData.value?.db_id || ''}`
      )
    )
    // 在下拉框找不到就不回显
    const country = countries.find((item) => item.countryCode === res.data?.country)

    const data = res.data ?? {}
    if (country) {
      // 先设置地区
      form.value.country = country.countryCode

      // 然后根据地区过滤，检查时区和语言是否在该地区的选项中
      const countryTimezones = timeZones.filter((item) => item.countryCode === country.countryCode)

      const timezone = countryTimezones.find((item) => item.timeZone === data?.timezone)
      const locale = filteredLanguages.value.find(
        (item) => item.languageCode === (data.language ?? data?.locale?.split('-')?.[0] ?? '')
      )

      // 如果找到匹配的时区，使用它；否则使用第一个
      form.value.timezone = timezone?.timeZone || countryTimezones[0]?.timeZone || ''
      // 如果找到匹配的语言，使用它；否则使用第一个
      form.value.locale = locale?.languageCode || filteredLanguages.value[0]?.languageCode || ''

      // 保存初始数据
      initialForm.value = { ...data }
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error) || t('cloudPhone.getFailed'))
  }
}
defineExpose({
  init: (device: Device) => {
    deviceData.value = device
    getDeviceCountryLanguageTimezone()
    visible.value = true
  }
})
</script>
