import { logger } from './logger'

type VmosEdgeInternalErrorInfo = {
  source:
    | 'channel_close'
    | 'channel_error'
    | 'video_recovery'
    | 'touch_recovery'
    | 'connect_retry'
    | 'connect_failed'
  recovering?: boolean
  errorMessage?: string
  [key: string]: any
}

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return '[Unserializable]'
  }
}

const getOriginalMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return safeStringify(error)
}

export const logVmosEdgeClientInternalError = (
  scope: string,
  error: unknown,
  info: VmosEdgeInternalErrorInfo
) => {
  if (info.recovering && info.source !== 'connect_failed') {
    logger.warn(`[${scope}] VmosEdgeClient recoverable issue`, {
      ...info,
      originalMessage: getOriginalMessage(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return
  }

  logger.error(`[${scope}] VmosEdgeClient ERROR`, error, info)
}
