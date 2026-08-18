import { shallowRef, computed, readonly } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { FRP_EVENTS } from '@shared/ipc/frp.types'
import type { DeployProgress, DeployScreenRequest } from '@shared/ipc/frp.types'

interface RunOptions {
  event: string
  stepLabels: string[]
  request?: DeployScreenRequest
}

/**
 * 投屏服务部署流程：管理 progress 状态、订阅事件、合并 ipc 错误
 *
 * 契约：progress 是 UI 唯一展示源
 * - 后端 emit progress(error) → UI 通过 progress.error 展示
 * - 后端漏 emit 但 ipc 返回 error → 在此处合并进 progress，UI 仍只看 progress
 * - 调用方不需要处理任何错误展示分支
 */
export function useScreenDeploy() {
  const progress = shallowRef<DeployProgress | null>(null)
  const activeStepLabels = shallowRef<string[]>([])
  const running = shallowRef(false)

  const hasError = computed(() => progress.value?.status === 'error')
  const isDone = computed(
    () => !!progress.value && progress.value.step === progress.value.totalSteps && progress.value.status === 'done'
  )

  const reset = () => {
    progress.value = null
    activeStepLabels.value = []
  }

  /**
   * 执行一次部署/更新/卸载，返回是否成功
   */
  const run = async (opts: RunOptions): Promise<boolean> => {
    running.value = true
    progress.value = null
    activeStepLabels.value = opts.stepLabels

    const offProgress = ipc.on<DeployProgress>(FRP_EVENTS.SCREEN_PROGRESS, (data) => {
      progress.value = data
    })

    try {
      const res = await ipc.invoke<void, DeployScreenRequest | void>(
        opts.event,
        (opts.request ?? undefined) as DeployScreenRequest | void
      )
      if (res.success) return true

      // ipc 失败兜底：仅当 progress 没拿到 error 时（通信中断 / 后端漏 emit）合并
      const cur = progress.value as DeployProgress | null
      if (!cur?.error) {
        progress.value = {
          step: cur?.step ?? 1,
          totalSteps: cur?.totalSteps ?? opts.stepLabels.length,
          label: '',
          status: 'error',
          error: res.error || ''
        }
      }
      return false
    } finally {
      running.value = false
      offProgress()
    }
  }

  // 外部只读，所有变更必须通过 reset() / run() 这两个 explicit action
  return {
    progress: readonly(progress),
    activeStepLabels: readonly(activeStepLabels),
    running: readonly(running),
    hasError,
    isDone,
    reset,
    run
  }
}
