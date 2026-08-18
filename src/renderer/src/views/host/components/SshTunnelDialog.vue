<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Monitor } from '@element-plus/icons-vue'
import { copyToClipboard } from '@renderer/utils/index'
import { useI18n } from 'vue-i18n'
import { useTunnelConnection } from '../composables/useTunnelConnection'

const { t } = useI18n()

const visible = shallowRef(false)

const {
  hostIp,
  observedStatus,
  viewState,
  canClose,
  pollingError,
  isOperating,
  isCancelling,
  enablePassword,
  observe,
  retryObserve,
  stopObserve,
  enable,
  disable,
  cancelConnect
} = useTunnelConnection()

const now = shallowRef(Date.now())
let nowTimer: ReturnType<typeof setInterval> | null = null

const startNowTimer = () => {
  if (nowTimer) return
  now.value = Date.now()
  nowTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

const stopNowTimer = () => {
  if (nowTimer) {
    clearInterval(nowTimer)
    nowTimer = null
  }
}

watch(viewState, (v) => {
  if (v === 'connected') startNowTimer()
  else stopNowTimer()
})

onUnmounted(stopNowTimer)

const remainingSeconds = computed(() => {
  const iso = observedStatus.value?.expires_at
  if (!iso) return 0
  const expiresMs = new Date(iso).getTime()
  if (!Number.isFinite(expiresMs)) return 0
  return Math.max(0, Math.floor((expiresMs - now.value) / 1000))
})

const remainingText = computed(() => {
  const s = remainingSeconds.value
  if (s <= 0) return ''
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${t('host.tunnelRemaining')} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})

const tunnelRemotePort = computed(() => observedStatus.value?.remote_port || 0)

const connectionInfoText = computed(() => {
  const lines: string[] = []
  if (tunnelRemotePort.value) lines.push(`${t('host.tunnelSshPort')}: ${tunnelRemotePort.value}`)
  if (enablePassword.value) lines.push(`${t('host.tunnelPassword')}: ${enablePassword.value}`)
  return lines.join('\n')
})

const showStatusError = computed(() => viewState.value !== 'error' && !!pollingError.value)

const handleEnable = async () => {
  try {
    await enable()
  } catch {
    /* pollingError 已由 composable 写好 */
  }
}

const handleRetry = async () => {
  try {
    await retryObserve()
  } catch {
    /* 同上 */
  }
}

const handleCancel = () => {
  cancelConnect()
}

const handleDisable = async () => {
  try {
    await disable()
    ElMessage.success(t('host.tunnelClosed'))
  } catch {
    /* 同上 */
  }
}

const handleCopyPort = () => {
  copyToClipboard(String(tunnelRemotePort.value), () => ElMessage.success(t('common.copySuccess')))
}

const handleCopyPassword = () => {
  if (enablePassword.value) {
    copyToClipboard(enablePassword.value, () => ElMessage.success(t('common.copySuccess')))
  }
}

const handleCopyAll = () => {
  copyToClipboard(connectionInfoText.value, () => ElMessage.success(t('common.copySuccess')))
}

const handleClose = () => {
  stopObserve()
  stopNowTimer()
}

const init = (ip: string) => {
  visible.value = true
  observe(ip)
}

defineExpose({ init })
</script>

<template>
  <VmosDialog
    v-model="visible"
    :title="t('host.tunnelTitle')"
    width="480px"
    :show-close="canClose && !isCancelling"
    @closed="handleClose"
  >
    <!-- 主机信息 -->
    <div class="tunnel-host-info">
      <el-icon><Monitor /></el-icon>
      <span>{{ t('host.tunnelHost') }}</span>
      <span class="tunnel-ip">{{ hostIp }}</span>
    </div>

    <template v-if="viewState === 'loading'">
      <div class="status-card connecting">
        <span class="status-label loading">
          <span class="status-dot loading" />
          {{ t('host.tunnelLoadingStatus') }}
        </span>
        <div class="status-hint">{{ t('common.loading') }}</div>
      </div>
    </template>

    <template v-else-if="viewState === 'error'">
      <div class="status-card disconnected">
        <span class="status-label off">
          <span class="status-dot off" />
          {{ t('host.tunnelStatusLoadFailed') }}
        </span>
        <div class="status-hint">{{ pollingError }}</div>
      </div>
    </template>

    <!-- 未连接 -->
    <template v-else-if="viewState === 'disconnected'">
      <div class="status-card disconnected">
        <span class="status-label off">
          <span class="status-dot off" />
          {{ t('host.tunnelDisconnected') }}
        </span>
      </div>
    </template>

    <!-- 连接中 -->
    <template v-else-if="viewState === 'connecting'">
      <div class="status-card connecting">
        <span class="status-label loading">
          <span class="status-dot loading" />
          {{ t('host.tunnelConnecting') }}
        </span>
        <div class="status-hint">{{ t('host.tunnelConnectingHint') }}</div>
      </div>
    </template>

    <!-- 已连接 -->
    <template v-else-if="viewState === 'connected'">
      <div class="status-card connected">
        <div class="status-header">
          <span class="status-label on">
            <span class="status-dot on" />
            {{ t('host.tunnelConnected') }}
          </span>
          <span class="status-timer">{{ remainingText }}</span>
        </div>
      </div>

      <div class="ssh-section-label">{{ t('host.tunnelSshPort') }}</div>
      <div class="ssh-cmd-box">
        <span class="ssh-cmd">{{ tunnelRemotePort }}</span>
        <el-button size="small" type="success" text @click="handleCopyPort">
          {{ t('common.copy') }}
        </el-button>
      </div>

      <template v-if="enablePassword">
        <div class="ssh-section-label">
          {{ t('host.tunnelPassword') }}
          <span class="password-hint">{{ t('host.tunnelPasswordOnce') }}</span>
        </div>
        <div class="ssh-cmd-box">
          <span class="ssh-cmd password">{{ enablePassword }}</span>
          <el-button size="small" type="success" text @click="handleCopyPassword">
            {{ t('common.copy') }}
          </el-button>
        </div>
      </template>
      <div v-else class="password-unavailable">
        {{ t('host.tunnelPasswordUnavailable') }}
      </div>
    </template>

    <!-- 错误 -->
    <div v-if="showStatusError" class="tunnel-error">{{ pollingError }}</div>

    <template #footer>
      <template v-if="viewState === 'loading'">
        <el-button @click="visible = false">
          {{ t('common.cancel') }}
        </el-button>
      </template>
      <template v-else-if="viewState === 'error'">
        <el-button @click="visible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="isOperating"
          :disabled="isOperating"
          @click="handleRetry"
        >
          {{ t('common.retry') }}
        </el-button>
      </template>
      <template v-else-if="viewState === 'disconnected'">
        <el-button :disabled="isOperating" @click="visible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="isOperating"
          :disabled="isOperating"
          @click="handleEnable"
        >
          {{ t('host.tunnelEnable') }}
        </el-button>
      </template>
      <template v-else-if="viewState === 'connecting'">
        <el-button :loading="isCancelling" :disabled="isCancelling" @click="handleCancel">{{
          t('common.cancel')
        }}</el-button>
      </template>
      <template v-else-if="viewState === 'connected'">
        <el-button v-if="enablePassword" type="primary" @click="handleCopyAll">
          {{ t('host.tunnelCopyAll') }}
        </el-button>
        <el-button
          type="danger"
          :loading="isOperating"
          :disabled="isOperating"
          @click="handleDisable"
        >
          {{ t('host.tunnelDisable') }}
        </el-button>
      </template>
    </template>
  </VmosDialog>
</template>

<style scoped lang="scss">
.tunnel-host-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.tunnel-ip {
  color: var(--el-color-primary);
  font-weight: 600;
  font-family: monospace;
  font-size: 14px;
}

/* 状态卡片 */
.status-card {
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;

  &.disconnected {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-light);
  }

  &.connecting {
    background: var(--el-color-warning-light-9);
    border: 1px solid var(--el-color-warning-light-5);
  }

  &.connected {
    background: var(--el-color-success-light-9);
    border: 1px solid var(--el-color-success-light-5);
  }
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-label {
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;

  &.off {
    color: var(--el-text-color-secondary);
  }

  &.loading {
    color: var(--el-color-warning);
  }

  &.on {
    color: var(--el-color-success);
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;

  &.off {
    background: var(--el-text-color-secondary);
  }

  &.loading {
    background: var(--el-color-warning);
    animation: blink 1s infinite;
  }

  &.on {
    background: var(--el-color-success);
    box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.status-hint {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  margin-top: 4px;
}

.status-timer {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: monospace;
}

/* SSH 命令 */
.ssh-section-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.ssh-cmd-box {
  background: var(--el-fill-color-darker);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ssh-cmd {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: var(--el-color-success);
  word-break: break-all;
  flex: 1;
}

.password-hint {
  margin-left: 6px;
  font-size: 11px;
  color: var(--el-color-warning);
  font-weight: 400;
}

.ssh-cmd.password {
  color: var(--el-color-warning);
  letter-spacing: 1px;
}

.password-unavailable {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  padding: 8px 0;
  margin-bottom: 8px;
}

/* 错误信息 */
.tunnel-error {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--el-color-danger-light-9);
  border-radius: 4px;
}
</style>
