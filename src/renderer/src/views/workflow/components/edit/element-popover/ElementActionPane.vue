<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ActionRule } from '../../../types'
import type { ElementActionListItem, ElementRecommendationCard } from './types'
import ElementActionHeroCard from './ElementActionHeroCard.vue'
import ElementActionList from './ElementActionList.vue'

defineProps<{
  recommendation: ElementRecommendationCard | null
  actions: ElementActionListItem[]
}>()

defineEmits<{
  (e: 'apply-recommendation', recommendation: ElementRecommendationCard['rec']): void
  (e: 'apply-action', rule: ActionRule): void
}>()
const { t } = useI18n()
</script>

<template>
  <div class="action-pane">
    <ElementActionHeroCard
      v-if="recommendation"
      :model="recommendation"
      @apply="$emit('apply-recommendation', $event)"
    />

    <section v-if="actions.length" class="section">
      <div class="section-title">{{ t('workflow.actionPane.otherActions') }}</div>
      <ElementActionList :items="actions" @apply="$emit('apply-action', $event)" />
    </section>

    <div v-else-if="!recommendation" class="empty-state">
      {{ t('workflow.actionPane.noRecommendation') }}
    </div>
  </div>
</template>

<style scoped>
.action-pane {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--el-text-color-placeholder);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-left: 2px;
}

.empty-state {
  padding: 32px 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.empty-state::before {
  content: '✨';
  font-size: 24px;
  opacity: 0.5;
}
</style>
