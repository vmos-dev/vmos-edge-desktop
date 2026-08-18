<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppInfo } from '@shared/ipc/workflow.types'

interface Props {
  app: AppInfo
  selected?: boolean
}

const props = defineProps<Props>()
defineEmits<{
  (e: 'select'): void
}>()
const { t } = useI18n()

const displaySize = computed(() => {
  if (!props.app.size) return null
  const mb = props.app.size / 1024 / 1024
  if (mb < 1) return `${Math.round(props.app.size / 1024)} KB`
  if (mb < 1024) return `${mb.toFixed(0)} MB`
  return `${(mb / 1024).toFixed(1)} GB`
})

const lastUsed = computed(() => {
  if (!props.app.lastUsedTime) return null
  const diff = Date.now() - props.app.lastUsedTime
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))
  if (days > 0) return t('workflow.appRow.daysAgo', { count: days })
  if (hours > 0) return t('workflow.appRow.hoursAgo', { count: hours })
  if (minutes > 0) return t('workflow.appRow.minutesAgo', { count: minutes })
  return t('workflow.appRow.justNow')
})

// 根据包名生成一个稳定的渐变色作为默认图标背景
const iconBg = computed(() => {
  let hash = 0
  for (let i = 0; i < props.app.packageName.length; i++) {
    hash = (hash << 5) - hash + props.app.packageName.charCodeAt(i)
    hash |= 0
  }
  const palette = [
    'linear-gradient(135deg,#60A5FA,#2563EB)',
    'linear-gradient(135deg,#F472B6,#EC4899)',
    'linear-gradient(135deg,#34D399,#10B981)',
    'linear-gradient(135deg,#FBBF24,#F59E0B)',
    'linear-gradient(135deg,#A78BFA,#7C3AED)',
    'linear-gradient(135deg,#F87171,#EF4444)'
  ]
  return palette[Math.abs(hash) % palette.length]
})

const displayInitial = computed(() => {
  const name = props.app.displayName || props.app.packageName
  return name.charAt(0).toUpperCase()
})
</script>

<template>
  <div class="app-list-row" :class="{ selected }" @click="$emit('select')">
    <div class="app-icon" :style="{ background: app.icon ? 'transparent' : iconBg }">
      <img v-if="app.icon" :src="app.icon" :alt="app.displayName" />
      <span v-else>{{ displayInitial }}</span>
    </div>
    <div class="app-info">
      <div class="app-name-row">
        <span class="app-name">{{ app.displayName || app.packageName }}</span>
        <span v-if="app.versionName" class="app-version">v{{ app.versionName }}</span>
      </div>
      <div class="app-pkg">{{ app.packageName }}</div>
      <div v-if="displaySize || lastUsed" class="app-meta-extra">
        <span v-if="displaySize" class="chip">📦 {{ displaySize }}</span>
        <span v-if="lastUsed" class="chip">🕐 {{ lastUsed }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-list-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  margin-bottom: 4px;
  background: var(--el-bg-color);
}

.app-list-row:hover {
  background: var(--el-fill-color-light);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.app-list-row.selected {
  background: color-mix(in srgb, var(--el-color-primary) 8%, var(--el-bg-color));
  border-color: var(--el-color-primary-light-3);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.app-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease;
}

.app-list-row:hover .app-icon {
  transform: scale(1.05);
}

.app-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.app-version {
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-lighter);
  padding: 1px 5px;
  border-radius: 4px;
}

.app-pkg {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  opacity: 0.7;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.app-meta-extra {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.app-meta-extra .chip {
  font-size: 11px;
  padding: 1px 6px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-placeholder);
  border-radius: 4px;
  font-weight: 500;
}
</style>
