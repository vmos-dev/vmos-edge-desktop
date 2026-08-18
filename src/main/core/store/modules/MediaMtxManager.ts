import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, ChildProcess, execSync } from 'child_process'
import net from 'net'
import os from 'os'
import { BaseManager } from './BaseManager'
import { logger } from '../../logger'
import {
  StartMediaServerOptions,
  StartMediaServerResult,
  MediaServerStatus
} from '@shared/ipc/mediaMtx.types'
import { MEDIAMTX_LOG, MEDIAMTX_STATUS_CHANGE } from '@shared/ipc/channels'

/**
 * MediaMTX 服务管理器 (高级版)
 *
 * 特性：
 * 1. 进程生命周期管理 (自动重启、优雅退出)
 * 2. 动态端口探测与冲突解决
 * 3. 结构化配置生成
 * 4. 详细的日志与状态监控
 */
export class MediaMtxManager extends BaseManager {
  private child: ChildProcess | null = null
  private running = false
  private currentPorts: { webrtc: number; rtsp: number } | null = null
  private lastError: string | undefined

  /** mediamtx 专属目录（用户数据隔离） */
  private readonly mediamtxDir: string
  /** 配置文件路径 */
  private readonly configPath: string

  // 自动重启配置
  private restartCount = 0
  private readonly MAX_RESTARTS = 3
  private readonly RESTART_WINDOW = 60000 // 1分钟内
  private lastRestartTime = 0
  private intentionalStop = false
  private currentOptions: StartMediaServerOptions | null = null

  constructor() {
    super()
    // 创建独立的 mediamtx 目录，与用户数据隔离
    this.mediamtxDir = path.join(app.getPath('userData'), 'mediamtx')
    this.configPath = path.join(this.mediamtxDir, 'mediamtx.yml')

    // 确保应用退出时清理资源
    app.on('before-quit', () => {
      this.stopServer()
    })
  }

  /**
   * 确保 mediamtx 专属目录存在
   * 所有 mediamtx 相关文件都隔离在 userData/mediamtx/ 目录下
   */
  private ensureMediaMtxDir(): void {
    if (!fs.existsSync(this.mediamtxDir)) {
      fs.mkdirSync(this.mediamtxDir, { recursive: true })
      logger.info(`[MediaMtx] Created isolated mediamtx directory: ${this.mediamtxDir}`)
    }
  }

  /**
   * macOS 特殊处理：确保二进制文件可执行
   * 1. 移除 Gatekeeper quarantine 扩展属性
   * 2. 确保文件有执行权限
   */
  private ensureMacOSBinaryPermissions(binaryPath: string): void {
    if (process.platform !== 'darwin') return

    try {
      // 移除 quarantine 属性，防止 Gatekeeper 阻止执行
      // xattr -d com.apple.quarantine <path>
      execSync(`xattr -d com.apple.quarantine "${binaryPath}"`, {
        stdio: 'ignore',
        timeout: 5000
      })
      logger.info(`[MediaMtx] Removed quarantine attribute from: ${binaryPath}`)
    } catch {
      // 属性不存在时会报错，可以忽略
      logger.debug(
        `[MediaMtx] No quarantine attribute to remove (normal for signed/local binaries)`
      )
    }

    try {
      // 确保文件有执行权限 (chmod +x)
      execSync(`chmod +x "${binaryPath}"`, {
        stdio: 'ignore',
        timeout: 5000
      })
      logger.info(`[MediaMtx] Ensured execute permission for: ${binaryPath}`)
    } catch (error) {
      logger.warn(`[MediaMtx] Failed to set execute permission: ${error}`)
    }
  }

  /**
   * 启动 MediaMTX 服务
   */
  public async startServer(options: StartMediaServerOptions): Promise<StartMediaServerResult> {
    this.intentionalStop = false
    this.currentOptions = options

    if (this.running && this.child) {
      logger.warn('[MediaMtx] Server already running, stopping first...')
      await this.stopServer(false) // 不清除 currentOptions，因为是重启
    }

    try {
      // 1. 查找可用端口 (如果未指定，使用默认或动态查找)
      const webrtcPort = await this.findAvailablePort(options.preferredPorts?.webrtc || 8889)
      const rtspPort = await this.findAvailablePort(options.preferredPorts?.rtsp || 8554)
      this.currentPorts = { webrtc: webrtcPort, rtsp: rtspPort }

      // 2. 确保目录存在并生成配置文件
      this.ensureMediaMtxDir()
      await this.generateConfig({
        webrtcPort,
        rtspPort,
        pathName: options.path || 'cam',
        exposeRtspToLan: options.exposeRtspToLan ?? false
      })

      // 3. 启动子进程
      await this.spawnProcess()

      this.notifyFrontend(MEDIAMTX_STATUS_CHANGE, this.getStatus())

      // 4. 构建返回结果
      const host = '127.0.0.1'
      let displayHost = host
      if (options.exposeRtspToLan) {
        displayHost = this.getLanIp() || host
      }

      return {
        webrtcPublishUrl: `http://127.0.0.1:${webrtcPort}/${options.path || 'cam'}/whip`,
        rtspUrl: `rtsp://${displayHost}:${rtspPort}/${options.path || 'cam'}`,
        ports: this.currentPorts
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      logger.error('[MediaMtx] Start failed', error)
      this.running = false
      this.notifyFrontend(MEDIAMTX_STATUS_CHANGE, this.getStatus())
      throw error
    }
  }

  /**
   * 停止服务
   * @param clearOptions 是否清除当前的启动选项 (完全停止时为 true)
   */
  public async stopServer(clearOptions = true): Promise<void> {
    if (clearOptions) {
      this.intentionalStop = true
      this.currentOptions = null
      this.restartCount = 0
    }

    if (this.child) {
      logger.info('[MediaMtx] Stopping server...')
      this.child.kill() // SIGTERM

      // 等待进程真正退出，避免僵尸进程
      const killPromise = new Promise<void>((resolve) => {
        if (!this.child) return resolve()
        const timeout = setTimeout(() => {
          if (this.child) {
            this.child.kill('SIGKILL') // 强制杀死
            resolve()
          }
        }, 2000)

        this.child.once('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      await killPromise
      this.child = null
    }

    this.running = false
    this.currentPorts = null
    this.notifyFrontend(MEDIAMTX_STATUS_CHANGE, this.getStatus())
  }

  public getStatus(): MediaServerStatus {
    return {
      running: this.running,
      ports: this.currentPorts || undefined,
      pid: this.child?.pid,
      lastError: this.lastError
    }
  }

  /**
   * 启动子进程的核心逻辑
   */
  private async spawnProcess() {
    const binaryPath = this.getBinaryPath()
    logger.info(`[MediaMtx] Spawning binary: ${binaryPath}`)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`MediaMTX binary not found at: ${binaryPath}`)
    }

    // macOS: 确保二进制文件可执行（移除 quarantine 属性 + chmod +x）
    this.ensureMacOSBinaryPermissions(binaryPath)

    // MediaMTX 期望配置文件作为第一个参数
    this.child = spawn(binaryPath, [this.configPath], {
      windowsHide: true,
      cwd: path.dirname(binaryPath),
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.running = true
    this.lastError = undefined

    // 标准输出处理
    this.child.stdout?.on('data', (data) => {
      const msg = data.toString().trim()
      // 过滤掉一些无用的心跳日志，避免前端刷屏
      if (msg && !msg.includes('closed') && !msg.includes('opened')) {
        logger.debug(`[MediaMtx] STDOUT: ${msg}`)
        this.notifyFrontend(MEDIAMTX_LOG, { type: 'stdout', message: msg })
      }
    })

    // 错误输出处理
    this.child.stderr?.on('data', (data) => {
      const msg = data.toString().trim()
      logger.warn(`[MediaMtx] STDERR: ${msg}`)
      this.notifyFrontend(MEDIAMTX_LOG, { type: 'stderr', message: msg })
    })

    // 进程退出处理
    this.child.on('close', (code, signal) => {
      const exitMsg = signal ? `signal ${signal}` : `code ${code}`
      logger.info(`[MediaMtx] Process exited with ${exitMsg}`)
      this.running = false
      this.child = null

      if (!this.intentionalStop) {
        this.handleUnexpectedExit(code, signal)
      } else {
        this.notifyFrontend(MEDIAMTX_STATUS_CHANGE, this.getStatus())
      }
    })

    this.child.on('error', (err) => {
      logger.error(`[MediaMtx] Failed to start subprocess: ${err.message}`)
      this.running = false
      this.lastError = `Spawn error: ${err.message}`
      this.notifyFrontend(MEDIAMTX_STATUS_CHANGE, this.getStatus())
    })

    // 启动健康检查
    if (this.currentPorts?.rtsp) {
      await this.waitForPort(this.currentPorts.rtsp)
    }
  }

  /**
   * 处理意外退出 (自动重启机制)
   */
  private handleUnexpectedExit(code: number | null, signal: string | null) {
    const exitMsg = signal ? `killed by signal ${signal}` : `exited with code ${code}`
    this.lastError = `Exited unexpectedly: ${exitMsg}`
    this.notifyFrontend(MEDIAMTX_STATUS_CHANGE, this.getStatus())

    const now = Date.now()
    if (now - this.lastRestartTime > this.RESTART_WINDOW) {
      // 如果距离上次重启超过窗口期，重置计数器
      this.restartCount = 0
    }

    if (this.restartCount < this.MAX_RESTARTS && this.currentOptions) {
      this.restartCount++
      this.lastRestartTime = now
      const delay = this.restartCount * 1000 // 线性退避: 1s, 2s, 3s

      logger.warn(
        `[MediaMtx] Attempting auto-restart (${this.restartCount}/${this.MAX_RESTARTS}) in ${delay}ms...`
      )

      setTimeout(() => {
        if (!this.intentionalStop && this.currentOptions) {
          this.startServer(this.currentOptions).catch((e) => {
            logger.error('[MediaMtx] Auto-restart failed', e)
          })
        }
      }, delay)
    } else {
      logger.error('[MediaMtx] Max restart attempts reached. Giving up.')
      this.lastError = 'Max restart attempts reached'
      this.notifyFrontend(MEDIAMTX_STATUS_CHANGE, this.getStatus())
    }
  }

  private getBinaryPath(): string {
    const platform = process.platform
    const arch = process.arch
    let binaryName = 'mediamtx'
    let platformDir = ''

    if (platform === 'win32') {
      binaryName = 'mediamtx.exe'
      platformDir = 'win'
    } else if (platform === 'darwin') {
      platformDir = `mac-${arch}`
    } else if (platform === 'linux') {
      platformDir = 'linux'
    } else {
      throw new Error(`Unsupported platform: ${platform}`)
    }

    const resourcesRoot = app.isPackaged
      ? process.resourcesPath
      : path.join(process.cwd(), 'resources')

    return path.join(resourcesRoot, platformDir, 'mediamtx', binaryName)
  }

  /**
   * 生成配置文件
   * 使用对象结构而不是纯字符串模板，便于维护
   */
  private async generateConfig(params: {
    webrtcPort: number
    rtspPort: number
    pathName: string
    exposeRtspToLan: boolean
  }) {
    const webrtcAddress = `0.0.0.0:${params.webrtcPort}`
    const rtspAddress = params.exposeRtspToLan
      ? `0.0.0.0:${params.rtspPort}`
      : `127.0.0.1:${params.rtspPort}`

    // 核心配置
    const configLines = [
      '###############################################',
      '# General',
      'logLevel: debug',
      'logDestinations: [stdout]',
      '',
      '###############################################',
      '# RTSP',
      'rtsp: yes',
      `rtspAddress: ${rtspAddress}`,
      'rtspTransports: [udp,tcp]',
      'rtspEncryption: "no"',
      '',
      '###############################################',
      '# RTMP',
      'rtmp: no',
      '',
      '###############################################',
      '# HLS',
      'hls: no',
      '',
      '###############################################',
      '# WebRTC',
      'webrtc: yes',
      `webrtcAddress: ${webrtcAddress}`,
      'webrtcEncryption: no',
      'webrtcLocalUDPAddress: :0',
      // 允许所有 IP 访问 WebRTC (如果需要局域网访问)
      'webrtcAllowOrigin: "*"',
      'webrtcTrustedProxies: []',
      '',
      '###############################################',
      '# SRT',
      'srt: no',
      '',
      '###############################################',
      '# Paths',
      'paths:',
      `  ${params.pathName}:`,
      '    publishUser:',
      '    publishPass:',
      '    readUser:',
      '    readPass:'
    ]

    fs.writeFileSync(this.configPath, configLines.join('\n'))
  }

  private findAvailablePort(startPort: number, attempt = 0): Promise<number> {
    if (attempt > 100) {
      return Promise.reject(
        new Error(`Could not find available port after 100 attempts starting from ${startPort}`)
      )
    }
    return new Promise((resolve, reject) => {
      const server = net.createServer()
      server.listen(startPort, () => {
        const { port } = server.address() as net.AddressInfo
        server.close(() => resolve(port))
      })
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(this.findAvailablePort(startPort + 1, attempt + 1))
        } else {
          reject(err)
        }
      })
    })
  }

  private async waitForPort(port: number, timeoutMs = 5000, intervalMs = 100): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      if (!this.running || this.child?.exitCode !== null) {
        throw new Error(this.lastError || `MediaMTX exited prematurely`)
      }

      if (await this.checkPortOpen(port)) {
        return
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }

    throw new Error(`MediaMTX failed to start: Port ${port} is not listening after ${timeoutMs}ms`)
  }

  private checkPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      const onError = () => {
        socket.destroy()
        resolve(false)
      }
      socket.setTimeout(100)
      socket.on('error', onError)
      socket.on('timeout', onError)

      socket.connect(port, '127.0.0.1', () => {
        socket.end()
        resolve(true)
      })
    })
  }

  private getLanIp(): string | null {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address
        }
      }
    }
    return null
  }
}
