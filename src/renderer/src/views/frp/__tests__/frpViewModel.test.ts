import { describe, expect, it } from 'vitest'
import {
  hasFrpConfiguration,
  isFrpClientRestartRequired,
  isFrpServerRestartRequired
} from '../frpViewModel'
import type { FrpConfig } from '@shared/ipc/frp.types'

function config(overrides: Partial<FrpConfig> = {}): FrpConfig {
  return {
    id: 'default',
    deploy_mode: 'nat',
    server_host: '10.0.0.10',
    ssh_port: 22,
    ssh_user: 'root',
    ssh_password: 'password',
    frps_port: 7000,
    frps_token: 'Token-123!',
    port_range_start: 30000,
    port_range_end: 31000,
    public_host: 'frp.example.com',
    public_frps_port: 17000,
    frps_dashboard_port: 7500,
    public_frps_dashboard_port: 17500,
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
    frps_version: '0.68.1',
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

describe('frpViewModel', () => {
  it('treats a stopped saved config as configured', () => {
    expect(hasFrpConfiguration(config({ status: 'idle' }))).toBe(true)
  })

  it('does not treat an empty default row as configured', () => {
    expect(hasFrpConfiguration(config({ server_host: '', frps_token: '' }))).toBe(false)
  })

  it('requires server/client restart for public NAT endpoint changes', () => {
    const current = config()

    expect(isFrpServerRestartRequired(current, { public_frps_dashboard_port: 18500 })).toBe(true)
    expect(isFrpClientRestartRequired(current, { public_host: 'new.example.com' })).toBe(true)
    expect(isFrpClientRestartRequired(current, { public_frps_port: 18000 })).toBe(true)
  })
})
