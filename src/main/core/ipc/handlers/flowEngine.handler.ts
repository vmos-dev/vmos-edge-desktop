import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { Client } from 'ssh2'
import type { SFTPWrapper } from 'ssh2'
import { handle, sendToMain } from '../IpcBus'
import {
  FLOW_ENGINE_EVENTS,
  type CheckUpdatePayload,
  type CheckUpdateResult,
  type DeployPayload,
  type DeployResult,
  type DeployStep
} from '@shared/ipc/flowEngine.types'
import {
  BUNDLED_FLOW_ENGINE_VERSION,
  BUNDLED_FLOW_ENGINE_VERSION_CODE,
  FLOW_ENGINE_PORT
} from '@shared/constant/flowEngine'
import { decideFlowEngineInstallStrategy } from '@shared/utils/flowEngineVersion'
import { logger } from '../../logger'

const SSH_PORT = 22
const SSH_USER = 'root'
const REMOTE_DIR = '/tmp/flow-engine-deploy'
const CONNECT_TIMEOUT_MS = 10_000
const HEALTH_TIMEOUT_MS = 5_000

interface HealthEnvelope {
  data?: {
    version?: string
    versionCode?: number
  }
}

function progress(step: DeployStep, detail?: string): void {
  logger.info(`[FlowEngine] deploy step=${step}${detail ? ` (${detail})` : ''}`)
  sendToMain(FLOW_ENGINE_EVENTS.DEPLOY_PROGRESS, { step, detail })
}

function getResourceDir(): string {
  const inAsar = app.getAppPath().includes('app.asar')
  if (inAsar) {
    return path.join(process.resourcesPath, 'flow-engine')
  }
  return path.join(app.getAppPath(), 'resources', 'flow-engine')
}

function sftpPut(sftp: SFTPWrapper, local: string, remote: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()))
  })
}

function safeEnd(conn: Client): void {
  try {
    conn.end()
  } catch {
    try {
      conn.destroy()
    } catch {
      // 已尽力释放
    }
  }
}

function sshExec(conn: Client, command: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err)
      let stdout = ''
      let stderr = ''
      let settled = false
      const settle = (fn: () => void): void => {
        if (settled) return
        settled = true
        fn()
      }
      stream.on('error', (e: Error) => settle(() => reject(e)))
      stream.stderr.on('error', (e: Error) => settle(() => reject(e)))
      stream.on('data', (d: Buffer) => {
        stdout += d.toString()
      })
      stream.stderr.on('data', (d: Buffer) => {
        stderr += d.toString()
      })
      stream.on('close', (code: number) => {
        settle(() => {
          if (code !== 0) {
            // stderr 优先；很多脚本(如 install.sh)把失败原因 echo 到 stdout,
            // 若 stderr 为空也带上 stdout,避免退化成无信息的 "exit code N"。
            reject(new Error(stderr.trim() || stdout.trim() || `exit code ${code}`))
          } else {
            resolve({ code, stdout: stdout.trim() })
          }
        })
      })
    })
  })
}

async function checkUpdate(payload: CheckUpdatePayload): Promise<CheckUpdateResult> {
  const bundled = {
    version: BUNDLED_FLOW_ENGINE_VERSION,
    versionCode: BUNDLED_FLOW_ENGINE_VERSION_CODE
  }
  if (!payload.hostIp) {
    return {
      strategy: 'unreachable',
      bundled,
      error: 'Missing host IP'
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  try {
    const res = await fetch(`http://${payload.hostIp}:${FLOW_ENGINE_PORT}/health`, {
      signal: controller.signal
    })
    if (!res.ok) {
      return { strategy: 'install', bundled, error: `health returned HTTP ${res.status}` }
    }

    const body = (await res.json().catch(() => null)) as HealthEnvelope | null
    const current = {
      version: body?.data?.version,
      versionCode: typeof body?.data?.versionCode === 'number' ? body.data.versionCode : undefined
    }
    return {
      strategy: decideFlowEngineInstallStrategy({
        reachable: true,
        remoteVersionCode: current.versionCode,
        bundledVersionCode: bundled.versionCode
      }),
      current,
      bundled
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { strategy: 'install', bundled, error: message }
  } finally {
    clearTimeout(timer)
  }
}

async function deploy(payload: DeployPayload): Promise<DeployResult> {
  const { hostIp, password } = payload
  const resourceDir = getResourceDir()
  logger.info(`[FlowEngine] deploy start: host=${hostIp}`)

  const binaryPath = path.join(resourceDir, 'yaml-flow-engine-linux-arm64')
  const servicePath = path.join(resourceDir, 'yaml-flow-engine.service')
  const journaldPath = path.join(resourceDir, 'yaml-flow-engine-journald.conf')
  const installPath = path.join(resourceDir, 'install.sh')

  for (const f of [binaryPath, servicePath, installPath]) {
    if (!fs.existsSync(f)) {
      logger.error(`[FlowEngine] deploy aborted: missing bundled resource ${path.basename(f)}`)
      return { success: false, error: `资源文件缺失: ${path.basename(f)}` }
    }
  }

  const conn = new Client()

  // 持久 error handler — 防止连接建立后任何阶段的 error 事件变成 uncaught EventEmitter error 崩溃主进程
  let connError: Error | null = null
  conn.on('error', (err: Error) => {
    connError = err
    logger.error('[FlowEngine] SSH connection error:', { error: err.message })
  })

  try {
    // 1. 连接
    progress('connecting', hostIp)
    await new Promise<void>((resolve, reject) => {
      conn.once('ready', resolve)
      conn.once('error', reject)
      conn.connect({
        host: hostIp,
        port: SSH_PORT,
        username: SSH_USER,
        password,
        readyTimeout: CONNECT_TIMEOUT_MS
      })
    })

    // 2. 上传
    progress('uploading')
    await sshExec(conn, `mkdir -p ${REMOTE_DIR}`)

    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      conn.sftp((err, s) => (err ? reject(err) : resolve(s)))
    })
    sftp.on('error', (err: Error) => {
      logger.error('[FlowEngine] SFTP error:', { error: err.message })
    })

    await sftpPut(sftp, binaryPath, `${REMOTE_DIR}/yaml-flow-engine`)
    await sftpPut(sftp, servicePath, `${REMOTE_DIR}/yaml-flow-engine.service`)
    if (fs.existsSync(journaldPath)) {
      await sftpPut(sftp, journaldPath, `${REMOTE_DIR}/yaml-flow-engine-journald.conf`)
    }
    await sftpPut(sftp, installPath, `${REMOTE_DIR}/install.sh`)

    // 3. 安装
    progress('installing')
    await sshExec(conn, `chmod +x ${REMOTE_DIR}/install.sh && bash ${REMOTE_DIR}/install.sh`)

    // 4. 验证
    progress('verifying')
    const { stdout } = await sshExec(conn, `curl -sf http://127.0.0.1:47218/health | head -c 500`)

    let version: string | undefined
    let versionCode: number | undefined
    try {
      const body = JSON.parse(stdout)
      version = body?.data?.version
      versionCode = typeof body?.data?.versionCode === 'number' ? body.data.versionCode : undefined
    } catch {
      // health 返回了但解析失败,仍算成功
    }

    await sshExec(conn, `rm -rf ${REMOTE_DIR}`)
    safeEnd(conn)

    logger.info(`[FlowEngine] deploy success: host=${hostIp}, version=${version ?? 'unknown'}`)
    return { success: true, version, versionCode }
  } catch (e) {
    safeEnd(conn)
    const raw = connError ?? e
    const msg = raw instanceof Error ? raw.message : String(raw)
    logger.error('[FlowEngine] deploy failed:', { error: msg })
    return { success: false, error: msg }
  }
}

export function registerFlowEngineHandlers(): void {
  handle<CheckUpdatePayload, CheckUpdateResult>(
    FLOW_ENGINE_EVENTS.CHECK_UPDATE,
    async (payload) => {
      try {
        const result = await checkUpdate(payload)
        return { success: true, data: result }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        return { success: false, error: msg }
      }
    }
  )

  handle<DeployPayload, DeployResult>(FLOW_ENGINE_EVENTS.DEPLOY, async (payload) => {
    try {
      const result = await deploy(payload)
      return { success: true, data: result }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })
}
