import { shallowRef, watch, onUnmounted, type Ref } from 'vue'
import { invoke } from '@renderer/core/ipc'
import { BATCH_TASK_EVENTS } from '@shared/ipc/batchTask.types'
import type { ItemDetailResult, BatchTaskItemStatus } from '@shared/ipc/batchTask.types'
import type { FlowStepRecord } from '@shared/ipc/flowEngine.api.types'

const ACTIVE_STATUSES = new Set<string>(['PENDING', 'RUNNING'])
const POLL_INTERVAL_MS = 1000

export function useBatchTaskItemSteps(
  batchTaskId: string,
  deviceId: Ref<string | null>,
  itemStatus: Ref<BatchTaskItemStatus | undefined>
) {
  const steps = shallowRef<FlowStepRecord[]>([])
  const loading = shallowRef(false)

  let generation = 0
  let fetching = false
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  async function fetchSteps(showLoading: boolean) {
    const currentDeviceId = deviceId.value
    if (!currentDeviceId) {
      steps.value = []
      loading.value = false
      return
    }

    if (fetching) return

    const gen = generation
    fetching = true
    if (showLoading) loading.value = true
    try {
      const resp = await invoke<ItemDetailResult>(BATCH_TASK_EVENTS.ITEM_DETAIL, {
        batchTaskId,
        deviceId: currentDeviceId
      })
      if (gen !== generation) return
      if (resp.success && resp.data) {
        steps.value = resp.data.steps
      }
    } finally {
      fetching = false
      if (gen === generation && showLoading) loading.value = false
    }
  }

  function startPoll() {
    stopPoll()
    pollTimer = setTimeout(async () => {
      pollTimer = null
      await fetchSteps(false)
      if (ACTIVE_STATUSES.has(itemStatus.value ?? '')) startPoll()
    }, POLL_INTERVAL_MS)
  }

  function stopPoll() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  watch(
    deviceId,
    (_, __, onCleanup) => {
      stopPoll()
      const gen = generation
      fetchSteps(true).then(() => {
        if (gen !== generation) return
        if (ACTIVE_STATUSES.has(itemStatus.value ?? '')) startPoll()
      })
      onCleanup(() => {
        generation++
        stopPoll()
      })
    },
    { immediate: true }
  )

  watch(itemStatus, (status, prevStatus) => {
    if (ACTIVE_STATUSES.has(status ?? '')) {
      if (!pollTimer) startPoll()
    } else {
      stopPoll()
      if (prevStatus && ACTIVE_STATUSES.has(prevStatus)) fetchSteps(false)
    }
  })

  onUnmounted(() => {
    generation++
    stopPoll()
  })

  return { steps, loading }
}
