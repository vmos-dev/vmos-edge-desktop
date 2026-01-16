import { ref, onMounted, onUnmounted, unref } from 'vue'
import type { Ref } from 'vue'

// 简单的节流函数
function throttle<T extends (...args: any[]) => any>(func: T, limit: number): T {
  let inThrottle: boolean
  return function (this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  } as T
}

interface UseResizeObserverOptions {
  throttleTime?: number
  onResize?: (entry: ResizeObserverEntry) => void
}

export function useResizeObserver(
  target: Ref<HTMLElement | null | undefined> | HTMLElement,
  options: UseResizeObserverOptions = {}
) {
  const width = ref(0)
  const height = ref(0)
  let observer: ResizeObserver | null = null

  const cleanup = () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  }

  const handleResize = (entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      const { width: w, height: h } = entry.contentRect
      width.value = w
      height.value = h
      options.onResize?.(entry)
    }
  }

  // 根据配置决定是否节流
  const processResize = options.throttleTime
    ? throttle(handleResize, options.throttleTime)
    : handleResize

  onMounted(() => {
    const el = unref(target)
    if (el) {
      observer = new ResizeObserver(processResize)
      observer.observe(el)
    }
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    width,
    height,
    cleanup
  }
}
