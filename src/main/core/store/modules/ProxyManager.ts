import { BaseManager } from './BaseManager'
import { logger } from '../../logger'
import { ProxyDao } from '../../dao/ProxyDao'
import { Proxy } from '@shared/ipc/data.types'
import { v4 as uuidv4 } from 'uuid'
import { configManager } from '../managers'
import { CONFIG_KEYS } from '@shared/constant'
import { getProxyCheckWorkerManager } from '../../workers/ProxyCheckWorkerManager'

/**
 * 代理管理器
 * 提供代理的存储、读取和验证功能
 */
export class ProxyManager extends BaseManager {
  private proxyDao: ProxyDao

  constructor() {
    super()
    this.proxyDao = new ProxyDao(this.dbInstance)
  }

  /**
   * 获取所有代理
   */
  public getProxies(): Proxy[] {
    const startTime = Date.now()
    logger.debug('[ProxyManager] getProxies called')
    try {
      const proxies = this.proxyDao.getAllProxies()
      const duration = Date.now() - startTime
      logger.debug(
        `[ProxyManager] getProxies success: count=${proxies.length}, duration=${duration}ms`
      )
      return proxies
    } catch (error) {
      logger.error('[ProxyManager] getProxies failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  /**
   * 查询代理
   */
  public queryProxies(options?: { name?: string; host?: string }): Proxy[] {
    const startTime = Date.now()
    logger.debug('[ProxyManager] queryProxies called', options)
    try {
      const proxies = this.proxyDao.queryProxies(options || {})
      const duration = Date.now() - startTime
      logger.debug(
        `[ProxyManager] queryProxies success: count=${proxies.length}, duration=${duration}ms`
      )
      return proxies
    } catch (error) {
      logger.error('[ProxyManager] queryProxies failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        options
      })
      throw error
    }
  }

  /**
   * 根据ID获取代理
   */
  public getProxyById(id: string): Proxy | undefined {
    logger.debug(`[ProxyManager] getProxyById called: id=${id}`)
    try {
      const proxy = this.proxyDao.getProxyById(id)
      logger.debug(`[ProxyManager] getProxyById success: id=${id}, found=${!!proxy}`)
      return proxy
    } catch (error) {
      logger.error(`[ProxyManager] getProxyById failed:`, {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id
      })
      throw error
    }
  }

  /**
   * 添加代理
   */
  public async addProxy(
    proxy: Omit<Proxy, 'id' | 'createTime' | 'lastCheckStatus'>
  ): Promise<void> {
    const startTime = Date.now()
    logger.info(`[ProxyManager] addProxy called:`, proxy)
    try {
      if (!proxy.name || !proxy.protocol || !proxy.host || !proxy.port) {
        logger.warn(
          `[ProxyManager] addProxy: invalid input name=${proxy.name}, protocol=${proxy.protocol}, host=${proxy.host}, port=${proxy.port}`
        )
        throw new Error('Incomplete proxy data: name, protocol, host, port are required fields')
      }
      let lastCheckStatus: 'success' | 'failed' | '' = ''
      let result: { success: boolean; data?: any; error?: string } | undefined
      if (['http', 'https', 'socks5'].includes(proxy.protocol)) {
        try {
          result = await this.checkProxy(proxy as any)
          lastCheckStatus = result.success ? 'success' : 'failed'
        } catch (error) {
          lastCheckStatus = 'failed'
        }
      }
      const newProxy: any = {
        id: uuidv4(),
        createTime: Date.now(),
        lastCheckStatus: lastCheckStatus,
        ...proxy,
        ip: result?.data?.ip || '',
        country: result?.data?.country || '',
        city: result?.data?.city || '',
        timezone: result?.data?.timezone || '',
        loc: result?.data?.loc || ''
      }
      this.proxyDao.addProxy(newProxy)
      const duration = Date.now() - startTime
      logger.info(`[ProxyManager] addProxy success: id=${newProxy.id}, duration=${duration}ms`)
    } catch (error) {
      logger.error('[ProxyManager] addProxy failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        proxy: proxy
      })
      throw error
    }
  }

  /**
   * 更新代理
   */
  public async updateProxy(
    id: string,
    isCheck: boolean = true,
    updates: Partial<Omit<Proxy, 'id' | 'createTime'>>
  ): Promise<void> {
    const startTime = Date.now()
    logger.info(`[ProxyManager] updateProxy called: id=${id}`, updates)
    try {
      if (!id) {
        logger.warn(`[ProxyManager] updateProxy: invalid input id=${id}`)
        throw new Error('Invalid input: id is required')
      }

      let lastCheckStatus: 'success' | 'failed' | '' = ''
      let result: { success: boolean; data?: any; error?: string } | undefined

      if (['http', 'https', 'socks5'].includes(updates.protocol as any) && isCheck) {
        try {
          result = await this.checkProxy({
            protocol: updates.protocol as any,
            host: updates.host || '',
            port: updates.port || 0,
            username: updates.username || undefined,
            password: updates.password || undefined
          })
          lastCheckStatus = result?.success ? 'success' : 'failed'
        } catch (error) {
          lastCheckStatus = 'failed'
        }
      }

      const updated = this.proxyDao.updateProxy(
        id,
        !isCheck
          ? { ...updates }
          : {
              ...updates,
              lastCheckStatus: lastCheckStatus,
              ip: result?.data?.ip || '',
              country: result?.data?.country || '',
              city: result?.data?.city || '',
              timezone: result?.data?.timezone || '',
              loc: result?.data?.loc || ''
            }
      )
      const duration = Date.now() - startTime
      if (!updated) {
        logger.warn(`[ProxyManager] updateProxy not found: id=${id}, duration=${duration}ms`)
        throw new Error(`Proxy not found: id=${id}`)
      }
      logger.info(`[ProxyManager] updateProxy success: id=${id}, duration=${duration}ms`)
    } catch (error) {
      logger.error('[ProxyManager] updateProxy failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id: id,
        updates
      })
      throw error
    }
  }

  /**
   * 删除代理
   */
  public deleteProxy(id: string): void {
    const startTime = Date.now()
    logger.info(`[ProxyManager] deleteProxy called: id=${id}`)
    try {
      if (!id) {
        logger.warn(`[ProxyManager] deleteProxy: invalid input id=${id}`)
        throw new Error('Invalid input: id is required')
      }

      const deleted = this.proxyDao.deleteProxy(id)
      const duration = Date.now() - startTime
      if (!deleted) {
        logger.warn(`[ProxyManager] deleteProxy not found: id=${id}, duration=${duration}ms`)
        throw new Error(`Proxy not found: id=${id}`)
      }
      logger.info(`[ProxyManager] deleteProxy success: id=${id}, duration=${duration}ms`)
    } catch (error) {
      logger.error('[ProxyManager] deleteProxy failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id: id
      })
      throw error
    }
  }

  /**
   * 检查代理有效性（使用独立 Worker 进程）
   *
   * 功能说明：
   * 1. 根据配置的厂商类型（providerType）选择对应的检测策略
   * 2. 通过代理访问测试接口检测代理连通性
   * 3. 根据策略类型决定是否获取 IP 和地区信息
   * 4. **在独立的 Worker 进程中运行，崩溃不影响主进程**
   *
   * 支持的厂商类型：
   * - 'default': 默认检测策略
   *   - 通过代理访问 http://cp.cloudflare.com 检测代理连通性
   *   - 只检测代理是否可用，不提取 IP 和地区信息
   *   - 返回的 IP 和地区信息为空字符串
   * - 'ipinfo': 使用 IPinfo API 服务
   *   - 通过代理访问 ipinfo.io API 获取代理的出口 IP 和地区信息
   *   - 需要配置 API Key（可选，但推荐）
   *   - 会实际验证代理的连通性和出口 IP
   *
   * @param proxy 代理信息
   * @returns 检测结果，包含 success、data（ip 和 country）、error
   *
   * @example
   * // 检测 HTTP 代理
   * const result = await proxyManager.checkProxy({
   *   protocol: 'http',
   *   host: 'proxy.example.com',  // 域名会自动解析
   *   port: 8080,
   *   username: 'user',
   *   password: 'pass'
   * })
   *
   * // 检测 SOCKS5 代理（IP 地址）
   * const result = await proxyManager.checkProxy({
   *   protocol: 'socks5',
   *   host: '192.168.1.100',  // IP 地址直接使用
   *   port: 1080
   * })
   */
  public async checkProxy(proxy: {
    protocol: 'http' | 'https' | 'socks5' | 'vmess' | 'ss' | 'ssr' | 'vless'
    host: string
    port: number
    username?: string
    password?: string
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    logger.info(
      `[ProxyManager] checkProxy called (Worker): ${proxy.protocol}://${proxy.host}:${proxy.port}`
    )

    const startTime = Date.now()
    try {
      // 步骤 1: 从配置读取超时时间和厂商类型
      const timeoutStr = configManager.getValue(CONFIG_KEYS.PROXY_CHECK_TIMEOUT)!
      const timeout = parseInt(timeoutStr, 10)
      const providerType =
        configManager.getValue(CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE) || 'default'
      const apiKey = configManager.getValue(CONFIG_KEYS.PROXY_CHECK_API_KEY) || ''

      logger.debug(
        `[ProxyManager] Using worker with provider: ${providerType}, timeout: ${timeout}ms, hasApiKey: ${!!apiKey}`
      )

      // 步骤 2: 获取 Worker 管理器
      const workerManager = getProxyCheckWorkerManager()

      // 步骤 3: 在 Worker 中执行检测（隔离运行，崩溃不影响主进程）
      const result = await workerManager.check(
        {
          protocol: proxy.protocol,
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password
        },
        timeout,
        providerType,
        apiKey
      )

      const duration = Date.now() - startTime

      if (result.success) {
        logger.info(
          `[ProxyManager] checkProxy success: ${proxy.protocol}://${proxy.host}:${proxy.port}, IP=${result.data?.ip}, Country=${result.data?.country}, duration=${duration}ms`
        )
      } else {
        logger.warn(
          `[ProxyManager] checkProxy failed: ${proxy.protocol}://${proxy.host}:${proxy.port}, error=${result.error}, duration=${duration}ms`
        )
      }

      // 步骤 4: 如果检测失败，抛出错误（保持向后兼容）
      if (!result.success) {
        throw new Error(result.error || 'Proxy check failed')
      }

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[ProxyManager] checkProxy failed: ${proxy.protocol}://${proxy.host}:${proxy.port}, error=${errorMsg}, duration=${duration}ms`
      )
      throw new Error(errorMsg)
    }
  }
}
