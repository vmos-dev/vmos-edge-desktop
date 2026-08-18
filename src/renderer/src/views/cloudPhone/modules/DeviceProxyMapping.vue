<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import { ArrowRight, Connection } from '@element-plus/icons-vue'
import { ElTable } from 'element-plus'
import type { Device, Proxy } from '@shared/ipc/data.types'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    devices: Device[]
    proxyList: Proxy[]
    modelValue: Record<string, string>
    disabled?: boolean
    checkingSet?: Set<string>
  }>(),
  {
    disabled: false,
    checkingSet: () => new Set()
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>]
  'check-proxy': [deviceDbId: string, proxyId: string]
}>()

const { t } = useI18n()
const tableRef = ref<InstanceType<typeof ElTable>>()
const allExpanded = ref(false)

const proxyMap = computed(() => {
  const map = new Map<string, Proxy>()
  for (const p of props.proxyList) {
    map.set(p.id, p)
  }
  return map
})

const getDeviceProxy = (row: Device): Proxy | undefined => {
  const proxyId = props.modelValue[row.db_id || '']
  return proxyId ? proxyMap.value.get(proxyId) : undefined
}

const hasExitInfo = (row: Device): boolean => {
  const p = getDeviceProxy(row)
  return !!(p && (p.ip || p.country || p.timezone || p.loc))
}

const toggleExpandAll = () => {
  const next = !allExpanded.value
  allExpanded.value = next
  props.devices.forEach((device) => {
    tableRef.value?.toggleRowExpansion(device, next)
  })
}

const updateDeviceProxy = (dbId: string, proxyId: string) => {
  emit('update:modelValue', { ...props.modelValue, [dbId]: proxyId })
}

const handleCheckProxy = (row: Device) => {
  const proxyId = props.modelValue[row.db_id || '']
  if (!proxyId) return
  tableRef.value?.toggleRowExpansion(row, true)
  emit('check-proxy', row.db_id || '', proxyId)
}

const headerCellStyle: CSSProperties = {
  backgroundColor: 'var(--el-fill-color-lighter)',
  color: 'var(--el-text-color-secondary)',
  fontWeight: '600',
  fontSize: '12px'
}

defineExpose({})
</script>

<template>
  <el-table
    ref="tableRef"
    :data="devices"
    row-key="db_id"
    size="small"
    max-height="300"
    :border="false"
    :header-cell-style="headerCellStyle"
    class="device-proxy-table"
  >
    <el-table-column type="expand" width="36">
      <template #header>
        <button
          class="expand-all-btn"
          :class="{ 'is-expanded': allExpanded }"
          @click="toggleExpandAll"
        >
          <el-icon :size="12"><ArrowRight /></el-icon>
        </button>
      </template>
      <template #default="{ row }">
        <div v-if="hasExitInfo(row)" class="exit-panel">
          <div class="exit-grid">
            <div class="exit-item">
              <span class="exit-label">{{ t('proxy.ip') }}</span>
              <span class="exit-value">{{ getDeviceProxy(row)?.ip || '-' }}</span>
            </div>
            <div class="exit-item">
              <span class="exit-label">{{ t('cloudPhone.regionLabel') }}</span>
              <span class="exit-value">{{ getDeviceProxy(row)?.country || '-' }}</span>
            </div>
            <div class="exit-item">
              <span class="exit-label">{{ t('cloudPhone.timezoneLabel') }}</span>
              <span class="exit-value">{{ getDeviceProxy(row)?.timezone || '-' }}</span>
            </div>
            <div class="exit-item">
              <span class="exit-label">{{ t('cloudPhone.locLabel') }}</span>
              <span class="exit-value">{{ getDeviceProxy(row)?.loc || '-' }}</span>
            </div>
          </div>
        </div>
        <div v-else class="exit-empty">{{ t('cloudPhone.noExitInfo') }}</div>
      </template>
    </el-table-column>
    <el-table-column
      prop="user_name"
      :label="t('cloudPhone.batchProxyDeviceName')"
      min-width="160"
      show-overflow-tooltip
    />
    <el-table-column :label="t('cloudPhone.batchProxySelectProxy')" min-width="220">
      <template #default="{ row }">
        <el-select
          :model-value="modelValue[row.db_id || '']"
          filterable
          :placeholder="t('cloudPhone.batchProxySelectProxy')"
          :disabled="disabled"
          size="small"
          style="width: 100%"
          @update:model-value="(val: string) => updateDeviceProxy(row.db_id || '', val)"
        >
          <el-option
            v-for="item in proxyList"
            :key="item.id"
            :label="`${item.name}(${item.host}:${item.port})`"
            :value="item.id"
          />
        </el-select>
      </template>
    </el-table-column>
    <el-table-column :label="t('common.action')" width="70" align="center">
      <template #default="{ row }">
        <el-tooltip :content="t('cloudPhone.proxyTest')" placement="top" :show-after="300">
          <el-button
            :icon="Connection"
            size="small"
            link
            type="primary"
            :loading="checkingSet.has(row.db_id || '')"
            :disabled="disabled || !modelValue[row.db_id || '']"
            @click="handleCheckProxy(row)"
          />
        </el-tooltip>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped lang="scss">
.device-proxy-table {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);

  :deep(th.el-table__cell),
  :deep(td.el-table__cell) {
    border-bottom: none;
  }

  :deep(.el-table__inner-wrapper::before) {
    display: none;
  }

  :deep(.el-table__row + .el-table__row td.el-table__cell) {
    border-top: 1px solid var(--el-border-color-extra-light);
  }

  :deep(.el-table__expanded-cell) {
    padding: 8px 12px 8px 48px;
    background: var(--el-fill-color-extra-light);
  }
}

.expand-all-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--el-fill-color);
    color: var(--el-color-primary);
  }

  .el-icon {
    transition: transform 0.2s;
  }

  &.is-expanded .el-icon {
    transform: rotate(90deg);
  }
}

.exit-panel {
  padding: 4px 0;
}

.exit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 24px;
}

.exit-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  line-height: 1.7;
}

.exit-label {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.exit-value {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exit-empty {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
