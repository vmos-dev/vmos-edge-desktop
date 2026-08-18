import { describe, expect, it, vi } from 'vitest'
import { FrpSyncService } from '../FrpSyncService'

describe('FrpSyncService', () => {
  it('cleans deleted devices even when the host is currently disabled', () => {
    const hostDao = { isEnabled: vi.fn(() => false) }
    const deviceDao = {
      delete: vi.fn(),
      isEnabled: vi.fn(() => false)
    }
    const mappingDao = {
      deleteByDeviceId: vi.fn(() => 2),
      getByDeviceId: vi.fn()
    }
    const service = new FrpSyncService(
      hostDao as any,
      deviceDao as any,
      mappingDao as any,
      {} as any
    )

    service.onDevicesSynced('10.0.0.1', [], [{ id: 'device-1', host_ip: '10.0.0.1' } as any])

    expect(mappingDao.deleteByDeviceId).toHaveBeenCalledWith('device-1')
    expect(deviceDao.delete).toHaveBeenCalledWith('device-1')
  })
})
