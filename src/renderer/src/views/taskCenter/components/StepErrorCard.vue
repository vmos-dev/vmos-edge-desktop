<script setup lang="ts">
import type { FlowStepRecord } from '@shared/ipc/flowEngine.api.types'
import { useI18n } from 'vue-i18n'

defineProps<{
  step: FlowStepRecord
}>()

const { t } = useI18n()
</script>

<template>
  <div class="step-error-card">
    <div class="error-header">
      <svg class="error-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="7" fill="var(--el-color-danger-light-7)" />
        <path
          d="M5.5 5.5l5 5M10.5 5.5l-5 5"
          stroke="var(--el-color-danger)"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <span class="error-label">Error</span>
    </div>
    <div class="error-body">
      <span class="error-text">{{ step.error }}</span>
    </div>
    <div v-if="step.screenshot" class="error-screenshot">
      <div class="screenshot-label">{{ t('taskCenter.detail.failScreenshot') }}</div>
      <el-image
        :src="step.screenshot"
        fit="contain"
        class="screenshot-img"
        :preview-src-list="[step.screenshot]"
      />
    </div>
  </div>
</template>

<style scoped>
.step-error-card {
  background: var(--el-color-danger-light-9);
  border-radius: var(--app-radius-base);
  margin-top: 10px;
  overflow: hidden;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--el-color-danger-light-8);
}

.error-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.error-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-danger);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.error-body {
  padding: 10px 14px;
}

.error-text {
  font-size: var(--app-text-small-size);
  color: var(--el-color-danger);
  line-height: 1.6;
  word-break: break-all;
}

.error-screenshot {
  padding: 0 14px 12px;
}

.screenshot-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.screenshot-img {
  max-width: 220px;
  max-height: 160px;
  border-radius: var(--app-radius-base);
  box-shadow: var(--app-shadow-base);
}
</style>
