/**
 * useDebouncedSave · 去抖自动保存
 *
 * 把"用户每次动作都想持久化,但别每次打 IPC"这类模式收进一个 composable:
 *  - schedule() 重置计时器;delay 到期后触发一次 save
 *  - 连续调用只会产生最后一次 save(合并)
 *  - cancel() 手动取消挂起的 save(显式保存前 / 离开前调用)
 *  - 组件卸载自动 cancel,不留悬挂定时器
 *
 * 典型场景:
 *  - 选元素落步骤后静默 save
 *  - 拖拽重排完成后静默 save
 *  - YAML 编辑 idle 后静默 save(若启用)
 *
 * 设计契约:
 *  - 本 composable 不知道"什么是 save",只知道"延迟后调用你给的函数"
 *  - save 失败由调用方处理(通常走静默:用户看 dirty 圆点即可)
 */

import { onUnmounted } from 'vue'

export interface DebouncedSaveHandle {
  /** 重置计时器,到期触发 save;连续调用合并成一次 */
  schedule(): void
  /** 取消挂起的 save(不会触发) */
  cancel(): void
}

/**
 * @param save   到期要调用的保存函数(fire-and-forget,返回值被丢弃)
 * @param delay  去抖延迟 ms(默认 600)
 */
export function useDebouncedSave(
  save: () => Promise<unknown> | void,
  delay = 600
): DebouncedSaveHandle {
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedule(): void {
    cancel()
    timer = setTimeout(() => {
      timer = null
      // fire-and-forget;调用方负责错误处理
      void save()
    }, delay)
  }

  // 组件卸载 → 自动清理,避免定时器悬挂到下一次挂载
  onUnmounted(cancel)

  return { schedule, cancel }
}
