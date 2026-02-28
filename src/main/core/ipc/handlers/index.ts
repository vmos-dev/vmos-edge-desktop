/**
 * IPC handler registration entry.
 */

import { registerWindowHandlers } from './window.handler'
import { registerCloudHandlers } from './cloud.handler'
import { registerConfigHandlers } from './config.handler'
import { registerGroupHandlers } from './group.handler'
import { registerHostHandlers } from './host.handler'
import { registerDeviceHandlers } from './device.handler'
import { logger } from '../../logger'
import { registerSharedHandlers } from './shared.handler'
import { registerImageHandlers } from './image.handler'
import { registerAdiHandlers } from './adi.handler'
import { registerProxyHandlers } from './proxy.handler'
import { registerGroupControlHandlers } from './groupControl.handler'
import { registerMediaMtxHandlers } from './mediaMtx.handler'

export function registerAllHandlers(): void {
  logger.info('[IPC Handlers] Starting registration...')

  registerWindowHandlers()
  registerCloudHandlers()
  registerConfigHandlers()
  registerGroupHandlers()
  registerHostHandlers()
  registerDeviceHandlers()
  registerSharedHandlers()
  registerImageHandlers()
  registerAdiHandlers()
  registerProxyHandlers()
  registerGroupControlHandlers()
  registerMediaMtxHandlers()

  logger.info('[IPC Handlers] All handlers registered')
}
