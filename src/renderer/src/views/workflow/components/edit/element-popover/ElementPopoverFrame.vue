<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Close } from '@element-plus/icons-vue'
import { ElButton } from 'element-plus'
import type { ElementPopoverMode } from './types'

defineProps<{
  title: string
  subtitle?: string
  /** 升档提示:tier 2/3 → info,tier 4 → warn。可选,只在非 Tier 1 时由容器传入 */
  hint?: { text: string; tone: 'info' | 'warn' } | null
  mode: ElementPopoverMode
  switchLabel: string
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'toggle-mode'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="popover-frame">
    <header class="header">
      <div class="titles">
        <div class="title" :title="title">{{ title }}</div>
        <div v-if="subtitle" class="subtitle" :title="subtitle">{{ subtitle }}</div>
        <div v-if="hint" class="pick-hint" :class="`tone-${hint.tone}`" :title="hint.text">
          {{ hint.text }}
        </div>
      </div>

      <ElButton
        class="close-btn"
        :icon="Close"
        size="small"
        link
        :title="t('workflow.elementPopover.close')"
        :aria-label="t('workflow.elementPopover.close')"
        @click="$emit('close')"
      />
    </header>

    <div class="body">
      <slot />
    </div>

    <footer class="footer">
      <button type="button" class="switch-btn" @click="$emit('toggle-mode')">
        {{ switchLabel }}
      </button>
      <span class="hint">{{ t('workflow.elementPopover.escClose') }}</span>
    </footer>
  </div>
</template>

<style scoped>
.popover-frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--el-bg-color);
}

.header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.titles {
  min-width: 0;
  flex: 1;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitle {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-family: 'SF Mono', 'Menlo', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 升档提示(Tier 2/3/4) —— 不干扰 Tier 1 的常规路径 */
.pick-hint {
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-hint.tone-info {
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  color: var(--el-color-primary);
}

.pick-hint.tone-warn {
  background: color-mix(in srgb, var(--el-color-danger) 14%, transparent);
  color: var(--el-color-danger);
}

.close-btn {
  flex-shrink: 0;
  margin-top: -2px;
}

.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.switch-btn {
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-color-primary);
  cursor: pointer;
}

.switch-btn:hover,
.switch-btn:focus-visible {
  text-decoration: underline;
  outline: none;
}

.hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  font-family: 'SF Mono', 'Menlo', monospace;
}
</style>
