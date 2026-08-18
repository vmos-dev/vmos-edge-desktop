import { computed, ref } from 'vue'
import type { Device } from '@shared/ipc/data.types'
import type { AppInfo, CreateWorkflowPayload } from '@shared/ipc/workflow.types'

type Mode = 'new' | 'change-device'

/** 对话框确认时产出的 payload(由调用方决定下一步) */
export type DeviceSelectionResult =
  | { kind: 'start-new'; seed: CreateWorkflowPayload; device: Device }
  | { kind: 'change-device'; device: Device }

export interface ConfirmPayload {
  device: Device
  app: AppInfo
  /** 新建时用户填写的脚本名(change-device 模式下忽略) */
  name?: string
}

export function useDeviceSelection() {
  const dialogOpen = ref(false)
  const mode = ref<Mode>('new')
  /** 派生:新建模式(对话框需要"脚本名"输入)。模板优先用这个,不用读 mode.value */
  const isNewMode = computed(() => mode.value === 'new')

  function openForNew(): void {
    mode.value = 'new'
    dialogOpen.value = true
  }

  function openForChange(): void {
    mode.value = 'change-device'
    dialogOpen.value = true
  }

  function confirm(payload: ConfirmPayload): DeviceSelectionResult {
    if (mode.value === 'change-device') {
      return { kind: 'change-device', device: payload.device }
    }

    const trimmedName = payload.name?.trim()
    return {
      kind: 'start-new',
      device: payload.device,
      seed: {
        name: trimmedName || `${payload.app.displayName} 自动化`,
        appId: payload.app.packageName,
        appName: payload.app.displayName,
        appIcon: payload.app.icon,
        appVersion: payload.app.versionName,
        defaultDeviceId: payload.device.id
      }
    }
  }

  return {
    dialogOpen,
    mode,
    isNewMode,
    openForNew,
    openForChange,
    confirm
  }
}
