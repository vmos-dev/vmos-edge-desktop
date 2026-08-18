import { watch, type Ref } from 'vue'

/**
 * Dialog 表单与外部数据源的双重同步契约。
 *
 * 解决的问题：
 * 单独 watch(props.config) 是被动 watch，仅在 source 引用变化时触发。
 * Dialog 关闭再打开时若 source 引用未变（用户未触发外部刷新），
 * form 仍保留上次的状态，回显与最新数据不符。
 *
 * 同步时机：
 * - source 引用变化（外部数据刷新场景：fetchConfig 拉到新对象）
 * - visible 变为 true（dialog 打开时强制同步一次，覆盖引用未变场景）
 *
 * 二者结合保证用户每次打开 dialog 看到的都是当前最新的数据状态。
 */
export function useDialogFormSync<T>(
  visible: Ref<boolean>,
  source: () => T | null | undefined,
  syncFn: (value: T) => void
): void {
  watch(
    source,
    (val) => {
      if (val != null) syncFn(val)
    },
    { immediate: true }
  )

  watch(visible, (open) => {
    if (open) {
      const current = source()
      if (current != null) syncFn(current)
    }
  })
}
