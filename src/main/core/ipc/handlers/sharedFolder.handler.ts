import { handle } from '../IpcBus'
import {
  SHARED_FOLDER_EVENTS,
  type SharedFolderStatus,
  type StartSharedFolderOptions,
  type StopSharedFolderOptions
} from '@shared/ipc/sharedFolder.types'
import { sharedFolderManager } from '../../store/managers'
import { logger } from '../../logger'

export function registerSharedFolderHandlers(): void {
  handle<void, SharedFolderStatus>(SHARED_FOLDER_EVENTS.GET_STATUS, async () => {
    try {
      return {
        success: true,
        data: sharedFolderManager.getStatus()
      }
    } catch (error) {
      logger.error('[SharedFolderHandler] Failed to get shared folder status', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  handle<StartSharedFolderOptions | undefined, SharedFolderStatus>(
    SHARED_FOLDER_EVENTS.START,
    async (payload) => {
      try {
        const data = await sharedFolderManager.startSharing(payload?.directory)
        return {
          success: true,
          data
        }
      } catch (error) {
        logger.error('[SharedFolderHandler] Failed to start shared folder service', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  handle<StopSharedFolderOptions | undefined, SharedFolderStatus>(
    SHARED_FOLDER_EVENTS.STOP,
    async (payload) => {
      try {
        const data = await sharedFolderManager.stopSharing({
          persistEnabled: payload?.persistEnabled
        })
        return {
          success: true,
          data
        }
      } catch (error) {
        logger.error('[SharedFolderHandler] Failed to stop shared folder service', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )
}
