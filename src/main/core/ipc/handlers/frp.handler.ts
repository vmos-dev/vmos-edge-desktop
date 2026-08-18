import { handle } from '../IpcBus'
import { FRP_EVENTS } from '@shared/ipc/frp.types'
import type {
  FrpConfig,
  FrpMapping,
  FrpStatusInfo,
  EnabledStates,
  ToggleHostRequest,
  ToggleDeviceRequest,
  BatchToggleRequest,
  BatchToggleResult,
  FrpMappingFilter,
  DeployScreenRequest
} from '@shared/ipc/frp.types'
import { logger } from '../../logger'
import { frpManager } from '../../store/managers'

function handleError(error: any): { success: false; error: string } {
  const errorMsg = error?.message || String(error)
  return { success: false, error: errorMsg }
}

export function registerFrpHandlers(): void {
  handle<Partial<FrpConfig>, boolean>(FRP_EVENTS.TEST_CONNECTION, async (config) => {
    logger.info('[FrpHandler] TEST_CONNECTION request')
    try {
      const ok = await frpManager.testConnection(config)
      return { success: true, data: ok }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<Partial<FrpConfig>, void>(FRP_EVENTS.DEPLOY, async (config) => {
    logger.info('[FrpHandler] DEPLOY request')
    try {
      await frpManager.deploy(config)
      logger.info('[FrpHandler] DEPLOY success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, void>(FRP_EVENTS.START, async () => {
    logger.info('[FrpHandler] START request')
    try {
      await frpManager.start()
      logger.info('[FrpHandler] START success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, void>(FRP_EVENTS.STOP, async () => {
    logger.info('[FrpHandler] STOP request')
    try {
      await frpManager.stop()
      logger.info('[FrpHandler] STOP success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, void>(FRP_EVENTS.UNINSTALL, async () => {
    logger.info('[FrpHandler] UNINSTALL request')
    try {
      await frpManager.uninstall()
      logger.info('[FrpHandler] UNINSTALL success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, void>(FRP_EVENTS.UNINSTALL_LOCAL, async () => {
    logger.info('[FrpHandler] UNINSTALL_LOCAL request')
    try {
      await frpManager.uninstall(true)
      logger.info('[FrpHandler] UNINSTALL_LOCAL success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, FrpStatusInfo>(FRP_EVENTS.GET_STATUS, async () => {
    try {
      const status = frpManager.getStatus()
      return { success: true, data: status }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, FrpConfig | undefined>(FRP_EVENTS.GET_CONFIG, async () => {
    try {
      const config = frpManager.getConfig()
      return { success: true, data: config }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<Partial<FrpConfig>, void>(FRP_EVENTS.UPDATE_CONFIG, async (updates) => {
    logger.info('[FrpHandler] UPDATE_CONFIG request')
    try {
      await frpManager.updateConfig(updates)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, void>(FRP_EVENTS.RECONFIGURE, async () => {
    logger.info('[FrpHandler] RECONFIGURE request')
    try {
      await frpManager.reconfigure()
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, EnabledStates>(FRP_EVENTS.GET_ENABLED_STATES, async () => {
    try {
      const states = frpManager.getEnabledStates()
      return { success: true, data: states }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<FrpMappingFilter | undefined, FrpMapping[]>(FRP_EVENTS.GET_MAPPINGS, async (filter) => {
    try {
      const mappings = frpManager.getMappings(filter ?? undefined)
      return { success: true, data: mappings }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<ToggleHostRequest, void>(FRP_EVENTS.TOGGLE_HOST, async ({ hostIp, enabled }) => {
    logger.info(`[FrpHandler] TOGGLE_HOST: hostIp=${hostIp}, enabled=${enabled}`)
    try {
      await frpManager.toggleHost(hostIp, enabled)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<ToggleDeviceRequest, void>(
    FRP_EVENTS.TOGGLE_DEVICE,
    async ({ deviceId, hostIp, enabled, portTypes }) => {
      logger.info(`[FrpHandler] TOGGLE_DEVICE: deviceId=${deviceId}, enabled=${enabled}`)
      try {
        await frpManager.toggleDevice(deviceId, hostIp, enabled, portTypes)
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  handle<BatchToggleRequest, BatchToggleResult>(
    FRP_EVENTS.BATCH_TOGGLE,
    async ({ items, enabled, portTypes }) => {
      logger.info(`[FrpHandler] BATCH_TOGGLE: count=${items.length}, enabled=${enabled}`)
      try {
        const result = await frpManager.batchToggle(items, enabled, portTypes)
        if (result.failures.length > 0 && result.succeeded === 0) {
          return { success: false, error: result.failures.map((f) => f.error).join('; ') }
        }
        return { success: true, data: result }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  handle<DeployScreenRequest, void>(FRP_EVENTS.DEPLOY_SCREEN, async (data) => {
    logger.info(`[FrpHandler] DEPLOY_SCREEN: port=${data.port}`)
    try {
      await frpManager.deployScreen(data.port, data.publicPort, data.sslCertPath, data.sslKeyPath)
      logger.info('[FrpHandler] DEPLOY_SCREEN success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<DeployScreenRequest, void>(FRP_EVENTS.UPDATE_SCREEN_CONFIG, async (data) => {
    logger.info(`[FrpHandler] UPDATE_SCREEN_CONFIG: port=${data.port}`)
    try {
      await frpManager.updateScreenConfig(
        data.port,
        data.publicPort,
        data.sslCertPath,
        data.sslKeyPath
      )
      logger.info('[FrpHandler] UPDATE_SCREEN_CONFIG success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, void>(FRP_EVENTS.UNINSTALL_SCREEN, async () => {
    logger.info('[FrpHandler] UNINSTALL_SCREEN request')
    try {
      await frpManager.uninstallScreen()
      logger.info('[FrpHandler] UNINSTALL_SCREEN success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<void, number>(FRP_EVENTS.CLEAN_ORPHANS, async () => {
    logger.info('[FrpHandler] CLEAN_ORPHANS request')
    try {
      const cleaned = await frpManager.cleanOrphans()
      logger.info(`[FrpHandler] CLEAN_ORPHANS success: cleaned=${cleaned}`)
      return { success: true, data: cleaned }
    } catch (error) {
      return handleError(error)
    }
  })

  logger.info('[FrpHandler] ✅ FRP 处理器已注册')
}
