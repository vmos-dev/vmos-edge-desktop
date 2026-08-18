<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Device } from '@shared/ipc/data.types'
import { parseCSV, generateCSVTemplate, downloadCSV } from '../utils/csvParser'

const props = defineProps<{
  devices: Device[]
  variableNames: string[]
  modelValue: Map<string, Record<string, string>>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Map<string, Record<string, string>>]
}>()

const { t } = useI18n()

const rows = computed(() =>
  props.devices.map((d) => ({
    deviceId: d.id,
    deviceName: d.user_name ?? d.id,
    env: props.modelValue.get(d.id) ?? {}
  }))
)

function updateCell(deviceId: string, varName: string, value: string) {
  const newMap = new Map(props.modelValue)
  const existing = newMap.get(deviceId) ?? {}
  newMap.set(deviceId, { ...existing, [varName]: value })
  emit('update:modelValue', newMap)
}

function handleImportCSV() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    const csvRows = parseCSV(text)
    const newMap = new Map(props.modelValue)
    for (const csvRow of csvRows) {
      const deviceName = csvRow['device_name']
      const device = props.devices.find((d) => (d.user_name ?? d.id) === deviceName)
      if (!device) continue
      const env: Record<string, string> = {}
      for (const varName of props.variableNames) {
        if (csvRow[varName] !== undefined && csvRow[varName] !== '') {
          env[varName] = csvRow[varName]
        }
      }
      newMap.set(device.id, { ...(newMap.get(device.id) ?? {}), ...env })
    }
    emit('update:modelValue', newMap)
  }
  input.click()
}

function handleDownloadTemplate() {
  const template = generateCSVTemplate(
    props.devices.map((d) => d.user_name ?? d.id),
    props.variableNames
  )
  downloadCSV(template, 'batch-variables-template.csv')
}
</script>

<template>
  <div class="param-config">
    <div class="param-toolbar">
      <el-button size="small" @click="handleImportCSV">
        {{ t('taskCenter.batchExecute.importCsv') }}
      </el-button>
      <el-button size="small" @click="handleDownloadTemplate">
        {{ t('taskCenter.batchExecute.downloadTemplate') }}
      </el-button>
      <span class="param-hint">{{ t('taskCenter.batchExecute.defaultValueHint') }}</span>
    </div>

    <div class="param-table">
      <el-table :data="rows" border stripe max-height="380" style="width: 100%">
        <el-table-column prop="deviceName" label="Device" width="160" fixed />
        <el-table-column
          v-for="varName in variableNames"
          :key="varName"
          :label="varName"
          min-width="140"
        >
          <template #default="{ row }">
            <el-input
              :model-value="row.env[varName] ?? ''"
              :placeholder="t('taskCenter.batchExecute.notFilled')"
              size="small"
              @update:model-value="(val: string) => updateCell(row.deviceId, varName, val)"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.param-config {
  min-height: 200px;
}

.param-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.param-toolbar .el-button {
  border-radius: 6px !important;
}

.param-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-left: auto;
}

.param-table {
  border-radius: var(--app-radius-base);
  overflow: hidden;
}

.param-table :deep(.el-table) {
  border-radius: var(--app-radius-base);
}

.param-table :deep(.el-table th) {
  font-weight: 600;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}

.param-table :deep(.el-input__wrapper) {
  border-radius: 6px;
}
</style>
