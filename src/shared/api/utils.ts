import { isAxiosError } from './request'

export function getErrorMessage(error: any, defaultMsg: string = 'operation failed') {
  try {
    if (isAxiosError(error)) {
      return (
        error.response?.data?.msg || error.response?.data?.message || error.message || defaultMsg
      )
    }

    if (typeof error === 'string') {
      return error
    }
    return error?.msg || error?.message || defaultMsg
  } catch (error: any) {
    return error?.message
  }
}

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

  return format
    .replace(/yyyy/g, String(year))
    .replace(/MM/g, month)
    .replace(/dd/g, day)
    .replace(/HH/g, hours)
    .replace(/mm/g, minutes)
    .replace(/ss/g, seconds)
}
