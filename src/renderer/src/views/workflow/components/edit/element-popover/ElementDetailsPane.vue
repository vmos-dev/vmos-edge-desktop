<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { ElementPropertyRow, SelectorStrategyRow } from './types'
import ElementPropertyList from './ElementPropertyList.vue'
import SelectorStrategyList from './SelectorStrategyList.vue'

defineProps<{
  selectorRows: SelectorStrategyRow[]
  propertyRows: ElementPropertyRow[]
}>()

const { t } = useI18n()

function handleCopy(value: string): void {
  navigator.clipboard?.writeText(value).then(() => {
    ElMessage.success(t('workflow.elementPopover.copied'))
  })
}
</script>

<template>
  <div class="details-pane">
    <section class="section">
      <div class="section-title">{{ t('workflow.elementPopover.selectorStrategy') }}</div>
      <SelectorStrategyList :rows="selectorRows" />
    </section>

    <section class="section">
      <div class="section-title">{{ t('workflow.elementPopover.elementProperties') }}</div>
      <ElementPropertyList :rows="propertyRows" @copy="handleCopy" />
    </section>
  </div>
</template>

<style scoped>
.details-pane {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 16px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.04em;
}
</style>
