import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FrpConfig } from '@shared/ipc/frp.types'

vi.mock('../BaseManager', () => ({
  BaseManager: class BaseManager {
    protected dbInstance = {
      transaction<T>(callback: () => T): T {
        return callback()
      }
    }
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

const { FrpManager } = await import('../FrpManager')

type FrpManagerInstance = InstanceType<typeof FrpManager>

function config(overrides?: Partial<FrpConfig>): FrpConfig {
  return {
    id: 'default',
    deploy_mode: 'public',
    server_host: '203.0.113.10',
    ssh_port: 22,
    ssh_user: 'root',
    ssh_password: 'password',
    frps_port: 7000,
    frps_token: 'Token-123!',
    port_range_start: 30000,
    port_range_end: 31000,
    public_host: '',
    public_frps_port: 0,
    frps_dashboard_port: 7500,
    public_frps_dashboard_port: 0,
    frps_dashboard_user: 'admin',
    frps_dashboard_password: 'Admin-123!',
    frpc_admin_port: 7400,
    map_host_port: 1,
    map_adb: 1,
    map_video: 1,
    map_control: 1,
    map_audio: 1,
    status: 'idle',
    deploy_step: '',
    frps_version: '',
    screen_enabled: 0,
    screen_port: 80,
    screen_public_port: 0,
    screen_ssl_cert: '',
    screen_ssl_key: '',
    proxy_bind_local: 0,
    created_at: 1,
    updated_at: 1,
    ...overrides
  }
}

describe('FrpManager runtime state', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fails start when frpc Admin API never becomes healthy', async () => {
    vi.useFakeTimers()
    const manager = Object.create(FrpManager.prototype) as FrpManagerInstance
    ;(manager as any).frpcProcess = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined)
    }
    ;(manager as any).adminClient = {
      isHealthy: vi.fn().mockResolvedValue(false)
    }
    ;(manager as any).syncService = {
      getReconciler: () => ({ schedule: vi.fn() })
    }

    const promise = expect((manager as any).startFrpc(config())).rejects.toThrow(
      'frpc Admin API not ready'
    )

    await vi.advanceTimersByTimeAsync(10_000)
    await promise
  })

  it('marks a running configuration as stopped without clearing saved settings', async () => {
    const currentConfig = config({ status: 'running' })
    const configDao = {
      getConfig: vi.fn(() => currentConfig),
      updateStatus: vi.fn()
    }
    const mappingDao = {
      getAll: vi.fn(() => []),
      updateStatus: vi.fn()
    }
    const manager = Object.create(FrpManager.prototype) as FrpManagerInstance
    ;(manager as any).frpcProcess = {
      stop: vi.fn().mockResolvedValue(undefined),
      isRunning: vi.fn(() => false)
    }
    ;(manager as any).syncService = { destroy: vi.fn() }
    ;(manager as any).configDao = configDao
    ;(manager as any).mappingDao = mappingDao
    ;(manager as any).dbInstance = {
      transaction<T>(callback: () => T): T {
        return callback()
      }
    }
    ;(manager as any).notifyFrontend = vi.fn()

    await manager.stop()

    expect(configDao.updateStatus).toHaveBeenCalledWith('stopped')
    expect(currentConfig.server_host).toBe('203.0.113.10')
    expect(currentConfig.frps_token).toBe('Token-123!')
  })

  it('reports batch toggle failures to the caller', async () => {
    const manager = Object.create(FrpManager.prototype) as FrpManagerInstance
    ;(manager as any).toggleDevice = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('device-2 failed'))

    const result = await manager.batchToggle(
      [
        { deviceId: 'device-1', hostIp: '10.0.0.1' },
        { deviceId: 'device-2', hostIp: '10.0.0.1' }
      ],
      true
    )

    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].deviceId).toBe('device-2')
    expect(result.failures[0].error).toContain('device-2 failed')
  })
})
