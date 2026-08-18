import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { SHARED_FOLDER_EVENTS, type SharedFolderStatus } from '@shared/ipc/sharedFolder.types'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { useI18n } from 'vue-i18n'

function createDefaultStatus(): SharedFolderStatus {
  return {
    protocol: 'webdav',
    directory: '',
    enabled: false,
    running: false,
    pathExists: false,
    port: 8788,
    username: '',
    password: ''
  }
}

export function useSharedFolder() {
  const { t } = useI18n()
  const sharedFolderStatus = ref<SharedFolderStatus>(createDefaultStatus())
  const sharedFolderLoading = ref(false)

  const sharedFolderError = computed(() => {
    return normalizeSharedFolderError(sharedFolderStatus.value.lastError)
  })

  async function loadSharedFolderStatus(showError = false) {
    try {
      const result = await ipc.invoke<SharedFolderStatus>(SHARED_FOLDER_EVENTS.GET_STATUS)
      if (!result.success || !result.data) {
        throw new Error(result.error || t('host.sharedFolderLoadFailed'))
      }
      sharedFolderStatus.value = result.data
    } catch (error) {
      if (showError) {
        ElMessage.error(
          normalizeSharedFolderError(error instanceof Error ? error.message : String(error))
        )
      }
    }
  }

  async function selectSharedFolder() {
    try {
      const result = await ipc.invoke<string>(SHARED_EVENTS.SELECT_FILE, {
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: sharedFolderStatus.value.directory || undefined
      })

      if (!result.success || !result.data) {
        return
      }

      if (sharedFolderStatus.value.running) {
        await ElMessageBox.confirm(
          t('host.sharedFolderChangeWhileRunningConfirm'),
          t('common.tips'),
          {
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel'),
            type: 'warning'
          }
        )
        await startSharedFolder(result.data)
        return
      }

      const saveResult = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
        key: CONFIG_KEYS.SHARED_FOLDER_PATH,
        value: result.data
      })

      if (!saveResult.success) {
        throw new Error(saveResult.error || t('host.sharedFolderPickFailed'))
      }

      await loadSharedFolderStatus()
      ElMessage.success(t('host.sharedFolderPathSaved'))
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(
          normalizeSharedFolderError(error instanceof Error ? error.message : String(error))
        )
      }
    }
  }

  async function startSharedFolder(directory?: string) {
    const nextDirectory = directory ?? sharedFolderStatus.value.directory

    if (!nextDirectory) {
      ElMessage.warning(t('host.sharedFolderPathRequired'))
      return
    }

    sharedFolderLoading.value = true

    try {
      const result = await ipc.invoke<SharedFolderStatus>(SHARED_FOLDER_EVENTS.START, {
        directory: nextDirectory
      })

      if (!result.success || !result.data) {
        throw new Error(result.error || t('host.sharedFolderLoadFailed'))
      }

      sharedFolderStatus.value = result.data
      ElMessage.success(t('host.sharedFolderStartSuccess'))
    } catch (error) {
      ElMessage.error(
        normalizeSharedFolderError(error instanceof Error ? error.message : String(error))
      )
    } finally {
      sharedFolderLoading.value = false
    }
  }

  async function stopSharedFolder() {
    sharedFolderLoading.value = true

    try {
      const result = await ipc.invoke<SharedFolderStatus>(SHARED_FOLDER_EVENTS.STOP)
      if (!result.success || !result.data) {
        throw new Error(result.error || t('host.sharedFolderLoadFailed'))
      }

      sharedFolderStatus.value = result.data
      ElMessage.success(t('host.sharedFolderStopSuccess'))
    } catch (error) {
      ElMessage.error(
        normalizeSharedFolderError(error instanceof Error ? error.message : String(error))
      )
    } finally {
      sharedFolderLoading.value = false
    }
  }

  function openSharedFolder() {
    if (!sharedFolderStatus.value.directory) {
      ElMessage.warning(t('host.sharedFolderPathRequired'))
      return
    }

    ipc.send(SHARED_EVENTS.OPEN_FOLDER, sharedFolderStatus.value.directory)
  }

  function normalizeSharedFolderError(message?: string): string {
    if (!message) {
      return ''
    }

    if (message.includes('not configured')) {
      return t('host.sharedFolderPathRequired')
    }

    if (message.includes('does not exist') || message.includes('Folder does not exist')) {
      return t('host.sharedFolderPathMissing')
    }

    return message
  }

  return {
    sharedFolderStatus,
    sharedFolderLoading,
    sharedFolderError,
    loadSharedFolderStatus,
    selectSharedFolder,
    startSharedFolder,
    stopSharedFolder,
    openSharedFolder
  }
}
