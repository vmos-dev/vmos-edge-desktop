<script setup lang="ts">
/**
 * 编辑页底部:[保存] [运行] / 运行中 → [停止]
 *
 * 运行不可用时用 tooltip 显示 runDisabledReason,避免用户面对灰按钮不知所措。
 */
import { useI18n } from 'vue-i18n'
import { ElButton, ElTooltip } from 'element-plus'
import { VideoPlay, VideoPause, Check } from '@element-plus/icons-vue'
import type { RunState } from '../../types'

interface Props {
  runState: RunState
  canRun: boolean
  /** 运行不可用的原因(可能为 null:可用或运行中) */
  runDisabledReason?: string | null
  isDirty: boolean
  hasYamlError: boolean
  saving: boolean
}

defineProps<Props>()
const { t } = useI18n()
defineEmits<{
  (e: 'run'): void
  (e: 'stop'): void
  (e: 'save'): void
}>()
</script>

<template>
  <footer class="action-bar">
    <template v-if="runState === 'running'">
      <ElButton type="danger" size="large" :icon="VideoPause" @click="$emit('stop')">
        {{ t('workflow.actionBar.stopRun') }}
      </ElButton>
    </template>

    <template v-else>
      <ElButton
        size="large"
        :icon="Check"
        :disabled="!isDirty || hasYamlError"
        :loading="saving"
        @click="$emit('save')"
      >
        {{ isDirty ? t('workflow.actionBar.save') : t('workflow.actionBar.saved') }}
      </ElButton>
      <ElTooltip :content="runDisabledReason ?? ''" :disabled="!runDisabledReason" placement="top">
        <!-- el-button disabled 不触发 tooltip:包一层 span 让 tooltip 接管 -->
        <span>
          <ElButton
            type="success"
            size="large"
            :icon="VideoPlay"
            :disabled="!canRun"
            @click="$emit('run')"
          >
            {{ t('workflow.actionBar.run') }}
          </ElButton>
        </span>
      </ElTooltip>
    </template>
  </footer>
</template>

<style scoped>
.action-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 14px 24px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  flex-shrink: 0;
}

.action-bar :deep(.el-button--large) {
  padding: 14px 32px;
  font-size: 14px;
  font-weight: 600;
  min-width: 140px;
  border-radius: 12px;
  transition: all 0.15s ease-out;
}

.action-bar :deep(.el-button--success:not(.is-disabled)) {
  box-shadow:
    0 0 0 4px rgba(16, 185, 129, 0.12),
    0 4px 14px rgba(16, 185, 129, 0.25);
}
.action-bar :deep(.el-button--success:not(.is-disabled):hover) {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 4px rgba(16, 185, 129, 0.15),
    0 6px 20px rgba(16, 185, 129, 0.35);
}

.action-bar :deep(.el-button--danger:not(.is-disabled)) {
  background: #0f172a;
  border-color: #0f172a;
}
.action-bar :deep(.el-button--danger:not(.is-disabled):hover) {
  background: #1e293b;
  border-color: #1e293b;
}

@media (prefers-reduced-motion: reduce) {
  .action-bar :deep(.el-button--success:not(.is-disabled):hover) {
    transform: none;
  }
}
</style>
