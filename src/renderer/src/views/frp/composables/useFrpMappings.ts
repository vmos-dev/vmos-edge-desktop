import { shallowRef, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElNotification } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { FRP_EVENTS } from '@shared/ipc/frp.types'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import type {
  FrpMapping,
  EnabledStates,
  DevicePortType,
  ToggleHostRequest,
  ToggleDeviceRequest,
  BatchToggleRequest,
  BatchToggleResult
} from '@shared/ipc/frp.types'
import type { FlatData, Host, Device } from '@shared/ipc/data.types'

export interface MappingTreeHost {
  hostIp: string
  hostName: string
  hostId: string
  hostStatus: 'online' | 'offline' | 'unknown'
  hostEnabled: boolean
  hostMappings: FrpMapping[]
  devices: MappingTreeDevice[]
}

export interface MappingTreeDevice {
  deviceId: string
  deviceName: string
  hostIp: string
  deviceEnabled: boolean
  state: string
  mappings: FrpMapping[]
}

export function useFrpMappings() {
  const { t } = useI18n()
  const mappings = shallowRef<FrpMapping[]>([])
  const hosts = shallowRef<Host[]>([])
  const devices = shallowRef<Device[]>([])
  const enabledHostIps = shallowRef<Set<string>>(new Set())
  const enabledDeviceIds = shallowRef<Set<string>>(new Set())
  const loading = shallowRef(false)
  const searchText = shallowRef('')
  const stateFilter = shallowRef<string[]>(['running'])

  const fetchMappings = async () => {
    const res = await ipc.invoke<FrpMapping[]>(FRP_EVENTS.GET_MAPPINGS)
    if (res.success && res.data) {
      mappings.value = res.data
    }
  }

  const fetchTreeData = async () => {
    const res = await ipc.invoke<FlatData>(DATA_EVENTS.GET_FLAT_DATA)
    if (res.success && res.data) {
      hosts.value = res.data.hosts
      devices.value = res.data.devices
    }
  }

  const fetchEnabledStates = async () => {
    try {
      const res = await ipc.invoke<EnabledStates>(FRP_EVENTS.GET_ENABLED_STATES)
      if (res.success && res.data) {
        enabledHostIps.value = new Set(res.data.hostIps)
        enabledDeviceIds.value = new Set(res.data.deviceIds)
      }
    } catch {
      // 主进程可能尚未注册此 handler，静默降级
    }
  }

  const refresh = async () => {
    loading.value = true
    try {
      await Promise.all([fetchMappings(), fetchTreeData(), fetchEnabledStates()])
    } finally {
      loading.value = false
    }
  }

  const treeData = computed<MappingTreeHost[]>(() => {
    const mappingMap = new Map<string, FrpMapping[]>()
    const hostHasMapping = new Set<string>()
    for (const m of mappings.value) {
      const key = m.device_id
      if (!mappingMap.has(key)) mappingMap.set(key, [])
      mappingMap.get(key)!.push(m)
      hostHasMapping.add(m.host_ip)
    }

    const hostDeviceMap = new Map<string, Device[]>()
    for (const d of devices.value) {
      const ip = d.host_ip || ''
      if (!hostDeviceMap.has(ip)) hostDeviceMap.set(ip, [])
      hostDeviceMap.get(ip)!.push(d)
    }

    const result: MappingTreeHost[] = []
    const search = searchText.value.toLowerCase()

    for (const host of hosts.value) {
      const hostDevices = hostDeviceMap.get(host.ip) || []

      const treeDevices: MappingTreeDevice[] = hostDevices
        .filter((d) => {
          if (stateFilter.value.length > 0 && !stateFilter.value.includes(d.state || '')) {
            return false
          }
          if (!search) return true
          const label = d.user_name || d.short_id || d.id
          return label.toLowerCase().includes(search) || d.id.toLowerCase().includes(search)
        })
        .map((d) => ({
          deviceId: d.id,
          deviceName: d.user_name || d.short_id || d.id,
          hostIp: host.ip,
          deviceEnabled:
            enabledDeviceIds.value.has(d.id) || (mappingMap.get(d.id)?.length ?? 0) > 0,
          state: d.state || '',
          mappings: mappingMap.get(d.id) || []
        }))

      if (
        search &&
        treeDevices.length === 0 &&
        !host.ip.includes(search) &&
        !host.name?.toLowerCase().includes(search)
      ) {
        continue
      }

      result.push({
        hostIp: host.ip,
        hostName: host.name || host.ip,
        hostId: host.id,
        hostStatus: host.status || 'unknown',
        hostEnabled: enabledHostIps.value.has(host.ip),
        hostMappings: mappingMap.get('host')?.filter((m) => m.host_ip === host.ip) || [],
        devices: treeDevices
      })
    }

    return result
  })

  const toggleHost = async (hostIp: string, enabled: boolean) => {
    const res = await ipc.invoke<void, ToggleHostRequest>(FRP_EVENTS.TOGGLE_HOST, {
      hostIp,
      enabled
    })
    if (res.success) await refresh()
    return res
  }

  const toggleDevice = async (
    deviceId: string,
    hostIp: string,
    enabled: boolean,
    portTypes?: DevicePortType[]
  ) => {
    const res = await ipc.invoke<void, ToggleDeviceRequest>(FRP_EVENTS.TOGGLE_DEVICE, {
      deviceId,
      hostIp,
      enabled,
      portTypes
    })
    if (res.success) await refresh()
    return res
  }

  const batchToggle = async (
    items: { deviceId: string; hostIp: string }[],
    enabled: boolean,
    portTypes?: DevicePortType[]
  ) => {
    const res = await ipc.invoke<BatchToggleResult, BatchToggleRequest>(FRP_EVENTS.BATCH_TOGGLE, {
      items,
      enabled,
      portTypes
    })
    if (res.success) await refresh()
    return res
  }

  let offMappingsUpdated: (() => void) | null = null
  let offDeviceUpdated: (() => void) | null = null
  let offDeviceDeleted: (() => void) | null = null
  let offHostUpdated: (() => void) | null = null
  let offConnectionsPersist: (() => void) | null = null
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  const schedulePoll = () => {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = setTimeout(() => {
      fetchMappings()
      fetchEnabledStates()
      schedulePoll()
    }, 5000)
  }

  onMounted(() => {
    refresh()
    schedulePoll()

    offMappingsUpdated = ipc.on(FRP_EVENTS.MAPPINGS_UPDATED, () => {
      fetchMappings()
      fetchEnabledStates()
      schedulePoll()
    })

    offDeviceUpdated = ipc.on(DATA_EVENTS.DEVICE_UPDATED, () => {
      fetchTreeData()
      schedulePoll()
    })

    offDeviceDeleted = ipc.on(DATA_EVENTS.DEVICE_DELETED, () => {
      fetchTreeData()
      fetchMappings()
      fetchEnabledStates()
      schedulePoll()
    })

    offHostUpdated = ipc.on(DATA_EVENTS.HOST_UPDATED, () => {
      fetchTreeData()
      schedulePoll()
    })

    offConnectionsPersist = ipc.on<number[]>(FRP_EVENTS.CONNECTIONS_PERSIST, (ports) => {
      // 持久通知（duration:0 不自动消失），用户必须手动关闭 —— 这是需要警觉的状态
      ElNotification({
        type: 'warning',
        title: t('frp.message.connectionsPersistTitle'),
        message: t('frp.message.connectionsPersist', { ports: ports.join(', ') }),
        duration: 0,
        showClose: true,
        position: 'bottom-right'
      })
    })
  })

  onUnmounted(() => {
    if (pollTimer) clearTimeout(pollTimer)
    offMappingsUpdated?.()
    offDeviceUpdated?.()
    offDeviceDeleted?.()
    offHostUpdated?.()
    offConnectionsPersist?.()
  })

  return {
    mappings,
    treeData,
    loading,
    searchText,
    stateFilter,
    refresh,
    toggleHost,
    toggleDevice,
    batchToggle
  }
}
