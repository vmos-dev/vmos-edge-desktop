import fs from 'fs'
import { Client } from 'ssh2'
import { logger } from '../../../logger'

interface SshConfig {
  host: string
  port: number
  username: string
  password: string
}

export class SshSession {
  private conn: Client | null = null
  private config: SshConfig | null = null
  private connected = false
  private connectPromise: Promise<void> | null = null
  private disposed = false
  private onStatusChange?: (connected: boolean) => void

  private shouldAutoReconnect = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0

  setStatusCallback(cb: (connected: boolean) => void): void {
    this.onStatusChange = cb
  }

  async connect(config: SshConfig): Promise<void> {
    if (this.disposed) throw new Error('SshSession disposed')
    this.config = config
    await this.doConnect()
  }

  private doConnect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise
    this.connectPromise = this.doConnectInternal().finally(() => {
      this.connectPromise = null
    })
    return this.connectPromise
  }

  private doConnectInternal(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config) return reject(new Error('no config'))

      this.cleanupConnection()
      const conn = new Client()
      let settled = false

      const settle = <T>(fn: () => T): T | undefined => {
        if (settled) return undefined
        settled = true
        clearTimeout(timeout)
        return fn()
      }

      const timeout = setTimeout(() => {
        settle(() => {
          try {
            conn.end()
          } catch {
            // ignore
          }
          reject(new Error('SSH connection timeout'))
        })
      }, 15_000)

      conn.on('ready', () => {
        settle(() => {
          if (this.disposed) {
            try {
              conn.end()
            } catch {
              // ignore
            }
            reject(new Error('SshSession disposed'))
            return
          }
          this.conn = conn
          this.connected = true
          this.shouldAutoReconnect = true
          this.reconnectAttempts = 0
          logger.info(`[SshSession] connected: ${this.config!.host}:${this.config!.port}`)
          this.onStatusChange?.(true)
          resolve()
        })
      })

      conn.on('error', (err) => {
        settle(() => {
          this.connected = false
          this.conn = null
          reject(new Error(`SSH connection failed: ${err.message}`))
        })
      })

      conn.on('close', () => {
        if (this.conn !== conn) return
        this.connected = false
        this.conn = null
        logger.info('[SshSession] connection closed')
        this.onStatusChange?.(false)

        if (this.shouldAutoReconnect && !this.disposed) {
          this.scheduleReconnect()
        }
      })

      conn.connect({
        ...this.config,
        keepaliveInterval: 30_000,
        keepaliveCountMax: 3
      })
    })
  }

  private async withConnection<T>(fn: (conn: Client) => Promise<T>): Promise<T> {
    if (this.disposed) throw new Error('SshSession disposed')
    if (!this.connected || !this.conn) {
      if (!this.config) throw new Error('SshSession not configured')
      await this.doConnect()
    }
    try {
      return await fn(this.conn!)
    } catch (err) {
      logger.warn('[SshSession] operation failed, reconnecting:', err)
      await this.doConnect()
      return fn(this.conn!)
    }
  }

  async exec(cmd: string): Promise<string> {
    return this.withConnection((conn) => this.execOnConn(conn, cmd))
  }

  // 以 root 身份执行远端命令（自动 sudo 包装）。整条命令一次提权，比逐条 sudo 高效。
  // 用于 ss -K / iptables 等需要 CAP_NET_ADMIN 的操作，调用方无需感知 sudo 细节。
  async execAsRoot(cmd: string): Promise<string> {
    return this.exec(`sudo sh -c ${this.shellQuote(cmd)}`)
  }

  private shellQuote(s: string): string {
    // 安全的 shell 单引号包裹：把内部单引号转义为 '\''
    return `'${s.replace(/'/g, `'\\''`)}'`
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    return this.withConnection((conn) => this.sftpUpload(conn, localPath, remotePath))
  }

  async writeFile(remotePath: string, content: string): Promise<void> {
    return this.withConnection((conn) => this.sftpWrite(conn, remotePath, content))
  }

  // 仅识别明确的 sudo 鉴权错误，避免把业务命令（如 systemctl start 失败）误判为权限问题
  private isSudoAuthError(output: string): boolean {
    return (
      /\bsudo:\s+(a password is required|incorrect password|no tty present|3 incorrect password attempts)/i.test(
        output
      ) ||
      /is not in the sudoers file/i.test(output) ||
      /is not allowed to execute/i.test(output)
    )
  }

  private execOnConn(conn: Client, cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      conn.exec(cmd, (err, stream) => {
        if (err) return reject(err)
        let stdout = ''
        let stderr = ''
        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })
        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
        stream.on('close', (code: number) => {
          if (code !== 0) {
            const output = stderr || stdout
            logger.warn(`[SshSession] command failed: ${cmd}, code=${code}, stderr=${stderr}`)
            if (cmd.startsWith('sudo') && this.isSudoAuthError(output)) {
              reject(
                new Error(
                  `sudo permission denied — SSH user must be root or have passwordless sudo. Original: ${output}`
                )
              )
            } else {
              reject(new Error(`Command failed (exit ${code}): ${output}`))
            }
          } else {
            resolve(stdout.trim())
          }
        })
      })
    })
  }

  private sftpUpload(conn: Client, localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      const done = (err?: Error) => {
        if (settled) return
        settled = true
        err ? reject(err) : resolve()
      }

      conn.sftp((err, sftp) => {
        if (err) return done(new Error(`SFTP session failed: ${err.message}`))
        const readStream = fs.createReadStream(localPath)
        const writeStream = sftp.createWriteStream(remotePath)
        writeStream.on('close', () => {
          sftp.end()
          done()
        })
        writeStream.on('error', (writeErr: Error) => {
          sftp.end()
          done(new Error(`SFTP upload failed: ${writeErr.message}`))
        })
        readStream.on('error', (readErr: Error) => {
          sftp.end()
          done(new Error(`Read local file failed: ${readErr.message}`))
        })
        readStream.pipe(writeStream)
      })
    })
  }

  private sftpWrite(conn: Client, remotePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(new Error(`SFTP session failed: ${err.message}`))
        sftp.writeFile(remotePath, content, (writeErr) => {
          sftp.end()
          if (writeErr) return reject(new Error(`SFTP write failed: ${writeErr.message}`))
          resolve()
        })
      })
    })
  }

  reconnectNow(): void {
    if (this.disposed || !this.config) return
    this.clearReconnectTimer()
    this.reconnectAttempts = 0
    this.cleanupConnection()
    this.shouldAutoReconnect = true
    this.doConnect()
      .then(() => logger.info('[SshSession] reconnectNow succeeded'))
      .catch((err) => {
        logger.warn('[SshSession] reconnectNow failed:', err)
        if (this.shouldAutoReconnect && !this.disposed) {
          this.scheduleReconnect()
        }
      })
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.disposed) return
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 30_000)
    this.reconnectAttempts++
    logger.info(
      `[SshSession] scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
    )

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.disposed || !this.shouldAutoReconnect || !this.config) return
      this.doConnect()
        .then(() => logger.info('[SshSession] auto-reconnect succeeded'))
        .catch((err) => {
          logger.warn('[SshSession] auto-reconnect failed:', err)
          if (this.shouldAutoReconnect && !this.disposed) {
            this.scheduleReconnect()
          }
        })
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private cleanupConnection(): void {
    const conn = this.conn
    this.conn = null
    this.connected = false
    try {
      conn?.end()
    } catch (err) {
      logger.warn('[SshSession] cleanup error:', err)
    }
  }

  async killPortRange(start: number, end: number): Promise<void> {
    // ss -K 需 CAP_NET_ADMIN，整条 execAsRoot 一次提权
    const cmd = `ss -K sport \\>= ${start} and sport \\<= ${end} 2>/dev/null; true`
    try {
      await this.execAsRoot(cmd)
      logger.info(`[SshSession] killPortRange done: ${start}-${end}`)
    } catch (err) {
      logger.warn('[SshSession] killPortRange failed:', err)
    }
  }

  async killPorts(ports: number[]): Promise<number[]> {
    if (ports.length === 0) return []
    const ssKill = ports.map((p) => `ss -K sport = ${p}`).join('; ')
    const iptAdd = ports
      .map((p) => `iptables -w -I INPUT -p tcp --dport ${p} -j REJECT --reject-with tcp-reset`)
      .join('; ')
    const iptDel = ports
      .map((p) => `iptables -w -D INPUT -p tcp --dport ${p} -j REJECT --reject-with tcp-reset`)
      .join('; ')
    const check = ports
      .map((p) => `ss -tn sport = ${p} 2>/dev/null | grep -q ESTAB && echo ${p}`)
      .join('; ')
    const cmd = `{ ${ssKill}; } 2>/dev/null; { ${iptAdd}; sleep 2; ${iptDel}; } 2>/dev/null; ${check}; true`
    try {
      // 整条以 root 身份执行：一次提权 + 调用方无需关心 sudo 细节
      const output = await this.execAsRoot(cmd)
      const remaining = output
        .split('\n')
        .map(Number)
        .filter((p) => p > 0)
      if (remaining.length > 0) {
        logger.warn(`[SshSession] killPorts: connections persist on ports: ${remaining.join(',')}`)
      } else {
        logger.info(`[SshSession] killPorts done: ${ports.join(',')}`)
      }
      return remaining
    } catch (err) {
      logger.warn('[SshSession] killPorts failed:', err)
      return ports
    }
  }

  dispose(): void {
    this.disposed = true
    this.shouldAutoReconnect = false
    this.clearReconnectTimer()
    this.config = null
    this.cleanupConnection()
  }

  disconnect(): void {
    this.shouldAutoReconnect = false
    this.clearReconnectTimer()
    this.cleanupConnection()
  }

  isConnected(): boolean {
    return this.connected && !this.disposed
  }
}
