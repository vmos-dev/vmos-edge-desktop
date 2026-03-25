/**
 * 代理检测 Worker
 * 运行在独立的 utility process 中，崩溃不影响主进程
 */

import { parentPort, workerData } from 'worker_threads'
import { VMOSEdgeProxy } from '@vmosedge/proxy-sdk'
import net from 'net'
import path from 'path'
import os from 'os'
import fs from 'fs'

// 在 Worker 线程中保存 resourcesPath
const resourcesPath = workerData?.resourcesPath
const isPackaged = workerData?.isPackaged

// 请求处理锁，确保同一时间只有一个检测任务在执行
let isProcessing = false
// 当前活跃的 SDK 实例，用于确保清理
let currentSdk: VMOSEdgeProxy | null = null
// 最后一次检测完成时间，用于添加冷却期
let lastCheckEndTime = 0
// 冷却期时间（毫秒），确保前一个 SDK 完全清理
const COOLDOWN_MS = 300
// 最大重试次数
const MAX_RETRIES = 2
// 可重试的错误关键词
const RETRYABLE_ERRORS = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'socket hang up', 'network', 'disconnected', 'TLS']


/**
 * 获取 SDK 二进制文件路径
 */
function getSdkBinPath() {
  if (!resourcesPath) {
    console.warn('[ProxyWorker] resourcesPath is not available')
    return undefined
  }

  const platform = os.platform()
  const arch = os.arch()
  const binName = platform === 'win32' ? 'mihomo.exe' : 'mihomo'

  // 修改为对应 electron-builder.yml 中的路径: vmosedge-proxy-sdk/bin/...
  // 注意：electron-builder 不支持 to 路径中的 @ 符号，所以使用 vmosedge-proxy-sdk 代替 @vmosedge/proxy-sdk
  const prodBinPath = path.join(
    resourcesPath,
    'vmosedge-proxy-sdk',
    'bin',
    `${platform}-${arch}`,
    binName
  )

  console.log(`[ProxyWorker] Looking for binary at: ${prodBinPath}`)
  console.log(`[ProxyWorker] resourcesPath: ${resourcesPath}`)
  console.log(`[ProxyWorker] File exists: ${fs.existsSync(prodBinPath)}`)

  if (fs.existsSync(prodBinPath)) {
    // macOS/Linux: 确保二进制文件有执行权限
    console.log(`[ProxyWorker] Found binary: ${prodBinPath}`)
    return prodBinPath
  }

  // 如果打包路径不存在，尝试检查目录是否存在（用于调试）
  const binDir = path.join(resourcesPath, 'vmosedge-proxy-sdk', 'bin', `${platform}-${arch}`)
  if (fs.existsSync(binDir)) {
    const files = fs.readdirSync(binDir)
    console.warn(`[ProxyWorker] Directory exists but binary not found. Files in directory:`, files)
  } else {
    console.warn(`[ProxyWorker] Directory does not exist: ${binDir}`)
  }

  return undefined
}

/**
 * 获取一个可用的随机端口
 */
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, () => {
      const address = server.address()
      if (address && typeof address !== 'string') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Failed to get port')))
      }
    })
  })
}

/**
 * Worker 消息类型
 */
interface WorkerMessage {
  id: string
  type: 'check'
  data: {
    proxies: {
      protocol: 'http' | 'https' | 'socks4' | 'socks5' | 'vmess' | 'vless' | 'ss' | 'ssr'
      host: string
      port: number
      username?: string
      password?: string
      rawLink?: string
    }[]
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
      timezone?: string
      city?: string
      loc?: string
    }
    error?: string
  }
  error?: string
}

/**
 * 将内部代理对象转换为 SDK 所需的配置
 */
function getProxyConfig(proxy: WorkerMessage['data']['proxies'][number]) {
  // 如果有原始链接，优先使用
  if (proxy.rawLink) {
    // 如果是 URI 字符串 (vless://..., ss://...)，直接返回让 SDK parseUri 处理
    if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(proxy.rawLink)) {
      return proxy.rawLink
    }
    try {
      // 尝试解析 JSON（适配 UI 存入的 rawLink）
      const config = JSON.parse(proxy.rawLink)
      // 兼容旧数据：gRPC 协议但缺少 grpc-opts 时，尝试从 serviceName 补全
      if (config.network === 'grpc' && !config['grpc-opts'] && config.serviceName) {
        config['grpc-opts'] = { 'grpc-service-name': config.serviceName }
      }
      return config
    } catch (e) {
      return proxy.rawLink
    }
  }

  // 传统协议 (http, https, socks5) 的手动构建
  const protocol = proxy.protocol.toLowerCase()
  const config: any = {
    name: 'test-proxy',
    type: protocol === 'https' ? 'http' : protocol,
    server: proxy.host,
    port: proxy.port
  }

  if (proxy.username && proxy.password) {
    config.username = proxy.username
    config.password = proxy.password
  }

  if (protocol === 'https') {
    config.tls = true
  }

  return config
}

/**
 * 获取检测 URL
 */
function getCheckUrl(providerType: string, apiKey: string = ''): string {
  if (providerType === 'ipinfo') {
    const url = new URL('https://ipinfo.io/json')
    if (apiKey) {
      url.searchParams.set('token', apiKey)
    }
    return url.toString()
  }

  if (providerType === 'ipmap') {
    const url = new URL('https://ipmap.sh/api')
    if (apiKey) {
      url.searchParams.set('token', apiKey)
    }
    return url.toString()
  }

  // 默认使用 Cloudflare
  return 'http://cp.cloudflare.com'
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: string): boolean {
  const lowerError = error.toLowerCase()
  return RETRYABLE_ERRORS.some((keyword) => lowerError.includes(keyword.toLowerCase()))
}

/**
 * 安全地停止并清理 SDK 实例
 */
async function cleanupSdk(sdk: VMOSEdgeProxy | null): Promise<void> {
  if (!sdk) return

  try {
    sdk.stop()
    // 给一点时间让进程完全退出
    await new Promise((resolve) => setTimeout(resolve, 100))
  } catch (e) {
    console.warn('[ProxyWorker] Error stopping SDK:', e)
  }
}

/**
 * 等待冷却期结束
 */
async function waitForCooldown(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastCheckEndTime
  if (elapsed < COOLDOWN_MS && lastCheckEndTime > 0) {
    const waitTime = COOLDOWN_MS - elapsed
    console.log(`[ProxyWorker] Waiting ${waitTime}ms for cooldown...`)
    await new Promise((resolve) => setTimeout(resolve, waitTime))
  }
}

/**
 * 执行单次代理检测
 */
async function doSingleCheck(
  proxies: WorkerMessage['data']['proxies'],
  timeout: number,
  providerType: string,
  apiKey: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const sdk = new VMOSEdgeProxy({
    timeout: timeout,
    logLevel: 'debug',
    binPath: isPackaged ? getSdkBinPath() : undefined
  })
  currentSdk = sdk

  try {
    const proxyConfigs = proxies.map((p) => getProxyConfig(p))
    const checkUrl = getCheckUrl(providerType, apiKey)

    // 获取动态可用端口，添加重试机制
    let mixedPort: number
    try {
      mixedPort = await getFreePort()
    } catch (e) {
      console.warn('[ProxyWorker] Failed to get free port, using fallback')
      mixedPort = 7891 + Math.floor(Math.random() * 1000)
    }

    // 使用 SDK 进行请求
    const response = await sdk.request(
      proxyConfigs,
      {
        url: checkUrl,
        timeout: timeout
      },
      { 'mixed-port': mixedPort }
    )

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Proxy request failed'
      }
    }

    // 处理返回的数据
    const data = response.data

    let resultData: any = {
      ip: '',
      country: '',
      providerType: providerType
    }

    if (providerType === 'ipinfo' || providerType === 'ipmap') {
      try {
        const businessData = typeof data === 'string' ? JSON.parse(data) : data
        resultData = {
          ...resultData,
          ip: businessData.ip || '',
          country: businessData.country || '',
          timezone: businessData.timezone || '',
          city: businessData.city || '',
          loc: businessData.loc || ''
        }
      } catch (e) {
        console.warn('[ProxyWorker] Failed to parse business data:', e)
      }
    }

    return {
      success: true,
      data: resultData
    }
  } finally {
    // 确保停止 SDK
    await cleanupSdk(sdk)
    currentSdk = null
  }
}

/**
 * 处理检测请求（带重试机制）
 */
async function handleCheck(message: WorkerMessage): Promise<WorkerResponse> {
  // 如果正在处理其他请求，先清理并等待
  if (isProcessing) {
    console.warn('[ProxyWorker] Previous check still in progress, cleaning up...')
    await cleanupSdk(currentSdk)
    currentSdk = null
    // 给更多时间确保完全清理
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // 等待冷却期
  await waitForCooldown()

  isProcessing = true
  const { proxies, timeout, providerType, apiKey = '' } = message.data

  let lastError: string = ''
  let result: { success: boolean; data?: any; error?: string } | null = null

  try {
    // 重试循环
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`[ProxyWorker] Retry attempt ${attempt}/${MAX_RETRIES}...`)
        // 重试前等待一段时间，让之前的资源完全释放
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      try {
        result = await doSingleCheck(proxies, timeout, providerType, apiKey)

        // 检测成功，直接返回
        if (result.success) {
          return {
            id: message.id,
            type: 'result',
            data: result
          }
        }

        // 检测失败，检查是否可重试
        lastError = result.error || 'Unknown error'
        if (!isRetryableError(lastError)) {
          // 不可重试的错误，直接返回
          console.log(`[ProxyWorker] Non-retryable error: ${lastError}`)
          break
        }

        console.warn(`[ProxyWorker] Retryable error on attempt ${attempt}: ${lastError}`)
      } catch (error: any) {
        lastError = error?.message || String(error)
        if (!isRetryableError(lastError)) {
          console.log(`[ProxyWorker] Non-retryable exception: ${lastError}`)
          break
        }
        console.warn(`[ProxyWorker] Retryable exception on attempt ${attempt}: ${lastError}`)
      }
    }

    // 所有重试都失败了
    return {
      id: message.id,
      type: 'result',
      data: {
        success: false,
        error: lastError
      }
    }
  } finally {
    isProcessing = false
    lastCheckEndTime = Date.now()
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
