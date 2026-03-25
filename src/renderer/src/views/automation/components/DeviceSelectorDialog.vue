<template>
  <vmos-dialog
    v-model="visible"
    :title="t('automation.deviceSelector.title')"
    width="480px"
    class="device-selector-dialog"
    destroy-on-close
    append-to-body
  >
    <div class="selector-content">
      <div class="search-box">
        <el-input
          v-model="searchText"
          :placeholder="t('automation.deviceSelector.searchPlaceholder')"
          :prefix-icon="Search"
          clearable
        />
      </div>

      <div class="device-list-container">
        <el-scrollbar max-height="400px">
          <div v-if="filteredGroups.length === 0" class="empty-state">
            <el-empty :description="t('automation.deviceSelector.emptyRunning')" />
          </div>
          <div v-else class="host-group" v-for="group in filteredGroups" :key="group.hostIp">
            <div class="group-header" @click="toggleGroup(group.hostIp)">
              <div class="header-left">
                <el-icon class="folder-icon"><Monitor /></el-icon>
                <span class="host-ip">{{
                  t('automation.deviceSelector.hostIp', { ip: group.hostIp })
                }}</span>
                <el-tag size="small" type="info" round class="device-count">
                  {{ t('automation.deviceSelector.deviceCount', { count: group.devices.length }) }}
                </el-tag>
              </div>
              <el-icon
                :class="['arrow-icon', { 'is-collapsed': collapsedGroups.has(group.hostIp) }]"
              >
                <ArrowDown />
              </el-icon>
            </div>
            <div class="device-items" v-show="!collapsedGroups.has(group.hostIp)">
              <div
                v-for="device in group.devices"
                :key="device.id"
                class="device-item"
                :class="{ 'is-selected': selectedDeviceId === device.id }"
                @click="handleSelect(device)"
              >
                <div class="item-left">
                  <div class="radio-wrapper">
                    <div class="custom-radio">
                      <div class="inner-circle" v-if="selectedDeviceId === device.id"></div>
                    </div>
                  </div>
                  <div class="device-icon">
                    <el-icon><Iphone /></el-icon>
                  </div>
                  <div class="device-info">
                    <div
                      class="device-name"
                      :title="device.user_name || t('automation.deviceSelector.unnamed')"
                    >
                      {{ device.user_name || t('automation.deviceSelector.unnamed') }}
                    </div>
                    <div
                      class="device-id"
                      :title="`${t('automation.deviceSelector.idPrefix')}: ${device.db_id || device.id}`"
                    >
                      {{ t('automation.deviceSelector.idPrefix') }}: {{ device.db_id || device.id }}
                    </div>
                  </div>
                </div>
                <div class="item-right">
                  <span class="status-dot online"></span>
                  <span class="status-text">{{ t('common.online') }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmSelection" :disabled="!tempSelectedDevice">
          {{ t('common.confirm') }}
        </el-button>
      </div>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search, Monitor, ArrowDown, Iphone } from '@element-plus/icons-vue'
import { useCloudTree } from '../../cloudPhone/hooks/useCloudTree'
import { DeviceState, type Device } from '@shared/ipc/data.types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  currentDeviceId?: string
}>()

const emit = defineEmits(['update:modelValue', 'select'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const searchText = ref('')
const selectedDeviceId = ref<string | undefined>(props.currentDeviceId)
const tempSelectedDevice = ref<Device | null>(null)
const collapsedGroups = ref<Set<string>>(new Set())

const { treeData } = useCloudTree()

// 按照主机 IP 分组，且只保留运行中的设备
const groupedDevices = computed(() => {
  const groups: Record<string, Device[]> = {}

  // 递归查找所有设备
  const collectRunningDevices = (nodes: any[]) => {
    nodes.forEach((node) => {
      if (node.type === 'device') {
        const device = node.originalData as Device
        // 只要运行中的云机
        if (device.state === DeviceState.StateRunning) {
          const hostIp = device.host_ip || t('automation.deviceSelector.unknownHost')
          if (!groups[hostIp]) {
            groups[hostIp] = []
          }
          groups[hostIp].push(device)
        }
      } else if (node.children) {
        collectRunningDevices(node.children)
      }
    })
  }

  collectRunningDevices(treeData.value)

  return Object.entries(groups).map(([hostIp, devices]) => ({
    hostIp,
    devices
  }))
})

const filteredGroups = computed(() => {
  const query = searchText.value.toLowerCase().trim()
  if (!query) return groupedDevices.value

  return groupedDevices.value
    .map((group) => {
      const matchesHost = group.hostIp.toLowerCase().includes(query)
      const filteredDevices = group.devices.filter(
        (device) =>
          device.user_name?.toLowerCase().includes(query) ||
          device.id.toLowerCase().includes(query) ||
          device.db_id?.toLowerCase().includes(query) ||
          device.short_id?.toLowerCase().includes(query)
      )

      if (matchesHost) return group
      if (filteredDevices.length > 0) {
        return { ...group, devices: filteredDevices }
      }
      return null
    })
    .filter((group) => group !== null) as any[]
})

const toggleGroup = (hostIp: string) => {
  if (collapsedGroups.value.has(hostIp)) {
    collapsedGroups.value.delete(hostIp)
  } else {
    collapsedGroups.value.add(hostIp)
  }
}

const handleSelect = (device: Device) => {
  selectedDeviceId.value = device.id
  tempSelectedDevice.value = device
}

const confirmSelection = () => {
  if (tempSelectedDevice.value) {
    emit('select', tempSelectedDevice.value)
    visible.value = false
  }
}

watch(
  () => props.currentDeviceId,
  (val) => {
    selectedDeviceId.value = val
  }
)
</script>

<style scoped lang="scss">
.device-selector-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.selector-content {
  padding: 16px;
  background-color: var(--el-bg-color-page);
}

.search-box {
  margin-bottom: 16px;
}

.device-list-container {
  background-color: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  overflow: hidden;
}

.host-group {
  border-bottom: 1px solid var(--el-border-color-lighter);
  &:last-child {
    border-bottom: none;
  }
}

.group-header {
  height: 40px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background-color: var(--el-fill-color-extra-light);
  user-select: none;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .folder-icon {
      color: var(--el-text-color-secondary);
      font-size: 16px;
    }

    .host-ip {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .device-count {
      height: 18px;
      padding: 0 6px;
      font-size: 11px;
    }
  }

  .arrow-icon {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    transition: transform 0.3s;
    &.is-collapsed {
      transform: rotate(-90deg);
    }
  }
}

.device-items {
  .device-item {
    height: 56px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    transition: all 0.2s;
    border-left: 3px solid transparent;

    &:hover {
      background-color: var(--el-fill-color-extra-light);
    }

    &.is-selected {
      border-left-color: var(--el-color-primary);

      .custom-radio {
        border-color: var(--el-color-primary);
      }
    }

    .item-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .radio-wrapper {
      display: flex;
      align-items: center;
    }

    .custom-radio {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 1px solid var(--el-border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #fff;

      .inner-circle {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--el-color-primary);
      }
    }

    .device-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background-color: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }

    .device-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;

      .device-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--el-text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .device-id {
        font-size: 11px;
        color: var(--el-text-color-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .item-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        &.online {
          background-color: var(--el-color-success);
        }
      }

      .status-text {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}

.empty-state {
  padding: 40px 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
