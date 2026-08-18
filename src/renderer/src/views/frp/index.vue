<script setup lang="ts">
import { shallowRef, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Search, Setting, View, Hide, CopyDocument } from '@element-plus/icons-vue'
import SetupCard from './components/SetupCard.vue'
import MappingTable from './components/MappingTable.vue'
import DeployDialog from './components/DeployDialog.vue'
import ServerSettingsDialog from './components/ServerSettingsDialog.vue'
import ClientSettingsDialog from './components/ClientSettingsDialog.vue'
import SshSettingsDialog from './components/SshSettingsDialog.vue'
import ScreenDeployDialog from './components/ScreenDeployDialog.vue'
import { useFrpConfig } from './composables/useFrpConfig'
import { useFrpStatus } from './composables/useFrpStatus'
import { useFrpMappings } from './composables/useFrpMappings'
import { useFrpConfigSave } from './composables/useFrpConfigSave'
import { hasFrpConfiguration } from './frpViewModel'
import { ipc } from '@renderer/core/ipc'
import { FRP_EVENTS } from '@shared/ipc/frp.types'
import type { FrpConfig, DevicePortType } from '@shared/ipc/frp.types'

defineOptions({ name: 'FrpPage' })

const { t } = useI18n()

const { config, fetchConfig, deploy, updateConfig, reconfigure } = useFrpConfig()
const { status, deployProgress, start, stop, uninstall, uninstallLocal, cleanOrphans } =
  useFrpStatus()
const {
  treeData,
  loading,
  searchText,
  stateFilter,
  toggleHost,
  toggleDevice,
  batchToggle: rawBatchToggle
} = useFrpMappings()

const DEVICE_STATE_OPTIONS = [
  'running',
  'stopped',
  'starting',
  'stopping',
  'creating',
  'paused',
  'exited',
  'upgrading',
  'rebooting',
  'rebuilding',
  'renewing',
  'pending_backup',
  'backing_up',
  'downloading',
  'deleting',
  'failed',
  'offline'
]

const stateFilterModel = computed({
  get: () => stateFilter.value,
  set: (val: string[]) => {
    if (val.length > 0) stateFilter.value = val
  }
})

const {
  loading: settingsLoading,
  showServerSettings,
  showClientSettings,
  showSshSettings,
  saveSettings: handleSaveSettings,
  saveSsh: handleSaveSsh
} = useFrpConfigSave({ config, updateConfig, reconfigure, start, stop })

const showDeploy = shallowRef(false)
const showScreenDeploy = shallowRef(false)
const deploying = shallowRef(false)
const actionLoading = shallowRef(false)

const isConfigured = computed(() => hasFrpConfiguration(config.value))
const canStart = computed(
  () =>
    isConfigured.value && status.value?.configStatus !== 'deploying' && !status.value?.frpcRunning
)
const canStop = computed(() => status.value?.frpcRunning === true)

const publicHost = computed(() => config.value?.public_host || config.value?.server_host || '')
const dashboardPort = computed(
  () => config.value?.public_frps_dashboard_port || config.value?.frps_dashboard_port || 7500
)
const dashboardUrl = computed(() => `http://${publicHost.value}:${dashboardPort.value}`)
const frpcAdminPort = computed(() => config.value?.frpc_admin_port || 7400)
const localIp = computed(() => status.value?.localIp || '127.0.0.1')
const frpcDashboardUrl = computed(() => `http://${localIp.value}:${frpcAdminPort.value}`)

const serverDashboardUser = computed(() => config.value?.frps_dashboard_user || 'admin')
const serverDashboardPassword = computed(() => config.value?.frps_dashboard_password || '')
const clientDashboardUser = 'admin'
const clientDashboardPassword = computed(() => config.value?.frps_token || '')

const showServerCredentials = shallowRef(false)
const showClientCredentials = shallowRef(false)

const statusText = computed(() => {
  if (!status.value) return ''
  switch (status.value.configStatus) {
    case 'running':
      return status.value.frpcRunning ? t('frp.status.running') : t('frp.status.reconnecting')
    case 'deploying':
      return t('frp.status.deploying')
    case 'error':
      return t('frp.status.error')
    case 'stopped':
      return t('frp.status.stopped')
    default:
      return t('frp.status.stopped')
  }
})

const statusDotClass = computed(() => {
  if (!status.value) return 'dot-gray'
  if (status.value.configStatus === 'running' && status.value.frpcRunning) return 'dot-green'
  if (status.value.configStatus === 'error') return 'dot-red'
  if (status.value.configStatus === 'deploying') return 'dot-orange'
  return 'dot-gray'
})

const sshDotClass = computed(() => {
  if (!status.value) return 'dot-gray'
  return status.value.sshConnected ? 'dot-green' : 'dot-gray'
})

const sshStatusText = computed(() => {
  if (!status.value) return ''
  return status.value.sshConnected ? t('frp.status.sshConnected') : t('frp.status.sshDisconnected')
})

const copyText = (text: string) => {
  navigator.clipboard.writeText(text)
  ElMessage({ message: t('common.copySuccess'), type: 'success', duration: 1500 })
}

const batchToggle = async (
  items: { deviceId: string; hostIp: string }[],
  enabled: boolean,
  portTypes?: DevicePortType[]
) => {
  const res = await rawBatchToggle(items, enabled, portTypes)
  if (!res.success) {
    ElMessage.error(res.error || t('frp.deploy.failed'))
  } else if (res.data?.failures?.length) {
    const failCount = res.data.failures.length
    ElMessage.warning(
      t('frp.message.batchPartialFail', { failed: failCount, total: res.data.total })
    )
  }
  return res
}

const handleDeploy = async (configInput: Partial<FrpConfig>) => {
  deploying.value = true
  try {
    const testRes = await ipc.invoke<boolean, Partial<FrpConfig>>(
      FRP_EVENTS.TEST_CONNECTION,
      configInput
    )
    if (!testRes.success || !testRes.data) {
      ElMessage.error(testRes.error || t('frp.confirm.sshFailedTitle'))
      return
    }
    showDeploy.value = true
    const res = await deploy(configInput)
    if (res.success) {
      ElMessage.success(t('frp.message.deploySuccess'))
    }
    // 失败时错误信息由 DeployDialog 的 progress.error 区展示，不重复弹 tip
  } finally {
    deploying.value = false
  }
}

const handleRetryDeploy = async () => {
  if (!config.value) return
  const res = await deploy(config.value)
  if (res.success) ElMessage.success(t('frp.message.deploySuccess'))
}

const handleStop = async () => {
  try {
    await ElMessageBox.confirm(t('frp.confirm.stopMessage'), t('frp.confirm.stopTitle'), {
      type: 'warning'
    })
    actionLoading.value = true
    const res = await stop()
    if (res.success) {
      ElMessage.success(t('frp.message.stopSuccess'))
      await fetchConfig()
    }
  } catch {
    /* cancelled */
  } finally {
    actionLoading.value = false
  }
}

const handleStart = async () => {
  actionLoading.value = true
  try {
    const res = await start()
    if (res.success) {
      ElMessage.success(t('frp.message.startSuccess'))
      await fetchConfig()
    } else {
      ElMessage.error(res.error || t('frp.status.error'))
    }
  } finally {
    actionLoading.value = false
  }
}

const handleUninstall = async () => {
  try {
    await ElMessageBox.confirm(t('frp.confirm.uninstallMessage'), t('frp.confirm.uninstallTitle'), {
      type: 'warning'
    })
  } catch {
    return
  }
  actionLoading.value = true
  try {
    const res = await uninstall()
    if (res.success) {
      ElMessage.success(t('frp.message.uninstallSuccess'))
      showServerSettings.value = false
      showClientSettings.value = false
      await fetchConfig()
    } else {
      try {
        await ElMessageBox.confirm(
          t('frp.confirm.uninstallLocalMessage'),
          t('frp.confirm.sshFailedTitle'),
          {
            confirmButtonText: t('frp.confirm.uninstallLocalOnly'),
            cancelButtonText: t('common.cancel'),
            type: 'warning'
          }
        )
        const localRes = await uninstallLocal()
        if (localRes.success) {
          ElMessage.success(t('frp.message.uninstallSuccess'))
          showServerSettings.value = false
          showClientSettings.value = false
          await fetchConfig()
        }
      } catch {
        /* cancelled */
      }
    }
  } finally {
    actionLoading.value = false
  }
}

const handleCleanOrphans = async () => {
  try {
    await ElMessageBox.confirm(
      t('frp.confirm.cleanOrphansMessage'),
      t('frp.confirm.cleanOrphansTitle')
    )
    actionLoading.value = true
    const res = await cleanOrphans()
    if (res.success) {
      const count = res.data || 0
      count > 0
        ? ElMessage.success(t('frp.message.cleanOrphansSuccess', { count }))
        : ElMessage.info(t('frp.message.cleanOrphansEmpty'))
    }
  } catch {
    /* cancelled */
  } finally {
    actionLoading.value = false
  }
}

const openServerSettings = () => {
  showServerSettings.value = true
}

const openClientSettings = () => {
  showClientSettings.value = true
}
</script>

<template>
  <div class="frp-container">
    <SetupCard
      v-if="!isConfigured"
      :deploying="deploying"
      :config="config"
      @deploy="handleDeploy"
    />

    <div v-else class="frp-page">
      <!-- ── 顶部状态栏 ── -->
      <div class="status-bar">
        <div class="status-left">
          <span class="status-label">{{ t('frp.status.frpcLabel') }}</span>
          <span class="status-dot" :class="statusDotClass" />
          <span class="status-text">{{ statusText }}</span>
          <span class="status-sep" />
          <span class="status-label">{{ t('frp.status.sshLabel') }}</span>
          <span class="status-dot" :class="sshDotClass" />
          <span class="status-text">{{ sshStatusText }}</span>
          <span class="status-sep" />
          <span class="status-host">{{ publicHost }}</span>
          <span v-if="status" class="status-mapping">
            {{ status.activeMappings }} / {{ status.totalMappings }}
          </span>
        </div>
        <div class="status-actions">
          <!-- 公网投屏入口临时隐藏，保留 ScreenDeployDialog / showScreenDeploy 状态以备后续启用 -->
          <!-- <el-button text size="small" @click="showScreenDeploy = true">{{
            t('frp.action.screenCasting')
          }}</el-button> -->
          <el-button
            text
            size="small"
            type="danger"
            :loading="actionLoading"
            @click="handleUninstall"
            >{{ t('frp.action.uninstall') }}</el-button
          >
          <el-button text size="small" @click="showSshSettings = true">{{
            t('frp.action.sshConfig')
          }}</el-button>
          <el-button text size="small" :loading="actionLoading" @click="handleCleanOrphans">{{
            t('frp.action.cleanOrphans')
          }}</el-button>
          <el-button
            v-if="canStart"
            text
            size="small"
            :loading="actionLoading"
            @click="handleStart"
            >{{ t('frp.action.start') }}</el-button
          >
          <el-button
            v-if="canStop"
            text
            size="small"
            type="danger"
            :loading="actionLoading"
            @click="handleStop"
            >{{ t('frp.action.stop') }}</el-button
          >
        </div>
      </div>

      <!-- ── 控制台卡片 ── -->
      <div class="console-cards" v-if="config">
        <!-- 服务端 -->
        <div class="console-card">
          <div class="console-header">
            <span class="console-label">{{ t('frp.overview.serverDashboard') }}</span>
            <div class="console-header-actions">
              <span class="console-icon-btn" @click="openServerSettings">
                <el-icon :size="14"><Setting /></el-icon>
              </span>
              <span
                class="console-icon-btn"
                @click="showServerCredentials = !showServerCredentials"
              >
                <el-icon :size="14"><Hide v-if="showServerCredentials" /><View v-else /></el-icon>
              </span>
            </div>
          </div>
          <a class="console-url" :href="dashboardUrl" target="_blank">
            {{ publicHost }}:{{ dashboardPort }}
          </a>
          <Transition name="fade">
            <div v-if="showServerCredentials" class="console-credentials">
              <div class="cred-item" @click="copyText(serverDashboardUser)">
                <span class="cred-key">{{ t('frp.overview.account') }}</span>
                <span class="cred-val"
                  >{{ serverDashboardUser }}<el-icon class="cred-copy"><CopyDocument /></el-icon
                ></span>
              </div>
              <div class="cred-item" @click="copyText(serverDashboardPassword)">
                <span class="cred-key">{{ t('frp.overview.password') }}</span>
                <span class="cred-val"
                  >{{ serverDashboardPassword }}<el-icon class="cred-copy"><CopyDocument /></el-icon
                ></span>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 客户端 -->
        <div class="console-card">
          <div class="console-header">
            <span class="console-label">{{ t('frp.overview.clientDashboard') }}</span>
            <div class="console-header-actions">
              <span class="console-icon-btn" @click="openClientSettings">
                <el-icon :size="14"><Setting /></el-icon>
              </span>
              <span
                class="console-icon-btn"
                @click="showClientCredentials = !showClientCredentials"
              >
                <el-icon :size="14"><Hide v-if="showClientCredentials" /><View v-else /></el-icon>
              </span>
            </div>
          </div>
          <a class="console-url" :href="frpcDashboardUrl" target="_blank">
            {{ localIp }}:{{ frpcAdminPort }}
          </a>
          <Transition name="fade">
            <div v-if="showClientCredentials" class="console-credentials">
              <div class="cred-item" @click="copyText(clientDashboardUser)">
                <span class="cred-key">{{ t('frp.overview.account') }}</span>
                <span class="cred-val"
                  >{{ clientDashboardUser }}<el-icon class="cred-copy"><CopyDocument /></el-icon
                ></span>
              </div>
              <div class="cred-item" @click="copyText(clientDashboardPassword)">
                <span class="cred-key">{{ t('frp.overview.password') }}</span>
                <span class="cred-val"
                  >{{ clientDashboardPassword }}<el-icon class="cred-copy"><CopyDocument /></el-icon
                ></span>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- ── 映射列表 ── -->
      <div class="mapping-section">
        <div class="mapping-header">
          <span class="mapping-title">{{ t('frp.overview.mappingList') }}</span>
          <div class="mapping-filters">
            <span class="security-warn">{{ t('frp.security.noAuth') }}</span>
            <el-input
              v-model="searchText"
              :prefix-icon="Search"
              :placeholder="t('frp.mapping.searchDevice')"
              clearable
              class="search-input"
            />
            <el-select
              v-model="stateFilterModel"
              multiple
              collapse-tags
              collapse-tags-tooltip
              :placeholder="t('frp.mapping.stateFilter')"
              class="state-filter"
            >
              <el-option
                v-for="state in DEVICE_STATE_OPTIONS"
                :key="state"
                :value="state"
                :label="t(`common.deviceStates.${state}`, state)"
                :disabled="stateFilter.length === 1 && stateFilter.includes(state)"
              />
            </el-select>
          </div>
        </div>
        <MappingTable
          :tree-data="treeData"
          :loading="loading"
          :server-host="publicHost"
          :frpc-running="status?.frpcRunning ?? false"
          :screen-url="status?.screenEnabled ? status.screenUrl : ''"
          :on-toggle-host="toggleHost"
          :on-toggle-device="toggleDevice"
          :on-batch-toggle="batchToggle"
        />
      </div>
    </div>

    <DeployDialog
      v-model:visible="showDeploy"
      :progress="deployProgress"
      @retry="handleRetryDeploy"
      @open-ssh-config="showSshSettings = true"
    />
    <ServerSettingsDialog
      v-model:visible="showServerSettings"
      :config="config"
      :loading="settingsLoading"
      @save="handleSaveSettings"
    />
    <ClientSettingsDialog
      v-model:visible="showClientSettings"
      :config="config"
      :loading="settingsLoading"
      @save="handleSaveSettings"
    />
    <SshSettingsDialog
      v-model:visible="showSshSettings"
      :config="config"
      :loading="settingsLoading"
      @save="handleSaveSsh"
    />
    <ScreenDeployDialog v-model:visible="showScreenDeploy" :config="config" :status="status" />
  </div>
</template>

<style scoped lang="scss">
.frp-container {
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
  background: var(--el-bg-color-page);
}

.frp-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

/* ═══════════ 状态栏 ═══════════ */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 12px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.status-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-green {
    background: #34c759;
    box-shadow: 0 0 6px rgba(52, 199, 89, 0.5);
  }
  &.dot-orange {
    background: #ff9f0a;
    box-shadow: 0 0 6px rgba(255, 159, 10, 0.5);
  }
  &.dot-red {
    background: #ff3b30;
    box-shadow: 0 0 6px rgba(255, 59, 48, 0.5);
  }
  &.dot-gray {
    background: #8e8e93;
  }
}

.status-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-text {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.status-sep {
  width: 1px;
  height: 14px;
  background: var(--el-border-color-lighter);
}

.status-host {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  letter-spacing: -0.2px;
}

.status-mapping {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  color: var(--el-text-color-placeholder);

  &::before {
    content: '';
    display: inline-block;
    width: 1px;
    height: 12px;
    background: var(--el-border-color-lighter);
    margin-right: 10px;
    vertical-align: -1px;
  }
}

.status-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.security-warn {
  font-size: 12px;
  color: var(--el-color-warning);
  margin-right: 10px;
}

/* ═══════════ 控制台卡片 ═══════════ */
.console-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.console-card {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.console-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--el-text-color-secondary);
}

.console-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.console-icon-btn {
  cursor: pointer;
  color: var(--el-text-color-placeholder);
  display: flex;
  align-items: center;
  padding: 3px;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
  }
}

.console-url {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 14px;
  font-weight: 500;
  color: var(--el-color-primary);
  text-decoration: none;
  transition: opacity 0.15s;
  line-height: 1.4;

  &:hover {
    opacity: 0.75;
  }
}

.console-credentials {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.cred-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  margin: 0 -8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: var(--el-fill-color-lighter);

    .cred-copy {
      opacity: 1;
    }
  }
}

.cred-key {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cred-val {
  font-size: 12px;
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  color: var(--el-text-color-primary);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.cred-copy {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  opacity: 0;
  transition: opacity 0.15s;
}

/* ═══════════ 映射列表 ═══════════ */
.mapping-section {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mapping-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.mapping-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.mapping-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.state-filter {
  width: 200px;

  :deep(.el-select__wrapper) {
    border-radius: 8px;
    box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
  }
}

.search-input {
  width: 200px;

  :deep(.el-input__wrapper) {
    border-radius: 8px;
    box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
  }
}

/* ═══════════ 过渡动画 ═══════════ */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
