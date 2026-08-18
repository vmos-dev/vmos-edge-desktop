<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton } from 'element-plus'
import { CircleCloseFilled } from '@element-plus/icons-vue'
import type { FlowEngineStatus } from '../../composables/useFlowEngineHealth'

interface Props {
  status: FlowEngineStatus
}

const props = defineProps<Props>()
const { t } = useI18n()
defineEmits<{
  (e: 'install'): void
}>()

const visible = computed(() => {
  const s = props.status
  return s === 'offline' || s === 'not-installed' || s === 'update-available'
})

const titleKey = computed(() =>
  props.status === 'update-available'
    ? 'workflow.engineBanner.updateTitle'
    : 'workflow.engineBanner.title'
)
const hintKey = computed(() =>
  props.status === 'update-available'
    ? 'workflow.engineBanner.updateHint'
    : 'workflow.engineBanner.hint'
)
const actionKey = computed(() =>
  props.status === 'update-available'
    ? 'workflow.engineBanner.update'
    : 'workflow.engineBanner.install'
)
</script>

<template>
  <div v-if="visible" class="engine-banner" role="alert" aria-live="polite">
    <span class="icon" aria-hidden="true"><CircleCloseFilled /></span>
    <span class="text">
      <strong>{{ t(titleKey) }}</strong>
      <span class="hint">{{ t(hintKey) }}</span>
    </span>
    <ElButton class="install" type="primary" size="small" @click="$emit('install')">
      {{ t(actionKey) }}
    </ElButton>
  </div>
</template>

<style scoped>
.engine-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-color-danger-light-7);
  font-size: 12.5px;
  line-height: 1.4;
  flex-shrink: 0;
  background: var(--el-color-danger-light-9);
}

.icon {
  display: inline-flex;
  font-size: 16px;
  line-height: 1;
  color: var(--el-color-danger);
}

.text {
  flex: 1;
  min-width: 0;
  color: var(--el-text-color-regular);
}

.text strong {
  font-weight: 600;
  margin-right: 6px;
  color: var(--el-color-danger);
}

.hint {
  color: var(--el-text-color-secondary);
}

.install {
  flex-shrink: 0;
}
</style>
