/**
 * Flow Engine 心跳
 *
 * ─── 状态语义(单一真相源)───
 *   unknown        :无设备或首次请求尚未回来
 *   online         :/health 2xx 且拿到 data.version
 *   update-available:/health 2xx 且 data.versionCode 小于当前应用携带的引擎版本
 *   offline        :fetch 抛异常(DNS / 连接拒绝 / 超时 等主机不可达)
 *   not-installed  :请求返回了(HTTP 连通),但服务不存在 / 返回体不合契约
 *                   —— 主机通但服务没装,和"离线"语义不同
 *
 * version 仅在 status=online/update-available 时有值;其他状态恒为 null。不拆 ref,别用 "online=false"
 * 模糊两种失败类型 —— 上层文案要区分"检查网络" vs "部署服务"。
 *
 * 行为:
 *   - 挂载 / 设备变化 → 立即拉一次
 *   - 之后每 30s 一次;HTTP 响应契约 `{ data: { version, versionCode, ... } }`
 *   - 设备切换时作废在飞的旧请求(AbortController)
 *   - retry() 手动触发一次立即拉取(UI 点"重试"用)
 */
import { shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import type { Device } from '@shared/ipc/data.types'
import { BUNDLED_FLOW_ENGINE_VERSION_CODE, FLOW_ENGINE_PORT } from '@shared/constant/flowEngine'

const HEALTH_POLL_INTERVAL_MS = 30 * 1000

/**
 * 单次 /health 请求超时 ms;超时会 abort fetch,和网络错误一样走 offline 计数。
 * 30s 轮询间隔留足 overhead,超时 10s 既不会拖到下一轮,也能容忍慢链路。
 */
const HEALTH_REQUEST_TIMEOUT_MS = 10 * 1000

export type FlowEngineStatus =
  | 'unknown'
  | 'online'
  | 'offline'
  | 'not-installed'
  | 'update-available'

/**
 * 白名单:状态允许运行工作流。加新状态时在这里主动决策:
 * 能否触发运行?不能就不加进来(调用方自动禁用运行按钮)。
 */
export const RUNNABLE_FLOW_ENGINE_STATUSES: readonly FlowEngineStatus[] = ['online']

interface HealthEnvelope {
  code?: number
  message?: string
  data?: {
    version?: string
    versionCode?: number
    name?: string
    status?: string
  }
}

export function useFlowEngineHealth(device: Ref<Device | null>) {
  const status = shallowRef<FlowEngineStatus>('unknown')
  const version = shallowRef<string | null>(null)
  const versionCode = shallowRef<number | null>(null)

  let timer: ReturnType<typeof setInterval> | null = null
  let abortController: AbortController | null = null

  function buildUrl(d: Device): string {
    return `http://${d.host_ip}:${FLOW_ENGINE_PORT}/health`
  }

  // ── 状态转换函数(约束 status ↔ version 的绑定关系,防止调用点误用)──
  function markOnline(ver: string, code: number | null): void {
    status.value = 'online'
    version.value = ver
    versionCode.value = code
  }
  function markUpdateAvailable(ver: string, code: number): void {
    status.value = 'update-available'
    version.value = ver
    versionCode.value = code
  }
  function markFailed(why: 'offline' | 'not-installed'): void {
    status.value = why
    version.value = null
    versionCode.value = null
  }
  function markUnknown(): void {
    status.value = 'unknown'
    version.value = null
    versionCode.value = null
  }

  async function fetchHealth(): Promise<void> {
    if (!device.value) return
    abortController?.abort()
    const ctrl = new AbortController()
    abortController = ctrl

    // 超时触发 abort;`timedOut` 标志用于区分"超时 abort"(算失败)
    // 与"外部 abort"(设备切换/卸载,静默退出,不算失败)。
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      ctrl.abort()
    }, HEALTH_REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(buildUrl(device.value), { signal: ctrl.signal })

      if (!res.ok) {
        // HTTP 连通但响应非 2xx(404/500)—— 主机在,服务不在 / 路径不对
        markFailed('not-installed')
        return
      }
      const body = (await res.json().catch(() => null)) as HealthEnvelope | null

      const v = body?.data?.version
      if (typeof v === 'string' && v.length > 0) {
        const code = body?.data?.versionCode
        if (typeof code === 'number' && code < BUNDLED_FLOW_ENGINE_VERSION_CODE) {
          markUpdateAvailable(v, code)
        } else {
          markOnline(v, typeof code === 'number' ? code : null)
        }
      } else {
        // HTTP 2xx 但 body 不合契约 —— 路径被别的服务占用或服务返回异常
        markFailed('not-installed')
      }
    } catch {
      // 外部 abort(设备切换/卸载)静默退出;其他(网络错误/超时)立刻判 offline
      if (ctrl.signal.aborted && !timedOut) return
      markFailed('offline')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    abortController?.abort()
    abortController = null
  }

  function start(): void {
    stop()
    // 切设备时先回 unknown,避免显示老设备的状态残留到新 fetch 返回前
    markUnknown()
    void fetchHealth()
    timer = setInterval(() => void fetchHealth(), HEALTH_POLL_INTERVAL_MS)
  }

  // 只 watch URL 真正依赖的字段(host_ip),避免 DEVICE_UPDATED 等事件把 device ref
  // 换成新对象(内容没变)就 restart 轮询 —— 那会让 version chip 反复闪"正在检测"。
  // host_ip 没变就不重启,chip 稳定;host_ip 变了才进"切设备"过渡(markUnknown)。
  watch(
    () => device.value?.host_ip ?? null,
    (hostIp) => {
      if (hostIp) {
        start()
      } else {
        stop()
        markUnknown()
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(stop)

  return { status, version, versionCode, retry: fetchHealth }
}
