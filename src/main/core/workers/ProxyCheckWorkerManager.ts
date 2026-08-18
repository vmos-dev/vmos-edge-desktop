/**
 * 代理检测 Worker 管理器
 * 使用 Worker Threads 隔离代理检测逻辑，防止崩溃影响主进程
 */

import { Worker } from 'worker_threads'
import path from 'path'
import { logger } from '../logger'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'

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
  protocol: 'http' | 'https' | 'socks5' | 'vmess' | 'ss' | 'ssr' | 'vless'
  host: string
  port: number
  username?: string
  password?: string
  rawLink?: string
}

/**
 * Worker 管理器
 * 负责创建和管理 worker 实例，处理消息通信
 */
export class ProxyCheckWorkerManager {
  private worker: Worker | null = null
  private pendingRequests: Map<
    string,
    {
      resolve: (result: ProxyCheckResult) => void
      reject: (error: Error) => void
      timer: NodeJS.Timeout
    }
  > = new Map()

  /**
   * 获取 resources 目录路径
   */
  private getResourcesPath(): string {
    if (app.isPackaged) {
      return process.resourcesPath || ''
    }
    // 开发环境：使用项目根目录的 resources 目录
    return path.join(process.cwd(), 'resources')
  }

  /**
   * 初始化 worker
   */
  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker
    }

    const workerPath = path.join(__dirname, 'proxyCheckWorker.js')
    const resourcesPath = this.getResourcesPath()
    logger.info(`[ProxyCheckWorkerManager] Creating worker at: ${workerPath}`)
    logger.info(`[ProxyCheckWorkerManager] resourcesPath: ${resourcesPath}`)

    this.worker = new Worker(workerPath, {
      workerData: {
        resourcesPath: resourcesPath,
        isPackaged: app.isPackaged
      }
    })

    // 监听 worker 消息
    this.worker.on('message', (response: any) => {
      this.handleWorkerMessage(response)
    })

    // 监听 worker 错误
    this.worker.on('error', (error) => {
      logger.error('[ProxyCheckWorkerManager] Worker error:', error)
      this.handleWorkerError(error)
    })

    // 监听 worker 退出
    this.worker.on('exit', (code) => {
      logger.warn(`[ProxyCheckWorkerManager] Worker exited with code ${code}`)
      this.worker = null

      // 清理所有待处理的请求
      for (const [id, request] of this.pendingRequests.entries()) {
        clearTimeout(request.timer)
        request.reject(new Error(`Worker exited with code ${code}`))
        this.pendingRequests.delete(id)
      }
    })

    return this.worker
  }

  /**
   * 处理 worker 返回的消息
   */
  private handleWorkerMessage(response: any): void {
    const request = this.pendingRequests.get(response.id)
    if (!request) {
      logger.warn(`[ProxyCheckWorkerManager] Received response for unknown request: ${response.id}`)
      return
    }

    clearTimeout(request.timer)
    this.pendingRequests.delete(response.id)

    if (response.type === 'result') {
      request.resolve(response.data)
    } else if (response.type === 'error') {
      request.reject(new Error(response.error))
    }
  }

  /**
   * 处理 worker 错误
   */
  private handleWorkerError(error: Error): void {
    // 拒绝所有待处理的请求
    for (const [id, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timer)
      request.reject(error)
      this.pendingRequests.delete(id)
    }

    // 销毁当前 worker
    this.destroyWorker()
  }

  /**
   * 检测代理
   */
  public async check(
    proxy: ProxyInfo | ProxyInfo[],
    timeout: number,
    providerType: string = 'default',
    apiKey: string = ''
  ): Promise<ProxyCheckResult> {
    const worker = this.ensureWorker()
    const id = uuidv4()

    return new Promise((resolve, reject) => {
      // 设置超时定时器
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Proxy check timeout after ${timeout}ms`))
      }, timeout + 1000) // 额外加 1 秒作为安全余量

      // 保存请求
      this.pendingRequests.set(id, { resolve, reject, timer })

      // 发送消息到 worker
      worker.postMessage({
        id,
        type: 'check',
        data: {
          proxies: Array.isArray(proxy) ? proxy : [proxy],
          timeout,
          providerType,
          apiKey
        }
      })
    })
  }

  /**
   * 销毁 worker
   */
  private destroyWorker(): void {
    if (this.worker) {
      try {
        this.worker.terminate()
      } catch (error) {
        logger.error('[ProxyCheckWorkerManager] Failed to terminate worker:', error)
      }
      this.worker = null
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    logger.info('[ProxyCheckWorkerManager] Destroying worker manager')

    // 清理所有待处理的请求
    for (const [id, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timer)
      request.reject(new Error('Worker manager destroyed'))
      this.pendingRequests.delete(id)
    }

    // 销毁 worker
    this.destroyWorker()
  }
}

/**
 * 全局单例
 */
let workerManager: ProxyCheckWorkerManager | null = null

/**
 * 获取 worker 管理器实例
 */
export function getProxyCheckWorkerManager(): ProxyCheckWorkerManager {
  if (!workerManager) {
    workerManager = new ProxyCheckWorkerManager()
  }
  return workerManager
}

/**
 * 销毁 worker 管理器
 */
export function destroyProxyCheckWorkerManager(): void {
  if (workerManager) {
    workerManager.destroy()
    workerManager = null
  }
}
