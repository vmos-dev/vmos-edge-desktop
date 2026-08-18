import { ref, computed, onMounted, onUnmounted } from 'vue'
import { invoke, on } from '@renderer/core/ipc'
import { BATCH_TASK_EVENTS } from '@shared/ipc/batchTask.types'
import type {
  BatchTaskListResult,
  StatusChangedEvent,
  BatchTaskStatus
} from '@shared/ipc/batchTask.types'

export function useBatchTaskList() {
  const data = ref<BatchTaskListResult>({ tasks: [], total: 0 })
  const loading = ref(false)
  const filterStatus = ref<BatchTaskStatus | undefined>(undefined)

  const stats = computed(() => {
    const all = data.value.tasks
    return {
      total: data.value.total,
      running: all.filter((t) => t.status === 'RUNNING').length,
      done: all.filter((t) => t.status === 'DONE').length,
      cancelled: all.filter((t) => t.status === 'CANCELLED').length
    }
  })

  async function refresh(offset = 0, limit = 50) {
    loading.value = true
    try {
      const resp = await invoke<BatchTaskListResult>(BATCH_TASK_EVENTS.LIST, {
        status: filterStatus.value,
        offset,
        limit
      })
      if (resp.success && resp.data) {
        data.value = resp.data
      }
    } finally {
      loading.value = false
    }
  }

  let unsub: (() => void) | undefined
  onMounted(() => {
    refresh()
    unsub = on<StatusChangedEvent>(BATCH_TASK_EVENTS.STATUS_CHANGED, () => refresh())
  })
  onUnmounted(() => unsub?.())

  return { tasks: computed(() => data.value.tasks), stats, loading, filterStatus, refresh }
}
