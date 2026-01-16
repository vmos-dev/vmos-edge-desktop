import { toRaw } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ipc, CLOUD_CREATE, CLOUD_CLOSE, CLOUD_ARRANGE } from '@renderer/core/ipc'
import { DATA_EVENTS, type Device, DeviceState, type Host } from '@shared/ipc/data.types'
import type { TreeNode } from './useCloudTree'
import { DeviceStateMap, DeviceType } from '@renderer/utils/constant'
import { request, getErrorMessage } from '@shared/api'
import { buildApiUrl, API_CONFIG } from '@shared/api'

// 接口定义操作所需的 Refs
export interface OperationRefs {
  updateDeviceNameRef: any // 具体类型可以在使用处定义
  deviceInfoRef: any // 具体类型可以在使用处定义
  updateImageRef: any
  newMachineRef: any
  deviceCloneRef: any
  setProxyRef: any
  setTimeZoneLanguageRef: any
  execCommandRef: any
  batchInstallRef: any
  modifyPositionRef: any
  // 其他弹窗 Ref 可以根据需要添加
}

// const parseImageDate = (version: string): number => {
//   const match = version.match(/(\d{8})/i)
//   return match ? Number(match[1]) : 0
// }

// const imageSupportVersionTime = __IMAGE_SUPPORT_VERSION_TIME__
export function useCloudOperations(hostIpMap: Map<string, TreeNode>, refs: OperationRefs) {
  console.log('useCloudOperations initialized with refs:', refs, 'keys:', Object.keys(refs))
  const deviceMenuList: { label: string; command: string; divided?: boolean }[] = [
    { label: '启动云机', command: 'start' },
    { label: '重启云机', command: 'restart' },
    { label: '关闭云机', command: 'shutdown' },
    { label: '云机详情', command: 'cloud-details', divided: true },
    { label: '修改名称', command: 'rename' },
    { label: 'API接口', command: 'api-interface' },
    { label: '修改镜像', command: 'modify-config', divided: true },
    { label: '设置代理', command: 'set-proxy' },
    { label: '关闭代理', command: 'close-proxy' },
    { label: '语言时区', command: 'set-timezone-language' },
    { label: '一键新机', command: 'renew', divided: true },
    { label: '重置云机', command: 'reset' },
    { label: '克隆云机', command: 'clone' },
    { label: '删除云机', command: 'delete', divided: true }
  ]

  const getDeviceMenuItems = (device: Device) => {
    if (!device) return []
    const state = device.state

    if (state === DeviceState.StateOffline) {
      return []
    }

    if (state === DeviceState.StateStopped) {
      const allowedCommands = [
        'start',
        'delete',
        'clone',
        'rename',
        'modify-config',
        //  'renew',
        'api-interface'
      ]
      return deviceMenuList.filter((item) => allowedCommands.includes(item.command))
    }

    return deviceMenuList.filter((item) => item.command !== 'start')
  }

  const getBatchOperationItems = (_rows: Device[]) => {
    return [
      // 启动/重启/关闭相关
      { label: '启动云机', command: 'start' },
      { label: '重启云机', command: 'restart' },
      { label: '关闭云机', command: 'shutdown' },

      // 镜像与系统操作
      { label: '一键新机', command: 'renew', divided: true },
      { label: '重置云机', command: 'reset' },
      { label: '删除云机', command: 'delete' },

      // 工具和功能操作
      { label: '执行命令', command: 'execute-command', divided: true },
      { label: '批量安装', command: 'batch-install' },
      { label: '批量上传', command: 'batch-upload' },
      { label: '修改位置', command: 'modify-location' },

      // 其它便利功能
      { label: '一键投屏', command: 'cast', divided: true },
      { label: '一键排序', command: 'sort' },
      { label: '一键关闭', command: 'close-window' }
    ]
  }

  const handleOpenWindow = (row: Device) => {
    // if (parseImageDate(row.image || '') < Number(imageSupportVersionTime)) {
    //   ElMessage.warning(
    //     `仅支持时间 ≥ ${imageSupportVersionTime} 的云机镜像，该镜像版本暂不支持投屏`
    //   )
    //   return
    // }
    ipc.send(CLOUD_CREATE, {
      deviceId: row.id
    })
  }

  const handleCloseProxy = async (devices: Device[]) => {
    try {
      await request.get(
        buildApiUrl(
          devices[0].host_ip || '',
          `${API_CONFIG.PATHS.CLOSE_PROXY}/${devices[0].db_id || ''}`
        )
      )
      ElMessage.success('操作成功')
    } catch (error) {
      const errorMsg = getErrorMessage(error)
      ElMessage.error(errorMsg || '代理关闭失败')
    }
  }
  // --- Validators ---
  const requireState = (state: DeviceState, msg: string) => (devices: Device[]) =>
    devices.some((d) => d.state !== state) ? msg : undefined

  const requireNotState = (state: DeviceState, msg: string) => (devices: Device[]) =>
    devices.some((d) => d.state === state) ? msg : undefined

  const requireSingle =
    (msg: string = '该操作只能针对单个云机') =>
    (devices: Device[]) =>
      devices.length !== 1 ? msg : undefined

  /**
   * 获取设备的实际类型
   * device_type 为空或者是 'real'，就是真机
   * device_type 是 'virtual'，就是虚拟机
   * @param device 设备对象
   * @returns 'real' | 'virtual'
   */
  const getDeviceActualType = (device: Device): string => {
    // device_type 为空或者是 'real'，就是真机
    if (!device.device_type || device.device_type === DeviceType.REAL) {
      return DeviceType.REAL
    }
    // device_type 是 'virtual'，就是虚拟机
    return DeviceType.VIRTUAL
  }

  // --- Command Configs ---
  interface CommandConfig {
    validator?: (devices: Device[]) => string | undefined
    confirm?: {
      message: string | ((devices: Device[]) => string)
      title?: string
      type?: 'warning' | 'info' | 'error' | 'success'
    }
    action: string | ((devices: Device[]) => void | Promise<any>)
  }

  const commandConfigs: Record<string, CommandConfig> = {
    reset: {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要重置的云机'
        return requireState(
          DeviceState.StateRunning,
          `仅支持重置处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机`
        )(devices)
      },
      confirm: {
        message: (devices) =>
          `确定要重置${devices.length > 1 ? `选中的 ${devices.length} 台` : ''}云机吗？此操作将清除所有数据且不可恢复，请谨慎操作。`,
        type: 'warning'
      },
      action: DATA_EVENTS.DEVICE_RESETED
    },
    shutdown: {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要关闭的云机'
        return requireState(
          DeviceState.StateRunning,
          `仅支持关闭处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机`
        )(devices)
      },
      confirm: {
        message: (devices) =>
          `确定要关闭${devices.length > 1 ? `选中的 ${devices.length} 台` : ''}云机吗？`,
        type: 'warning'
      },
      action: DATA_EVENTS.DEVICE_SHUTDOWNED
    },
    start: {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要启动的云机'
        const stateError = requireState(
          DeviceState.StateStopped,
          `仅支持启动处于${DeviceStateMap[DeviceState.StateStopped]}状态的云机`
        )(devices)
        if (stateError) return stateError

        const LIMIT_PER_HOST = 12
        const hostGroups = new Map<string, number>()

        devices.forEach((d) => {
          const ip = d.host_ip || ''
          if (ip) {
            hostGroups.set(ip, (hostGroups.get(ip) || 0) + 1)
          }
        })

        for (const [ip, countToStart] of hostGroups) {
          const hostNode = hostIpMap.get(ip)
          if (!hostNode || !hostNode.children) continue

          const currentRunningCount = hostNode.children.filter((childNode) => {
            const device = childNode.originalData as Device
            return (
              device.state !== DeviceState.StateStopped && device.state !== DeviceState.StateFailed
            )
          }).length

          if (currentRunningCount + countToStart > LIMIT_PER_HOST) {
            return `主机 ${ip} 资源不足（上限 ${LIMIT_PER_HOST} 台），当前已运行 ${currentRunningCount} 台，无法再启动 ${countToStart} 台`
          }
        }
        return undefined
      },
      confirm: {
        message: (devices) =>
          `确定要启动${devices.length > 1 ? `选中的 ${devices.length} 台` : ''}云机吗？`,
        type: 'warning'
      },
      action: DATA_EVENTS.DEVICE_STARTED
    },
    delete: {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要删除的云机'
        return requireNotState(
          DeviceState.StateDeleting,
          '部分选中的云机正在删除中，请勿重复操作'
        )(devices)
      },
      confirm: {
        message: (devices) =>
          `确定要删除${devices.length > 1 ? `选中的 ${devices.length} 台` : ''}云机吗？删除后数据无法恢复。`,
        type: 'warning'
      },
      action: DATA_EVENTS.DEVICE_DELETED
    },
    restart: {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要重启的云机'
        return requireState(
          DeviceState.StateRunning,
          `仅支持重启处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机`
        )(devices)
      },
      confirm: {
        message: (devices) =>
          `确定要重启${devices.length > 1 ? `选中的 ${devices.length} 台` : ''}云机吗？运行中的任务将会中断。`,
        type: 'warning'
      },
      action: DATA_EVENTS.DEVICE_RESTARTED
    },
    rename: {
      validator: (devices) => {
        if (devices.length === 0) return '请选择需要修改名称的云机'
        return requireSingle('请选择单台云机进行名称修改')(devices)
      },
      action: (devices) => refs.updateDeviceNameRef.value?.init(devices[0])
    },
    'modify-config': {
      validator: (devices) => {
        if (devices.length === 0) return '请选择需要修改镜像的云机'
        return requireSingle('请选择单台云机修改镜像')(devices)
      },
      action: (devices) => {
        const device = devices[0]
        const hostIp = device.host_ip || ''
        const hostNode = hostIpMap.get(hostIp)
        // hostNode.originalData is used in index.vue, but check TreeNode definition
        // In index.vue: data.originalData as Host.
        // Let's assume TreeNode has originalData or data.
        // In read_file of index.vue: data.originalData.
        // In useCloudTree.ts (not read fully), but let's check generic TreeNode usage.
        // We'll try accessing data or originalData.
        // Actually, if I look at index.vue, it accesses `data.originalData`.
        // So I will use `(hostNode as any)?.originalData`.
        const host = (hostNode as any)?.originalData
        refs.updateImageRef.value?.init(device, host)
      }
    },
    'set-proxy': {
      validator: (devices) => {
        if (devices.length === 0) return '请选择需要设置代理的云机'
        const singleError = requireSingle('请选择单台云机设置代理')(devices)
        if (singleError) return singleError
        return requireState(DeviceState.StateRunning, `仅支持为运行中的云机设置代理`)(devices)
      },
      action: (devices) => {
        if (refs.setProxyRef && refs.setProxyRef.value) {
          refs.setProxyRef.value.init(devices[0])
        }
      }
    },
    'close-proxy': {
      validator: (devices) => {
        if (devices.length === 0) return '请选择需要关闭代理的云机'
        const singleError = requireSingle('请选择单台云机关闭代理')(devices)
        if (singleError) return singleError
        return requireState(DeviceState.StateRunning, `仅支持为运行中的云机关闭代理`)(devices)
      },
      action: (devices) => {
        handleCloseProxy(devices)
      }
    },
    'set-timezone-language': {
      validator: (devices) => {
        if (devices.length === 0) return '请选择需要设置语言时区的云机'
        const singleError = requireSingle('请选择单台云机设置语言时区')(devices)
        if (singleError) return singleError
        return requireState(DeviceState.StateRunning, `仅支持为运行中的云机设置语言时区`)(devices)
      },
      action: (devices) => {
        if (refs.setTimeZoneLanguageRef && refs.setTimeZoneLanguageRef.value) {
          refs.setTimeZoneLanguageRef.value.init(devices[0])
        }
      }
    },
    renew: {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要一键新机的云机'

        // 状态必须是运行中
        const stateError = requireState(
          DeviceState.StateRunning,
          `仅支持一键新机处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机`
        )(devices)
        if (stateError) return stateError

        // 云机类型必须一致
        // device_type 为空或者是 'real'，就是真机
        // device_type 是 'virtual'，就是虚拟机
        if (devices.length > 1) {
          const firstDeviceType = getDeviceActualType(devices[0])
          const hasDifferentType = devices.some(
            (device) => getDeviceActualType(device) !== firstDeviceType
          )

          if (hasDifferentType) {
            return `批量一键新机时，所有云机类型必须一致。当前选中了不同类型的云机。`
          }
        }

        return undefined
      },
      action: (devices) => {
        const hosts = new Map<string, Host>()
        devices.forEach((d) => {
          const hostIp = d.host_ip || ''
          const hostNode = hostIpMap.get(hostIp)
          const host = (hostNode as any)?.originalData as Host
          if (host) {
            hosts.set(hostIp, host)
          }
        })
        refs.newMachineRef.value?.init(devices, hosts)
      }
    },
    'api-interface': {
      validator: requireSingle('请选择单台云机查看API接口'),
      action: DATA_EVENTS.HOST_OPEN_API_DETAIL
    },
    'execute-command': {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择云机'
        return requireState(
          DeviceState.StateRunning,
          `仅支持为处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机执行命令`
        )(devices)
      },
      action: (devices) => {
        if (refs.execCommandRef && refs.execCommandRef.value) {
          refs.execCommandRef.value.init(devices)
        }
      }
    },
    'cloud-details': {
      validator: requireSingle('请选择单台云机查看详情'),
      action: (devices) => {
        console.log('cloud-details action triggered', devices, refs.deviceInfoRef)
        if (refs.deviceInfoRef && refs.deviceInfoRef.value) {
          refs.deviceInfoRef.value.init(devices[0])
        } else {
          console.error('deviceInfoRef is null or undefined', refs.deviceInfoRef)
        }
      }
    },
    clone: {
      validator: requireState(
        DeviceState.StateStopped,
        `仅支持克隆处于${DeviceStateMap[DeviceState.StateStopped]}状态的云机`
      ),
      action: (devices) => {
        if (refs.deviceCloneRef && refs.deviceCloneRef.value) {
          // 需要获取 host 数据，这里暂时只传 device
          // 如果需要 host，可以从 hostIpMap 获取
          const device = devices[0]
          const host = hostIpMap.get(device.host_ip || '')
          refs.deviceCloneRef.value.init(device, host)
        }
      }
    },
    upgrade: {
      validator: (devices) =>
        devices.some(
          (d) => d.state === DeviceState.StateUpgrading || d.state === DeviceState.StateDeleting
        )
          ? '部分选中的云机正在升级或删除中，暂时无法执行升级操作'
          : undefined,
      action: () => console.log('升级云机')
    },
    cast: {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要投屏的云机'

        const stateError = requireState(
          DeviceState.StateRunning,
          `仅支持投屏处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机`
        )(devices)
        if (stateError) return stateError

        //         const imageError = devices.filter(
        //           (d) => parseImageDate(d.image || '') < Number(imageSupportVersionTime)
        //         )

        //         if (imageError.length > 0)
        //           return `仅支持时间 ≥ ${imageSupportVersionTime} 的云机镜像。
        // 当前有 ${imageError.length} 台云机 使用的镜像版本过旧，暂无法投屏，请升级镜像后重试。`

        return undefined
      },
      action: (devices) => {
        devices.forEach((d, i) => {
          if (d.state === DeviceState.StateRunning) {
            setTimeout(() => {
              handleOpenWindow(d)
            }, i * 200)
          }
        })
      }
    },
    sort: {
      action: () => ipc.send(CLOUD_ARRANGE)
    },
    'close-window': {
      action: () => {
        ipc.send(CLOUD_CLOSE, { closeAll: true })
      }
    },
    'batch-install': {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要批量安装的云机'
        return requireState(
          DeviceState.StateRunning,
          `仅支持批量安装处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机`
        )(devices)
      },
      action: (devices) => {
        refs.batchInstallRef.value?.init(devices, 'install')
      }
    },
    'batch-upload': {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要批量上传的云机'
        return requireState(
          DeviceState.StateRunning,
          `仅支持批量上传处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机`
        )(devices)
      },
      action: (devices) => {
        refs.batchInstallRef.value?.init(devices, 'upload')
      }
    },
    'modify-location': {
      validator: (devices) => {
        if (devices.length === 0) return '请先选择需要修改位置的云机'
        return requireState(
          DeviceState.StateRunning,
          `仅支持修改位置处于${DeviceStateMap[DeviceState.StateRunning]}状态的云机`
        )(devices)
      },
      action: (devices) => {
        refs.modifyPositionRef.value?.init(devices)
      }
    }
  }

  /**
   * 统一执行命令
   * 包含三个阶段：校验 -> 确认 -> 执行
   * @param command 命令标识
   * @param devices 目标设备列表
   */
  const handleCommand = async (command: string, devices: Device[]) => {
    // 过滤离线设备（除了部分允许离线操作的命令）
    const offlineSafeCommands = ['sort', 'close-window']
    if (!offlineSafeCommands.includes(command)) {
      const originalCount = devices.length
      devices = devices.filter((d) => d.state !== DeviceState.StateOffline)
      if (devices.length === 0 && originalCount > 0) {
        ElMessage.warning('没有可操作的设备')
        return
      }
    }

    const config = commandConfigs[command]
    if (!config) return

    // 1. 执行前校验 (Validator)
    if (config.validator) {
      const error = config.validator(devices)
      if (error) {
        ElMessage.warning(error)
        return
      }
    }

    // 2. 弹出确认框 (Confirm)
    if (config.confirm) {
      const message =
        typeof config.confirm.message === 'function'
          ? config.confirm.message(devices)
          : config.confirm.message

      try {
        await ElMessageBox.confirm(message, config.confirm.title || '操作确认', {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          type: config.confirm.type
        })
      } catch {
        // 用户取消操作
        return
      }
    }

    // 3. 执行具体逻辑 (Action)
    try {
      if (typeof config.action === 'string') {
        // 字符串形式：视为 IPC 事件名，自动调用 ipc.invoke
        const res = await ipc.invoke(
          config.action,
          devices.map((d) => toRaw(d))
        )
        if (res.success) {
          ElMessage.success('操作成功')
        } else {
          ElMessage.error(res.error || '操作失败')
        }
      } else {
        // 函数形式：直接执行回调
        await config.action(devices)
      }
    } catch (e) {
      console.error(e)
      ElMessage.error('操作异常')
    }
  }

  const handleDeviceDropdownClick = (command: string, devices: Device[]) => {
    handleCommand(command, devices)
  }

  return {
    handleCommand,
    handleDeviceDropdownClick,
    handleOpenWindow,
    getDeviceMenuItems,
    getBatchOperationItems
  }
}
