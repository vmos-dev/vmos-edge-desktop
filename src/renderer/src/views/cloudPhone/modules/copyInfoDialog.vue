<template>
  <VmosDialog v-model="visible" :title="t('cloudPhone.copyInfo')" width="500px">
    <div class="copy-info-container">
      <div class="section-title">{{ t('cloudPhone.selectFields') }}</div>
      <el-checkbox-group v-model="selectedFields" class="fields-grid">
        <el-checkbox v-for="field in availableFields" :key="field.key" :label="field.key">
          {{ field.label }}
        </el-checkbox>
      </el-checkbox-group>

      <el-divider />

      <div class="section-title">{{ t('cloudPhone.separator') }}</div>
      <el-radio-group v-model="separator">
        <el-radio value="comma">{{ t('cloudPhone.separatorComma') }} ( , )</el-radio>
        <el-radio value="newline">{{ t('cloudPhone.separatorNewline') }} ( \n )</el-radio>
        <el-radio value="pipe">{{ t('cloudPhone.separatorPipe') }} ( | )</el-radio>
        <el-radio value="space">{{ t('cloudPhone.separatorSpace') }} ( Space )</el-radio>
      </el-radio-group>

      <div class="preview-section" v-if="previewText">
        <div class="section-title">{{ t('common.preview') }}</div>
        <el-input type="textarea" :rows="4" v-model="previewText" readonly resize="none" />
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleCopy">{{ t('common.copy') }}</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { copyToClipboard } from '@renderer/utils'
import { type Device } from '@shared/ipc/data.types'

const { t } = useI18n()
const visible = ref(false)
const devices = ref<Device[]>([])
const selectedFields = ref<string[]>(['db_id'])
const separator = ref('comma')

const availableFields = computed(() => [
  { key: 'db_id', label: t('cloudPhone.deviceId') },
  { key: 'ip', label: t('cloudPhone.deviceIp') },
  { key: 'user_name', label: t('cloudPhone.deviceName') },
  { key: 'aosp_version', label: t('cloudPhone.androidVersion') },
  { key: 'image', label: t('cloudPhone.imageVersion') }
])

const formatFieldValue = (device: Device, key: string) => {
  switch (key) {
    case 'aosp_version':
      return `Android ${device.aosp_version}`
    case 'image':
      return (device.image || '').replace(/:latest$/, '')
    default:
      return (device as any)[key] || ''
  }
}

const generateText = (limit?: number) => {
  const targetDevices = limit ? devices.value.slice(0, limit) : devices.value
  const sepMap = {
    comma: ',',
    newline: '\n',
    pipe: '|',
    space: ' '
  }
  const sep = sepMap[separator.value] || ','

  return selectedFields.value
    .map((key) => {
      return targetDevices.map((device) => formatFieldValue(device, key)).join(sep)
    })
    .join('\n')
}

const previewText = computed(() => {
  if (devices.value.length === 0 || selectedFields.value.length === 0) return ''
  return generateText(5) + (devices.value.length > 5 ? '\n...' : '')
})

const handleCopy = () => {
  const text = generateText()
  if (!text) {
    ElMessage.warning(t('cloudPhone.noData'))
    return
  }
  copyToClipboard(text, () => {
    ElMessage.success(t('common.copySuccess'))
    visible.value = false
  })
}

const init = (selectedDevices: Device[]) => {
  devices.value = selectedDevices
  visible.value = true
}

defineExpose({ init })
</script>

<style scoped lang="scss">
.copy-info-container {
  padding: 0;
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  :deep(.el-checkbox) {
    margin-right: 0;
  }
}

.preview-section {
  margin-top: 20px;
}

:deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

:deep(.el-radio) {
  margin-right: 0;
}
</style>
