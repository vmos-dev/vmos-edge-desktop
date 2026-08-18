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
  if (!text || !navigator.clipboard?.writeText) {
    return
  }

  if (typeof document !== 'undefined' && !document.hasFocus()) {
    console.warn('Copy skipped because document is not focused')
    return
  }

  void navigator.clipboard
    .writeText(text)
    .then(() => {
      callback?.()
    })
    .catch((error) => {
      console.warn('Copy failed', error)
    })
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

export const parseCoordinate = (input: string, order: 'latlng' | 'lnglat') => {
  const [a, b] = input.split(',').map((v) => Number(v.trim()))

  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error('Invalid coordinate format')
  }

  if (order === 'latlng') {
    if (Math.abs(a) > 90 || Math.abs(b) > 180) {
      throw new Error('Invalid lat,lng')
    }
    return { latitude: a, longitude: b }
  }

  // lnglat
  if (Math.abs(a) > 180 || Math.abs(b) > 90) {
    throw new Error('Invalid lng,lat')
  }

  return { longitude: a, latitude: b }
}
