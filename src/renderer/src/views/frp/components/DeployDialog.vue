<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Close, Loading } from '@element-plus/icons-vue'
import type { DeployProgress } from '@shared/ipc/frp.types'

const { t } = useI18n()

const props = defineProps<{
  progress: DeployProgress | null
}>()

const emit = defineEmits<{
  retry: []
  'open-ssh-config': []
}>()

const visible = defineModel<boolean>('visible', { default: false })

const steps = computed(() => {
  if (!props.progress) return []
  const total = props.progress.totalSteps
  const current = props.progress.step
  const currentStatus = props.progress.status

  return Array.from({ length: total }, (_, i) => {
    const stepNum = i + 1
    if (stepNum < current) return { status: 'done' as const }
    if (stepNum === current) return { status: currentStatus }
    return { status: 'pending' as const }
  })
})

const isDone = computed(
  () => props.progress?.step === props.progress?.totalSteps && props.progress?.status === 'done'
)
const hasError = computed(() => props.progress?.status === 'error')
const isSshError = computed(() => hasError.value && props.progress?.step === 1)

const stepLabels = [
  'frp.deploy.connecting',
  'frp.deploy.detectArch',
  'frp.deploy.uploading',
  'frp.deploy.writingConfig',
  'frp.deploy.setupService',
  'frp.deploy.openFirewall'
]
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('frp.deploy.title')"
    width="480px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="isDone || hasError"
  >
    <div class="deploy-steps">
      <div v-for="(step, index) in steps" :key="index" class="deploy-step">
        <div class="step-icon">
          <el-icon v-if="step.status === 'done'" color="var(--el-color-success)"><Check /></el-icon>
          <el-icon v-else-if="step.status === 'error'" color="var(--el-color-danger)"
            ><Close
          /></el-icon>
          <el-icon v-else-if="step.status === 'running'" class="is-loading"><Loading /></el-icon>
          <span v-else class="step-number">{{ index + 1 }}</span>
        </div>
        <span :class="['step-label', step.status]">{{ t(stepLabels[index]) }}</span>
      </div>
    </div>

    <div v-if="hasError && progress?.error" class="deploy-error">
      {{ progress.error }}
    </div>

    <template #footer>
      <div v-if="isDone" style="text-align: center">
        <el-button type="primary" @click="visible = false">
          {{ t('frp.deploy.success') }}
        </el-button>
      </div>
      <div v-else-if="hasError" style="text-align: center; display: flex; justify-content: center; gap: 12px">
        <el-button v-if="isSshError" @click="emit('open-ssh-config')">
          {{ t('frp.action.sshConfig') }}
        </el-button>
        <el-button type="primary" @click="emit('retry')">
          {{ t('frp.deploy.retry') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.deploy-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.deploy-step {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-number {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-border-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.step-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.step-label.done {
  color: var(--el-color-success);
}
.step-label.error {
  color: var(--el-color-danger);
}
.step-label.running {
  color: var(--el-color-primary);
  font-weight: 500;
}
.step-label.pending {
  color: var(--el-text-color-placeholder);
}

.deploy-error {
  margin-top: 12px;
  padding: 12px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--el-color-danger-light-9);
  border-radius: 6px;
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
}
</style>
