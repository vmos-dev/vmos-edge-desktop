/**
 * 格式化时间戳
 */

export function formatTime(timestamp?: number, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')

  return format
    .replace(/yyyy/g, String(year))
    .replace(/MM/g, month)
    .replace(/dd/g, day)
    .replace(/HH/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds)
    .replace(/SSS/g, milliseconds)
}

// 复制
export function copyToClipboard(text: string, callback?: () => void) {
  try {
    navigator.clipboard.writeText(text)
    callback?.()
  } catch (error) {
    console.error('复制失败', error)
  }
}

/** 格式化文件大小 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
}

// 导出键盘映射工具
export * from './keyboard-map'

// 解析经纬度
export const parseCoordinate = (input: string) => {
  const parts = input.split(',').map((v) => Number(v.trim()))
  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    throw new Error('Invalid coordinate format')
  }

  const [a, b] = parts

  // One value large, one small: most reliable
  if (Math.abs(a) > 90 && Math.abs(a) <= 180 && Math.abs(b) <= 90) {
    return { longitude: a, latitude: b }
  }
  if (Math.abs(b) > 90 && Math.abs(b) <= 180 && Math.abs(a) <= 90) {
    return { longitude: b, latitude: a }
  }

  // Both in reasonable ranges, assume lng,lat by default
  if (Math.abs(a) <= 180 && Math.abs(b) <= 90) {
    return { longitude: a, latitude: b }
  }

  throw new Error('Invalid longitude or latitude range')
}
