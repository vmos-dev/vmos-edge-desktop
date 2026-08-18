import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox, ElMessage } from 'element-plus'
import { isFrpServerRestartRequired, isFrpClientRestartRequired } from '../frpViewModel'
import type { ShallowRef } from 'vue'
import type { FrpConfig } from '@shared/ipc/frp.types'

interface IpcResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

interface ConfigSaveDeps {
  config: ShallowRef<FrpConfig | null>
  updateConfig: (updates: Partial<FrpConfig>) => Promise<IpcResult>
  reconfigure: () => Promise<IpcResult>
  start: () => Promise<IpcResult>
  stop: () => Promise<IpcResult>
}

export function useFrpConfigSave(deps: ConfigSaveDeps) {
  const { t } = useI18n()
  const loading = shallowRef(false)
  const pendingReconfigure = shallowRef(false)
  const showServerSettings = shallowRef(false)
  const showClientSettings = shallowRef(false)
  const showSshSettings = shallowRef(false)

  const saveSettings = async (updates: Partial<FrpConfig>) => {
    const serverChanged = isFrpServerRestartRequired(deps.config.value, updates)
    const clientChanged = isFrpClientRestartRequired(deps.config.value, updates)
    const needsReconfigure = serverChanged || pendingReconfigure.value
    const needsRestart = needsReconfigure || clientChanged

    if (needsReconfigure) {
      try {
        await ElMessageBox.confirm(
          t('frp.confirm.reconfigureMessage'),
          t('frp.confirm.reconfigureTitle'),
          {
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel'),
            type: 'warning'
          }
        )
      } catch {
        return
      }
    } else if (clientChanged) {
      try {
        await ElMessageBox.confirm(
          t('frp.confirm.restartMessage'),
          t('frp.confirm.restartTitle'),
          {
            confirmButtonText: t('frp.action.restart'),
            cancelButtonText: t('common.cancel'),
            type: 'warning'
          }
        )
      } catch {
        return
      }
    }

    loading.value = true
    try {
      const res = await deps.updateConfig(updates)
      if (!res.success) {
        ElMessage.error(res.error || 'Failed')
        return
      }

      if (needsReconfigure) {
        const reconfRes = await deps.reconfigure()
        if (!reconfRes.success) {
          pendingReconfigure.value = true
          ElMessage.warning(t('frp.confirm.sshFailedMessage'))
          showSshSettings.value = true
          return
        }
        pendingReconfigure.value = false
      }

      if (needsRestart) {
        await deps.stop()
        await deps.start()
        ElMessage.success(t('frp.message.startSuccess'))
      } else {
        ElMessage.success(t('frp.message.configSaved'))
      }
      showServerSettings.value = false
      showClientSettings.value = false
    } finally {
      loading.value = false
    }
  }

  const saveSsh = async (updates: Partial<FrpConfig>) => {
    loading.value = true
    try {
      const res = await deps.updateConfig(updates)
      if (!res.success) {
        ElMessage.error(res.error || 'Failed')
        return
      }

      if (pendingReconfigure.value) {
        const reconfRes = await deps.reconfigure()
        if (!reconfRes.success) {
          ElMessage.warning(t('frp.confirm.sshFailedMessage'))
          return
        }
        pendingReconfigure.value = false
        await deps.stop()
        await deps.start()
        ElMessage.success(t('frp.message.startSuccess'))
      } else {
        ElMessage.success(t('frp.message.configSaved'))
      }
      showSshSettings.value = false
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    pendingReconfigure,
    showServerSettings,
    showClientSettings,
    showSshSettings,
    saveSettings,
    saveSsh
  }
}
