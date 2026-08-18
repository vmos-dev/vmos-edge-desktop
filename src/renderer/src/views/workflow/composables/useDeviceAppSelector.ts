/**
 * useDeviceAppSelector · 云机 + 应用选择器的状态机
 *
 * 职责:
 * 1. 从主进程拉 FlatData(groups / hosts / devices)
 * 2. 过滤出:在线主机 + 运行中云机,按主机分组
 * 3. 监听 DEVICE_UPDATED / HOST_UPDATED,实时更新列表
 * 4. 选中云机时自动触发应用扫描(调 useDeviceApps)
 * 5. 选中应用后,标记为"最近使用"
 *
 * 规范落实:
 * - 对外 ref 全部 readonly 包装
 * - 监听器在 onUnmounted 清理
 * - 错误不 throw,放 error.value 给上层
 */

import { ref, computed, watch, readonly, onUnmounted } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { t } from '@renderer/locales'
import {
  DATA_EVENTS,
  DeviceState,
  HostState,
  type Device,
  type Host,
  type FlatData
} from '@shared/ipc/data.types'
import type { AppInfo } from '@shared/ipc/workflow.types'
import { useDeviceApps } from './useDeviceApps'

/** 在线主机 + 该主机下运行中云机的分组视图 */
export interface HostGroup {
  host: Host
  devices: Device[]
}

export function useDeviceAppSelector() {
  // ═══════════════ 状态 ═══════════════

  const hosts = ref<Host[]>([])
  const devices = ref<Device[]>([])
  const loadingTree = ref(false)
  const treeError = ref<string | null>(null)

  const selectedDevice = ref<Device | null>(null)
  const selectedApp = ref<AppInfo | null>(null)

  // 应用扫描通过另一个 composable 处理
  const deviceApps = useDeviceApps()

  // ═══════════════ 计算视图 ═══════════════

  /**
   * 只保留:在线主机 + 运行中云机
   * 对应设计稿里的「按主机分组的云机树」
   */
  const hostGroups = computed<HostGroup[]>(() => {
    const onlineHosts = hosts.value.filter((h) => h.status === HostState.Online)
    return onlineHosts
      .map((host) => ({
        host,
        devices: devices.value.filter(
          (d) =>
            (d.hostId === host.id || d.host_ip === host.ip) && d.state === DeviceState.StateRunning
        )
      }))
      .filter((g) => g.devices.length > 0)
  })

  /** 选择器是否可以确认(云机 + 应用都选了) */
  const canConfirm = computed(() => selectedDevice.value !== null && selectedApp.value !== null)

  // ═══════════════ 加载 + 实时监听 ═══════════════

  let removeDeviceListener: (() => void) | null = null
  let removeHostListener: (() => void) | null = null
  let removeDeviceAddedListener: (() => void) | null = null
  let removeDeviceDeletedListener: (() => void) | null = null

  /**
   * 初次加载:拉 FlatData + 绑定监听器
   * 返回一个 stop 函数供上层组件在关闭时清理
   */
  async function initialize(): Promise<() => void> {
    loadingTree.value = true
    treeError.value = null
    try {
      const res = await ipc.invoke<FlatData>(DATA_EVENTS.GET_FLAT_DATA)
      if (!res.success || !res.data) {
        throw new Error(res.error || t('workflow.misc.loadDeviceFailed'))
      }
      hosts.value = res.data.hosts
      devices.value = res.data.devices
    } catch (e) {
      treeError.value = e instanceof Error ? e.message : String(e)
    } finally {
      loadingTree.value = false
    }

    bindListeners()
    return stopListening
  }

  function bindListeners(): void {
    // 设备变更(单个或批量)
    removeDeviceListener = ipc.on(DATA_EVENTS.DEVICE_UPDATED, (payload: Device | Device[]) => {
      const updates = Array.isArray(payload) ? payload : [payload]
      updates.forEach((u) => {
        const idx = devices.value.findIndex((d) => d.id === u.id)
        if (idx >= 0) {
          // 合并式更新,保留未在 payload 里的字段
          devices.value[idx] = { ...devices.value[idx], ...u }
        } else {
          devices.value.push(u)
        }
      })

      // 选中的云机如果不再 running,清除选择
      const currentSelectedId = selectedDevice.value?.id
      if (
        currentSelectedId &&
        updates.some((u) => u.id === currentSelectedId && u.state !== DeviceState.StateRunning)
      ) {
        deviceApps.invalidate(currentSelectedId)
        selectedDevice.value = null
        selectedApp.value = null
      }
    })

    // 设备新增
    removeDeviceAddedListener = ipc.on(DATA_EVENTS.DEVICE_ADDED, (payload: Device | Device[]) => {
      const additions = Array.isArray(payload) ? payload : [payload]
      additions.forEach((a) => {
        if (!devices.value.some((d) => d.id === a.id)) devices.value.push(a)
      })
    })

    // 设备删除
    removeDeviceDeletedListener = ipc.on(
      DATA_EVENTS.DEVICE_DELETED,
      (payload: Device | Device[]) => {
        const deletions = Array.isArray(payload) ? payload : [payload]
        const ids = new Set(deletions.map((d) => d.id))
        devices.value = devices.value.filter((d) => !ids.has(d.id))
        // 选中的云机被删了 → 清除选择
        if (selectedDevice.value && ids.has(selectedDevice.value.id)) {
          selectedDevice.value = null
          selectedApp.value = null
        }
      }
    )

    // 主机状态变化(上/下线)
    removeHostListener = ipc.on(DATA_EVENTS.HOST_UPDATED, (payload: Host | Host[]) => {
      const updates = Array.isArray(payload) ? payload : [payload]
      updates.forEach((u) => {
        const idx = hosts.value.findIndex((h) => h.id === u.id)
        if (idx >= 0) {
          hosts.value[idx] = { ...hosts.value[idx], ...u }
        } else {
          hosts.value.push(u)
        }
      })
    })
  }

  function stopListening(): void {
    removeDeviceListener?.()
    removeHostListener?.()
    removeDeviceAddedListener?.()
    removeDeviceDeletedListener?.()
    removeDeviceListener = null
    removeHostListener = null
    removeDeviceAddedListener = null
    removeDeviceDeletedListener = null
  }

  onUnmounted(stopListening)

  // ═══════════════ 用户操作 ═══════════════

  /** 选中云机 → 自动扫描应用 */
  function selectDevice(device: Device | null): void {
    selectedDevice.value = device
    selectedApp.value = null // 切换云机时清空之前选的应用
  }

  /** 选中应用 → 记录到"最近使用" */
  function selectApp(app: AppInfo | null): void {
    selectedApp.value = app
    if (app) deviceApps.markUsed(app)
  }

  /** 强制重扫当前云机 */
  async function refreshApps(): Promise<void> {
    if (!selectedDevice.value) return
    await deviceApps.scan(selectedDevice.value, true)
  }

  /** 重置选择状态(打开新对话框时调用) */
  function reset(): void {
    selectedDevice.value = null
    selectedApp.value = null
  }

  // ═══════════════ 响应式:云机切换触发扫描 ═══════════════

  watch(selectedDevice, (device) => {
    if (device) void deviceApps.scan(device)
  })

  return {
    // 树形视图
    hostGroups,
    loadingTree: readonly(loadingTree),
    treeError: readonly(treeError),

    // 选择状态
    selectedDevice: readonly(selectedDevice),
    selectedApp: readonly(selectedApp),
    canConfirm,

    // 应用扫描(从 useDeviceApps 传出,只读)
    appsLoading: deviceApps.loading,
    appsError: deviceApps.error,
    apps: deviceApps.apps,
    getRecentApps: deviceApps.getRecent,

    // Actions
    initialize,
    selectDevice,
    selectApp,
    refreshApps,
    reset
  }
}
