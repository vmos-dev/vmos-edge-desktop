import { logger } from '../logger'
import axios from 'axios'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { getErrorMessage } from '@shared/api'

/**
 * 代理检测结果
 */
export interface ProxyCheckResult {
  success: boolean
  data?: {
    ip: string
    country: string
    providerType: string
  }
  error?: string
}

/**
 * 代理信息
 */
export interface ProxyInfo {
  protocol: 'http' | 'https' | 'socks4' | 'socks5'
  host: string
  port: number
  username?: string
  password?: string
}

/**
 * 代理检测策略接口
 * 不同的厂商实现不同的检测逻辑
 */
export interface IProxyCheckStrategy {
  /**
   * 检测代理有效性并获取 IP 和地区信息
   * @param proxy 代理信息
   * @param timeout 超时时间（毫秒）
   * @returns 检测结果
   */
  check(proxy: ProxyInfo, timeout: number): Promise<ProxyCheckResult>
}

/**
 * 默认代理检测策略
 *
 * 说明：
 * - 通过代理访问 http://cp.cloudflare.com 来检测代理连通性
 * - 只检测代理是否可用，不提取 IP 和地区信息
 * - 返回的 IP 和地区信息为空字符串
 */
export class DefaultProxyCheckStrategy implements IProxyCheckStrategy {
  private testUrl: string

  constructor() {
    // 使用 Cloudflare 的检测接口
    this.testUrl = 'http://cp.cloudflare.com'
  }

  /**
   * 检测代理连通性
   *
   * 流程：
   * 1. 构建代理 URL
   * 2. 创建代理 agent
   * 3. 通过代理访问 Cloudflare 检测接口
   * 4. 判断连通性，如果通过则返回成功（IP 和地区信息为空）
   *
   * @param proxy 代理信息
   * @param timeout 超时时间（毫秒）
   * @returns 检测结果，IP 和地区信息为空字符串
   */
  public async check(proxy: ProxyInfo, timeout: number): Promise<ProxyCheckResult> {
    const startTime = Date.now()
    logger.info(
      `[DefaultProxyCheckStrategy] Checking proxy: ${proxy.protocol}://${proxy.host}:${proxy.port}`
    )

    try {
      // 步骤 1: 构建代理 URL
      const proxyUrl = this.buildProxyUrl(proxy)

      // 步骤 2: 创建代理 agent
      const { httpAgent, httpsAgent } = this.createProxyAgents(proxyUrl, proxy.protocol)

      // 步骤 3: 通过代理访问 Cloudflare 检测接口
      logger.debug(`[DefaultProxyCheckStrategy] Testing proxy connectivity via ${this.testUrl}...`)
      const response = await axios.get(this.testUrl, {
        httpAgent,
        httpsAgent,
        timeout,
        validateStatus: (status) => status < 500 // 接受 2xx, 3xx, 4xx 状态码
      })

      const duration = Date.now() - startTime

      // 步骤 4: 判断连通性
      if (response.status >= 200 && response.status < 500) {
        // 连通性检测通过
        logger.info(
          `[DefaultProxyCheckStrategy] Proxy connectivity check passed: status=${response.status}, duration=${duration}ms`
        )

        // 返回成功，IP 和地区信息为空
        return {
          success: true,
          data: {
            ip: '',
            country: '',
            providerType: 'default'
          }
        }
      } else {
        // 连通性检测失败
        throw new Error(`Proxy connectivity check failed with status code: ${response.status}`)
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMsg = getErrorMessage(error)
      logger.warn(
        `[DefaultProxyCheckStrategy] Check failed: ${proxy.protocol}://${proxy.host}:${proxy.port}, error=${errorMsg}, duration=${duration}ms`
      )
      return {
        success: false,
        error: errorMsg
      }
    }
  }

  /**
   * 构建代理 URL
   */
  private buildProxyUrl(proxy: ProxyInfo): string {
    if (proxy.username && proxy.password) {
      return `${proxy.protocol.toLowerCase()}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    }
    return `${proxy.protocol.toLowerCase()}://${proxy.host}:${proxy.port}`
  }

  /**
   * 创建代理 agent，并配置错误处理
   */
  private createProxyAgents(
    proxyUrl: string,
    protocol: string
  ): {
    httpAgent: any
    httpsAgent: any
  } {
    const onAgentError = (err: any) => {
      logger.warn('[DefaultProxyCheckStrategy] ProxyAgent socket error:', err?.code || err?.message)
    }

    // 配置 agent 选项，禁用 TLS 证书验证以避免 ECONNRESET 崩溃
    const agentOptions = {
      rejectUnauthorized: false, // 忽略 TLS 证书验证错误
      timeout: 30000 // socket 超时时间
    }

    if (protocol === 'http' || protocol === 'https') {
      const httpAgent = new HttpProxyAgent(proxyUrl, agentOptions)
      const httpsAgent = new HttpsProxyAgent(proxyUrl, agentOptions)

      httpAgent.on('error', onAgentError)
      httpsAgent.on('error', onAgentError)

      return { httpAgent, httpsAgent }
    }

    if (protocol === 'socks4' || protocol === 'socks5') {
      const socksAgent = new SocksProxyAgent(proxyUrl, agentOptions)
      socksAgent.on('error', onAgentError)

      return {
        httpAgent: socksAgent,
        httpsAgent: socksAgent
      }
    }

    throw new Error(`Unsupported proxy protocol: ${protocol}`)
  }
}

/**
 * IPinfo API 检测策略
 * 通过代理访问 IPinfo API 获取 IP 和地区信息
 */
export class IpInfoProxyCheckStrategy implements IProxyCheckStrategy {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string = '') {
    this.apiKey = apiKey
    this.baseUrl = 'https://ipinfo.io/json'
  }

  /**
   * 检测代理有效性
   * 流程：
   * 1. 构建 API URL（添加 token 参数）
   * 2. 构建代理 URL
   * 3. 创建代理 agent
   * 4. 通过代理访问 IPinfo API 获取 IP 和地区信息
   */
  public async check(proxy: ProxyInfo, timeout: number): Promise<ProxyCheckResult> {
    const startTime = Date.now()
    logger.info(
      `[IpInfoProxyCheckStrategy] Checking proxy: ${proxy.protocol}://${proxy.host}:${proxy.port}`
    )

    try {
      // 步骤 1: 构建 API URL（添加 token 参数）
      const apiUrl = this.buildApiUrl()

      // 步骤 3: 构建代理 URL
      const proxyUrl = this.buildProxyUrl(proxy)

      // 步骤 4: 创建代理 agent
      const { httpAgent, httpsAgent } = this.createProxyAgents(proxyUrl, proxy.protocol)

      // 步骤 5: 通过代理访问 IPinfo API
      logger.debug(`[IpInfoProxyCheckStrategy] Fetching IP info via proxy...`)
      const response = await axios.get(apiUrl, {
        httpAgent,
        httpsAgent,
        timeout,
        validateStatus: (status) => status < 500
      })

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`IPinfo API request failed with status code: ${response.status}`)
      }

      const data = response.data
      const duration = Date.now() - startTime

      logger.info(
        `[IpInfoProxyCheckStrategy] Check success: IP=${data.ip}, Country=${data.country}, duration=${duration}ms`
      )

      return {
        success: true,
        data: {
          ip: data.ip || '',
          country: data.country || '',
          providerType: 'ipinfo'
        }
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorMsg = getErrorMessage(error)
      logger.warn(
        `[IpInfoProxyCheckStrategy] Check failed: ${proxy.protocol}://${proxy.host}:${proxy.port}, error=${errorMsg}, duration=${duration}ms`
      )
      return {
        success: false,
        error: errorMsg
      }
    }
  }

  /**
   * 构建 API URL（添加 token 参数）
   */
  private buildApiUrl(): string {
    const urlObj = new URL(this.baseUrl)
    if (this.apiKey) {
      urlObj.searchParams.set('token', this.apiKey)
    }
    return urlObj.toString()
  }

  /**
   * 构建代理 URL
   */
  private buildProxyUrl(proxy: ProxyInfo): string {
    if (proxy.username && proxy.password) {
      return `${proxy.protocol.toLowerCase()}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
    }
    return `${proxy.protocol.toLowerCase()}://${proxy.host}:${proxy.port}`
  }

  /**
   * 创建代理 agent，并配置错误处理
   */
  private createProxyAgents(
    proxyUrl: string,
    protocol: string
  ): {
    httpAgent: any
    httpsAgent: any
  } {
    const onAgentError = (err: any) => {
      logger.warn('[IpInfoProxyCheckStrategy] ProxyAgent socket error:', err?.code || err?.message)
    }

    // 配置 agent 选项，禁用 TLS 证书验证以避免 ECONNRESET 崩溃
    const agentOptions = {
      rejectUnauthorized: false, // 忽略 TLS 证书验证错误
      timeout: 30000 // socket 超时时间
    }

    if (protocol === 'http' || protocol === 'https') {
      const httpAgent = new HttpProxyAgent(proxyUrl, agentOptions)
      const httpsAgent = new HttpsProxyAgent(proxyUrl, agentOptions)

      httpAgent.on('error', onAgentError)
      httpsAgent.on('error', onAgentError)

      return {
        httpAgent,
        httpsAgent
      }
    } else if (protocol === 'socks4' || protocol === 'socks5') {
      const socksAgent = new SocksProxyAgent(proxyUrl, agentOptions)
      socksAgent.on('error', onAgentError)

      return {
        httpAgent: socksAgent,
        httpsAgent: socksAgent
      }
    } else {
      throw new Error(`Unsupported proxy protocol: ${protocol}`)
    }
  }
}

/**
 * 代理检测策略工厂
 * 根据配置的厂商类型创建对应的策略实例
 */
export class ProxyCheckStrategyFactory {
  /**
   * 创建代理检测策略
   * @param providerType 厂商类型：'default' | 'ipinfo'
   * @param apiKey API Key（仅 ipinfo 需要）
   * @returns 策略实例
   */
  public static create(providerType: string, apiKey: string = ''): IProxyCheckStrategy {
    // 处理 'default' 使用默认策略
    if (providerType === 'default') {
      logger.debug(`[ProxyCheckStrategyFactory] Creating default strategy`)
      return new DefaultProxyCheckStrategy()
    }

    if (providerType === 'ipinfo') {
      logger.debug(`[ProxyCheckStrategyFactory] Creating IPinfo strategy`)
      return new IpInfoProxyCheckStrategy(apiKey)
    }

    // 默认使用默认策略
    logger.warn(
      `[ProxyCheckStrategyFactory] Unknown provider type: ${providerType}, using default strategy`
    )
    return new DefaultProxyCheckStrategy()
  }
}
