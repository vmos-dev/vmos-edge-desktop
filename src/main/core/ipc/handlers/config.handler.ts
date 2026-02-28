import { handle, broadcast } from '../IpcBus'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { configManager } from '../../store/managers'
import { trayManager } from '../../window/TrayManager'
import { CONFIG_KEYS } from '@shared/constant'
import { logger } from '../../logger'
import { isAxiosError } from '@shared/api/request'

/**
 * 处理错误，只返回错误信息，不打印日志（日志已在 manager 层打印）
 */
function handleError(error: any): { success: false; error: string } {
  let errorMsg: string

  if (isAxiosError(error)) {
    // axios 错误：优先从 response.data.msg 获取，其次从 response.data.message，最后从 error.message
    // 注意：拦截器可能 reject 的是 data 对象（有 msg 字段），所以也需要检查 error.msg
    errorMsg =
      error.response?.data?.msg ||
      error.response?.data?.message ||
      (error as any)?.msg ||
      error.message ||
      String(error)
  } else {
    // 非 axios 错误：优先从 error.msg，其次从 error.message
    errorMsg = error?.msg || error?.message || String(error)
  }

  return {
    success: false,
    error: errorMsg
  }
}

export function registerConfigHandlers() {
  handle<string, string | undefined>(CONFIG_EVENTS.GET_CONFIGS, async (key) => {
    const startTime = Date.now()
    logger.info(`[ConfigHandler] GET_CONFIGS request: key=${key}`)
    try {
      const value = configManager.getValue(key)
      const duration = Date.now() - startTime
      logger.info(
        `[ConfigHandler] GET_CONFIGS success: key=${key}, found=${value !== undefined}, duration=${duration}ms`
      )
      return {
        success: true,
        data: value
      }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<{ key: string; value: string }, void>(CONFIG_EVENTS.SET_CONFIG, async ({ key, value }) => {
    const startTime = Date.now()
    logger.info(`[ConfigHandler] SET_CONFIG request: key=${key}, value=${value}`)
    try {
      configManager.setValue(key, value)

      // 广播配置更新
      broadcast(CONFIG_EVENTS.CONFIG_UPDATED, { key, value })

      // 如果修改了最小化到托盘配置，更新托盘显示
      if (key === CONFIG_KEYS.MINIMIZE_TO_TRAY) {
        trayManager.update()
      }

      const duration = Date.now() - startTime
      logger.info(`[ConfigHandler] SET_CONFIG success: key=${key}, duration=${duration}ms`)
      return {
        success: true,
        data: undefined
      }
    } catch (error) {
      return handleError(error)
    }
  })

  handle<string, void>(CONFIG_EVENTS.DELETE_CONFIG, async (key) => {
    const startTime = Date.now()
    logger.info(`[ConfigHandler] DELETE_CONFIG request: key=${key}`)
    try {
      configManager.deleteValue(key)

      // 广播配置更新
      broadcast(CONFIG_EVENTS.CONFIG_UPDATED, { key, value: undefined })

      const duration = Date.now() - startTime
      logger.info(`[ConfigHandler] DELETE_CONFIG success: key=${key}, duration=${duration}ms`)
      return {
        success: true,
        data: undefined
      }
    } catch (error) {
      return handleError(error)
    }
  })

  logger.info('[ConfigHandler] ✅ 配置处理器已注册')
}
