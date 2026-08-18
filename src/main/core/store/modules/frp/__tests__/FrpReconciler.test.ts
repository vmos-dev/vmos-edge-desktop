import { describe, expect, it, vi } from 'vitest'
import { FrpReconciler } from '../FrpReconciler'
import type { FrpMapping } from '@shared/ipc/frp.types'

function mapping(overrides: Partial<FrpMapping> = {}): FrpMapping {
  return {
    id: '10.0.0.1-device-1-adb',
    host_id: 'host-1',
    host_ip: '10.0.0.1',
    device_id: 'device-1',
    port_type: 'adb',
    local_ip: '10.0.0.1',
    local_port: 5555,
    remote_port: 30001,
    status: 'active',
    created_at: 1,
    ...overrides
  }
}

describe('FrpReconciler', () => {
  it('updates an existing remote proxy when the local port changed', async () => {
    const dbMapping = mapping({ local_port: 5556 })
    const dao = {
      getAll: vi.fn(() => [dbMapping]),
      updateRemotePort: vi.fn(),
      getById: vi.fn(() => dbMapping),
      updateStatus: vi.fn()
    }
    const client = {
      isHealthy: vi.fn().mockResolvedValue(true),
      getAllStatus: vi.fn().mockResolvedValue([
        {
          name: dbMapping.id,
          type: 'tcp',
          status: 'running',
          remotePort: 30001,
          localIP: '10.0.0.1',
          localPort: 5555
        }
      ]),
      createProxy: vi.fn(),
      updateProxy: vi.fn(),
      deleteProxy: vi.fn()
    }

    await new FrpReconciler(client as any, dao as any).run()

    expect(client.updateProxy).toHaveBeenCalledWith(
      dbMapping.id,
      dbMapping.local_ip,
      dbMapping.local_port,
      dbMapping.remote_port
    )
    expect(client.createProxy).not.toHaveBeenCalled()
  })
})
