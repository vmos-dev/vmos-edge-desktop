/**
 * useFlashHighlight · 受控的"闪烁 → 自动消失"状态机
 *
 * 把"按外部 id 驱动一段定时可见高亮"的逻辑抽成组合式函数:
 *   - 状态:activeId(闪烁中的节点 id)、animationKey(动画重播计数)
 *   - 副作用:setTimeout / clearTimeout / onBeforeUnmount 清理
 *   - 反查:用户传入 lookup(id) 得到实际对象(保持泛型,不绑死 UiNode)
 *
 * 对齐 Vue 最佳实践:把状态 + 定时器 + 动画 key 三件套从 SFC 里抽出,
 * 让消费组件只管声明式渲染。
 */

import { shallowRef, watch, computed, onBeforeUnmount, type Ref } from 'vue'

export interface UseFlashHighlightOptions<T> {
  /** 闪烁总时长(毫秒)。默认 5000 */
  durationMs?: number
  /** 把 id 反查成实际对象(找不到返回 null)。典型:(id) => dump.nodes.find(...) */
  lookup: (id: number) => T | null
}

export interface UseFlashHighlightResult<T> {
  /** 当前闪烁的对象(会在 durationMs 后自动变 null) */
  target: Readonly<Ref<T | null>>
  /**
   * 动画重播计数器:每次 sourceId 变化都 +1,给 `<rect :key="animationKey">`
   * 使用,强制 Vue 重建 DOM 以重播 CSS 动画
   */
  animationKey: Readonly<Ref<number>>
}

/**
 * @param sourceId 外部 id 源(reactive 或 getter)。变化规则:
 *   - 非 null → 启动计时,target 立即变为 lookup(id);durationMs 后自动清空
 *   - null → 立即清空 target,取消计时
 * @param options 配置(duration + lookup)
 */
export function useFlashHighlight<T>(
  sourceId: Ref<number | null | undefined> | (() => number | null | undefined),
  options: UseFlashHighlightOptions<T>
): UseFlashHighlightResult<T> {
  const { durationMs = 5000 } = options
  const activeId = shallowRef<number | null>(null)
  const animationKey = shallowRef(0)
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  watch(sourceId, (id) => {
    clearTimer()
    if (id == null) {
      activeId.value = null
      return
    }
    activeId.value = id
    animationKey.value++
    timer = setTimeout(() => {
      activeId.value = null
      timer = null
    }, durationMs)
  })

  onBeforeUnmount(clearTimer)

  const target = computed<T | null>(() =>
    activeId.value == null ? null : options.lookup(activeId.value)
  )

  return { target, animationKey }
}
