import { spawn, execSync, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { logger } from '../../../logger'

interface FrpcConfig {
  serverAddr: string
  serverPort: number
  authToken: string
  adminPort: number
  adminUser: string
  adminPassword: string
}

export class FrpcProcess {
  private process: ChildProcess | null = null
  private configPath: string = ''
  private config: FrpcConfig | null = null
  private restartAttempts = 0
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private stableTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  private onExit?: () => void
  private onRestart?: () => void

  setCallbacks(callbacks: { onExit?: () => void; onRestart?: () => void }): void {
    this.onExit = callbacks.onExit
    this.onRestart = callbacks.onRestart
  }

  private getFrpcBinaryPath(): string {
    const platform = process.platform
    const arch = process.arch
    let binaryName: string
    let folder: string

    if (platform === 'darwin') {
      folder = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
      binaryName = 'frpc'
    } else if (platform === 'win32') {
      folder = 'win-x64'
      binaryName = 'frpc.exe'
    } else {
      folder = 'linux-x64'
      binaryName = 'frpc'
    }

    const resourcesBase = is.dev
      ? path.join(app.getAppPath(), 'resources')
      : path.join(process.resourcesPath)

    return path.join(resourcesBase, 'frpc', folder, binaryName)
  }

  private ensureCodesign(binaryPath: string): void {
    try {
      execSync(`codesign -v "${binaryPath}" 2>&1`)
    } catch {
      logger.info(`[FrpcProcess] re-signing binary for dev: ${binaryPath}`)
      execSync(`codesign --force --sign - "${binaryPath}"`)
    }
  }

  private writeConfigFile(config: FrpcConfig): string {
    const configDir = path.join(app.getPath('userData'), 'frpc')
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const storePath = path.join(configDir, 'store.json').replace(/\\/g, '/')
    const toml = [
      `serverAddr = "${config.serverAddr}"`,
      `serverPort = ${config.serverPort}`,
      '',
      '[auth]',
      `token = "${config.authToken}"`,
      '',
      '[webServer]',
      'addr = "0.0.0.0"',
      `port = ${config.adminPort}`,
      `user = "${config.adminUser}"`,
      `password = "${config.adminPassword}"`,
      '',
      '[store]',
      `path = "${storePath}"`
    ].join('\n')

    const configPath = path.join(configDir, 'frpc.toml')
    fs.writeFileSync(configPath, toml, 'utf-8')
    return configPath
  }

  async start(config: FrpcConfig): Promise<void> {
    if (this.process) {
      logger.warn('[FrpcProcess] already running, stopping first')
      await this.stop()
    }

    this.config = config
    this.stopped = false
    this.restartAttempts = 0

    const binaryPath = this.getFrpcBinaryPath()
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`frpc binary not found: ${binaryPath}`)
    }

    this.configPath = this.writeConfigFile(config)
    if (is.dev && process.platform === 'darwin') {
      this.ensureCodesign(binaryPath)
    }
    this.spawnProcess()
  }

  private spawnProcess(): void {
    if (!this.config) return

    const binaryPath = this.getFrpcBinaryPath()
    logger.info(`[FrpcProcess] spawning: ${binaryPath} -c ${this.configPath}`)

    this.process = spawn(binaryPath, ['-c', this.configPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) logger.debug(`[frpc stdout] ${line}`)
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      const line = data.toString().trim()
      if (line) logger.warn(`[frpc stderr] ${line}`)
    })

    this.process.on('exit', (code, signal) => {
      logger.warn(`[FrpcProcess] exited: code=${code}, signal=${signal}`)
      this.process = null
      this.clearStableTimer()

      if (!this.stopped) {
        this.scheduleRestart()
      } else {
        try {
          this.onExit?.()
        } catch (err) {
          logger.error('[FrpcProcess] onExit callback error:', err)
        }
      }
    })

    this.process.on('error', (err) => {
      logger.error('[FrpcProcess] spawn error:', err)
      if (this.process) {
        this.process = null
        this.clearStableTimer()
      }
      if (!this.stopped) {
        this.scheduleRestart()
      }
    })

    this.stableTimer = setTimeout(() => {
      this.restartAttempts = 0
    }, 60_000)
  }

  private scheduleRestart(): void {
    const delay = Math.min(1000 * Math.pow(2, this.restartAttempts), 30_000)
    this.restartAttempts++
    logger.info(`[FrpcProcess] scheduling restart in ${delay}ms (attempt ${this.restartAttempts})`)

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (!this.stopped) {
        try {
          this.onRestart?.()
        } catch (err) {
          logger.error('[FrpcProcess] onRestart callback error:', err)
        }
        this.spawnProcess()
      }
    }, delay)
  }

  private clearStableTimer(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = null
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.clearStableTimer()

    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }

    if (!this.process) return

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          logger.warn('[FrpcProcess] force killing')
          this.process.kill('SIGKILL')
        }
        resolve()
      }, 5000)

      this.process!.once('exit', () => {
        clearTimeout(timeout)
        this.process = null
        resolve()
      })

      this.process!.kill('SIGTERM')
    })
  }

  stopSync(): void {
    this.stopped = true
    this.clearStableTimer()
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM')
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  cleanup(): void {
    if (this.configPath && fs.existsSync(this.configPath)) {
      try {
        fs.unlinkSync(this.configPath)
      } catch {
        // ignore
      }
    }
  }
}
