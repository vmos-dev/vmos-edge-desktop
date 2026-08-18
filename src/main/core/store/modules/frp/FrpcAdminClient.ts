import { logger } from '../../../logger'

export interface ProxyStatus {
  name: string
  type: string
  status: string
  remotePort?: number
  localIP?: string
  localPort?: number
  err?: string
}

export interface StoreProxyDefinition {
  name: string
  type: string
  tcp?: {
    localIP: string
    localPort: number
    remotePort?: number
  }
}

export class FrpcAdminClient {
  private baseUrl: string
  private authHeader: string

  constructor(adminPort: number, user?: string, password?: string) {
    this.baseUrl = `http://127.0.0.1:${adminPort}`
    this.authHeader = this.buildAuth(user, password)
  }

  updatePort(adminPort: number): void {
    this.baseUrl = `http://127.0.0.1:${adminPort}`
  }

  updateAuth(user: string, password: string): void {
    this.authHeader = this.buildAuth(user, password)
  }

  private buildAuth(user?: string, password?: string): string {
    if (!user) return ''
    return 'Basic ' + Buffer.from(`${user}:${password || ''}`).toString('base64')
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...extra }
    if (this.authHeader) h['Authorization'] = this.authHeader
    return h
  }

  // ── Status API ──

  async getAllStatus(): Promise<ProxyStatus[]> {
    const resp = await fetch(`${this.baseUrl}/api/status`, { headers: this.headers() })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`getAllStatus failed: ${resp.status} ${text}`)
    }
    const data = (await resp.json()) as {
      tcp?: Array<{
        name: string
        status: string
        remote_addr?: string
        local_addr?: string
        err?: string
      }>
    }
    const results: ProxyStatus[] = []
    if (data.tcp) {
      for (const item of data.tcp) {
        let port = 0
        if (item.remote_addr) {
          const lastColon = item.remote_addr.lastIndexOf(':')
          if (lastColon >= 0) {
            port = parseInt(item.remote_addr.substring(lastColon + 1), 10) || 0
          }
        }
        results.push({
          name: item.name,
          type: 'tcp',
          status: item.status,
          remotePort: port,
          ...this.parseLocalAddress(item.local_addr),
          err: item.err
        })
      }
    }
    return results
  }

  private parseLocalAddress(localAddr?: string): Pick<ProxyStatus, 'localIP' | 'localPort'> {
    if (!localAddr) return {}
    const lastColon = localAddr.lastIndexOf(':')
    if (lastColon < 0) return {}
    const localPort = parseInt(localAddr.substring(lastColon + 1), 10)
    if (!localPort) return {}
    return {
      localIP: localAddr.substring(0, lastColon),
      localPort
    }
  }

  // ── Store API (v0.68.0+) ──

  async createProxy(
    name: string,
    localIP: string,
    localPort: number,
    remotePort?: number
  ): Promise<void> {
    const body: StoreProxyDefinition = {
      name,
      type: 'tcp',
      tcp: { localIP, localPort }
    }
    if (remotePort && remotePort > 0) {
      body.tcp!.remotePort = remotePort
    }

    const resp = await fetch(`${this.baseUrl}/api/store/proxies`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`createProxy failed: ${resp.status} ${text}`)
    }
    logger.debug(`[FrpcAdminClient] createProxy: ${name}`)
  }

  async updateProxy(
    name: string,
    localIP: string,
    localPort: number,
    remotePort?: number
  ): Promise<void> {
    const body: StoreProxyDefinition = {
      name,
      type: 'tcp',
      tcp: { localIP, localPort }
    }
    if (remotePort && remotePort > 0) {
      body.tcp!.remotePort = remotePort
    }

    const resp = await fetch(`${this.baseUrl}/api/store/proxies/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`updateProxy failed: ${resp.status} ${text}`)
    }
    logger.debug(`[FrpcAdminClient] updateProxy: ${name}`)
  }

  async deleteProxy(name: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/api/store/proxies/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: this.headers()
    })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`deleteProxy failed: ${resp.status} ${text}`)
    }
    logger.debug(`[FrpcAdminClient] deleteProxy: ${name}`)
  }

  async listStoreProxies(): Promise<StoreProxyDefinition[]> {
    const resp = await fetch(`${this.baseUrl}/api/store/proxies`, { headers: this.headers() })
    if (!resp.ok) {
      const text = await resp.text()
      throw new Error(`listStoreProxies failed: ${resp.status} ${text}`)
    }
    const data = (await resp.json()) as { proxies?: StoreProxyDefinition[] }
    return data.proxies || []
  }

  // ── Config API (保留用于读取基础配置) ──

  async getFullConfig(): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/api/config`, { headers: this.headers() })
    if (!resp.ok) throw new Error(`getConfig failed: ${resp.status}`)
    return resp.text()
  }

  // ── Health ──

  async isHealthy(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/status`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(3000)
      })
      return resp.ok
    } catch {
      return false
    }
  }
}
