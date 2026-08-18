import { shallowRef, onMounted, onUnmounted } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { FRP_EVENTS } from '@shared/ipc/frp.types'
import type { FrpConfig } from '@shared/ipc/frp.types'

export function useFrpConfig() {
  const config = shallowRef<FrpConfig | null>(null)
  const loading = shallowRef(false)

  const fetchConfig = async () => {
    loading.value = true
    try {
      const res = await ipc.invoke<FrpConfig | undefined>(FRP_EVENTS.GET_CONFIG)
      if (res.success) {
        config.value = res.data ?? null
      }
    } finally {
      loading.value = false
    }
  }

  const updateConfig = async (updates: Partial<FrpConfig>) => {
    const res = await ipc.invoke<void, Partial<FrpConfig>>(FRP_EVENTS.UPDATE_CONFIG, updates)
    if (res.success) {
      await fetchConfig()
    }
    return res
  }

  const reconfigure = async () => {
    return ipc.invoke<void>(FRP_EVENTS.RECONFIGURE)
  }

  const deploy = async (configInput: Partial<FrpConfig>) => {
    const res = await ipc.invoke<void, Partial<FrpConfig>>(FRP_EVENTS.DEPLOY, configInput)
    if (res.success) {
      await fetchConfig()
    }
    return res
  }

  let offStatusChanged: (() => void) | null = null

  onMounted(() => {
    fetchConfig()
    offStatusChanged = ipc.on(FRP_EVENTS.STATUS_CHANGED, () => {
      fetchConfig()
    })
  })

  onUnmounted(() => {
    offStatusChanged?.()
  })

  return {
    config,
    loading,
    fetchConfig,
    updateConfig,
    reconfigure,
    deploy
  }
}
