import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { logger } from '../../../logger'
import { SshSession } from './SshSession'
import { NGINX_CONF_TEMPLATE, NGINX_MIME_TYPES } from './nginxTemplates'
import type { FrpConfig, DeployProgress } from '@shared/ipc/frp.types'

type ProgressCallback = (progress: DeployProgress) => void

const DEPLOY_STEPS = [
  'frp.deploy.connecting',
  'frp.deploy.detectArch',
  'frp.deploy.uploading',
  'frp.deploy.writingConfig',
  'frp.deploy.setupService',
  'frp.deploy.openFirewall'
] as const

const TOTAL_STEPS = DEPLOY_STEPS.length

export class FrpInstaller {
  private emit(
    cb: ProgressCallback | undefined,
    step: number,
    status: DeployProgress['status'],
    error?: string
  ): void {
    cb?.({
      step,
      totalSteps: TOTAL_STEPS,
      label: DEPLOY_STEPS[step - 1] || '',
      status,
      error
    })
  }

  async deploy(
    session: SshSession,
    config: FrpConfig,
    onProgress?: ProgressCallback,
    resumeFrom?: string
  ): Promise<string> {
    const startStep = resumeFrom ? DEPLOY_STEPS.indexOf(resumeFrom as any) + 1 : 1
    let currentStep = Math.max(startStep, 1)

    try {
      if (startStep <= 1) {
        currentStep = 1
        this.emit(onProgress, 1, 'running')
        this.emit(onProgress, 1, 'done')
      }

      let arch = 'amd64'
      if (startStep <= 2) {
        currentStep = 2
        this.emit(onProgress, 2, 'running')
        arch = await this.detectArch(session)
        this.emit(onProgress, 2, 'done')
      }

      const frpsVersion = '0.68.1'
      if (startStep <= 3) {
        currentStep = 3
        this.emit(onProgress, 3, 'running')
        await this.uploadFrps(session, arch)
        this.emit(onProgress, 3, 'done')
      }

      if (startStep <= 4) {
        currentStep = 4
        this.emit(onProgress, 4, 'running')
        await this.writeConfig(session, config)
        this.emit(onProgress, 4, 'done')
      }

      if (startStep <= 5) {
        currentStep = 5
        this.emit(onProgress, 5, 'running')
        await this.setupSystemd(session)
        this.emit(onProgress, 5, 'done')
      }

      if (startStep <= 6) {
        currentStep = 6
        this.emit(onProgress, 6, 'running')
        await this.openFirewall(session, config)
        this.emit(onProgress, 6, 'done')
      }

      logger.info(`[FrpInstaller] deploy completed: frps v${frpsVersion}`)
      return frpsVersion
    } catch (error: any) {
      this.emit(onProgress, currentStep, 'error', error?.message || String(error))
      throw error
    }
  }

  async reconfigure(session: SshSession, config: FrpConfig): Promise<void> {
    await this.writeConfig(session, config)
    await this.restartServiceClean(session, 'frps', '/usr/local/frps/frps')
    await this.openFirewall(session, config)
    logger.info('[FrpInstaller] reconfigure done')
  }

  async uninstall(session: SshSession, config: FrpConfig): Promise<void> {
    await session.exec('sudo systemctl stop frps 2>/dev/null || true')
    await session.exec('sudo systemctl disable frps 2>/dev/null || true')
    await session.exec('sudo rm -f /etc/systemd/system/frps.service')
    await session.exec('sudo systemctl daemon-reload')
    await session.exec('sudo rm -rf /usr/local/frps')
    await this.closeFirewall(session, config)
  }

  // 幂等重启：先停（释放端口、清理 failed 状态）→ 清理同路径孤儿进程 → daemon-reload → start
  // 启动失败时自动抓取 journalctl 日志附带回去，避免用户必须 SSH 到服务器排查
  // 所有 deploy / reconfigure 都走这个出口，保证服务以最新配置干净启动
  private async restartServiceClean(
    session: SshSession,
    serviceName: string,
    binaryPath?: string
  ): Promise<void> {
    await session.exec(`sudo systemctl stop ${serviceName} 2>/dev/null || true`)
    if (binaryPath) {
      await session.exec(`sudo pkill -f '^${binaryPath}' 2>/dev/null || true`)
    }
    await session.exec('sudo systemctl daemon-reload')
    try {
      await session.exec(`sudo systemctl start ${serviceName}`)
    } catch (err) {
      const journal = await session
        .exec(`sudo journalctl -xeu ${serviceName} --no-pager -n 30 2>/dev/null || true`)
        .catch(() => '')
      const cause = err instanceof Error ? err.message : String(err)
      throw new Error(`${serviceName} failed to start\n\n${journal || cause}`)
    }
    logger.info(`[FrpInstaller] service started cleanly: ${serviceName}`)
  }

  private async detectArch(session: SshSession): Promise<string> {
    const uname = await session.exec('uname -m')
    const archMap: Record<string, string> = {
      x86_64: 'amd64',
      aarch64: 'arm64',
      arm64: 'arm64',
      armv7l: 'arm'
    }
    const arch = archMap[uname] || 'amd64'
    logger.info(`[FrpInstaller] detected arch: ${uname} → ${arch}`)
    return arch
  }

  private getFrpsBinaryPath(arch: string): string {
    const folder = `linux-${arch}`
    const resourcesBase = is.dev
      ? path.join(app.getAppPath(), 'resources')
      : path.join(process.resourcesPath)
    return path.join(resourcesBase, 'frps', folder, 'frps')
  }

  private async uploadFrps(session: SshSession, arch: string): Promise<void> {
    const localBinary = this.getFrpsBinaryPath(arch)
    if (!fs.existsSync(localBinary)) {
      throw new Error(`frps binary not found for linux-${arch}: ${localBinary}`)
    }
    const tmpPath = `/tmp/frps-${Date.now()}`
    await session.uploadFile(localBinary, tmpPath)
    await session.exec('sudo mkdir -p /usr/local/frps')
    await session.exec(`sudo mv ${tmpPath} /usr/local/frps/frps`)
    await session.exec('sudo chmod +x /usr/local/frps/frps')
    logger.info(`[FrpInstaller] uploaded frps binary (${arch}) to remote server`)
  }

  private async writeConfig(session: SshSession, config: FrpConfig): Promise<void> {
    const bindAddr = config.proxy_bind_local ? '127.0.0.1' : '0.0.0.0'
    const lines = [
      `bindPort = ${config.frps_port}`,
      `proxyBindAddr = "${bindAddr}"`,
      '',
      '[auth]',
      `token = "${config.frps_token}"`,
      '',
      '[webServer]',
      `addr = "0.0.0.0"`,
      `port = ${config.frps_dashboard_port || 7500}`,
      `user = "${config.frps_dashboard_user || 'admin'}"`,
      `password = "${config.frps_dashboard_password || config.frps_token}"`,
      '',
      '[[allowPorts]]',
      `start = ${config.port_range_start}`,
      `end = ${config.port_range_end}`
    ]
    const toml = lines.join('\n')

    const tmpPath = `/tmp/frps-${Date.now()}.toml`
    await session.writeFile(tmpPath, toml)
    await session.exec(`sudo mv ${tmpPath} /usr/local/frps/frps.toml`)
    logger.info(`[FrpInstaller] config written: bindPort=${config.frps_port}`)
  }

  private async setupSystemd(session: SshSession): Promise<void> {
    const service = [
      '[Unit]',
      'Description=frps server',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      'ExecStart=/usr/local/frps/frps -c /usr/local/frps/frps.toml',
      'Restart=on-failure',
      'RestartSec=5s',
      '',
      '[Install]',
      'WantedBy=multi-user.target'
    ].join('\n')

    const tmpPath = `/tmp/frps-${Date.now()}.service`
    await session.writeFile(tmpPath, service)
    await session.exec(`sudo mv ${tmpPath} /etc/systemd/system/frps.service`)
    await session.exec('sudo systemctl enable frps')
    await this.restartServiceClean(session, 'frps', '/usr/local/frps/frps')
    logger.info('[FrpInstaller] systemd service configured and started')
  }

  // ── 公网投屏部署 ──

  private static readonly SCREEN_DEPLOY_STEPS = [
    'frp.screen.deploying',
    'frp.screen.uploadNginx',
    'frp.screen.writeConfig',
    'frp.screen.uploadPage',
    'frp.screen.setupService'
  ] as const

  private static readonly SCREEN_UPDATE_STEPS = [
    'frp.deploy.connecting',
    'frp.screen.writeConfig',
    'frp.screen.uploadPage',
    'frp.screen.reloadService'
  ] as const

  private static readonly SCREEN_UNINSTALL_STEPS = [
    'frp.deploy.connecting',
    'frp.screen.stopService',
    'frp.screen.cleanup'
  ] as const

  private emitProgress(
    steps: readonly string[],
    cb: ProgressCallback | undefined,
    step: number,
    status: DeployProgress['status'],
    error?: string
  ): void {
    cb?.({
      step,
      totalSteps: steps.length,
      label: steps[step - 1] || '',
      status,
      error
    })
  }

  private getNginxBinaryPath(arch: string): string {
    const folder = `linux-${arch}`
    const resourcesBase = is.dev
      ? path.join(app.getAppPath(), 'resources')
      : path.join(process.resourcesPath)
    return path.join(resourcesBase, 'nginx', folder, 'nginx')
  }

  private getNginxResourcePath(relativePath: string): string {
    const resourcesBase = is.dev
      ? path.join(app.getAppPath(), 'resources')
      : path.join(process.resourcesPath)
    return path.join(resourcesBase, 'nginx', relativePath)
  }

  private async writeNginxConfig(
    session: SshSession,
    screenPort: number,
    sslCertPath?: string,
    sslKeyPath?: string
  ): Promise<void> {
    const useSSL = !!(sslCertPath && sslKeyPath)

    if (useSSL) {
      await session.exec('sudo mkdir -p /usr/local/vmos-screen/ssl')
      const tmpCert = `/tmp/ssl-cert-${Date.now()}`
      const tmpKey = `/tmp/ssl-key-${Date.now()}`
      await session.uploadFile(sslCertPath, tmpCert)
      await session.uploadFile(sslKeyPath, tmpKey)
      await session.exec(`sudo mv ${tmpCert} /usr/local/vmos-screen/ssl/cert.pem`)
      await session.exec(`sudo mv ${tmpKey} /usr/local/vmos-screen/ssl/key.pem`)
      await session.exec('sudo chmod 600 /usr/local/vmos-screen/ssl/key.pem')
    } else {
      await session.exec('sudo rm -rf /usr/local/vmos-screen/ssl')
    }

    const sslListen = useSSL ? ' ssl' : ''
    const sslConfig = useSSL
      ? [
          '        ssl_certificate /usr/local/vmos-screen/ssl/cert.pem;',
          '        ssl_certificate_key /usr/local/vmos-screen/ssl/key.pem;',
          '        ssl_protocols TLSv1.2 TLSv1.3;',
          '        ssl_ciphers HIGH:!aNULL:!MD5;',
          ''
        ].join('\n')
      : ''
    // 只 bind 用户配置的端口，不额外占用 80 做 HTTP→HTTPS 跳转
    const nginxConf = NGINX_CONF_TEMPLATE.replace(/\{\{PORT\}\}/g, String(screenPort))
      .replace(/\{\{SSL_LISTEN\}\}/g, sslListen)
      .replace(/\{\{SSL_CONFIG\}\}\n?/g, sslConfig)
      .replace(/\{\{HTTP_REDIRECT\}\}\n?/g, '')
    await session.exec('sudo mkdir -p /usr/local/vmos-screen/logs')
    const tmpConf = `/tmp/nginx-conf-${Date.now()}`
    await session.writeFile(tmpConf, nginxConf)
    await session.exec(`sudo mv ${tmpConf} /usr/local/vmos-screen/nginx.conf`)
  }

  private async uploadScreenPages(session: SshSession): Promise<void> {
    await session.exec('sudo rm -rf /usr/local/vmos-screen/html')
    await session.exec('sudo mkdir -p /usr/local/vmos-screen/html')
    const htmlDir = this.getNginxResourcePath('html')
    const uploadDir = async (localDir: string, remoteDir: string): Promise<void> => {
      const entries = fs.readdirSync(localDir, { withFileTypes: true })
      for (const entry of entries) {
        const localPath = path.join(localDir, entry.name)
        const remotePath = `${remoteDir}/${entry.name}`
        if (entry.isDirectory()) {
          await session.exec(`sudo mkdir -p ${remotePath}`)
          await uploadDir(localPath, remotePath)
        } else {
          const tmp = `/tmp/html-${entry.name}-${Date.now()}`
          await session.uploadFile(localPath, tmp)
          await session.exec(`sudo mv ${tmp} ${remotePath}`)
        }
      }
    }
    await uploadDir(htmlDir, '/usr/local/vmos-screen/html')
  }

  private async updateScreenFirewall(
    session: SshSession,
    newPort: number,
    oldPort: number
  ): Promise<void> {
    if (oldPort && oldPort !== newPort) await this.fwRemovePort(session, oldPort)
    await this.fwAllowPort(session, newPort)
    await this.fwSave(session)
  }

  private async configureSELinux(session: SshSession, screenPort: number): Promise<void> {
    try {
      await session.exec('sudo setsebool -P httpd_can_network_connect 1 2>/dev/null || true')
    } catch {
      // ignore — SELinux may not be present
    }
    if (screenPort === 80 || screenPort === 443 || screenPort === 8080 || screenPort === 8443) {
      return
    }
    try {
      await session.exec(
        `sudo semanage port -a -t http_port_t -p tcp ${screenPort} 2>/dev/null || sudo semanage port -m -t http_port_t -p tcp ${screenPort} 2>/dev/null || true`
      )
    } catch {
      // ignore — semanage may not be installed
    }
  }

  async deployScreen(
    session: SshSession,
    config: FrpConfig,
    screenPort: number,
    sslCertPath?: string,
    sslKeyPath?: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const steps = FrpInstaller.SCREEN_DEPLOY_STEPS
    const emit = (step: number, status: DeployProgress['status'], error?: string) =>
      this.emitProgress(steps, onProgress, step, status, error)
    const useSSL = !!(sslCertPath && sslKeyPath)
    if (useSSL) {
      if (!fs.existsSync(sslCertPath)) throw new Error(`SSL cert not found: ${sslCertPath}`)
      if (!fs.existsSync(sslKeyPath)) throw new Error(`SSL key not found: ${sslKeyPath}`)
    }

    let currentStep = 1

    try {
      currentStep = 1
      emit(1, 'running')
      emit(1, 'done')

      currentStep = 2
      emit(2, 'running')
      const arch = await this.detectArch(session)
      const nginxBinary = this.getNginxBinaryPath(arch)
      if (!fs.existsSync(nginxBinary)) {
        throw new Error(`Nginx binary not found for linux-${arch}: ${nginxBinary}`)
      }
      const tmpNginx = `/tmp/nginx-${Date.now()}`
      await session.uploadFile(nginxBinary, tmpNginx)
      await session.exec('sudo mkdir -p /usr/local/vmos-screen/sbin')
      await session.exec(`sudo mv ${tmpNginx} /usr/local/vmos-screen/sbin/nginx`)
      await session.exec('sudo chmod +x /usr/local/vmos-screen/sbin/nginx')
      emit(2, 'done')

      currentStep = 3
      emit(3, 'running')
      await this.writeNginxConfig(session, screenPort, sslCertPath, sslKeyPath)
      emit(3, 'done')

      currentStep = 4
      emit(4, 'running')
      const tmpMime = `/tmp/mime-types-${Date.now()}`
      await session.writeFile(tmpMime, NGINX_MIME_TYPES)
      await session.exec(`sudo mv ${tmpMime} /usr/local/vmos-screen/mime.types`)
      await this.uploadScreenPages(session)
      emit(4, 'done')

      currentStep = 5
      emit(5, 'running')
      const service = [
        '[Unit]',
        'Description=VMOS Screen (Nginx)',
        'After=network.target',
        '',
        '[Service]',
        'Type=forking',
        'PIDFile=/usr/local/vmos-screen/nginx.pid',
        'ExecStart=/usr/local/vmos-screen/sbin/nginx -c /usr/local/vmos-screen/nginx.conf',
        'ExecReload=/usr/local/vmos-screen/sbin/nginx -s reload',
        'ExecStop=/usr/local/vmos-screen/sbin/nginx -s stop',
        'Restart=on-failure',
        'RestartSec=5s',
        '',
        '[Install]',
        'WantedBy=multi-user.target'
      ].join('\n')
      const tmpService = `/tmp/vmos-screen-${Date.now()}.service`
      await session.writeFile(tmpService, service)
      await session.exec(`sudo mv ${tmpService} /etc/systemd/system/vmos-screen.service`)
      await session.exec('sudo systemctl enable vmos-screen')
      await this.configureSELinux(session, screenPort)
      await this.restartServiceClean(
        session,
        'vmos-screen',
        '/usr/local/vmos-screen/sbin/nginx'
      )
      await this.updateScreenFirewall(session, screenPort, config.screen_port)
      emit(5, 'done')

      logger.info(`[FrpInstaller] screen deployed: port=${screenPort}`)
    } catch (error: any) {
      emit(currentStep, 'error', error?.message || String(error))
      throw error
    }
  }

  async updateScreenConfig(
    session: SshSession,
    config: FrpConfig,
    screenPort: number,
    sslCertPath?: string,
    sslKeyPath?: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const steps = FrpInstaller.SCREEN_UPDATE_STEPS
    const emit = (step: number, status: DeployProgress['status'], error?: string) =>
      this.emitProgress(steps, onProgress, step, status, error)
    const useSSL = !!(sslCertPath && sslKeyPath)
    if (useSSL) {
      if (!fs.existsSync(sslCertPath)) throw new Error(`SSL cert not found: ${sslCertPath}`)
      if (!fs.existsSync(sslKeyPath)) throw new Error(`SSL key not found: ${sslKeyPath}`)
    }

    let currentStep = 1

    try {
      currentStep = 1
      emit(1, 'running')
      emit(1, 'done')

      currentStep = 2
      emit(2, 'running')
      await this.writeNginxConfig(session, screenPort, sslCertPath, sslKeyPath)
      emit(2, 'done')

      currentStep = 3
      emit(3, 'running')
      await this.uploadScreenPages(session)
      emit(3, 'done')

      currentStep = 4
      emit(4, 'running')
      await this.configureSELinux(session, screenPort)
      await session.exec(
        '/usr/local/vmos-screen/sbin/nginx -c /usr/local/vmos-screen/nginx.conf -s reload'
      )
      await this.updateScreenFirewall(session, screenPort, config.screen_port)
      emit(4, 'done')

      logger.info(`[FrpInstaller] screen config updated: port=${screenPort}`)
    } catch (error: any) {
      emit(currentStep, 'error', error?.message || String(error))
      throw error
    }
  }

  async uninstallScreen(
    session: SshSession,
    config: FrpConfig,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const steps = FrpInstaller.SCREEN_UNINSTALL_STEPS
    const emit = (step: number, status: DeployProgress['status'], error?: string) =>
      this.emitProgress(steps, onProgress, step, status, error)
    let currentStep = 1
    try {
      emit(1, 'running')
      emit(1, 'done')

      currentStep = 2
      emit(2, 'running')
      await session.exec('sudo systemctl stop vmos-screen 2>/dev/null || true')
      await session.exec('sudo systemctl disable vmos-screen 2>/dev/null || true')
      await session.exec('sudo rm -f /etc/systemd/system/vmos-screen.service')
      await session.exec('sudo systemctl daemon-reload')
      emit(2, 'done')

      currentStep = 3
      emit(3, 'running')
      await session.exec('sudo rm -rf /usr/local/vmos-screen')
      if (config.screen_port) {
        await this.fwRemovePort(session, config.screen_port)
        await this.fwSave(session)
      }
      emit(3, 'done')

      logger.info('[FrpInstaller] screen uninstalled')
    } catch (error) {
      emit(currentStep, 'error', (error as Error)?.message || String(error))
      throw error
    }
  }

  private async openFirewall(session: SshSession, config: FrpConfig): Promise<void> {
    const dashboardPort = config.frps_dashboard_port || 7500
    await this.fwAllowPort(session, config.frps_port)
    await this.fwAllowPort(session, dashboardPort)
    await this.fwAllowRange(session, config.port_range_start, config.port_range_end)
    await this.fwSave(session)
  }

  private async closeFirewall(session: SshSession, config: FrpConfig): Promise<void> {
    const dashboardPort = config.frps_dashboard_port || 7500
    await this.fwRemovePort(session, config.frps_port)
    await this.fwRemovePort(session, dashboardPort)
    await this.fwSave(session)
  }

  // ── 防火墙统一方法：ufw + firewalld + iptables ──

  private async fwAllowPort(session: SshSession, port: number): Promise<void> {
    const cmd = [
      `sudo ufw allow ${port}/tcp 2>/dev/null || true`,
      `sudo firewall-cmd --permanent --add-port=${port}/tcp 2>/dev/null || true`,
      `sudo iptables -C INPUT -p tcp --dport ${port} -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport ${port} -j ACCEPT 2>/dev/null || true`
    ].join('; ')
    try {
      await session.exec(cmd)
    } catch {
      // ignore
    }
  }

  private async fwRemovePort(session: SshSession, port: number): Promise<void> {
    const cmd = [
      `sudo ufw delete allow ${port}/tcp 2>/dev/null || true`,
      `sudo firewall-cmd --permanent --remove-port=${port}/tcp 2>/dev/null || true`,
      `sudo iptables -D INPUT -p tcp --dport ${port} -j ACCEPT 2>/dev/null || true`
    ].join('; ')
    try {
      await session.exec(cmd)
    } catch {
      // ignore
    }
  }

  private async fwAllowRange(session: SshSession, start: number, end: number): Promise<void> {
    const cmd = [
      `sudo ufw allow ${start}:${end}/tcp 2>/dev/null || true`,
      `sudo firewall-cmd --permanent --add-port=${start}-${end}/tcp 2>/dev/null || true`,
      `sudo iptables -C INPUT -p tcp --dport ${start}:${end} -j ACCEPT 2>/dev/null || sudo iptables -I INPUT -p tcp --dport ${start}:${end} -j ACCEPT 2>/dev/null || true`
    ].join('; ')
    try {
      await session.exec(cmd)
    } catch {
      // ignore
    }
  }

  private async fwSave(session: SshSession): Promise<void> {
    const cmd = [
      'sudo firewall-cmd --reload 2>/dev/null || true',
      'sudo sh -c "iptables-save > /etc/sysconfig/iptables" 2>/dev/null || sudo netfilter-persistent save 2>/dev/null || true'
    ].join('; ')
    try {
      await session.exec(cmd)
    } catch {
      // ignore
    }
  }
}
