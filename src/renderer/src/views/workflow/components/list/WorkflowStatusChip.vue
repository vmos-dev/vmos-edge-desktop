<script setup lang="ts">
/**
 * 工作流状态 chip(卡片右上角小标签)
 *
 * 列表层只能区分:有步骤(ready)/ 空(draft)。
 * 「错误」态需要解析 YAML,不在列表层判断;打开后才会显示。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  stepCount: number
}

const props = defineProps<Props>()
const { t } = useI18n()
const isReady = computed(() => props.stepCount > 0)
</script>

<template>
  <span
    class="chip"
    :class="{ ready: isReady, draft: !isReady }"
    :title="
      isReady
        ? t('workflow.statusChip.steps', { count: stepCount })
        : t('workflow.statusChip.draft')
    "
  >
    <span class="dot" aria-hidden="true" />
    <span class="chip-label">{{
      isReady
        ? t('workflow.statusChip.steps', { count: stepCount })
        : t('workflow.statusChip.draft')
    }}</span>
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  max-width: 120px;
}
.chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.chip.ready {
  background: var(--wf-success-soft);
  color: var(--el-color-success);
}

.chip.draft {
  background: var(--wf-warning-soft);
  color: var(--el-color-warning);
}
</style>
