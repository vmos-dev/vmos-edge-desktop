import { ref, onMounted, onUnmounted, unref } from 'vue'
import type { Ref } from 'vue'

// 防抖函数：resize 停止后才触发，避免前沿节流丢失末尾事件
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return function (this: any, ...args: any[]) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      func.apply(this, args)
      timer = null
    }, wait)
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

  // 根据配置决定是否防抖
  const processResize = options.throttleTime
    ? debounce(handleResize, options.throttleTime)
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
