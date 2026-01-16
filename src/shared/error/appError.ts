import { ErrorCode } from './errorCode'

/**
 * 页面 & 后端统一使用的错误类型
 * 只包含：code / message / data?
 */

export class AppError extends Error {
  readonly code: ErrorCode
  readonly data?: any

  constructor(code: ErrorCode, message: string, data?: any) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.data = data
  }
}

/**
 * 判断是否 AppError
 */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError
}

/**
 * 任意异常兜底为 AppError
 */
export function toAppError(
  e: unknown,
  fallback: {
    code: ErrorCode
    message: string
  }
): AppError {
  if (e instanceof AppError) {
    return e
  }

  return new AppError(fallback.code, fallback.message)
}
