<script setup lang="ts">
/**
 * 编辑面板底部状态栏:步骤数 / YAML 行数 / 错误数
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  stepCount: number
  lineCount: number
  errorCount: number
}

const props = defineProps<Props>()
const { t } = useI18n()

const errorTone = computed(() => (props.errorCount > 0 ? 'err' : 'ok'))
const errorLabel = computed(() =>
  props.errorCount > 0
    ? t('workflow.statusBar.errors', { count: props.errorCount })
    : t('workflow.statusBar.noErrors')
)
</script>

<template>
  <div class="status-bar" role="status">
    <span class="seg">{{ t('workflow.statusBar.steps', { count: stepCount }) }}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span class="seg">{{ t('workflow.statusBar.lines', { count: lineCount }) }}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span class="seg" :class="errorTone">{{ errorLabel }}</span>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  font-family: 'SF Mono', 'Menlo', monospace;
  flex-shrink: 0;
}
.seg.ok {
  color: var(--el-color-success);
}
.seg.err {
  color: var(--el-color-danger);
}
.dot {
  color: var(--el-text-color-placeholder);
}
</style>
