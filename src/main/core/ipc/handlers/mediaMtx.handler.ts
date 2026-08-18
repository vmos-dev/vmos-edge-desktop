import { handle } from '../IpcBus'
import { MEDIAMTX_START, MEDIAMTX_STOP, MEDIAMTX_GET_STATUS } from '@shared/ipc/channels'
import {
  StartMediaServerOptions,
  StartMediaServerResult,
  MediaServerStatus
} from '@shared/ipc/mediaMtx.types'
import { mediaMtxManager } from '../../store/managers'
import { logger } from '../../logger'

export function registerMediaMtxHandlers(): void {
  handle<StartMediaServerOptions, StartMediaServerResult>(MEDIAMTX_START, async (params) => {
    logger.info('[MediaMtxHandler] Start requested', params)
    try {
      const result = await mediaMtxManager.startServer(params)
      return { success: true, data: result }
    } catch (error) {
      logger.error('[MediaMtxHandler] Start failed', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  handle<void, void>(MEDIAMTX_STOP, async () => {
    logger.info('[MediaMtxHandler] Stop requested')
    try {
      await mediaMtxManager.stopServer()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  handle<void, MediaServerStatus>(MEDIAMTX_GET_STATUS, async () => {
    return {
      success: true,
      data: mediaMtxManager.getStatus()
    }
  })

  logger.info('[MediaMtxHandler] Handlers registered')
}
