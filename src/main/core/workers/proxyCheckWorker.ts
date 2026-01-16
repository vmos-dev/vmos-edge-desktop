/**
 * 代理检测 Worker
 * 运行在独立的 utility process 中，崩溃不影响主进程
 */

import { parentPort } from 'worker_threads'
import axios from 'axios'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

/**
 * Worker 消息类型
 */
interface WorkerMessage {
  id: string
  type: 'check'
  data: {
    proxy: {
      protocol: 'http' | 'https' | 'socks4' | 'socks5'
      host: string
      port: number
      username?: string
      password?: string
    }
    timeout: number
    providerType: string
    apiKey?: string
  }
}

/**
 * Worker 响应类型
 */
interface WorkerResponse {
  id: string
  type: 'result' | 'error'
  data?: {
    success: boolean
    data?: {
      ip: string
      country: string
      providerType: string
    }
    error?: string
  }
  error?: string
}

interface CheckResult {
  ip: string
  country: string
  timezone: string
  city: string
  providerType: string
  loc: string
}

/**
 * 构建代理 URL
 */
function buildProxyUrl(proxy: WorkerMessage['data']['proxy']): string {
  if (proxy.username && proxy.password) {
    return `${proxy.protocol.toLowerCase()}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
  }
  return `${proxy.protocol.toLowerCase()}://${proxy.host}:${proxy.port}`
}

/**
 * 创建代理 agent
 */
function createProxyAgents(
  proxyUrl: string,
  protocol: string
): {
  httpAgent: any
  httpsAgent: any
} {
  const agentOptions = {
    rejectUnauthorized: false, // 忽略 TLS 证书验证错误
    timeout: 30000 // socket 超时时间
  }

  if (protocol === 'http' || protocol === 'https') {
    const httpAgent = new HttpProxyAgent(proxyUrl, agentOptions)
    const httpsAgent = new HttpsProxyAgent(proxyUrl, agentOptions)
    return { httpAgent, httpsAgent }
  }

  if (protocol === 'socks4' || protocol === 'socks5') {
    const socksAgent = new SocksProxyAgent(proxyUrl, agentOptions)
    return {
      httpAgent: socksAgent,
      httpsAgent: socksAgent
    }
  }

  throw new Error(`Unsupported proxy protocol: ${protocol}`)
}

/**
 * 默认检测策略 - 使用 Cloudflare
 */
async function checkDefault(
  proxy: WorkerMessage['data']['proxy'],
  timeout: number
): Promise<CheckResult> {
  const proxyUrl = buildProxyUrl(proxy)
  const { httpAgent, httpsAgent } = createProxyAgents(proxyUrl, proxy.protocol)

  const response = await axios.get('http://cp.cloudflare.com', {
    httpAgent,
    httpsAgent,
    timeout,
    validateStatus: (status) => status < 500
  })

  if (response.status >= 200 && response.status < 500) {
    return {
      ip: '',
      country: '',
      timezone: '',
      city: '',
      providerType: 'default',
      loc: ''
    }
  }

  throw new Error(`Proxy connectivity check failed with status code: ${response.status}`)
}

/**
 * IPinfo 检测策略
 */
async function checkIpInfo(
  proxy: WorkerMessage['data']['proxy'],
  timeout: number,
  apiKey: string = ''
): Promise<CheckResult> {
  const proxyUrl = buildProxyUrl(proxy)
  const { httpAgent, httpsAgent } = createProxyAgents(proxyUrl, proxy.protocol)

  const urlObj = new URL('https://ipinfo.io/json')
  if (apiKey) {
    urlObj.searchParams.set('token', apiKey)
  }

  const response = await axios.get(urlObj.toString(), {
    httpAgent,
    httpsAgent,
    timeout,
    validateStatus: (status) => status < 500
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`IPinfo API request failed with status code: ${response.status}`)
  }

  const data = response?.data || {}
  return {
    ip: data.ip || '',
    country: data.country || '',
    timezone: data.timezone || '',
    city: data.city || '',
    providerType: 'ipinfo',
    loc: data.loc || ''
  }
}

/**
 * 处理检测请求
 */
async function handleCheck(message: WorkerMessage): Promise<WorkerResponse> {
  try {
    const { proxy, timeout, providerType, apiKey } = message.data

    let result: {
      ip: string
      country: string
      timezone: string
      city: string
      providerType: string
      loc: string
    }

    if (providerType === 'ipinfo') {
      result = await checkIpInfo(proxy, timeout, apiKey)
    } else {
      result = await checkDefault(proxy, timeout)
    }

    return {
      id: message.id,
      type: 'result',
      data: {
        success: true,
        data: result
      }
    }
  } catch (error: any) {
    return {
      id: message.id,
      type: 'result',
      data: {
        success: false,
        error: error?.message || String(error)
      }
    }
  }
}

/**
 * 监听来自主进程的消息
 */
if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    try {
      if (message.type === 'check') {
        const response = await handleCheck(message)
        parentPort!.postMessage(response)
      }
    } catch (error: any) {
      const errorResponse: WorkerResponse = {
        id: message.id,
        type: 'error',
        error: error?.message || String(error)
      }
      parentPort!.postMessage(errorResponse)
    }
  })
}
