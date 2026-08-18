<script setup lang="tsx">
import { ref, shallowRef, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElAutoResizer, ElTableV2, ElSwitch, ElTag, ElMessage } from 'element-plus'
import type { MappingTreeHost } from '../composables/useFrpMappings'
import type { FrpMapping, DevicePortType } from '@shared/ipc/frp.types'

const { t } = useI18n()
const ALL_DEVICE_PORTS: DevicePortType[] = ['adb', 'video', 'control', 'audio']

interface TableRow {
  id: string
  isHost: boolean
  hostIp: string
  hostName: string
  hostStatus: string
  hostEnabled: boolean
  deviceId: string
  deviceName: string
  deviceEnabled: boolean
  state: string
  mappings: FrpMapping[]
  children?: TableRow[]
}

const props = defineProps<{
  treeData: MappingTreeHost[]
  loading: boolean
  serverHost: string
  frpcRunning: boolean
  screenUrl: string
  onToggleHost: (hostIp: string, enabled: boolean) => Promise<unknown>
  onToggleDevice: (
    deviceId: string,
    hostIp: string,
    enabled: boolean,
    portTypes?: DevicePortType[]
  ) => Promise<unknown>
  onBatchToggle: (
    items: { deviceId: string; hostIp: string }[],
    enabled: boolean,
    portTypes?: DevicePortType[]
  ) => Promise<unknown>
}>()

const togglingSet = shallowRef<Set<string>>(new Set())
const expandedRowKeys = ref<string[]>([])
const knownHostKeys = new Set<string>()
const portDialogVisible = shallowRef(false)
const selectedPortTypes = ref<DevicePortType[]>([...ALL_DEVICE_PORTS])
const pendingAction = shallowRef<
  | { type: 'device'; deviceId: string; hostIp: string }
  | { type: 'batch'; hostIp: string }
  | { type: 'batchDisable'; hostIp: string }
  | null
>(null)

const treeTableData = computed<TableRow[]>(() => {
  return props.treeData.map((host) => ({
    id: `host-${host.hostIp}`,
    isHost: true,
    hostIp: host.hostIp,
    hostName: host.hostName,
    hostStatus: host.hostStatus,
    hostEnabled: host.hostEnabled,
    deviceId: '',
    deviceName: '',
    deviceEnabled: false,
    state: '',
    mappings: host.hostMappings,
    children: host.devices.map((d) => ({
      id: d.deviceId,
      isHost: false,
      hostIp: host.hostIp,
      hostName: '',
      hostStatus: '',
      hostEnabled: false,
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      deviceEnabled: d.deviceEnabled,
      state: d.state,
      mappings: d.mappings
    }))
  }))
})

watch(
  () => props.treeData,
  (hosts) => {
    const newKeys: string[] = []
    for (const h of hosts) {
      const key = `host-${h.hostIp}`
      if (!knownHostKeys.has(key)) {
        knownHostKeys.add(key)
        newKeys.push(key)
      }
    }
    if (newKeys.length) expandedRowKeys.value = [...expandedRowKeys.value, ...newKeys]
  },
  { immediate: true }
)

const addToggling = (id: string) => {
  const next = new Set(togglingSet.value)
  next.add(id)
  togglingSet.value = next
}

const removeToggling = (id: string) => {
  const next = new Set(togglingSet.value)
  next.delete(id)
  togglingSet.value = next
}

const handleToggleHost = async (hostIp: string, val: boolean) => {
  addToggling(hostIp)
  try {
    await props.onToggleHost(hostIp, val)
  } finally {
    removeToggling(hostIp)
  }
}

const handleToggleDevice = (deviceId: string, hostIp: string, val: boolean) => {
  if (val) {
    selectedPortTypes.value = [...ALL_DEVICE_PORTS]
    pendingAction.value = { type: 'device', deviceId, hostIp }
    portDialogVisible.value = true
  } else {
    addToggling(deviceId)
    props.onToggleDevice(deviceId, hostIp, false).finally(() => {
      removeToggling(deviceId)
    })
  }
}

const handleEnableAll = (hostIp: string) => {
  if (togglingSet.value.has(hostIp)) return
  const host = props.treeData.find((h) => h.hostIp === hostIp)
  if (!host?.devices.length) return
  selectedPortTypes.value = [...ALL_DEVICE_PORTS]
  pendingAction.value = { type: 'batch', hostIp }
  portDialogVisible.value = true
}

const handleDisableAll = (hostIp: string) => {
  if (togglingSet.value.has(hostIp)) return
  const host = props.treeData.find((h) => h.hostIp === hostIp)
  if (!host?.devices.length) return
  selectedPortTypes.value = [...ALL_DEVICE_PORTS]
  pendingAction.value = { type: 'batchDisable', hostIp }
  portDialogVisible.value = true
}

const confirmPortDialog = async () => {
  const action = pendingAction.value
  if (!action) return
  portDialogVisible.value = false
  const portTypes = [...selectedPortTypes.value]

  if (action.type === 'device') {
    addToggling(action.deviceId)
    try {
      await props.onToggleDevice(action.deviceId, action.hostIp, true, portTypes)
    } finally {
      removeToggling(action.deviceId)
    }
  } else if (action.type === 'batch' || action.type === 'batchDisable') {
    const host = props.treeData.find((h) => h.hostIp === action.hostIp)
    if (!host) return
    const enabled = action.type === 'batch'
    const items = host.devices.map((d) => ({ deviceId: d.deviceId, hostIp: action.hostIp }))
    const batch = new Set(togglingSet.value)
    batch.add(action.hostIp)
    for (const item of items) batch.add(item.deviceId)
    togglingSet.value = batch
    try {
      await props.onBatchToggle(items, enabled, portTypes)
    } finally {
      const after = new Set(togglingSet.value)
      after.delete(action.hostIp)
      for (const item of items) after.delete(item.deviceId)
      togglingSet.value = after
    }
  }
  pendingAction.value = null
}

const cancelPortDialog = () => {
  portDialogVisible.value = false
  pendingAction.value = null
}

const portDialogTitle = computed(() => {
  const action = pendingAction.value
  if (!action) return ''
  if (action.type === 'device') {
    const host = props.treeData.find((h) => h.hostIp === action.hostIp)
    const device = host?.devices.find((d) => d.deviceId === action.deviceId)
    return t('frp.mapping.enableDevice', { name: device?.deviceName || action.deviceId })
  }
  const hostName = props.treeData.find((h) => h.hostIp === action.hostIp)?.hostName || action.hostIp
  if (action.type === 'batch') return t('frp.mapping.batchEnable') + ' - ' + hostName
  return t('frp.mapping.batchDisable') + ' - ' + hostName
})

const portTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    management: t('frp.mapping.management'),
    adb: 'ADB',
    video: t('frp.mapping.video'),
    control: t('frp.mapping.control'),
    audio: t('frp.mapping.audio')
  }
  return map[type] || type
}

const copyRemoteAddress = (e: Event, remotePort: number) => {
  e.stopPropagation()
  const text = `${props.serverHost}:${remotePort}`
  navigator.clipboard.writeText(text)
  ElMessage({ message: t('common.copySuccess'), type: 'success', duration: 1500 })
}

const buildScreenLink = (mappings: FrpMapping[]): string | null => {
  if (!props.screenUrl) return null
  const video = mappings.find((m) => m.port_type === 'video' && m.remote_port)
  if (!video) return null
  const params = new URLSearchParams()
  params.set('video', String(video.remote_port))
  const audio = mappings.find((m) => m.port_type === 'audio' && m.remote_port)
  if (audio) params.set('audio', String(audio.remote_port))
  const control = mappings.find((m) => m.port_type === 'control' && m.remote_port)
  if (control) params.set('control', String(control.remote_port))
  return `${props.screenUrl}/?${params.toString()}`
}

const copyScreenLink = (e: Event, mappings: FrpMapping[]) => {
  e.stopPropagation()
  const link = buildScreenLink(mappings)
  if (link) {
    navigator.clipboard.writeText(link)
    ElMessage({ message: t('frp.screen.copyLinkWarn'), type: 'warning', duration: 5000 })
  }
}
// 上方按钮临时隐藏，函数保留以备启用；此处 void 引用避免 TS 未使用告警
void copyScreenLink

const hostStatusType = (status: string) => {
  if (status === 'online') return 'success'
  if (status === 'offline') return 'danger'
  return 'info'
}

const getRowClass = ({ rowData }: { rowData: TableRow }) => {
  return rowData.isHost ? 'mapping-host-row' : 'mapping-device-row'
}

const generateAdaptiveColumns = (containerWidth: number) => {
  const cols = rawColumns.value
  let totalFixedWidth = 0
  let totalFlexGrow = 0
  cols.forEach((col: any) => {
    totalFixedWidth += col.width || 0
    if (col.flexGrow) totalFlexGrow += col.flexGrow
  })
  if (containerWidth > totalFixedWidth && totalFlexGrow > 0) {
    const extra = containerWidth - totalFixedWidth
    return cols.map((col: any) => {
      if (col.flexGrow) {
        return {
          ...col,
          width: (col.width || 0) + Math.floor((extra * col.flexGrow) / totalFlexGrow)
        }
      }
      return col
    })
  }
  return cols
}

const rawColumns = computed(() => [
  {
    key: 'name',
    title: t('frp.mapping.name'),
    width: 240,
    flexGrow: 1,
    cellRenderer: ({ rowData }: any) => {
      if (rowData.isHost) {
        return <span class="m-host-label">{rowData.hostName}</span>
      }
      return <span class="m-device-label">{rowData.deviceName}</span>
    }
  },
  {
    key: 'status',
    title: t('frp.mapping.status'),
    width: 100,
    cellRenderer: ({ rowData }: { rowData: TableRow }) => {
      if (rowData.isHost) {
        return (
          <ElTag type={hostStatusType(rowData.hostStatus)} effect="light" round>
            {t(`common.hostStates.${rowData.hostStatus}`, rowData.hostStatus)}
          </ElTag>
        )
      }
      if (!rowData.state) return null
      return (
        <ElTag type={rowData.state === 'running' ? 'success' : 'info'} effect="light" round>
          {t(`common.deviceStates.${rowData.state}`, rowData.state)}
        </ElTag>
      )
    }
  },
  {
    key: 'ports',
    title: t('frp.mapping.ports'),
    width: 300,
    flexGrow: 2,
    cellRenderer: ({ rowData }: { rowData: TableRow }) => {
      if (!rowData.mappings.length) {
        return <span class="m-empty-port">&mdash;</span>
      }
      return (
        <span class="m-port-list">
          {rowData.mappings.map((m) => (
            <span class="m-port-chip" key={m.id}>
              <span class="m-port-name">{portTypeLabel(m.port_type)}</span>
              <span class="m-port-local">{m.local_port}</span>
              <span class="m-port-sep">&rarr;</span>
              {m.remote_port ? (
                <span
                  class={[
                    'm-port-remote',
                    'm-port-copyable',
                    !props.frpcRunning || m.status !== 'active' ? 'is-inactive' : ''
                  ]}
                  title={`${props.serverHost}:${m.remote_port}`}
                  onClick={(e: Event) => copyRemoteAddress(e, m.remote_port)}
                >
                  {m.remote_port}
                </span>
              ) : (
                <span class="m-port-remote is-inactive">—</span>
              )}
            </span>
          ))}
        </span>
      )
    }
  },
  {
    key: 'actions',
    title: '',
    width: 260,
    align: 'right' as const,
    cellRenderer: ({ rowData }: { rowData: TableRow }) => {
      if (rowData.isHost) {
        return (
          <span class="m-host-ops">
            <span
              class={['m-batch-btn', togglingSet.value.has(rowData.hostIp) && 'is-disabled']}
              onClick={() => handleEnableAll(rowData.hostIp)}
            >
              {t('frp.mapping.enableAll')}
            </span>
            <span class="m-batch-sep" />
            <span
              class={['m-batch-btn', togglingSet.value.has(rowData.hostIp) && 'is-disabled']}
              onClick={() => handleDisableAll(rowData.hostIp)}
            >
              {t('frp.mapping.disableAll')}
            </span>
            <ElSwitch
              modelValue={rowData.hostEnabled}
              loading={togglingSet.value.has(rowData.hostIp)}
              disabled={togglingSet.value.has(rowData.hostIp)}
              onChange={(val: boolean) => handleToggleHost(rowData.hostIp, val)}
            />
          </span>
        )
      }
      // 投屏链接按钮临时隐藏，保留 buildScreenLink / copyScreenLink 实现以备后续启用
      // const screenLink = buildScreenLink(rowData.mappings)
      return (
        <span class="m-device-ops">
          {/* {screenLink && (
            <span
              class="m-screen-btn"
              title={screenLink}
              onClick={(e: Event) => copyScreenLink(e, rowData.mappings)}
            >
              {t('frp.screen.copyLink')}
            </span>
          )} */}
          <ElSwitch
            modelValue={rowData.deviceEnabled}
            loading={togglingSet.value.has(rowData.deviceId)}
            disabled={togglingSet.value.has(rowData.deviceId)}
            onChange={(val: boolean) => handleToggleDevice(rowData.deviceId, rowData.hostIp, val)}
          />
        </span>
      )
    }
  }
])
</script>

<template>
  <div v-loading="loading" class="mapping-table-wrap">
    <ElAutoResizer>
      <template #default="{ height, width }">
        <ElTableV2
          v-model:expanded-row-keys="expandedRowKeys"
          :columns="generateAdaptiveColumns(width)"
          :data="treeTableData"
          :width="width"
          :height="height"
          :row-height="56"
          :header-height="44"
          row-key="id"
          expand-column-key="name"
          :indent-size="20"
          :row-class="getRowClass"
          fixed
          class="mapping-v2"
        />
      </template>
    </ElAutoResizer>
    <el-empty v-if="!treeData.length && !loading" />
  </div>

  <el-dialog
    v-model="portDialogVisible"
    :title="portDialogTitle"
    width="400"
    :close-on-click-modal="false"
    @close="cancelPortDialog"
  >
    <p class="port-dialog-desc">{{ t('frp.mapping.selectPortTypes') }}</p>
    <el-checkbox-group v-model="selectedPortTypes" class="port-type-group">
      <el-checkbox value="adb">ADB</el-checkbox>
      <el-checkbox value="video">{{ t('frp.mapping.video') }}</el-checkbox>
      <el-checkbox value="control">{{ t('frp.mapping.control') }}</el-checkbox>
      <el-checkbox value="audio">{{ t('frp.mapping.audio') }}</el-checkbox>
    </el-checkbox-group>
    <template #footer>
      <el-button @click="cancelPortDialog">{{ t('common.cancel') }}</el-button>
      <el-button
        type="primary"
        :disabled="selectedPortTypes.length === 0"
        @click="confirmPortDialog"
      >
        {{ t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.mapping-table-wrap {
  flex: 1;
  min-height: 0;
}

/* ── 隐藏内置展开箭头图标，只保留缩进和点击区域 ── */
.mapping-table-wrap :deep(.el-table-v2__expand-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  color: var(--el-text-color-placeholder);
  transition: all 0.2s ease;
  cursor: pointer;
}

.mapping-table-wrap :deep(.el-table-v2__expand-icon:hover) {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
}

.mapping-table-wrap :deep(.el-table-v2__expand-icon > svg) {
  transition: transform 0.2s ease;
}

.mapping-table-wrap :deep(.el-table-v2__expand-icon.is-expanded > svg) {
  transform: rotate(90deg);
}

/* ── 表头 ── */
.mapping-table-wrap :deep(.el-table-v2__header-cell) {
  background: var(--el-fill-color-lighter) !important;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.mapping-table-wrap :deep(.el-table-v2__header-cell .el-table-v2__cell-text) {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

/* ── 行 ── */
.mapping-table-wrap :deep(.el-table-v2__row) {
  border-bottom: 1px solid var(--el-border-color-extra-light);
  transition: background-color 0.15s ease;
}

.mapping-table-wrap :deep(.mapping-host-row) {
  background: var(--el-fill-color-blank);
}

.mapping-table-wrap :deep(.mapping-host-row:hover) {
  background: var(--el-fill-color-lighter);
}

.mapping-table-wrap :deep(.mapping-device-row) {
  background: var(--el-bg-color);
}

.mapping-table-wrap :deep(.mapping-device-row:hover) {
  background: var(--el-fill-color-blank);
}

/* ── 主机单元格 ── */
.mapping-table-wrap :deep(.m-host-cell) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mapping-table-wrap :deep(.m-host-label) {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* ── 设备单元格 ── */
.mapping-table-wrap :deep(.m-device-cell) {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mapping-table-wrap :deep(.m-device-label) {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

/* ── 端口映射 ── */
.mapping-table-wrap :deep(.m-port-list) {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mapping-table-wrap :deep(.m-port-chip) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 100px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  line-height: 1;
}

.mapping-table-wrap :deep(.m-port-name) {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.mapping-table-wrap :deep(.m-port-local) {
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
}

.mapping-table-wrap :deep(.m-port-sep) {
  color: var(--el-text-color-placeholder);
  font-size: 10px;
}

.mapping-table-wrap :deep(.m-port-remote) {
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
  color: var(--el-color-primary);
  font-weight: 500;
}

.mapping-table-wrap :deep(.m-port-copyable) {
  cursor: pointer;
  transition: opacity 0.15s;
}

.mapping-table-wrap :deep(.m-port-copyable:hover) {
  opacity: 0.7;
}

.mapping-table-wrap :deep(.m-port-remote.is-inactive) {
  color: var(--el-text-color-placeholder);
}

.mapping-table-wrap :deep(.m-empty-port) {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

/* ── 操作列 ── */
.mapping-table-wrap :deep(.m-host-ops) {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-right: 15px;
}

.mapping-table-wrap :deep(.m-batch-btn) {
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.mapping-table-wrap :deep(.m-batch-btn:hover) {
  opacity: 0.7;
}

.mapping-table-wrap :deep(.m-batch-btn.is-disabled) {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
  pointer-events: none;
}

.mapping-table-wrap :deep(.m-batch-sep) {
  width: 1px;
  height: 12px;
  background: var(--el-border-color-lighter);
  flex-shrink: 0;
}

.mapping-table-wrap :deep(.m-device-ops) {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-right: 15px;
}

.mapping-table-wrap :deep(.m-screen-btn) {
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
  user-select: none;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.mapping-table-wrap :deep(.m-screen-btn:hover) {
  opacity: 0.7;
}

/* ── 对话框 ── */
.port-dialog-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0 0 16px;
}

.port-type-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 24px;
}
</style>
