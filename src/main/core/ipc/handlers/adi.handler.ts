import { handle } from '../IpcBus'
import { ADI_EVENTS } from '@shared/ipc/adi.types'
import { adiManager } from '../../store/managers'
import { logger } from '../../logger'
import { isAxiosError } from '@shared/api/request'
import { Adi, CustomAdi } from '@shared/ipc/adi.types'
import type { Host } from '@shared/ipc/data.types'

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

export function registerAdiHandlers() {
  handle<void, Adi[]>(ADI_EVENTS.GET_ADIS, async () => {
    const startTime = Date.now()
    logger.info(`[AdiHandler] GET_ADIS request`)
    try {
      const adis = adiManager.getAdis()
      const duration = Date.now() - startTime
      logger.info(`[AdiHandler] GET_ADIS success: count=${adis.length}, duration=${duration}ms`)
      return {
        success: true,
        data: adis
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 获取所有自定义机型
  handle<void, CustomAdi[]>(ADI_EVENTS.GET_CUSTOM_ADIS, async () => {
    const startTime = Date.now()
    logger.info(`[AdiHandler] GET_CUSTOM_ADIS request`)
    try {
      const adis = adiManager.getCustomAdis()
      const duration = Date.now() - startTime
      logger.info(
        `[AdiHandler] GET_CUSTOM_ADIS success: count=${adis.length}, duration=${duration}ms`
      )
      return {
        success: true,
        data: adis
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 导入自定义机型
  // 兼容 payload 可能被包装的场景，确保 filePath 为字符串
  handle<{ filePath: string } | { payload?: { filePath: string } }, CustomAdi>(
    ADI_EVENTS.IMPORT_CUSTOM_ADI,
    async (data) => {
      const raw = (data as any)?.payload ?? data
      const filePath = typeof raw?.filePath === 'string' ? raw.filePath : undefined
      if (!filePath) {
        logger.error(`[AdiHandler] IMPORT_CUSTOM_ADI invalid payload: filePath expected string, got ${typeof raw?.filePath}`)
        return { success: false, error: 'Invalid file path' }
      }
      logger.info(`[AdiHandler] IMPORT_CUSTOM_ADI request: path=${filePath}`)
      try {
        const adi = await adiManager.importCustomAdi(filePath)
        return {
          success: true,
          data: adi
        }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 删除自定义机型
  handle<string, void>(ADI_EVENTS.DELETE_CUSTOM_ADI, async (id) => {
    logger.info(`[AdiHandler] DELETE_CUSTOM_ADI request: id=${id}`)
    try {
      await adiManager.deleteCustomAdi(id)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 上传机型模板到主机
  handle<{ adi: Adi | CustomAdi; host: Host }, void>(ADI_EVENTS.UPLOAD_ADI_TO_HOST, async (data) => {
    logger.info(`[AdiHandler] UPLOAD_ADI_TO_HOST request: adi=${data.adi.name}, host=${data.host.ip}`)
    try {
      await adiManager.uploadAdiToHost(data.adi, data.host)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  logger.info('[AdiHandler] ✅ 机型设置处理器已注册')
}
