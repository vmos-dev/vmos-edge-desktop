import { t } from '@renderer/locales'

// 设备状态映射函数
export const getDeviceStateText = (state: string): string => {
  const stateMap: Record<string, string> = {
    running: t('common.deviceStates.running'),
    stopped: t('common.deviceStates.stopped'),
    creating: t('common.deviceStates.creating'),
    starting: t('common.deviceStates.starting'),
    pending_backup: t('common.deviceStates.pending_backup'),
    backing_up: t('common.deviceStates.backing_up'),
    downloading: t('common.deviceStates.downloading'),
    paused: t('common.deviceStates.paused'),
    exited: t('common.deviceStates.exited'),
    stopping: t('common.deviceStates.stopping'),
    rebooting: t('common.deviceStates.rebooting'),
    upgrading: t('common.deviceStates.upgrading'),
    renewing: t('common.deviceStates.renewing'),
    rebuilding: t('common.deviceStates.rebuilding'),
    deleting: t('common.deviceStates.deleting'),
    failed: t('common.deviceStates.failed'),
    offline: t('common.deviceStates.offline')
  }
  return stateMap[state] || state
}

// 设备类型映射函数
export const getDeviceTypeText = (type: string): string => {
  const typeMap: Record<string, string> = {
    virtual: t('common.deviceTypes.virtual'),
    real: t('common.deviceTypes.real')
  }
  return typeMap[type] || type
}

// 代理检测策略映射函数
export const getProxyCheckStrategyList = () => [
  {
    label: 'IPMap',
    value: 'ipmap'
  },
  {
    label: 'IPinfo',
    value: 'ipinfo'
  },
  {
    label: t('common.proxyStrategies.default'),
    value: 'default'
  }
]
