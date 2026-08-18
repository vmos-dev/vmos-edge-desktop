import { describe, expect, it, vi } from 'vitest'
import type { FrpConfig, DeployProgress } from '@shared/ipc/frp.types'
import type { SshSession } from '../SshSession'

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

const { FrpInstaller } = await import('../FrpInstaller')

function createConfig(): FrpConfig {
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
    updated_at: 1
  }
}

function createMockSession(execImpl?: (cmd: string) => Promise<string>): SshSession {
  return {
    exec: execImpl ?? vi.fn().mockRejectedValue(new Error('arch detect failed')),
    uploadFile: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    killPorts: vi.fn().mockResolvedValue(undefined)
  } as unknown as SshSession
}

describe('FrpInstaller deploy progress', () => {
  it('emits an error progress for the failing deploy step', async () => {
    const installer = new FrpInstaller()
    const session = createMockSession()
    const progress: DeployProgress[] = []

    await expect(
      installer.deploy(session, createConfig(), (item) => progress.push(item))
    ).rejects.toThrow('arch detect failed')

    expect(progress.at(-1)).toMatchObject({
      step: 2,
      status: 'error',
      error: 'arch detect failed'
    })
  })
})
