<script setup lang="ts">
import type { Device } from '@shared/ipc/data.types'

interface Props {
  device: Device
  selected?: boolean
}

defineProps<Props>()
defineEmits<{
  (e: 'select'): void
}>()

function isMacvlan(d: Device): boolean {
  return d.network_mode === 'macvlan' || d.is_macvlan === true
}

function formatSpec(d: Device): string {
  const parts: string[] = []
  if (d.aosp_version) parts.push(`Android ${d.aosp_version}`)
  if (d.cpus) parts.push(`${d.cpus}C${d.memory ? '/' + d.memory + 'G' : ''}`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="device-row" :class="{ selected }" @click="$emit('select')">
    <span class="status-dot online" />
    <div class="thumb" />
    <div class="info">
      <div class="name">
        {{ device.user_name || device.short_id || device.id }}
        <span v-if="isMacvlan(device)" class="lan-tag">macvlan</span>
      </div>
      <div class="meta">{{ formatSpec(device) }}</div>
    </div>
  </div>
</template>

<style scoped>
.device-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  margin-bottom: 4px;
  background: var(--el-bg-color);
}

.device-row:hover {
  background: var(--el-fill-color-light);
  transform: translateY(-1px);
}

.device-row.selected {
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--el-bg-color));
  border-color: var(--el-color-primary-light-3);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.1);
}

.status-dot.online {
  background: var(--el-color-success);
  box-shadow: 0 0 8px color-mix(in srgb, var(--el-color-success) 40%, transparent);
}

.thumb {
  width: 32px;
  height: 52px;
  background: linear-gradient(180deg, #334155, #0f172a);
  border-radius: 6px;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.thumb::before {
  content: '';
  position: absolute;
  inset: 2px;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.4), rgba(167, 139, 250, 0.4));
  border-radius: 4px;
}

.info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}

.lan-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 0 4px;
  border-radius: 4px;
  margin-left: 6px;
  text-transform: uppercase;
}

.meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  opacity: 0.8;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
