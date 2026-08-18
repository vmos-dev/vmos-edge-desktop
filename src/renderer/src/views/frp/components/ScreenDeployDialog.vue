<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CopyDocument,
  FolderOpened,
  Close,
  Check,
  Loading as LoadingIcon
} from '@element-plus/icons-vue'
import { ipc } from '@renderer/core/ipc'
import { FRP_EVENTS } from '@shared/ipc/frp.types'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import type { FrpConfig, FrpStatusInfo, DeployScreenRequest } from '@shared/ipc/frp.types'
import { useScreenDeploy } from '../composables/useScreenDeploy'

const { t } = useI18n()

const props = defineProps<{
  config: FrpConfig | null
  status: FrpStatusInfo | null
}>()

const visible = defineModel<boolean>('visible', { default: false })

const portInput = shallowRef(80)
const publicPortInput = shallowRef(80)
const sslCertPath = shallowRef('')
const sslKeyPath = shallowRef('')

const { progress, activeStepLabels, running: deploying, hasError, isDone, reset, run } =
  useScreenDeploy()

const isDeployed = computed(() => props.status?.screenEnabled === true)
const screenUrl = computed(() => props.status?.screenUrl || '')
const isNat = computed(() => props.config?.deploy_mode === 'nat')

const doneLabel = shallowRef('')

const steps = computed(() => {
  if (!progress.value) return []
  const total = progress.value.totalSteps
  const current = progress.value.step
  const currentStatus = progress.value.status

  return Array.from({ length: total }, (_, i) => {
    const stepNum = i + 1
    if (stepNum < current) return { status: 'done' as const }
    if (stepNum === current) return { status: currentStatus }
    return { status: 'pending' as const }
  })
})

watch(
  () => props.config,
  (cfg) => {
    if (cfg?.screen_port) portInput.value = cfg.screen_port
    publicPortInput.value = cfg?.screen_public_port || cfg?.screen_port || 80
    sslCertPath.value = cfg?.screen_ssl_cert || ''
    sslKeyPath.value = cfg?.screen_ssl_key || ''
  },
  { immediate: true }
)

watch(visible, (val) => {
  if (val) reset()
})

const selectFile = async (type: 'cert' | 'key') => {
  const extensions = type === 'cert' ? ['pem', 'crt', 'cer'] : ['pem', 'key']
  const res = await ipc.invoke<string, { filters: { name: string; extensions: string[] }[] }>(
    SHARED_EVENTS.SELECT_FILE,
    { filters: [{ name: type === 'cert' ? 'Certificate' : 'Private Key', extensions }] }
  )
  if (res.success && res.data) {
    if (type === 'cert') sslCertPath.value = res.data
    else sslKeyPath.value = res.data
  }
}

const clearFile = (type: 'cert' | 'key') => {
  if (type === 'cert') sslCertPath.value = ''
  else sslKeyPath.value = ''
}

const buildRequest = (): DeployScreenRequest => ({
  port: portInput.value,
  publicPort: isNat.value ? publicPortInput.value : undefined,
  sslCertPath: sslCertPath.value || undefined,
  sslKeyPath: sslKeyPath.value || undefined
})

const handleDeploy = async () => {
  const successMsg = t('frp.screen.deploySuccess')
  doneLabel.value = successMsg
  const ok = await run({
    event: FRP_EVENTS.DEPLOY_SCREEN,
    stepLabels: [
      'frp.screen.deploying',
      'frp.screen.uploadNginx',
      'frp.screen.writeConfig',
      'frp.screen.uploadPage',
      'frp.screen.setupService'
    ],
    request: buildRequest()
  })
  if (ok) ElMessage.success(successMsg)
}

const handleUpdate = async () => {
  const successMsg = t('frp.screen.updateSuccess')
  doneLabel.value = successMsg
  const ok = await run({
    event: FRP_EVENTS.UPDATE_SCREEN_CONFIG,
    stepLabels: [
      'frp.deploy.connecting',
      'frp.screen.writeConfig',
      'frp.screen.uploadPage',
      'frp.screen.reloadService'
    ],
    request: buildRequest()
  })
  if (ok) ElMessage.success(successMsg)
}

const handleUninstall = async () => {
  try {
    await ElMessageBox.confirm(t('frp.screen.uninstallConfirm'), t('frp.screen.uninstall'), {
      type: 'warning'
    })
  } catch {
    return
  }
  const successMsg = t('frp.screen.uninstallSuccess')
  doneLabel.value = successMsg
  const ok = await run({
    event: FRP_EVENTS.UNINSTALL_SCREEN,
    stepLabels: ['frp.deploy.connecting', 'frp.screen.stopService', 'frp.screen.cleanup']
  })
  if (ok) ElMessage.success(successMsg)
}

const copyUrl = () => {
  if (screenUrl.value) {
    navigator.clipboard.writeText(screenUrl.value)
    ElMessage({ message: t('common.copySuccess'), type: 'success', duration: 1500 })
  }
}
</script>

<template>
  <vmos-dialog
    v-model="visible"
    :title="t('frp.screen.title')"
    width="420px"
    :show-close="!deploying || isDone || hasError"
    :close-on-click-modal="!deploying"
    :close-on-press-escape="!deploying"
  >
    <!-- 部署/卸载进度 -->
    <div v-if="progress" class="deploy-steps">
      <div v-for="(step, index) in steps" :key="index" class="deploy-step">
        <div class="step-icon">
          <el-icon v-if="step.status === 'done'" color="var(--el-color-success)">
            <Check />
          </el-icon>
          <el-icon v-else-if="step.status === 'error'" color="var(--el-color-danger)">
            <Close />
          </el-icon>
          <el-icon v-else-if="step.status === 'running'" class="is-loading">
            <LoadingIcon />
          </el-icon>
          <span v-else class="step-number">{{ index + 1 }}</span>
        </div>
        <span :class="['step-label', step.status]">{{ t(activeStepLabels[index]) }}</span>
      </div>

      <div v-if="hasError && progress.error" class="deploy-error">
        {{ progress.error }}
      </div>
    </div>

    <!-- 配置表单 -->
    <div v-else class="screen-form">
      <!-- 状态 -->
      <div class="info-row">
        <span class="info-label">{{ t('frp.mapping.status') }}</span>
        <span class="info-val">
          <span class="status-dot" :class="isDeployed ? 'dot-green' : 'dot-gray'" />
          {{ isDeployed ? t('frp.screen.deployed') : t('frp.screen.notDeployed') }}
        </span>
      </div>

      <!-- 访问地址 -->
      <div v-if="isDeployed && screenUrl" class="info-row">
        <span class="info-label">{{ t('frp.screen.accessUrl') }}</span>
        <span class="info-val url-val">
          <a :href="screenUrl" target="_blank" class="url-link">{{ screenUrl }}</a>
          <el-icon class="copy-icon" @click="copyUrl"><CopyDocument /></el-icon>
        </span>
      </div>

      <el-divider />

      <!-- 端口 -->
      <el-form label-position="top">
        <el-form-item :label="t('frp.screen.port')">
          <template v-if="isNat">
            <div class="port-mapping">
              <el-input-number
                v-model="portInput"
                :min="1"
                :max="65535"
                :disabled="deploying"
                controls-position="right"
              />
              <span class="port-mapping-arrow">&rarr;</span>
              <el-input-number
                v-model="publicPortInput"
                :min="1"
                :max="65535"
                :disabled="deploying"
                controls-position="right"
              />
            </div>
            <div class="form-tip">{{ t('frp.screen.publicPortTip') }}</div>
          </template>
          <template v-else>
            <el-input-number
              v-model="portInput"
              :min="1"
              :max="65535"
              :disabled="deploying"
              controls-position="right"
              style="width: 100%"
            />
            <div class="form-tip">{{ t('frp.screen.portTip') }}</div>
          </template>
        </el-form-item>
      </el-form>

      <!-- SSL 证书 -->
      <el-form label-position="top">
        <el-form-item :label="t('frp.screen.sslCert')">
          <div class="file-input">
            <el-input
              :model-value="sslCertPath"
              readonly
              :placeholder="t('frp.screen.sslCertPlaceholder')"
              :disabled="deploying"
            >
              <template #suffix>
                <el-icon v-if="sslCertPath" class="file-clear" @click.stop="clearFile('cert')">
                  <Close />
                </el-icon>
              </template>
            </el-input>
            <el-button :disabled="deploying" @click="selectFile('cert')">
              <el-icon><FolderOpened /></el-icon>
            </el-button>
          </div>
        </el-form-item>
        <el-form-item :label="t('frp.screen.sslKey')">
          <div class="file-input">
            <el-input
              :model-value="sslKeyPath"
              readonly
              :placeholder="t('frp.screen.sslKeyPlaceholder')"
              :disabled="deploying"
            >
              <template #suffix>
                <el-icon v-if="sslKeyPath" class="file-clear" @click.stop="clearFile('key')">
                  <Close />
                </el-icon>
              </template>
            </el-input>
            <el-button :disabled="deploying" @click="selectFile('key')">
              <el-icon><FolderOpened /></el-icon>
            </el-button>
          </div>
          <div class="form-tip">{{ t('frp.screen.sslTip') }}</div>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <!-- 进度状态的 footer -->
      <div v-if="progress && isDone" style="text-align: center">
        <el-button type="primary" @click="progress = null">
          {{ doneLabel }}
        </el-button>
      </div>
      <div v-else-if="progress && hasError" style="text-align: center">
        <el-button type="primary" @click="progress = null">
          {{ t('frp.deploy.retry') }}
        </el-button>
      </div>
      <!-- 表单状态的 footer -->
      <div v-else-if="!progress" class="dialog-footer">
        <el-button
          v-if="isDeployed"
          type="danger"
          plain
          :loading="deploying"
          @click="handleUninstall"
        >
          {{ t('frp.screen.uninstall') }}
        </el-button>
        <el-button v-if="isDeployed" type="primary" :loading="deploying" @click="handleUpdate">
          {{ t('frp.screen.updateConfig') }}
        </el-button>
        <el-button v-else type="primary" :loading="deploying" @click="handleDeploy">
          {{ t('frp.screen.deploy') }}
        </el-button>
      </div>
    </template>
  </vmos-dialog>
</template>

<style scoped>
.screen-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.screen-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.screen-form :deep(.el-form-item__label) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding-bottom: 4px;
}

.screen-form :deep(.el-divider) {
  margin: 8px 0 12px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.info-label {
  color: var(--el-text-color-secondary);
}

.info-val {
  font-size: 13px;
  color: var(--el-text-color-primary);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;

  &.dot-green {
    background: #34c759;
    box-shadow: 0 0 5px rgba(52, 199, 89, 0.5);
  }

  &.dot-gray {
    background: #8e8e93;
  }
}

.url-val {
  gap: 4px;
}

.url-link {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  color: var(--el-color-primary);
  text-decoration: none;

  &:hover {
    opacity: 0.75;
  }
}

.copy-icon {
  cursor: pointer;
  color: var(--el-text-color-placeholder);
  font-size: 13px;

  &:hover {
    color: var(--el-text-color-regular);
  }
}

.port-mapping {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.port-mapping .el-input-number {
  flex: 1;
}

.port-mapping-arrow {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  flex-shrink: 0;
}

.file-input {
  display: flex;
  gap: 8px;
  width: 100%;

  .el-input {
    flex: 1;
    min-width: 0;
  }
}

.file-clear {
  cursor: pointer;
  color: var(--el-text-color-placeholder);

  &:hover {
    color: var(--el-text-color-regular);
  }
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
}

/* 部署步骤 */
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
