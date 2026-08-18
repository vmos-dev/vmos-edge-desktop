import { toRaw, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ipc, CLOUD_CREATE, CLOUD_CLOSE, CLOUD_ARRANGE } from '@renderer/core/ipc'
import { DATA_EVENTS, type Device, DeviceState, type Host } from '@shared/ipc/data.types'
import type { TreeNode } from './useCloudTree'
import { DeviceType } from '@renderer/utils/constant'
import { getDeviceStateText } from '@renderer/utils/i18n-maps'
import { request, getErrorMessage } from '@shared/api'
import { buildApiUrl, API_CONFIG } from '@shared/api'
import { useI18n } from 'vue-i18n'

// 接口定义操作所需的 Refs
export interface OperationRefs {
  updateDeviceNameRef: any // 具体类型可以在使用处定义
  deviceInfoRef: any // 具体类型可以在使用处定义
  backupDialogRef: any
  updateImageRef: any
  newMachineRef: any
  deviceCloneRef: any
  setProxyRef: any
  batchProxyRef: any
  setTimeZoneLanguageRef: any
  execCommandRef: any
  batchInstallRef: any
  batchExecuteScriptRef: any
  batchCloseScriptRef: any
  modifyPositionRef: any
  modifySystemPropertiesRef: any
  copyInfoRef: any
  batchExecuteVisible: any
}

export interface CloudContext {
  hostIpMap: Map<string, TreeNode>
  allHostsMap: Map<string, Host>
  getRunningCountByHostIp: (ip: string) => number
}

// const parseImageDate = (version: string): number => {
//   const match = version.match(/(\d{8})/i)
//   return match ? Number(match[1]) : 0
// }

// const imageSupportVersionTime = __IMAGE_SUPPORT_VERSION_TIME__
export function useCloudOperations(context: CloudContext, refs: OperationRefs) {
  const { t } = useI18n()
  const { hostIpMap, allHostsMap, getRunningCountByHostIp } = context
  console.log('useCloudOperations initialized with refs:', refs, 'keys:', Object.keys(refs))
  const deviceMenuList = computed<{ label: string; command: string; divided?: boolean }[]>(() => [
    { label: t('cloudPhone.startDevice'), command: 'start' },
    { label: t('cloudPhone.restartDevice'), command: 'restart' },
    { label: t('cloudPhone.shutdownDevice'), command: 'shutdown' },
    { label: t('cloudPhone.deviceDetails'), command: 'cloud-details', divided: true },
    { label: t('cloudPhone.rename'), command: 'rename' },
    { label: t('cloudPhone.apiInterface'), command: 'api-interface' },
    { label: t('cloudPhone.modifyImage'), command: 'modify-config', divided: true },
    { label: t('cloudPhone.setProxy'), command: 'set-proxy' },
    { label: t('cloudPhone.closeProxy'), command: 'close-proxy' },
    { label: t('cloudPhone.setTimezoneLanguage'), command: 'set-timezone-language' },
    { label: t('cloudPhone.renewDevice'), command: 'renew', divided: true },
    { label: t('cloudPhone.resetDevice'), command: 'reset' },
    { label: t('cloudPhone.cloneDevice'), command: 'clone' },
    { label: t('cloudPhone.deleteDevice'), command: 'delete', divided: true }
  ])

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
      return deviceMenuList.value.filter((item) => allowedCommands.includes(item.command))
    }

    if (state === DeviceState.StateFailed) {
      const allowedCommands = ['start']
      return deviceMenuList.value.filter((item) => allowedCommands.includes(item.command))
    }

    return deviceMenuList.value.filter((item) => item.command !== 'start')
  }

  const batchOperationItems = computed(() => {
    return [
      // 启动/重启/关闭相关
      { label: t('cloudPhone.startDevice'), command: 'start' },
      { label: t('cloudPhone.restartDevice'), command: 'restart' },
      { label: t('cloudPhone.shutdownDevice'), command: 'shutdown' },
      // 备份
      { label: t('cloudPhone.backup'), command: 'backup' },

      // 镜像与系统操作
      { label: t('cloudPhone.renewDevice'), command: 'renew', divided: true },
      { label: t('cloudPhone.resetDevice'), command: 'reset' },
      { label: t('cloudPhone.deleteDevice'), command: 'delete' },

      // 工具和功能操作
      { label: t('cloudPhone.setProxy'), command: 'batch-set-proxy', divided: true },
      { label: t('cloudPhone.closeProxy'), command: 'batch-close-proxy' },
      { label: t('cloudPhone.executeCommand'), command: 'execute-command', divided: true },
      // { label: t('cloudPhone.batchExecuteScript'), command: 'batch-execute-script' },
      // { label: t('cloudPhone.closeScriptExecution'), command: 'close-script-execution' },
      { label: t('cloudPhone.batchInstall'), command: 'batch-install' },
      { label: t('cloudPhone.batchUpload'), command: 'batch-upload' },
      { label: t('cloudPhone.modifyLocation'), command: 'modify-location' },
      { label: t('cloudPhone.modifySystemProperties'), command: 'modify-system-properties' },

      // 其它便利功能
      { label: t('cloudPhone.copyInfo'), command: 'copy-info', divided: true },
      { label: t('cloudPhone.cast'), command: 'cast', divided: true },
      { label: t('cloudPhone.sort'), command: 'sort' },
      { label: t('cloudPhone.closeWindow'), command: 'close-window' }
    ]
  })

  const getBatchOperationItems = () => {
    return batchOperationItems.value
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
      ElMessage.success(t('common.operationSuccess'))
    } catch (error) {
      const errorMsg = getErrorMessage(error)
      ElMessage.error(errorMsg || t('cloudPhone.proxyCloseFailed'))
    }
  }
  // --- Validators ---
  const requireState = (state: DeviceState, msg: string) => (devices: Device[]) =>
    devices.some((d) => d.state !== state) ? msg : undefined

  const requireNotState = (state: DeviceState, msg: string) => (devices: Device[]) =>
    devices.some((d) => d.state === state) ? msg : undefined

  const requireSingle =
    (msg: string = t('cloudPhone.singleDeviceOnly')) =>
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

  const commandConfigs = computed<Record<string, CommandConfig>>(() => ({
    reset: {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevicesFirst', { action: t('cloudPhone.reset') })
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningState', {
            action: t('cloudPhone.reset'),
            state: getDeviceStateText(DeviceState.StateRunning)
          })
        )(devices)
      },
      confirm: {
        message: (devices) =>
          t('cloudPhone.resetConfirm', {
            count:
              devices.length > 1 ? t('cloudPhone.selectedCount', { count: devices.length }) : ''
          }),
        type: 'warning'
      },
      action: async (devices) => {
        const res = await ipc.invoke<{ resetDevices: Device[]; failedDevices: Device[] }>(
          DATA_EVENTS.DEVICE_RESETED,
          devices.map((d) => toRaw(d))
        )
        if (res.success && res.data) {
          const { resetDevices, failedDevices } = res.data
          if (failedDevices.length > 0) {
            ElMessage.warning(
              t('cloudPhone.operationCompleted', {
                success: resetDevices.length,
                fail: failedDevices.length
              })
            )
          } else {
            ElMessage.success(t('cloudPhone.resetSuccess', { count: resetDevices.length }))
          }
        } else {
          ElMessage.error(res.error || t('cloudPhone.resetFailed'))
        }
      }
    },
    shutdown: {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevicesFirst', { action: t('cloudPhone.shutdown') })
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningState', {
            action: t('cloudPhone.shutdown'),
            state: getDeviceStateText(DeviceState.StateRunning)
          })
        )(devices)
      },
      confirm: {
        message: (devices) =>
          t('cloudPhone.shutdownConfirm', {
            count:
              devices.length > 1 ? t('cloudPhone.selectedCount', { count: devices.length }) : ''
          }),
        type: 'warning'
      },
      action: async (devices) => {
        const res = await ipc.invoke<{ shutdownDevices: Device[]; failedDevices: Device[] }>(
          DATA_EVENTS.DEVICE_SHUTDOWNED,
          devices.map((d) => toRaw(d))
        )
        if (res.success && res.data) {
          const { shutdownDevices, failedDevices } = res.data
          if (failedDevices.length > 0) {
            ElMessage.warning(
              t('cloudPhone.operationCompleted', {
                success: shutdownDevices.length,
                fail: failedDevices.length
              })
            )
          } else {
            ElMessage.success(t('cloudPhone.shutdownSuccess', { count: shutdownDevices.length }))
          }
        } else {
          ElMessage.error(res.error || t('cloudPhone.shutdownFailed'))
        }
      }
    },
    backup: {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevicesFirst', { action: t('cloudPhone.backup') })
        return requireState(
          DeviceState.StateStopped,
          t('cloudPhone.onlyRunningState', {
            action: t('cloudPhone.backup'),
            state: getDeviceStateText(DeviceState.StateStopped)
          })
        )(devices)
      },
      action: (devices) => {
        refs.backupDialogRef.value?.init(devices)
      }
    },
    start: {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevicesFirst', { action: t('cloudPhone.startDevice') })

        const invalidDevice = devices.find(
          (d) => d.state !== DeviceState.StateStopped && d.state !== DeviceState.StateFailed
        )

        if (invalidDevice) {
          return t('cloudPhone.onlyStoppedOrFailedForStart', {
            state1: getDeviceStateText(DeviceState.StateStopped),
            state2: getDeviceStateText(DeviceState.StateFailed)
          })
        }

        const LIMIT_PER_HOST = 12
        const hostGroups = new Map<string, number>()

        devices.forEach((d) => {
          const ip = d.host_ip || ''
          if (ip) {
            hostGroups.set(ip, (hostGroups.get(ip) || 0) + 1)
          }
        })

        for (const [ip, countToStart] of hostGroups) {
          const currentRunningCount = getRunningCountByHostIp(ip)

          if (currentRunningCount + countToStart > LIMIT_PER_HOST) {
            return t('cloudPhone.hostResourceInsufficient', {
              ip,
              limit: LIMIT_PER_HOST,
              current: currentRunningCount,
              count: countToStart
            })
          }
        }
        return undefined
      },
      // confirm: {
      //   message: (devices) =>
      //     t('cloudPhone.startConfirm', { count: devices.length > 1 ? t('cloudPhone.selectedCount', { count: devices.length }) : '' }),
      //   type: 'warning'
      // },
      action: async (devices) => {
        const res = await ipc.invoke<{ startedDevices: Device[]; failedDevices: Device[] }>(
          DATA_EVENTS.DEVICE_STARTED,
          devices.map((d) => toRaw(d))
        )
        if (res.success && res.data) {
          const { startedDevices, failedDevices } = res.data
          if (failedDevices.length > 0) {
            ElMessage.warning(
              t('cloudPhone.operationCompleted', {
                success: startedDevices.length,
                fail: failedDevices.length
              })
            )
          } else {
            ElMessage.success(t('cloudPhone.startSuccess', { count: startedDevices.length }))
          }
        } else {
          ElMessage.error(res.error || t('cloudPhone.startFailed'))
        }
      }
    },
    delete: {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevicesFirst', { action: t('common.delete') })
        return requireNotState(
          DeviceState.StateDeleting,
          t('cloudPhone.operationException')
        )(devices)
      },
      confirm: {
        message: (devices) =>
          t('cloudPhone.deleteConfirm', {
            count:
              devices.length > 1 ? t('cloudPhone.selectedCount', { count: devices.length }) : ''
          }),
        type: 'warning'
      },
      action: async (devices) => {
        const res = await ipc.invoke<{ deletedDevices: Device[]; failedDevices: Device[] }>(
          DATA_EVENTS.DEVICE_DELETED,
          devices.map((d) => toRaw(d))
        )
        if (res.success && res.data) {
          const { deletedDevices, failedDevices } = res.data
          if (failedDevices.length > 0) {
            ElMessage.warning(
              t('cloudPhone.operationCompleted', {
                success: deletedDevices.length,
                fail: failedDevices.length
              })
            )
          } else {
            ElMessage.success(t('cloudPhone.deleteSuccess', { count: deletedDevices.length }))
          }
        } else {
          ElMessage.error(res.error || t('common.deleteFailed'))
        }
      }
    },
    restart: {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevicesFirst', { action: t('cloudPhone.restart') })
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningState', {
            action: t('cloudPhone.restart'),
            state: getDeviceStateText(DeviceState.StateRunning)
          })
        )(devices)
      },
      confirm: {
        message: (devices) =>
          t('cloudPhone.restartConfirm', {
            count:
              devices.length > 1 ? t('cloudPhone.selectedCount', { count: devices.length }) : ''
          }),
        type: 'warning'
      },
      action: async (devices) => {
        const res = await ipc.invoke<{ restartedDevices: Device[]; failedDevices: Device[] }>(
          DATA_EVENTS.DEVICE_RESTARTED,
          devices.map((d) => toRaw(d))
        )
        if (res.success && res.data) {
          const { restartedDevices, failedDevices } = res.data
          if (failedDevices.length > 0) {
            ElMessage.warning(
              t('cloudPhone.operationCompleted', {
                success: restartedDevices.length,
                fail: failedDevices.length
              })
            )
          } else {
            ElMessage.success(t('cloudPhone.restartSuccess', { count: restartedDevices.length }))
          }
        } else {
          ElMessage.error(res.error || t('cloudPhone.restartFailed'))
        }
      }
    },
    rename: {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.rename') })
        return requireSingle(
          t('cloudPhone.selectSingleDevice', { action: t('cloudPhone.rename') })
        )(devices)
      },
      action: (devices) => refs.updateDeviceNameRef.value?.init(devices[0])
    },
    'modify-config': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.modifyImage') })
        return requireSingle(
          t('cloudPhone.selectSingleDevice', { action: t('cloudPhone.modifyImage') })
        )(devices)
      },
      action: (devices) => {
        const device = devices[0]
        const hostIp = device.host_ip || ''
        // 优先从 hostIpMap 获取 (Host模式)，降级从 allHostsMap 获取 (Device模式)
        const hostNode = hostIpMap.get(hostIp)
        const host = (hostNode as any)?.originalData || allHostsMap.get(hostIp)
        refs.updateImageRef.value?.init(device, host)
      }
    },
    'set-proxy': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.setProxy') })
        const singleError = requireSingle(
          t('cloudPhone.selectSingleDevice', { action: t('cloudPhone.setProxy') })
        )(devices)
        if (singleError) return singleError
        return requireState(DeviceState.StateRunning, t('cloudPhone.onlyRunningForProxy'))(devices)
      },
      action: (devices) => {
        if (refs.setProxyRef && refs.setProxyRef.value) {
          refs.setProxyRef.value.init(devices[0])
        }
      }
    },
    'close-proxy': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.closeProxy') })
        const singleError = requireSingle(
          t('cloudPhone.selectSingleDevice', { action: t('cloudPhone.closeProxy') })
        )(devices)
        if (singleError) return singleError
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningForCloseProxy')
        )(devices)
      },
      action: (devices) => {
        handleCloseProxy(devices)
      }
    },
    'batch-set-proxy': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.setProxy') })
        return requireState(DeviceState.StateRunning, t('cloudPhone.onlyRunningForProxy'))(devices)
      },
      action: (devices) => {
        refs.batchProxyRef.value?.init('set', devices)
      }
    },
    'batch-close-proxy': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.closeProxy') })
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningForCloseProxy')
        )(devices)
      },
      action: (devices) => {
        refs.batchProxyRef.value?.init('close', devices)
      }
    },
    'set-timezone-language': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.setTimezoneLanguage') })
        const singleError = requireSingle(
          t('cloudPhone.selectSingleDevice', { action: t('cloudPhone.setTimezoneLanguage') })
        )(devices)
        if (singleError) return singleError
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningForTimezone')
        )(devices)
      },
      action: (devices) => {
        if (refs.setTimeZoneLanguageRef && refs.setTimeZoneLanguageRef.value) {
          refs.setTimeZoneLanguageRef.value.init(devices[0])
        }
      }
    },
    renew: {
      validator: (devices) => {
        if (devices.length === 0) return t('cloudPhone.selectRenewDevices')

        // 状态必须是运行中
        const stateError = requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningForRenew', {
            state: getDeviceStateText(DeviceState.StateRunning)
          })
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
            return t('cloudPhone.sameDeviceTypeRequired')
          }
        }

        return undefined
      },
      action: (devices) => {
        const hosts = new Map<string, Host>()
        devices.forEach((d) => {
          const hostIp = d.host_ip || ''
          const hostNode = hostIpMap.get(hostIp)
          const host = ((hostNode as any)?.originalData as Host) || allHostsMap.get(hostIp)
          if (host) {
            hosts.set(hostIp, host)
          }
        })
        if (refs.newMachineRef && refs.newMachineRef.value) {
          refs.newMachineRef.value.init(devices, hosts)
        }
      }
    },
    'api-interface': {
      validator: requireSingle(
        t('cloudPhone.selectSingleDevice', { action: t('cloudPhone.apiInterface') })
      ),
      action: DATA_EVENTS.HOST_OPEN_API_DETAIL
    },
    'execute-command': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.executeCommand') })
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningForCommand', {
            state: getDeviceStateText(DeviceState.StateRunning)
          })
        )(devices)
      },
      action: (devices) => {
        if (refs.execCommandRef && refs.execCommandRef.value) {
          refs.execCommandRef.value.init(devices)
        }
      }
    },
    // 'batch-execute-script': {
    //   validator: (devices) => {
    //     if (devices.length === 0)
    //       return t('cloudPhone.selectDevices', { action: t('cloudPhone.batchExecuteScript') })
    //     return requireState(
    //       DeviceState.StateRunning,
    //       t('cloudPhone.onlyRunningForScript', {
    //         state: getDeviceStateText(DeviceState.StateRunning)
    //       })
    //     )(devices)
    //   },
    //   action: (devices) => {
    //     if (refs.batchExecuteScriptRef && refs.batchExecuteScriptRef.value) {
    //       refs.batchExecuteScriptRef.value.init(devices)
    //     }
    //   }
    // },
    // 'close-script-execution': {
    //   validator: (devices) => {
    //     if (devices.length === 0)
    //       return t('cloudPhone.selectDevices', { action: t('cloudPhone.closeScriptExecution') })
    //     return requireState(
    //       DeviceState.StateRunning,
    //       t('cloudPhone.onlyRunningForCloseScript', {
    //         state: getDeviceStateText(DeviceState.StateRunning)
    //       })
    //     )(devices)
    //   },
    //   action: (devices) => {
    //     if (refs.batchCloseScriptRef && refs.batchCloseScriptRef.value) {
    //       refs.batchCloseScriptRef.value.init(devices)
    //     }
    //   }
    // },
    'cloud-details': {
      validator: requireSingle(
        t('cloudPhone.selectSingleDevice', { action: t('cloudPhone.deviceDetails') })
      ),
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
        t('cloudPhone.onlyStoppedForClone', { state: getDeviceStateText(DeviceState.StateStopped) })
      ),
      action: (devices) => {
        if (refs.deviceCloneRef && refs.deviceCloneRef.value) {
          // 需要获取 host 数据，这里暂时只传 device
          // 如果需要 host，可以从 hostIpMap 获取
          const device = devices[0]
          const hostIp = device.host_ip || ''
          const hostNode = hostIpMap.get(hostIp)
          const host = (hostNode as any)?.originalData || allHostsMap.get(hostIp)
          refs.deviceCloneRef.value.init(device, host)
        }
      }
    },
    upgrade: {
      validator: (devices) =>
        devices.some(
          (d) => d.state === DeviceState.StateUpgrading || d.state === DeviceState.StateDeleting
        )
          ? t('cloudPhone.operationException')
          : undefined,
      action: () => console.log('升级云机')
    },
    cast: {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.cast') })

        const stateError = requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningForCast', {
            state: getDeviceStateText(DeviceState.StateRunning)
          })
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
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.batchInstall') })
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningForInstall', {
            state: getDeviceStateText(DeviceState.StateRunning)
          })
        )(devices)
      },
      action: (devices) => {
        refs.batchInstallRef.value?.init(devices, 'install')
      }
    },
    'batch-upload': {
      validator: (devices) => {
        if (devices.length === 0) return t('cloudPhone.selectDevicesForBatchUpload')
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.batchUploadOnlyRunning', {
            state: getDeviceStateText(DeviceState.StateRunning)
          })
        )(devices)
      },
      action: (devices) => {
        refs.batchInstallRef.value?.init(devices, 'upload')
      }
    },
    'modify-location': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.modifyLocation') })
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningForLocation', {
            state: getDeviceStateText(DeviceState.StateRunning)
          })
        )(devices)
      },
      action: (devices) => {
        refs.modifyPositionRef.value?.init(devices)
      }
    },
    'modify-system-properties': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.modifySystemProperties') })

        const invalidDevice = devices.find(
          (d) => d.state !== DeviceState.StateRunning && d.state !== DeviceState.StateStopped
        )

        if (invalidDevice) {
          return t('cloudPhone.onlyRunningOrStoppedForProperties', {
            state1: getDeviceStateText(DeviceState.StateRunning),
            state2: getDeviceStateText(DeviceState.StateStopped)
          })
        }
        return undefined
      },
      action: (devices) => {
        refs.modifySystemPropertiesRef.value?.init(devices)
      }
    },
    'copy-info': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('cloudPhone.copyInfo') })
        return undefined
      },
      action: (devices) => {
        refs.copyInfoRef.value?.init(devices)
      }
    },
    'batch-execute': {
      validator: (devices) => {
        if (devices.length === 0)
          return t('cloudPhone.selectDevices', { action: t('taskCenter.batchExecute.title') })
        return requireState(
          DeviceState.StateRunning,
          t('cloudPhone.onlyRunningState', {
            action: t('taskCenter.batchExecute.title'),
            state: getDeviceStateText(DeviceState.StateRunning)
          })
        )(devices)
      },
      action: () => {
        if (refs.batchExecuteVisible) {
          refs.batchExecuteVisible.value = true
        }
      }
    }
  }))

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
        ElMessage.warning(t('common.noData'))
        return
      }
    }

    const config = commandConfigs.value[command]
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
        await ElMessageBox.confirm(message, config.confirm.title || t('common.tips'), {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
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
          ElMessage.success(t('common.operationSuccess'))
        } else {
          ElMessage.error(res.error || t('common.operationFailed'))
        }
      } else {
        // 函数形式：直接执行回调
        await config.action(devices)
      }
    } catch (e) {
      console.error(e)
      ElMessage.error(t('cloudPhone.operationException'))
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
