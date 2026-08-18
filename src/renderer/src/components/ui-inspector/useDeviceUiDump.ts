/**
 * useDeviceUiDump · 云机 UI dump 拉取 + 自动刷新
 *
 * 把 UiInspectorOverlay 里"拉 dump、定时刷新、清理"的副作用单独收成 composable:
 *  - 状态:dump / loading / error
 *  - 行为:device 变化或 enabled 切换时自动 start/stop
 *  - 生命周期:onBeforeUnmount 自动停掉 timer,不留悬挂
 *
 * 设计要点(避免历史 bug):
 *  - watch 加 immediate: true —— 否则首次挂载时 enabled 一直为 true,
 *    watcher 不触发,dump 永远拉不到,点选无响应。这是真实踩过的坑。
 *  - 不静默吞错(原实现 catch 块带 quiet 注释,让 dump 失败时用户看不到任何反馈),
 *    改为存到 error.value,UI 自行决定怎么提示。
 */

import { onBeforeUnmount, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { Device } from '@shared/ipc/data.types'
import { getDeviceModuleJson } from '@renderer/utils/deviceApi'
import { parseDumpXml } from './dumpParser'
import type { DumpResult } from './types'

export interface UseDeviceUiDumpOptions {
  /** 是否启用自动刷新;false 立即停止 timer 并清空 dump */
  enabled: MaybeRefOrGetter<boolean>
  /** 自动刷新间隔 ms,默认 2000 */
  intervalMs?: number
}

export function useDeviceUiDump(
  device: MaybeRefOrGetter<Device | null>,
  options: UseDeviceUiDumpOptions
) {
  const dump = shallowRef<DumpResult | null>(null)
  const loading = shallowRef(false)
  const error = shallowRef<string | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null
  const intervalMs = options.intervalMs ?? 2000

  async function fetchOnce(): Promise<void> {
    const d = toValue(device)
    if (!d || loading.value) return
    loading.value = true
    error.value = null
    try {
      const xml = await getDeviceModuleJson<string>(d, 'accessibility', 'dump')
      dump.value = parseDumpXml(xml)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  function start(): void {
    stop()
    void fetchOnce()
    timer = setInterval(() => void fetchOnce(), intervalMs)
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  function clear(): void {
    stop()
    dump.value = null
    error.value = null
  }

  // immediate: true —— 首次挂载就根据当前 enabled / device 状态启动或停止。
  //
  // 职责分离:
  //   clear() = 数据过期(设备切换或无设备)→ 清空 dump
  //   stop()  = 停止轮询但**保留** dump(冻结模式下 overlay 还需要渲染高亮/闪烁)
  //
  // 历史行为曾把 "enabled=false" 直接 clear,导致冻结模式下 overlay 数据消失;
  // 现在只在设备真正变更时清空,冻结只停轮询。
  watch(
    [() => toValue(options.enabled), () => toValue(device)?.id ?? null],
    ([enabled, deviceId], oldValues) => {
      const oldDeviceId = oldValues?.[1] ?? null
      const deviceChanged = oldDeviceId != null && oldDeviceId !== deviceId
      if (!deviceId || deviceChanged) {
        clear()
      }
      if (enabled && deviceId) {
        start()
      } else {
        stop()
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(stop)

  return {
    dump,
    loading,
    error,
    /** 强制立即拉一次(用户主动刷新时调用) */
    refresh: fetchOnce
  }
}
