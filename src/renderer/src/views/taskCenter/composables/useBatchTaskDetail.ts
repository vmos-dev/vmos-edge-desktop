import { ref, onMounted, onUnmounted } from 'vue'
import { invoke, on } from '@renderer/core/ipc'
import { BATCH_TASK_EVENTS } from '@shared/ipc/batchTask.types'
import type {
  BatchTaskDetailResult,
  StatusChangedEvent,
  BatchTaskItemStatus
} from '@shared/ipc/batchTask.types'

export function useBatchTaskDetail(batchTaskId: string) {
  const data = ref<BatchTaskDetailResult | null>(null)
  const loading = ref(false)
  const selectedDeviceId = ref<string | null>(null)
  const filterStatus = ref<BatchTaskItemStatus | undefined>(undefined)

  async function refresh() {
    loading.value = true
    try {
      const resp = await invoke<BatchTaskDetailResult>(BATCH_TASK_EVENTS.GET, batchTaskId)
      if (resp.success && resp.data) {
        data.value = resp.data
        if (!selectedDeviceId.value && resp.data.items.length > 0) {
          selectedDeviceId.value = resp.data.items[0].deviceId
        }
      }
    } finally {
      loading.value = false
    }
  }

  let unsub: (() => void) | undefined
  onMounted(() => {
    refresh()
    unsub = on<StatusChangedEvent>(BATCH_TASK_EVENTS.STATUS_CHANGED, (event) => {
      if (event.batchTaskId === batchTaskId) refresh()
    })
  })
  onUnmounted(() => unsub?.())

  return { data, loading, selectedDeviceId, filterStatus, refresh }
}
