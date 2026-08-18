import os from 'os'
import { BaseManager } from './BaseManager'
import { logger } from '../../logger'
import { v4 as uuidv4 } from 'uuid'
import { FrpConfigDao } from '../../dao/FrpConfigDao'
import { FrpHostDao } from '../../dao/FrpHostDao'
import { FrpDeviceDao } from '../../dao/FrpDeviceDao'
import { FrpMappingDao } from '../../dao/FrpMappingDao'
import { HostDao } from '../../dao/HostDao'
import { DeviceDao } from '../../dao/DeviceDao'
import { FrpcProcess } from './frp/FrpcProcess'
import { FrpcAdminClient } from './frp/FrpcAdminClient'
import { FrpInstaller } from './frp/FrpInstaller'
import { FrpSyncService } from './frp/FrpSyncService'
import { SshSession } from './frp/SshSession'
import { PortKillQueue } from './frp/PortKillQueue'
import { FRP_EVENTS } from '@shared/ipc/frp.types'
import type {
  FrpConfig,
  FrpMapping,
  FrpStatusInfo,
  FrpMappingFilter,
  DeployProgress,
  FrpPortType,
  DevicePortType,
  BatchToggleResult,
  EnabledStates
} from '@shared/ipc/frp.types'
import type { Device } from '@shared/ipc/data.types'
import { MACVLAN_PORTS } from '@shared/constant'

const HOST_MANAGEMENT_PORT = 18182

export class FrpManager extends BaseManager {
  private configDao: FrpConfigDao
  private hostDao: FrpHostDao
  private deviceDao: FrpDeviceDao
  private mappingDao: FrpMappingDao
  private coreHostDao: HostDao
  private coreDeviceDao: DeviceDao
  private frpcProcess: FrpcProcess
  private adminClient: FrpcAdminClient
  private installer: FrpInstaller
  private syncService: FrpSyncService
  private sshSession: SshSession
  private portKillQueue: PortKillQueue

  constructor() {
    super()
    this.configDao = new FrpConfigDao(this.dbInstance)
    this.hostDao = new FrpHostDao(this.dbInstance)
    this.deviceDao = new FrpDeviceDao(this.dbInstance)
    this.mappingDao = new FrpMappingDao(this.dbInstance)
    this.coreHostDao = new HostDao(this.dbInstance)
    this.coreDeviceDao = new DeviceDao(this.dbInstance)
    this.frpcProcess = new FrpcProcess()
    this.adminClient = new FrpcAdminClient(7400, 'admin')
    this.installer = new FrpInstaller()
    this.sshSession = new SshSession()
    this.syncService = new FrpSyncService(
      this.hostDao,
      this.deviceDao,
      this.mappingDao,
      this.adminClient
    )
    this.portKillQueue = new PortKillQueue({
      killer: (ports) => this.sshSession.killPorts(ports),
      canRun: () => this.sshSession.isConnected() && this.frpcProcess.isRunning(),
      onExhausted: (ports) => this.notifyFrontend(FRP_EVENTS.CONNECTIONS_PERSIST, ports)
    })

    this.sshSession.setStatusCallback(() => {
      this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
    })

    this.frpcProcess.setCallbacks({
      onRestart: () => {
        logger.info('[FrpManager] frpc restarted, scheduling reconcile')
        this.syncService.getReconciler().schedule()
        this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
      },
      onExit: () => {
        this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
      }
    })

    this.syncService.getReconciler().setCallback(() => {
      this.notifyFrontend(FRP_EVENTS.MAPPINGS_UPDATED, null)
    })

    this.syncService.getReconciler().setDeleteCallback((ports) => this.killProxyPorts(ports))
  }

  // 删除映射后强制断开远端活跃连接：同步首次强杀 → 残留交给 PortKillQueue 异步重试 → 耗尽才上报
  private killProxyPorts(ports: number[]): void {
    if (ports.length === 0) return
    this.sshSession
      .killPorts(ports)
      .then((remaining) => this.portKillQueue.enqueue(remaining))
      .catch((err) => {
        logger.warn('[FrpManager] killProxyPorts failed:', err)
        this.portKillQueue.enqueue(ports)
      })
  }

  async testConnection(configInput: Partial<FrpConfig>): Promise<boolean> {
    const temp = new SshSession()
    try {
      await temp.connect({
        host: configInput.server_host || '',
        port: configInput.ssh_port || 22,
        username: configInput.ssh_user || 'root',
        password: configInput.ssh_password || ''
      })
      return true
    } catch {
      return false
    } finally {
      temp.disconnect()
    }
  }

  private async withSshSession<T>(
    config: FrpConfig,
    fn: (session: SshSession) => Promise<T>
  ): Promise<T> {
    if (this.sshSession.isConnected()) {
      return fn(this.sshSession)
    }
    const temp = new SshSession()
    try {
      await temp.connect({
        host: config.server_host,
        port: config.ssh_port,
        username: config.ssh_user,
        password: config.ssh_password
      })
      return await fn(temp)
    } finally {
      temp.disconnect()
    }
  }

  // ── 部署 ──

  async deploy(configInput: Partial<FrpConfig>): Promise<void> {
    const startTime = Date.now()
    logger.info('[FrpManager] deploy called')

    try {
      const existingConfig = this.configDao.getConfig()
      const isRetry = existingConfig?.status === 'error' && existingConfig.deploy_step
      const token = configInput.frps_token || existingConfig?.frps_token || uuidv4()

      const config: Partial<FrpConfig> = {
        ...configInput,
        frps_token: token,
        status: 'deploying',
        deploy_step: isRetry ? existingConfig.deploy_step : ''
      }
      this.configDao.saveConfig(config)

      const fullConfig = this.configDao.getConfig()!
      this.adminClient.updatePort(fullConfig.frpc_admin_port)
      this.adminClient.updateAuth('admin', fullConfig.frps_token)

      const onProgress = (progress: DeployProgress) => {
        this.configDao.updateDeployStep(progress.label)
        this.notifyFrontend(FRP_EVENTS.DEPLOY_PROGRESS, progress)
      }

      const resumeStep = isRetry ? fullConfig.deploy_step || undefined : undefined
      const frpsVersion = await this.withSshSession(fullConfig, (s) =>
        this.installer.deploy(s, fullConfig, onProgress, resumeStep)
      )

      await this.startFrpc(fullConfig)

      this.configDao.saveConfig({
        status: 'running',
        frps_version: frpsVersion,
        deploy_step: ''
      })

      const duration = Date.now() - startTime
      logger.info(`[FrpManager] deploy success: duration=${duration}ms`)
      this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
    } catch (error) {
      this.configDao.updateStatus('error')
      logger.error('[FrpManager] deploy failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
      throw error
    }
  }

  // ── 启停 ──

  async start(): Promise<void> {
    const startTime = Date.now()
    logger.info('[FrpManager] start called')
    const config = this.configDao.getConfig()
    if (!config) throw new Error('FRP not configured')

    this.adminClient.updatePort(config.frpc_admin_port)
    this.adminClient.updateAuth('admin', config.frps_token)
    try {
      await this.startFrpc(config)
    } catch (error) {
      this.configDao.updateStatus('error')
      this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
      throw error
    }
    this.configDao.updateStatus('running')
    logger.info(`[FrpManager] start success: duration=${Date.now() - startTime}ms`)
    this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
  }

  async stop(): Promise<void> {
    logger.info('[FrpManager] stop called')

    // stop 是整服务关闭，取消所有未完成的端口杀重试（killPortRange 会一次性扫整范围）
    this.portKillQueue.clear()

    const config = this.configDao.getConfig()
    if (config && this.sshSession.isConnected()) {
      const timeout = new Promise<void>((r) => setTimeout(r, 5000))
      await Promise.race([
        this.sshSession.killPortRange(config.port_range_start, config.port_range_end),
        timeout
      ]).catch((err) => logger.warn('[FrpManager] killPortRange on stop failed:', err))
    }

    await this.frpcProcess.stop()
    this.sshSession.disconnect()
    this.syncService.stop()

    if (config && config.status === 'running') {
      this.configDao.updateStatus('stopped')
    }

    this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
    this.notifyFrontend(FRP_EVENTS.MAPPINGS_UPDATED, null)
  }

  stopSync(): void {
    this.portKillQueue.clear()
    this.frpcProcess.stopSync()
    this.sshSession.dispose()
    this.syncService.destroy()
  }

  async uninstall(forceLocal = false): Promise<void> {
    logger.info('[FrpManager] uninstall called, forceLocal:', forceLocal)
    await this.stop()
    const config = this.configDao.getConfig()
    if (config) {
      if (!forceLocal) {
        await this.withSshSession(config, async (s) => {
          if (config.screen_enabled === 1) {
            try {
              await this.installer.uninstallScreen(s, config)
            } catch (e) {
              logger.warn('[FrpManager] uninstallScreen during reset failed, continuing:', e)
            }
          }
          await this.installer.uninstall(s, config)
        })
      }
      this.dbInstance.transaction(() => {
        const allMappings = this.mappingDao.getAll()
        for (const m of allMappings) this.mappingDao.delete(m.id)
        const allHosts = this.hostDao.getAll()
        for (const h of allHosts) this.hostDao.delete(h.id)
        const allDevices = this.deviceDao.getAll()
        for (const d of allDevices) this.deviceDao.delete(d.id)
        this.configDao.saveConfig({
          status: 'idle',
          deploy_mode: 'public',
          server_host: '',
          ssh_password: '',
          frps_token: '',
          frps_version: '',
          deploy_step: '',
          screen_enabled: 0,
          screen_public_port: 0,
          screen_ssl_cert: '',
          screen_ssl_key: ''
        })
      })
    }
    this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
    this.notifyFrontend(FRP_EVENTS.MAPPINGS_UPDATED, null)
  }

  // ── 自动启动 ──

  async autoStart(): Promise<void> {
    const config = this.configDao.getConfig()
    if (config?.status === 'running') {
      const startTime = Date.now()
      logger.info('[FrpManager] autoStart: restoring running state')
      try {
        this.adminClient.updatePort(config.frpc_admin_port)
        this.adminClient.updateAuth('admin', config.frps_token)
        await this.startFrpc(config)
        logger.info(`[FrpManager] autoStart success: duration=${Date.now() - startTime}ms`)
      } catch (error) {
        logger.error('[FrpManager] autoStart failed:', error)
        this.configDao.updateStatus('error')
      }
    }
  }

  // ── 状态 ──

  getStatus(): FrpStatusInfo {
    const config = this.configDao.getConfig()
    const allMappings = this.mappingDao.getAll()
    const running = this.frpcProcess.isRunning()
    const serverHost = config?.public_host || config?.server_host || ''
    const screenEnabled = config?.screen_enabled === 1
    const screenPort = config?.screen_port || 80
    const screenPublicPort = config?.screen_public_port || screenPort
    const hasSSL = !!(config?.screen_ssl_cert && config?.screen_ssl_key)
    const protocol = hasSSL ? 'https' : 'http'
    const defaultPort = hasSSL ? 443 : 80
    const screenUrl =
      screenEnabled && serverHost
        ? `${protocol}://${serverHost}${screenPublicPort === defaultPort ? '' : ':' + screenPublicPort}`
        : ''
    return {
      frpcRunning: running,
      sshConnected: this.sshSession.isConnected(),
      configStatus: config?.status || 'idle',
      configured: this.isConfigured(config),
      serverHost,
      localIp: this.getLocalIp(),
      totalMappings: allMappings.length,
      activeMappings: running ? allMappings.filter((m) => m.status === 'active').length : 0,
      screenEnabled,
      screenPort,
      screenUrl
    }
  }

  private isConfigured(config: FrpConfig | undefined): boolean {
    return Boolean(config?.server_host && config.frps_token)
  }

  private getLocalIp(): string {
    const interfaces = os.networkInterfaces()
    for (const addrs of Object.values(interfaces)) {
      if (!addrs) continue
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) return addr.address
      }
    }
    return '127.0.0.1'
  }

  getConfig(): FrpConfig | undefined {
    return this.configDao.getConfig()
  }

  async updateConfig(updates: Partial<FrpConfig>): Promise<void> {
    logger.info('[FrpManager] updateConfig:', updates)
    this.configDao.saveConfig(updates)
    if (updates.frpc_admin_port) {
      this.adminClient.updatePort(updates.frpc_admin_port)
    }
    if (updates.frps_token) {
      this.adminClient.updateAuth('admin', updates.frps_token)
    }

    if (updates.server_host || updates.ssh_port || updates.ssh_user || updates.ssh_password) {
      const config = this.configDao.getConfig()
      if (config && this.frpcProcess.isRunning()) {
        this.sshSession.disconnect()
        this.sshSession
          .connect({
            host: config.server_host,
            port: config.ssh_port,
            username: config.ssh_user,
            password: config.ssh_password
          })
          .catch((err) => {
            logger.warn('[FrpManager] SshSession reconnect failed:', err)
          })
      }
    }
  }

  async reconfigure(): Promise<void> {
    logger.info('[FrpManager] reconfigure called')
    const config = this.configDao.getConfig()
    if (!config) throw new Error('FRP not configured')
    await this.withSshSession(config, (s) => this.installer.reconfigure(s, config))
  }

  // ── 投屏服务 ──

  private requireDeployedConfig(): FrpConfig {
    const config = this.configDao.getConfig()
    if (!config) throw new Error('FRP not configured')
    if (config.status !== 'running' && config.status !== 'stopped') {
      throw new Error('FRP service must be deployed first')
    }
    return config
  }

  private screenProgress = (progress: DeployProgress) => {
    this.notifyFrontend(FRP_EVENTS.SCREEN_PROGRESS, progress)
  }

  private saveScreenConfig(
    port: number,
    publicPort?: number,
    sslCertPath?: string,
    sslKeyPath?: string
  ): void {
    this.configDao.saveConfig({
      screen_enabled: 1,
      screen_port: port,
      screen_public_port: publicPort || 0,
      screen_ssl_cert: sslCertPath || '',
      screen_ssl_key: sslKeyPath || ''
    })
    this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
  }

  async deployScreen(
    port: number,
    publicPort?: number,
    sslCertPath?: string,
    sslKeyPath?: string
  ): Promise<void> {
    logger.info(
      `[FrpManager] deployScreen: port=${port}, publicPort=${publicPort}, ssl=${!!(sslCertPath && sslKeyPath)}`
    )
    const config = this.requireDeployedConfig()
    try {
      await this.withSshSession(config, (s) =>
        this.installer.deployScreen(s, config, port, sslCertPath, sslKeyPath, this.screenProgress)
      )
      this.saveScreenConfig(port, publicPort, sslCertPath, sslKeyPath)
    } catch (error) {
      logger.error('[FrpManager] deployScreen failed:', error)
      throw error
    }
  }

  async updateScreenConfig(
    port: number,
    publicPort?: number,
    sslCertPath?: string,
    sslKeyPath?: string
  ): Promise<void> {
    logger.info(
      `[FrpManager] updateScreenConfig: port=${port}, publicPort=${publicPort}, ssl=${!!(sslCertPath && sslKeyPath)}`
    )
    const config = this.requireDeployedConfig()
    if (config.screen_enabled !== 1) throw new Error('Screen service not deployed')
    try {
      await this.withSshSession(config, (s) =>
        this.installer.updateScreenConfig(
          s,
          config,
          port,
          sslCertPath,
          sslKeyPath,
          this.screenProgress
        )
      )
      this.saveScreenConfig(port, publicPort, sslCertPath, sslKeyPath)
    } catch (error) {
      logger.error('[FrpManager] updateScreenConfig failed:', error)
      throw error
    }
  }

  async uninstallScreen(): Promise<void> {
    logger.info('[FrpManager] uninstallScreen called')
    const config = this.configDao.getConfig()
    if (!config) throw new Error('FRP not configured')

    try {
      await this.withSshSession(config, (s) =>
        this.installer.uninstallScreen(s, config, this.screenProgress)
      )
      this.configDao.saveConfig({
        screen_enabled: 0,
        screen_public_port: 0,
        screen_ssl_cert: '',
        screen_ssl_key: ''
      })
      this.notifyFrontend(FRP_EVENTS.STATUS_CHANGED, this.getStatus())
    } catch (error) {
      logger.error('[FrpManager] uninstallScreen failed:', error)
      throw error
    }
  }

  // ── 启用状态查询 ──

  getEnabledStates(): EnabledStates {
    const hosts = this.hostDao.getAllEnabled()
    const devices = this.deviceDao.getAllEnabled()
    return {
      hostIps: hosts.map((h) => h.id),
      deviceIds: devices.map((d) => d.id)
    }
  }

  // ── 映射查询 ──

  getMappings(filter?: FrpMappingFilter): FrpMapping[] {
    if (filter?.hostIp) return this.mappingDao.getByHostIp(filter.hostIp)
    if (filter?.deviceId) return this.mappingDao.getByDeviceId(filter.deviceId)
    const all = this.mappingDao.getAll()
    logger.info(`[FrpManager] getMappings: total=${all.length}`)
    return all
  }

  // ── 开关控制 ──

  async toggleHost(hostIp: string, enabled: boolean): Promise<void> {
    const startTime = Date.now()
    logger.info(`[FrpManager] toggleHost: hostIp=${hostIp}, enabled=${enabled}`)

    this.hostDao.setEnabled(hostIp, enabled)

    if (enabled) {
      await this.createHostMappings(hostIp)
    } else {
      const hostMappings = this.mappingDao.getByHostIp(hostIp).filter((m) => m.device_id === 'host')
      this.dbInstance.transaction(() => {
        for (const m of hostMappings) this.mappingDao.delete(m.id)
      })
    }

    this.syncService.getReconciler().schedule()
    const duration = Date.now() - startTime
    logger.info(`[FrpManager] toggleHost done: hostIp=${hostIp}, duration=${duration}ms`)
  }

  async toggleDevice(
    deviceId: string,
    hostIp: string,
    enabled: boolean,
    portTypes?: DevicePortType[]
  ): Promise<void> {
    const startTime = Date.now()
    logger.info(`[FrpManager] toggleDevice: deviceId=${deviceId}, enabled=${enabled}`)

    if (enabled) {
      this.deviceDao.setEnabled(deviceId, hostIp, true)
      await this.createDeviceMappings(deviceId, hostIp, portTypes)
    } else if (portTypes?.length) {
      const mappings = this.mappingDao.getByDeviceId(deviceId)
      const toDelete = mappings.filter((m) => portTypes.includes(m.port_type as DevicePortType))
      this.dbInstance.transaction(() => {
        for (const m of toDelete) this.mappingDao.delete(m.id)
      })
      const remaining = this.mappingDao.getByDeviceId(deviceId)
      if (remaining.length === 0) {
        this.deviceDao.setEnabled(deviceId, hostIp, false)
      }
    } else {
      this.deviceDao.setEnabled(deviceId, hostIp, false)
      const mappings = this.mappingDao.getByDeviceId(deviceId)
      this.dbInstance.transaction(() => {
        for (const m of mappings) this.mappingDao.delete(m.id)
      })
    }

    this.syncService.getReconciler().schedule()
    const duration = Date.now() - startTime
    logger.info(`[FrpManager] toggleDevice done: deviceId=${deviceId}, duration=${duration}ms`)
  }

  async batchToggle(
    items: { deviceId: string; hostIp: string }[],
    enabled: boolean,
    portTypes?: DevicePortType[]
  ): Promise<BatchToggleResult> {
    logger.info(`[FrpManager] batchToggle: count=${items.length}, enabled=${enabled}`)

    const failures: { deviceId: string; error: string }[] = []
    for (const item of items) {
      try {
        await this.toggleDevice(item.deviceId, item.hostIp, enabled, portTypes)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        failures.push({ deviceId: item.deviceId, error: msg })
        logger.warn(`[FrpManager] batchToggle failed for device ${item.deviceId}:`, error)
      }
    }

    return {
      total: items.length,
      succeeded: items.length - failures.length,
      failures
    }
  }

  // ── 释放无用端口 ──

  async cleanOrphans(): Promise<number> {
    logger.info('[FrpManager] cleanOrphans called')
    // 按 proxy 名字去重：DB 删 + frpc 删可能是同一个映射的两面，不应重复计数
    const cleanedProxyNames = new Set<string>()

    // 1. 扫描 DB 中的孤儿映射（设备已不存在）
    const allDeviceIds = new Set(this.coreDeviceDao.getAll().map((d) => d.id))
    const orphans = this.mappingDao.findOrphans(allDeviceIds)
    if (orphans.length > 0) {
      this.dbInstance.transaction(() => {
        for (const o of orphans) {
          this.mappingDao.delete(o.id)
          this.deviceDao.delete(o.device_id)
          cleanedProxyNames.add(o.id)
        }
      })
      logger.info(`[FrpManager] cleaned ${orphans.length} orphan mappings from DB`)
    }

    // 2. 扫描 frpc 实际 proxy 中 DB 无记录的残留，直接删除（可能包含步骤 1 刚删的）
    const killedPorts: number[] = []
    try {
      const remoteStatuses = await this.adminClient.getAllStatus()
      const dbIds = new Set(this.mappingDao.getAll().map((m) => m.id))
      const staleProxies = remoteStatuses.filter((s) => !dbIds.has(s.name))

      for (const s of staleProxies) {
        try {
          await this.adminClient.deleteProxy(s.name)
          if (s.remotePort && s.remotePort > 0) killedPorts.push(s.remotePort)
          cleanedProxyNames.add(s.name) // 与步骤 1 同 id 自动去重
        } catch (error) {
          logger.warn(`[FrpManager] failed to delete stale proxy ${s.name}:`, error)
        }
      }
      if (staleProxies.length > 0) {
        logger.info(`[FrpManager] cleaned ${staleProxies.length} stale proxies from frpc`)
      }
    } catch (error) {
      logger.warn('[FrpManager] failed to scan frpc for stale proxies:', error)
    }

    // 3. 走统一出口杀掉残留端口上的活跃连接
    this.killProxyPorts(killedPorts)

    this.notifyFrontend(FRP_EVENTS.MAPPINGS_UPDATED, null)
    return cleanedProxyNames.size
  }

  // ── 调和触发 ──

  reconnectSsh(): void {
    const config = this.configDao.getConfig()
    if (!config || config.status !== 'running' || !this.frpcProcess.isRunning()) return
    this.sshSession.reconnectNow()
  }

  scheduleReconcile(): void {
    if (this.frpcProcess.isRunning()) {
      this.syncService.getReconciler().schedule()
    }
  }

  // ── 设备同步入口（由 DeviceManager 调用） ──

  onDevicesSynced(hostIp: string, currentDevices: Device[], deletedDevices: Device[]): void {
    this.syncService.onDevicesSynced(hostIp, currentDevices, deletedDevices)

    for (const device of currentDevices) {
      if (!this.deviceDao.isEnabled(device.id)) continue
      // createDeviceMappings 内部有 exists 检查，对已有映射是幂等的
      this.createDeviceMappings(device.id, hostIp).catch((err) => {
        logger.error(`[FrpManager] failed to create mappings for device ${device.id}:`, err)
      })
    }
  }

  // ── 内部方法 ──

  private async startFrpc(config: FrpConfig): Promise<void> {
    await this.frpcProcess.start({
      serverAddr: config.public_host || config.server_host,
      serverPort: config.public_frps_port || config.frps_port,
      authToken: config.frps_token,
      adminPort: config.frpc_admin_port,
      adminUser: 'admin',
      adminPassword: config.frps_token
    })

    // 等待 frpc Admin API 就绪
    let retries = 0
    while (retries < 20) {
      await new Promise((r) => setTimeout(r, 500))
      if (await this.adminClient.isHealthy()) {
        logger.info('[FrpManager] frpc Admin API ready')
        this.sshSession
          .connect({
            host: config.server_host,
            port: config.ssh_port,
            username: config.ssh_user,
            password: config.ssh_password
          })
          .catch((err) => {
            logger.warn('[FrpManager] SshSession connect failed:', err)
          })
        this.syncService.getReconciler().schedule()
        return
      }
      retries++
    }
    await this.frpcProcess.stop()
    throw new Error('frpc Admin API not ready after 10s')
  }

  private async createHostMappings(hostIp: string): Promise<void> {
    const config = this.configDao.getConfig()
    if (!config) {
      logger.warn(`[FrpManager] createHostMappings: no config found, skipping`)
      return
    }

    const host = this.coreHostDao.getByIp(hostIp)

    if (!host) {
      logger.warn(`[FrpManager] createHostMappings: host not found for ip=${hostIp}`)
      return
    }

    logger.info(
      `[FrpManager] createHostMappings: hostIp=${hostIp}, hostId=${host.id}, map_host_port=${config.map_host_port}`
    )

    // 主机管理端口映射
    if (config.map_host_port) {
      const proxyName = `${hostIp}-host-management`
      if (!this.mappingDao.exists(proxyName)) {
        this.mappingDao.insert({
          id: proxyName,
          host_id: host.id,
          host_ip: hostIp,
          device_id: 'host',
          port_type: 'management',
          local_ip: hostIp,
          local_port: HOST_MANAGEMENT_PORT,
          remote_port: 0,
          status: 'active',
          created_at: Date.now()
        } as FrpMapping)
        logger.info(`[FrpManager] createHostMappings: created management mapping ${proxyName}`)
      }
    }
  }

  private async createDeviceMappings(
    deviceId: string,
    hostIp: string,
    portTypes?: DevicePortType[]
  ): Promise<void> {
    const config = this.configDao.getConfig()
    if (!config) {
      logger.warn(`[FrpManager] createDeviceMappings: no config found`)
      return
    }

    const device = this.coreDeviceDao.getById(deviceId) as Device | undefined

    if (!device) {
      logger.warn(`[FrpManager] createDeviceMappings: device not found: ${deviceId}`)
      return
    }

    const host = this.coreHostDao.getByIp(hostIp)

    const hostId = host?.id || ''
    const now = Date.now()
    const isMacvlan = device.network_mode === 'macvlan'
    const localIp = isMacvlan && device.ip ? device.ip : hostIp

    type PM = { type: FrpPortType; port: number | undefined; enabled: boolean }
    const has = (t: DevicePortType) => (portTypes ? portTypes.includes(t) : true)
    const portMappings: PM[] = isMacvlan
      ? [
          { type: 'adb', port: MACVLAN_PORTS.adb, enabled: has('adb') },
          { type: 'video', port: MACVLAN_PORTS.video, enabled: has('video') },
          { type: 'control', port: MACVLAN_PORTS.control, enabled: has('control') },
          { type: 'audio', port: MACVLAN_PORTS.audio, enabled: has('audio') }
        ]
      : [
          { type: 'adb', port: device.adb ?? undefined, enabled: has('adb') },
          { type: 'video', port: device.tcp_port ?? undefined, enabled: has('video') },
          { type: 'control', port: device.tcp_control_port ?? undefined, enabled: has('control') },
          { type: 'audio', port: device.tcp_audio_port ?? undefined, enabled: has('audio') }
        ]

    logger.info(
      `[FrpManager] createDeviceMappings: deviceId=${deviceId}, macvlan=${isMacvlan}, localIp=${localIp}, portTypes=${portTypes || 'default'}`
    )

    let created = 0
    this.dbInstance.transaction(() => {
      for (const pm of portMappings) {
        if (!pm.enabled || !pm.port) continue

        const proxyName = `${hostIp}-${deviceId}-${pm.type}`
        if (!this.mappingDao.exists(proxyName)) {
          this.mappingDao.insert({
            id: proxyName,
            host_id: hostId,
            host_ip: hostIp,
            device_id: deviceId,
            port_type: pm.type,
            local_ip: localIp,
            local_port: pm.port,
            remote_port: 0,
            status: 'active',
            created_at: now
          } as FrpMapping)
          created++
        }
      }
    })
    if (created > 0) {
      logger.info(`[FrpManager] createDeviceMappings: created ${created} mappings for ${deviceId}`)
    }
  }
}
