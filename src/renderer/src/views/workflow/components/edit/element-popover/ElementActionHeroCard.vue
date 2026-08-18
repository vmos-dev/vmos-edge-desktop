<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ElIcon } from 'element-plus'
import { ArrowRight } from '@element-plus/icons-vue'
import type { ElementRecommendationCard } from './types'

defineProps<{
  model: ElementRecommendationCard
}>()

defineEmits<{
  (e: 'apply', recommendation: ElementRecommendationCard['rec']): void
}>()
const { t } = useI18n()

function colorMix(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}
</script>

<template>
  <button
    type="button"
    class="hero-card"
    :style="{
      '--hero-accent': model.style.c500,
      '--hero-accent-light': colorMix(model.style.c500, 12),
      '--hero-accent-border': colorMix(model.style.c500, 30)
    }"
    @click="$emit('apply', model.rec)"
  >
    <div class="card-glass"></div>
    <div class="header">
      <span class="eyebrow-badge"> {{ t('workflow.heroCard.smartRecommend') }} </span>
      <span class="helper">{{ model.helperText }}</span>
    </div>

    <div class="main-content">
      <div class="icon-section">
        <div class="icon-blob">
          <ElIcon :size="16" class="action-icon">
            <component :is="model.style.icon" />
          </ElIcon>
        </div>
      </div>

      <div class="text-section">
        <h3 class="title">{{ model.title }}</h3>
        <p class="reason">{{ model.reason }}</p>
      </div>
    </div>

    <div class="footer">
      <span class="action-chip">{{ model.actionLabel }}</span>
      <div class="apply-hint">
        {{ t('workflow.heroCard.clickToApply') }} <ElIcon><ArrowRight /></ElIcon>
      </div>
    </div>
  </button>
</template>

<style scoped>
.hero-card {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent);
  border-radius: 10px;
  background: var(--el-bg-color);
  cursor: pointer;
  text-align: left;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
  font-family: var(--app-font-family);
  overflow: hidden;
}

.hero-card:hover {
  transform: translateY(-1px);
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.eyebrow-badge {
  font-size: 9px;
  font-weight: 700;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 1px 6px;
  border-radius: 4px;
}

.main-content {
  display: flex;
  gap: 10px;
  align-items: center;
}

.icon-blob {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary);
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.action-icon {
  color: #ffffff !important;
}

.hero-card:hover .icon-blob {
  transform: scale(1.05);
}

.text-section {
  flex: 1;
  min-width: 0;
}

.title {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.reason {
  margin: 1px 0 0;
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.3;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0;
  padding-top: 6px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.action-chip {
  font-size: 10px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-light);
  padding: 1px 6px;
  border-radius: 4px;
}

.apply-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
  transition: gap 0.2s ease;
}

.hero-card:hover .apply-hint {
  gap: 8px;
}

.helper {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

html.dark .hero-card {
  background: linear-gradient(
    to bottom right,
    color-mix(in srgb, var(--el-bg-color) 95%, white 5%),
    var(--el-bg-color)
  );
}

.card-glass {
  display: none;
}

.pulse-dot {
  display: none;
}
</style>
