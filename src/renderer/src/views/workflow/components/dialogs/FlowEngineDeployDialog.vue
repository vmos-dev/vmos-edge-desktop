<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElInput, ElButton, ElIcon } from 'element-plus'
import { Loading, SuccessFilled, CircleCloseFilled, Monitor } from '@element-plus/icons-vue'
import VmosDialog from '@renderer/components/dialog/index.vue'
import { ipc } from '@renderer/core/ipc'
import {
  FLOW_ENGINE_EVENTS,
  type CheckUpdateResult,
  type DeployProgress,
  type DeployResult,
  type DeployStep,
  type FlowEngineInstallStrategy
} from '@shared/ipc/flowEngine.types'

interface Props {
  hostIp: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>({ required: true })
const { t } = useI18n()

const password = shallowRef('')
const phase = shallowRef<'input' | 'deploying' | 'success' | 'error'>('input')
type DeployUiStep = 'checking' | DeployStep
const currentStep = shallowRef<DeployUiStep | null>(null)
const stepDetail = shallowRef('')
const errorMsg = shallowRef('')
const resultVersion = shallowRef('')
const resultMessage = shallowRef('')
const deployStrategy = shallowRef<FlowEngineInstallStrategy>('install')

const DEPLOY_STEP_KEYS: Record<DeployUiStep, string> = {
  checking: 'workflow.deploy.checkingVersion',
  connecting: 'workflow.deploy.connecting',
  uploading: 'workflow.deploy.uploading',
  installing: 'workflow.deploy.installing',
  verifying: 'workflow.deploy.verifying'
}

const STEP_ORDER: DeployUiStep[] = [
  'checking',
  'connecting',
  'uploading',
  'installing',
  'verifying'
]

const stepIndex = computed(() => (currentStep.value ? STEP_ORDER.indexOf(currentStep.value) : -1))

const canSubmit = computed(
  () => password.value.length > 0 && phase.value === 'input' && props.hostIp.length > 0
)

watch(open, (v) => {
  if (v) {
    password.value = ''
    phase.value = 'input'
    currentStep.value = null
    stepDetail.value = ''
    errorMsg.value = ''
    resultVersion.value = ''
    resultMessage.value = ''
    deployStrategy.value = 'install'
  }
})

async function handleDeploy(): Promise<void> {
  if (!canSubmit.value) return

  phase.value = 'deploying'
  currentStep.value = 'checking'
  stepDetail.value = ''
  resultMessage.value = ''
  resultVersion.value = ''

  const off = ipc.on<DeployProgress>(FLOW_ENGINE_EVENTS.DEPLOY_PROGRESS, (p) => {
    currentStep.value = p.step
    stepDetail.value = p.detail ?? ''
  })

  try {
    const checkRes = await ipc.invoke<CheckUpdateResult>(FLOW_ENGINE_EVENTS.CHECK_UPDATE, {
      hostIp: props.hostIp
    })

    if (!checkRes.success || !checkRes.data) {
      errorMsg.value = checkRes.error ?? t('workflow.deploy.failed')
      phase.value = 'error'
      return
    }

    const check = checkRes.data
    deployStrategy.value = check.strategy

    if (check.strategy === 'none') {
      resultVersion.value = check.current?.version ?? check.bundled.version
      resultMessage.value = t('workflow.deploy.alreadyLatest')
      phase.value = 'success'
      return
    }

    if (check.strategy === 'unreachable') {
      errorMsg.value = check.error ?? t('workflow.deploy.unreachable')
      phase.value = 'error'
      return
    }

    currentStep.value = 'connecting'
    stepDetail.value =
      check.strategy === 'update'
        ? t('workflow.deploy.updatePending', {
            current: check.current?.version ?? String(check.current?.versionCode ?? ''),
            bundled: check.bundled.version
          })
        : ''

    const res = await ipc.invoke<DeployResult>(FLOW_ENGINE_EVENTS.DEPLOY, {
      hostIp: props.hostIp,
      password: password.value
    })

    if (!res.success || !res.data) {
      errorMsg.value = res.error ?? t('workflow.deploy.failed')
      phase.value = 'error'
      return
    }

    const result = res.data
    if (result.success) {
      resultVersion.value = result.version ?? ''
      resultMessage.value =
        deployStrategy.value === 'update'
          ? t('workflow.deploy.updateSuccess')
          : t('workflow.deploy.installSuccess')
      phase.value = 'success'
    } else {
      errorMsg.value = result.error ?? t('workflow.deploy.failed')
      phase.value = 'error'
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : t('workflow.deploy.failed')
    phase.value = 'error'
  } finally {
    off()
  }
}

function handleClose(): void {
  if (phase.value === 'deploying') return
  open.value = false
}
</script>

<template>
  <VmosDialog
    v-model="open"
    :title="t('workflow.deploy.title')"
    width="480px"
    :show-close="phase !== 'deploying'"
    @close="handleClose"
  >
    <template #header>
      <div class="deploy-header">
        <div class="header-title-wrap">
          <ElIcon class="header-icon"><Monitor /></ElIcon>
          <span class="header-title">{{ t('workflow.deploy.title') }}</span>
        </div>
        <div class="header-desc">{{ t('workflow.deploy.desc') }}</div>
      </div>
    </template>

    <!-- 输入密码 -->
    <div v-if="phase === 'input'" class="deploy-body">
      <div class="host-info">
        <span class="host-label">{{ t('workflow.deploy.targetHost') }}</span>
        <span class="host-value">{{ hostIp }}</span>
      </div>
      <div class="password-field">
        <span class="field-label">{{ t('workflow.deploy.password') }}</span>
        <ElInput
          v-model="password"
          type="password"
          :placeholder="t('workflow.deploy.passwordPlaceholder')"
          show-password
          @keydown.enter="handleDeploy"
        />
      </div>
    </div>

    <!-- 部署中 -->
    <div v-else-if="phase === 'deploying'" class="deploy-body deploy-progress">
      <div class="progress-steps">
        <div
          v-for="(step, i) in STEP_ORDER"
          :key="step"
          class="step-item"
          :class="{
            active: i === stepIndex,
            done: i < stepIndex,
            pending: i > stepIndex
          }"
        >
          <span class="step-dot">
            <ElIcon v-if="i === stepIndex" class="spin-icon" :size="14"><Loading /></ElIcon>
            <ElIcon v-else-if="i < stepIndex" :size="14"><SuccessFilled /></ElIcon>
            <span v-else class="dot-circle" />
          </span>
          <span class="step-text">{{ t(DEPLOY_STEP_KEYS[step]) }}</span>
        </div>
      </div>
      <p v-if="stepDetail" class="step-detail">{{ stepDetail }}</p>
    </div>

    <!-- 成功 -->
    <div v-else-if="phase === 'success'" class="deploy-body deploy-result">
      <ElIcon class="result-icon success" :size="48"><SuccessFilled /></ElIcon>
      <p class="result-title">{{ resultMessage || t('workflow.deploy.success') }}</p>
      <p v-if="resultVersion" class="result-version">v{{ resultVersion }}</p>
    </div>

    <!-- 失败 -->
    <div v-else-if="phase === 'error'" class="deploy-body deploy-result">
      <ElIcon class="result-icon error" :size="48"><CircleCloseFilled /></ElIcon>
      <p class="result-title">{{ t('workflow.deploy.failed') }}</p>
      <p class="result-error">{{ errorMsg }}</p>
    </div>

    <template #footer>
      <div class="deploy-footer">
        <ElButton v-if="phase === 'input'" @click="handleClose">{{
          t('workflow.deploy.cancel')
        }}</ElButton>
        <ElButton
          v-if="phase === 'input'"
          type="primary"
          :disabled="!canSubmit"
          @click="handleDeploy"
        >
          {{ t('workflow.deploy.start') }}
        </ElButton>

        <ElButton v-if="phase === 'success'" type="primary" @click="handleClose">{{
          t('workflow.deploy.done')
        }}</ElButton>

        <ElButton v-if="phase === 'error'" @click="handleClose">{{
          t('workflow.deploy.close')
        }}</ElButton>
        <ElButton v-if="phase === 'error'" type="primary" @click="phase = 'input'">{{
          t('workflow.deploy.retry')
        }}</ElButton>
      </div>
    </template>
  </VmosDialog>
</template>

<style scoped>
.deploy-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 20px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 6px;
  border-radius: 6px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding-left: 42px;
}

.deploy-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 输入阶段 ── */
.host-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.host-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.host-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.password-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

/* ── 部署进度 ── */
.deploy-progress {
  padding: 8px 0;
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 6px;
  transition: background 0.2s;
}

.step-item.active {
  background: var(--el-color-primary-light-9);
}

.step-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.dot-circle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-border-color);
}

.step-item.done .step-dot {
  color: var(--el-color-success);
}

.step-item.active .step-dot {
  color: var(--el-color-primary);
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.step-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.step-item.active .step-text {
  font-weight: 600;
  color: var(--el-color-primary);
}

.step-item.done .step-text {
  color: var(--el-text-color-secondary);
}

.step-item.pending .step-text {
  color: var(--el-text-color-placeholder);
}

.step-detail {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 0 14px;
}

/* ── 结果 ── */
.deploy-result {
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}

.result-icon.success {
  color: var(--el-color-success);
}

.result-icon.error {
  color: var(--el-color-danger);
}

.result-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.result-version {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.result-error {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
  word-break: break-word;
  max-width: 360px;
}

/* ── 底部 ── */
.deploy-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
