/**
 * 处理器统一注册入口
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
import { registerAutomationScriptHandlers } from './automationScript.handler'
import { registerAgentHandlers } from './agent.handler'
import { registerBackupHandlers } from './backup.handler'

/**
 * 注册所有 IPC 事件处理器
 */
export function registerAllHandlers(): void {
  logger.info('[IPC Handlers] 开始注册所有处理器...')

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
  registerAutomationScriptHandlers()
  registerAgentHandlers()
  registerBackupHandlers()
  logger.info('[IPC Handlers] ✅ 所有处理器注册完成')
}
