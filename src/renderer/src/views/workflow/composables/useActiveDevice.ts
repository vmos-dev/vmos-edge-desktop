/**
 * useActiveDevice · 从 workflow.defaultDeviceId 派生当前云机
 *
 * 设计:
 *  - workflow.defaultDeviceId 是真相(DB 字段)
 *  - selectedDevice 是派生:watch defaultDeviceId,通过 IPC 查 FlatData 拿 Device
 *  - 订阅 DEVICE_UPDATED / DEVICE_DELETED 事件,远端变更自动同步
 *
 * 覆盖的场景:
 *  - URL 直开 /workflow/:id → workflow.defaultDeviceId 有值 → 自动加载 Device
 *  - 刷新页面 → 同上
 *  - 侧栏切换工作流 → defaultDeviceId 变 → 重新查 Device
 *  - 换云机(setDefaultDevice)→ defaultDeviceId 变 → 重新查 Device
 *  - 设备被远端删除 / 下线 → 主动把 selectedDevice 置 null
 */

import { ref, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, type Device, type FlatData } from '@shared/ipc/data.types'
import type { Workflow } from '@shared/ipc/workflow.types'

export function useActiveDevice(workflow: Ref<Workflow | null> | ComputedRef<Workflow | null>) {
  const device = ref<Device | null>(null)

  async function fetchDevice(deviceId: string): Promise<Device | null> {
    try {
      const res = await ipc.invoke<FlatData>(DATA_EVENTS.GET_FLAT_DATA)
      if (!res.success || !res.data) return null
      return res.data.devices.find((d) => d.id === deviceId) ?? null
    } catch {
      return null
    }
  }

  async function sync(deviceId: string | undefined): Promise<void> {
    if (!deviceId) {
      device.value = null
      return
    }
    if (device.value?.id === deviceId) return
    device.value = await fetchDevice(deviceId)
  }

  // workflow 切换 → 同步云机
  watch(
    () => workflow.value?.defaultDeviceId,
    (id) => {
      void sync(id)
    },
    { immediate: true }
  )

  // 远端云机数据变动 → 更新本地引用
  const offUpdated = ipc.on(DATA_EVENTS.DEVICE_UPDATED, (payload: Device | Device[]) => {
    const current = device.value
    if (!current) return
    const list = Array.isArray(payload) ? payload : [payload]
    const hit = list.find((d) => d.id === current.id)
    if (hit) device.value = hit
  })

  const offDeleted = ipc.on(DATA_EVENTS.DEVICE_DELETED, (payload: string | string[]) => {
    const current = device.value
    if (!current) return
    const ids = Array.isArray(payload) ? payload : [payload]
    if (ids.includes(current.id)) device.value = null
  })

  onUnmounted(() => {
    offUpdated()
    offDeleted()
  })

  return { device }
}
