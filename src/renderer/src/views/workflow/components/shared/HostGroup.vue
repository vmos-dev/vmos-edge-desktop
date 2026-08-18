<script setup lang="ts">
import { ref } from 'vue'
import type { Host, Device } from '@shared/ipc/data.types'
import DeviceRow from './DeviceRow.vue'

interface Props {
  host: Host
  devices: Device[]
  selectedDeviceId: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'select-device', device: Device): void
}>()

const collapsed = ref(false)

function toggle() {
  collapsed.value = !collapsed.value
}

function handleSelect(device: Device) {
  emit('select-device', device)
}
</script>

<template>
  <div class="host-group" :class="{ collapsed }">
    <div class="host-header" @click="toggle">
      <span class="chev">▾</span>
      <span class="host-status" />
      <span class="host-name">
        {{ host.name || host.ip }}
        <span class="host-ip">{{ host.ip }}</span>
      </span>
      <span class="host-count">{{ devices.length }}</span>
    </div>
    <div v-if="!collapsed" class="host-children">
      <DeviceRow
        v-for="device in props.devices"
        :key="device.id"
        :device="device"
        :selected="selectedDeviceId === device.id"
        @select="handleSelect(device)"
      />
    </div>
  </div>
</template>

<style scoped>
.host-group {
  margin-bottom: 12px;
}
.host-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s;
}
.host-header:hover {
  background: var(--el-bg-color);
}
.host-name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.host-ip {
  color: var(--el-text-color-placeholder);
  font-family: 'JetBrains Mono', monospace;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  font-size: 10.5px;
  margin-left: 6px;
}
.host-count {
  padding: 1px 6px;
  background: var(--el-fill-color);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  text-transform: none;
  letter-spacing: 0;
}
.chev {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
  transition: transform 0.15s;
}
.host-group.collapsed .chev {
  transform: rotate(-90deg);
}
.host-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-success);
  flex-shrink: 0;
}
.host-children {
  padding: 2px 0 0 8px;
}
</style>
