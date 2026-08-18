import { logger } from '../../../logger'
import { FrpcAdminClient } from './FrpcAdminClient'
import { FrpMappingDao } from '../../../dao/FrpMappingDao'
import type { FrpMapping } from '@shared/ipc/frp.types'
import type { StoreProxyDefinition, ProxyStatus } from './FrpcAdminClient'

const DEBOUNCE_MS = 500

export class FrpReconciler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private pendingAfterRun = false
  private destroyed = false
  private client: FrpcAdminClient
  private mappingDao: FrpMappingDao
  private onReconciled?: () => void
  private onProxiesDeleted?: (ports: number[]) => void

  constructor(client: FrpcAdminClient, mappingDao: FrpMappingDao) {
    this.client = client
    this.mappingDao = mappingDao
  }

  setCallback(onReconciled: () => void): void {
    this.onReconciled = onReconciled
  }

  setDeleteCallback(onProxiesDeleted: (ports: number[]) => void): void {
    this.onProxiesDeleted = onProxiesDeleted
  }

  schedule(): void {
    if (this.destroyed) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      this.run().catch((err) => {
        logger.error('[FrpReconciler] unexpected run error:', err)
      })
    }, DEBOUNCE_MS)
  }

  async run(): Promise<void> {
    if (this.running || this.destroyed) {
      if (this.running && !this.destroyed) this.pendingAfterRun = true
      return
    }
    this.running = true
    const startTime = Date.now()

    try {
      const isHealthy = await this.client.isHealthy()
      if (!isHealthy) {
        logger.warn('[FrpReconciler] frpc not healthy, skipping')
        return
      }

      const dbMappings = this.mappingDao.getAll()
      const remoteStatuses = await this.client.getAllStatus()
      const storeProxies = await this.getStoreProxies(remoteStatuses)
      const remoteSet = new Set(remoteStatuses.map((s) => s.name))
      const dbSet = new Set(dbMappings.map((m) => m.id))

      const toCreate = dbMappings.filter((m) => !remoteSet.has(m.id))
      const toDelete = remoteStatuses.filter((s) => !dbSet.has(s.name))
      const toUpdate = dbMappings.filter((m) => {
        if (!remoteSet.has(m.id)) return false
        return this.hasProxyDrift(
          m,
          storeProxies.get(m.id),
          remoteStatuses.find((s) => s.name === m.id)
        )
      })

      if (toCreate.length === 0 && toDelete.length === 0 && toUpdate.length === 0) {
        logger.debug('[FrpReconciler] no changes needed')
      } else {
        logger.info(
          `[FrpReconciler] reconciling via Store API: create=${toCreate.length}, update=${toUpdate.length}, delete=${toDelete.length}`
        )

        const deletedProxyNames: string[] = []
        const deletedPorts: number[] = []
        for (const s of toDelete) {
          try {
            await this.client.deleteProxy(s.name)
            deletedProxyNames.push(s.name)
            if (s.remotePort && s.remotePort > 0) {
              deletedPorts.push(s.remotePort)
            }
          } catch (error) {
            logger.warn(`[FrpReconciler] deleteProxy ${s.name} failed:`, error)
          }
        }
        // 等待 frps 端真正 close listener 后再触发 killPorts，
        // 否则 deleteProxy 仅是请求受理，frps 还可能 accept 新连接，导致杀完又有
        if (deletedProxyNames.length > 0) {
          await this.waitForProxiesDeleted(deletedProxyNames)
        }
        if (deletedPorts.length > 0) {
          this.onProxiesDeleted?.(deletedPorts)
        }

        for (const m of toUpdate) {
          try {
            await this.client.updateProxy(
              m.id,
              m.local_ip,
              m.local_port,
              m.remote_port > 0 ? m.remote_port : undefined
            )
          } catch (error) {
            logger.warn(`[FrpReconciler] updateProxy ${m.id} failed:`, error)
          }
        }

        for (const m of toCreate) {
          try {
            await this.client.createProxy(
              m.id,
              m.local_ip,
              m.local_port,
              m.remote_port > 0 ? m.remote_port : undefined
            )
          } catch (error) {
            logger.warn(`[FrpReconciler] createProxy ${m.id} failed:`, error)
          }
        }

        if (toCreate.length > 0) {
          await this.waitForProxiesReady(toCreate)
        }
      }

      await this.syncRemotePorts()

      const duration = Date.now() - startTime
      logger.info(
        `[FrpReconciler] reconciled: changes=${toCreate.length + toUpdate.length + toDelete.length}, duration=${duration}ms`
      )

      this.onReconciled?.()
    } catch (error) {
      logger.error('[FrpReconciler] reconcile failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
    } finally {
      this.running = false
      if (this.pendingAfterRun) {
        this.pendingAfterRun = false
        this.schedule()
      }
    }
  }

  private async getStoreProxies(
    remoteStatuses: ProxyStatus[]
  ): Promise<Map<string, StoreProxyDefinition>> {
    try {
      const storeProxies = await this.client.listStoreProxies()
      return new Map(storeProxies.map((proxy) => [proxy.name, proxy]))
    } catch (error) {
      logger.warn('[FrpReconciler] listStoreProxies failed, falling back to status payload:', error)
      return new Map(
        remoteStatuses
          .filter((status) => status.localIP && status.localPort)
          .map((status) => [
            status.name,
            {
              name: status.name,
              type: 'tcp',
              tcp: {
                localIP: status.localIP!,
                localPort: status.localPort!,
                remotePort: status.remotePort
              }
            }
          ])
      )
    }
  }

  private hasProxyDrift(
    mapping: FrpMapping,
    stored: StoreProxyDefinition | undefined,
    status: ProxyStatus | undefined
  ): boolean {
    const tcp = stored?.tcp
    const localIP = tcp?.localIP ?? status?.localIP
    const localPort = tcp?.localPort ?? status?.localPort
    const remotePort = tcp?.remotePort ?? status?.remotePort

    if (localIP && localIP !== mapping.local_ip) return true
    if (localPort && localPort !== mapping.local_port) return true
    if (mapping.remote_port > 0 && remotePort && remotePort !== mapping.remote_port) return true
    return false
  }

  private async syncRemotePorts(): Promise<void> {
    try {
      const statuses = await this.client.getAllStatus()
      for (const s of statuses) {
        if (s.remotePort && s.remotePort > 0) {
          try {
            this.mappingDao.updateRemotePort(s.name, s.remotePort)
          } catch {
            // mapping may not exist in DB (orphan), ignore
          }
        }
        const dbMapping = this.mappingDao.getById(s.name) as FrpMapping | undefined
        if (dbMapping) {
          const newStatus = s.status === 'running' ? 'active' : 'error'
          if (dbMapping.status !== newStatus) {
            logger.info(
              `[FrpReconciler] status change: ${s.name} ${dbMapping.status}→${newStatus}${s.err ? `, err=${s.err}` : ''}`
            )
            this.mappingDao.updateStatus(s.name, newStatus as FrpMapping['status'])
          }
        }
      }
    } catch (error) {
      logger.warn('[FrpReconciler] syncRemotePorts failed:', error)
    }
  }

  // 与 waitForProxiesReady 对称：等待 frps 真正不再上报这些 proxy（listener 已 close）
  // 之后 kill 操作才有效，否则 frps 还在 accept 新连接，杀掉会立刻被补上
  // 上限 1.5s，超时不阻塞后续 killPorts（killPorts 自己有重试兜底）
  private async waitForProxiesDeleted(names: string[]): Promise<void> {
    const maxAttempts = 5
    const intervalMs = 300
    const target = new Set(names)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const statuses = await this.client.getAllStatus()
        const stillPresent = statuses.some((s) => target.has(s.name))
        if (!stillPresent) {
          logger.debug(`[FrpReconciler] waitForProxiesDeleted: cleared in ${attempt} attempts`)
          return
        }
      } catch (error) {
        logger.warn(`[FrpReconciler] waitForProxiesDeleted poll error:`, error)
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    logger.warn(
      `[FrpReconciler] waitForProxiesDeleted: timed out after ${maxAttempts * intervalMs}ms`
    )
  }

  private async waitForProxiesReady(created: FrpMapping[]): Promise<void> {
    const maxAttempts = 10
    const intervalMs = 500
    const names = new Set(created.map((m) => m.id))

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      try {
        const statuses = await this.client.getAllStatus()
        const readyCount = statuses.filter(
          (s) => names.has(s.name) && s.status === 'running' && s.remotePort && s.remotePort > 0
        ).length

        logger.debug(
          `[FrpReconciler] waitForProxiesReady: attempt=${attempt}, ready=${readyCount}/${names.size}`
        )

        if (readyCount >= names.size) return
      } catch (error) {
        logger.warn(`[FrpReconciler] waitForProxiesReady poll error:`, error)
      }
    }

    logger.warn(
      `[FrpReconciler] waitForProxiesReady: timed out after ${maxAttempts * intervalMs}ms`
    )
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  destroy(): void {
    this.destroyed = true
    this.cancel()
  }
}
