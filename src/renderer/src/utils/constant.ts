// 设备状态中文映射
export const DeviceStateMap = {
  running: '运行中',
  stopped: '已关机',
  creating: '创建中',
  starting: '启动中',
  paused: '已暂停',
  exited: '已退出',
  stopping: '关机中',
  rebooting: '重启中',
  upgrading: '升级中',
  renewing: '一键新机中',
  rebuilding: '重置中',
  deleting: '删除中',
  failed: '失败',
  offline: '离线'
} as const

export const DeviceType = {
  VIRTUAL: 'virtual',
  REAL: 'real'
} as const

export const DeviceTypeMap = {
  [DeviceType.VIRTUAL]: '虚拟机',
  [DeviceType.REAL]: '云真机'
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
