import { ref, type Ref, watch } from 'vue'
import { type Device } from '@shared/ipc/data.types'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import { debounce } from 'lodash-es'

export function useGroupControl(selectedRows: Ref<Device[]>) {
  // 默认开启群控
  const isGroupControl = ref(false)

  // 节流 上报需要被控制的设备
  const reportGroupControlDevices = debounce(() => {
    ipc.send(
      DATA_EVENTS.GROUP_CONTROL_DEVICES,
      selectedRows.value?.map((device) => ({
        id: device.id,
        ip: device.ip,
        host_ip: device.host_ip,
        network_mode: device.network_mode,
        tcp_control_port: device.tcp_control_port,
        tcp_audio_port: device.tcp_audio_port,
        tcp_port: device.tcp_port,
        state: device.state,
        user_name: device.user_name
      }))
    )
  }, 300)

  // 清空需要被控制的设备
  const clearGroupControlDevices = () => {
    ipc.send(DATA_EVENTS.GROUP_CONTROL_DEVICES, [])
  }

  // 保存 watch 的 stop 函数
  let stopWatch: (() => void) | null = null

  // 开启监听
  const startWatch = () => {
    if (stopWatch) return
    console.log('开始监听群控设备:', selectedRows.value)

    stopWatch = watch(
      () => selectedRows.value,
      () => {
        reportGroupControlDevices()
      },
      {
        immediate: true,
        deep: true
      }
    )
  }

  // 停止监听
  const stopWatchGroup = () => {
    if (stopWatch) {
      console.log('停止监听群控设备')
      stopWatch()
      stopWatch = null
    }
  }

  // 监听群控停止事件（如主控窗口被关闭）
  ipc.on(DATA_EVENTS.GROUP_CONTROL_STOPPED, () => {
    isGroupControl.value = false
  })

  watch(
    () => isGroupControl.value,
    (newVal) => {
      console.log('群控开关切换:', newVal)
      if (newVal) {
        startWatch()
        reportGroupControlDevices()
      } else {
        stopWatchGroup()
        clearGroupControlDevices()
      }
    }
  )

  return {
    isGroupControl
  }
}
