import { handle } from '../IpcBus'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import { logger } from '../../logger'
import { proxyManager } from '../../store/managers'
import type { Proxy } from '@shared/ipc/data.types'
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

export function registerProxyHandlers() {
  // 获取所有代理
  handle<void, Proxy[]>(PROXY_EVENTS.GET_PROXIES, async () => {
    logger.debug('[ProxyHandler] GET_PROXIES request')
    try {
      const proxies = proxyManager.getProxies()
      logger.info(`[ProxyHandler] GET_PROXIES success: count=${proxies.length}`)
      return {
        success: true,
        data: proxies
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 查询代理
  handle<{ name?: string; host?: string }, Proxy[]>(PROXY_EVENTS.QUERY_PROXIES, async (options) => {
    logger.debug('[ProxyHandler] QUERY_PROXIES request:', options)
    try {
      const proxies = proxyManager.queryProxies(options)
      logger.info(`[ProxyHandler] QUERY_PROXIES success: count=${proxies.length}`)
      return {
        success: true,
        data: proxies
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 根据ID获取代理
  handle<string, Proxy | undefined>(PROXY_EVENTS.GET_PROXY_BY_ID, async (id) => {
    logger.debug(`[ProxyHandler] GET_PROXY_BY_ID request: id=${id}`)
    try {
      const proxy = proxyManager.getProxyById(id)
      logger.info(`[ProxyHandler] GET_PROXY_BY_ID success: found=${!!proxy}`)
      return {
        success: true,
        data: proxy
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 添加代理
  handle<Omit<Proxy, 'id' | 'createTime' | 'lastCheckStatus'>, void>(
    PROXY_EVENTS.ADD_PROXY,
    async (proxy) => {
      logger.info('[ProxyHandler] ADD_PROXY request:', proxy)
      try {
        await proxyManager.addProxy(proxy)
        logger.info('[ProxyHandler] ADD_PROXY success')
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 批量添加代理
  handle<Omit<Proxy, 'id' | 'createTime' | 'lastCheckStatus'>[], { success: number; failed: number; errors: string[] }>(
    PROXY_EVENTS.BATCH_ADD_PROXY,
    async (proxies) => {
      logger.info(`[ProxyHandler] BATCH_ADD_PROXY request: count=${proxies.length}`)
      try {
        const result = await proxyManager.batchAddProxies(proxies)
        logger.info(`[ProxyHandler] BATCH_ADD_PROXY success`)
        return { success: true, data: result }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 更新代理
  handle<
    {
      id: string
      isCheck: boolean
      updates: Partial<Omit<Proxy, 'id' | 'createTime' | 'lastCheckStatus'>>
    },
    void
  >(PROXY_EVENTS.UPDATE_PROXY, async ({ id, isCheck, updates }) => {
    logger.info(`[ProxyHandler] UPDATE_PROXY request: id=${id}`, updates)
    try {
      await proxyManager.updateProxy(id, isCheck, updates)
      logger.info('[ProxyHandler] UPDATE_PROXY success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 删除代理
  handle<string, void>(PROXY_EVENTS.DELETE_PROXY, async (id) => {
    logger.info(`[ProxyHandler] DELETE_PROXY request: id=${id}`)
    try {
      proxyManager.deleteProxy(id)
      logger.info('[ProxyHandler] DELETE_PROXY success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 检查代理有效性
  handle<Proxy | Proxy[], { success: boolean; error?: string }>(
    PROXY_EVENTS.CHECK_PROXY,
    async (proxy) => {
      const isArray = Array.isArray(proxy)
      const firstProxy = isArray ? proxy[0] : proxy
      logger.info(
        `[ProxyHandler] CHECK_PROXY request: ${firstProxy.protocol}://${firstProxy.host}:${firstProxy.port}${isArray ? ` (Total: ${proxy.length})` : ''}`
      )
      try {
        const result = await proxyManager.checkProxy(proxy)
        logger.info(`[ProxyHandler] CHECK_PROXY success: success=${result.success}`)
        return {
          success: true,
          data: result
        }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  logger.info('[ProxyHandler] ✅ 代理处理器已注册')
}
