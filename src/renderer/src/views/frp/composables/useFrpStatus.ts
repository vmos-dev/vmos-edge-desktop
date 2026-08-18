import { shallowRef, onMounted, onUnmounted } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { FRP_EVENTS } from '@shared/ipc/frp.types'
import type { FrpStatusInfo, DeployProgress } from '@shared/ipc/frp.types'

export function useFrpStatus() {
  const status = shallowRef<FrpStatusInfo | null>(null)
  const deployProgress = shallowRef<DeployProgress | null>(null)

  const fetchStatus = async () => {
    const res = await ipc.invoke<FrpStatusInfo>(FRP_EVENTS.GET_STATUS)
    if (res.success && res.data) {
      status.value = res.data
    }
  }

  const start = async () => {
    const res = await ipc.invoke<void>(FRP_EVENTS.START)
    if (res.success) await fetchStatus()
    return res
  }

  const stop = async () => {
    const res = await ipc.invoke<void>(FRP_EVENTS.STOP)
    if (res.success) await fetchStatus()
    return res
  }

  const uninstall = async () => {
    const res = await ipc.invoke<void>(FRP_EVENTS.UNINSTALL)
    if (res.success) await fetchStatus()
    return res
  }

  const uninstallLocal = async () => {
    const res = await ipc.invoke<void>(FRP_EVENTS.UNINSTALL_LOCAL)
    if (res.success) await fetchStatus()
    return res
  }

  const cleanOrphans = async () => {
    return ipc.invoke<number>(FRP_EVENTS.CLEAN_ORPHANS)
  }

  let offStatusChanged: (() => void) | null = null
  let offDeployProgress: (() => void) | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  const schedulePoll = () => {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = setTimeout(() => {
      fetchStatus()
      schedulePoll()
    }, 5000)
  }

  onMounted(() => {
    fetchStatus()
    schedulePoll()

    offStatusChanged = ipc.on<FrpStatusInfo>(FRP_EVENTS.STATUS_CHANGED, (data) => {
      status.value = data
      schedulePoll()
    })

    offDeployProgress = ipc.on<DeployProgress>(FRP_EVENTS.DEPLOY_PROGRESS, (data) => {
      deployProgress.value = data
    })
  })

  onUnmounted(() => {
    if (pollTimer) clearTimeout(pollTimer)
    offStatusChanged?.()
    offDeployProgress?.()
  })

  return {
    status,
    deployProgress,
    fetchStatus,
    start,
    stop,
    uninstall,
    uninstallLocal,
    cleanOrphans
  }
}
