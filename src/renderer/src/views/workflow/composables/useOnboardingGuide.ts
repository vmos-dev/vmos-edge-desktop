import { shallowRef, readonly, onUnmounted, nextTick } from 'vue'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import '../guide/theme.css'
import { t } from '@renderer/locales'

const STORAGE_PREFIX = 'wf-guide-'

/** 模块级互斥:同一时刻只允许一个引导激活,避免 overlay 冲突 */
let activeGuideId: string | null = null

const MAX_RETRIES = 3
const RETRY_INTERVAL = 600

/**
 * 管理单个新手引导组的完整生命周期。
 *
 * @param guideId  引导唯一标识,用于 localStorage 持久化
 * @param steps    driver.js 步骤定义(纯配置,从 guide/steps.ts 传入)
 */
export function useOnboardingGuide(guideId: string, steps: DriveStep[]) {
  const storageKey = STORAGE_PREFIX + guideId
  const isCompleted = shallowRef(localStorage.getItem(storageKey) === '1')
  let instance: Driver | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  /** 尝试启动引导,返回是否成功 */
  function start(): boolean {
    if (instance || isCompleted.value) return false
    if (activeGuideId && activeGuideId !== guideId) return false

    const available = steps.filter((step) => {
      if (!step.element) return true
      const sel = typeof step.element === 'string' ? step.element : null
      return !sel || document.querySelector(sel)
    })
    if (available.length === 0) return false

    const isDark = document.documentElement.classList.contains('dark')

    activeGuideId = guideId
    instance = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: '#000',
      overlayOpacity: isDark ? 0.45 : 0.3,
      stagePadding: 10,
      stageRadius: 12,
      popoverOffset: 12,
      progressText: '{{current}} / {{total}}',
      nextBtnText: t('workflow.misc.guideNext'),
      prevBtnText: t('workflow.misc.guidePrev'),
      doneBtnText: t('workflow.misc.guideDone'),
      steps: available,
      onDestroyed: () => {
        if (activeGuideId === guideId) activeGuideId = null
        // stop() 会先置空 instance 再调 destroy(),此时 instance === null → 跳过标记
        if (instance) {
          localStorage.setItem(storageKey, '1')
          isCompleted.value = true
          instance = null
        }
      }
    })
    instance.drive()
    return true
  }

  /** 带有限重试的自动启动,处理互斥锁阻塞和 DOM 未就绪 */
  function tryAutoStart(attempt = 0): void {
    if (isCompleted.value) return
    clearRetryTimer()

    nextTick(() =>
      requestAnimationFrame(() => {
        if (isCompleted.value) return
        const ok = start()
        if (!ok && attempt < MAX_RETRIES) {
          retryTimer = setTimeout(() => tryAutoStart(attempt + 1), RETRY_INTERVAL)
        }
      })
    )
  }

  /** 主动停止当前引导(不标记为已完成),释放互斥锁 */
  function stop(): void {
    clearRetryTimer()
    if (activeGuideId === guideId) activeGuideId = null
    const d = instance
    instance = null
    d?.destroy()
  }

  function reset(): void {
    stop()
    localStorage.removeItem(storageKey)
    isCompleted.value = false
  }

  function clearRetryTimer(): void {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  onUnmounted(() => {
    stop()
  })

  return {
    start,
    tryAutoStart,
    stop,
    isCompleted: readonly(isCompleted),
    reset
  }
}
