// 设备状态映射 - 已迁移到 i18n-maps.ts
// 为了向后兼容，这里保留一个简单的映射，但建议使用 getDeviceStateText() 函数
export const DeviceStateMap = {
  running: 'running',
  stopped: 'stopped',
  creating: 'creating',
  starting: 'starting',
  paused: 'paused',
  exited: 'exited',
  stopping: 'stopping',
  rebooting: 'rebooting',
  upgrading: 'upgrading',
  renewing: 'renewing',
  rebuilding: 'rebuilding',
  deleting: 'deleting',
  failed: 'failed',
  offline: 'offline'
} as const

export const DeviceType = {
  VIRTUAL: 'virtual',
  REAL: 'real'
} as const

// 设备类型映射 - 已迁移到 i18n-maps.ts
// 为了向后兼容，这里保留一个简单的映射，但建议使用 getDeviceTypeText() 函数
export const DeviceTypeMap = {
  [DeviceType.VIRTUAL]: DeviceType.VIRTUAL,
  [DeviceType.REAL]: DeviceType.REAL
} as const

// 设备状态颜色
export const DeviceStateColorMap = {
  creating: '#67C23A', // success - 绿色
  starting: '#409EFF', // primary - 蓝色
  running: '#67C23A', // success - 绿色
  stopping: '#F56C6C', // danger - 红色
  stopped: '#F56C6C', // danger - 红色
  paused: '#E6A23C', // warning - 橙色
  exited: '#F56C6C', // danger - 红色
  deleting: '#F56C6C', // danger - 红色
  upgrading: '#E6A23C', // warning - 橙色
  failed: '#F56C6C', // danger - 红色
  rebooting: '#E6A23C', // warning - 橙色
  rebuilding: '#E6A23C', // warning - 橙色
  renewing: '#E6A23C', // warning - 橙色
  offline: '#F56C6C' // danger - 红色
} as const

// 分辨率模型
export const ResolutionModel = [
  '720x1280x320',
  '1080x1920x420',
  '1080x2160x420',
  '1080x2340x440',
  '1080x2400x440',
  '1080x2460x440',
  '1440x2560x560',
  '1440x3200x640'
] as const

export const MacvlanPortMap = {
  video: 9999,
  audio: 9998,
  touch: 9997,
  adb: 5555
} as const


// 代理检测策略 数组
export const ProxyCheckStrategyList = [
  {
    label: 'IPMap',
    value: 'ipmap'
  },
  {
    label: 'IPinfo',
    value: 'ipinfo'
  },
  {
    label: 'Default (No exit info support)',
    value: 'default'
  },
]