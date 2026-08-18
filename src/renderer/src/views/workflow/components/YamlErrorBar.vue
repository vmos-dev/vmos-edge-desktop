<script setup lang="ts">
/**
 * YamlErrorBar · YAML 校验失败时的提示条
 *
 * 单一职责:列出解析 / 语法 / 结构错误
 * 父级控制显隐(基于 errors.length)
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  errors: readonly string[]
  title?: string
}

const props = defineProps<Props>()
const { t } = useI18n()

const displayTitle = computed(() => props.title || t('workflow.yamlErrorBar.defaultTitle'))
</script>

<template>
  <div class="yaml-error-bar" role="alert" aria-live="assertive">
    <div class="err-title">⚠ {{ displayTitle }}</div>
    <div v-for="(err, idx) in errors" :key="idx" class="err-line">
      {{ err }}
    </div>
  </div>
</template>

<style scoped>
.yaml-error-bar {
  padding: 10px 14px;
  background: var(--el-color-danger-light-9);
  border-bottom: 1px solid var(--el-color-danger-light-7);
  color: var(--el-color-danger);
  font-size: 12px;
  flex-shrink: 0;
  max-height: 140px;
  overflow-y: auto;
}
.err-title {
  font-weight: 600;
  margin-bottom: 4px;
}
.err-line {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 2px 0 2px 20px;
  color: var(--el-color-danger-dark-2);
}
</style>
