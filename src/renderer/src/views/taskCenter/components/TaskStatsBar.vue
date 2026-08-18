<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  stats: { total: number; running: number; done: number; cancelled: number }
}>()

const { t } = useI18n()
</script>

<template>
  <div class="stats-bar">
    <div class="stat-card">
      <div class="stat-icon total">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">{{ t('taskCenter.stats.total') }}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon running">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      <div class="stat-body">
        <div class="stat-value running">{{ stats.running }}</div>
        <div class="stat-label">{{ t('taskCenter.stats.running') }}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon done">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div class="stat-body">
        <div class="stat-value done">{{ stats.done }}</div>
        <div class="stat-label">{{ t('taskCenter.stats.done') }}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon cancelled">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </div>
      <div class="stat-body">
        <div class="stat-value cancelled">{{ stats.cancelled }}</div>
        <div class="stat-label">{{ t('taskCenter.status.cancelled') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--app-padding-base);
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--app-radius-base);
  padding: 16px 18px;
  box-shadow: var(--app-shadow-base);
  transition: all 0.3s ease;
}

.stat-card:hover {
  box-shadow: var(--app-shadow-hover);
  transform: translateY(-1px);
}

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 18px;
  height: 18px;
}

.stat-icon.total {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.stat-icon.running {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.stat-icon.done {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.stat-icon.cancelled {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.stat-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.2;
  letter-spacing: -0.5px;
}

.stat-value.running {
  color: var(--el-color-primary);
}

.stat-value.done {
  color: var(--el-color-success);
}

.stat-value.cancelled {
  color: var(--el-color-info);
}

.stat-label {
  font-size: var(--app-text-small-size);
  color: var(--el-text-color-secondary);
}
</style>
