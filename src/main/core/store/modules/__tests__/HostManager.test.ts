import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Host } from '@shared/ipc/data.types'

vi.mock('../BaseManager', () => ({
  BaseManager: class BaseManager {
    protected dbInstance = {
      transaction<T>(callback: () => T): T {
        return callback()
      }
    }
  }
}))

const { HostManager } = await import('../HostManager')

function createHost(overrides: Partial<Host>): Host {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    groupId: overrides.groupId ?? 'default',
    name: overrides.name ?? 'host',
    ip: overrides.ip ?? '127.0.0.1',
    status: overrides.status ?? 'offline',
    lastActiveTime: overrides.lastActiveTime ?? Date.now()
  }
}

class FakeHostDao {
  private readonly records = new Map<string, Host>()

  add(host: Host): void {
    this.records.set(host.id, host)
  }

  getById(id: string): Host | undefined {
    return this.records.get(id)
  }

  getByIp(ip: string): Host | undefined {
    return Array.from(this.records.values()).find((host) => host.ip === ip)
  }

  delete(id: string): boolean {
    return this.records.delete(id)
  }

  has(id: string): boolean {
    return this.records.has(id)
  }
}

class FakeDeviceManager {
  public deleteByHostIp = vi.fn(() => [])
}

describe('HostManager delete rules', () => {
  let hostDao: FakeHostDao
  let deviceManager: FakeDeviceManager
  let manager: InstanceType<typeof HostManager>
  let notifyFrontend: ReturnType<typeof vi.fn>

  beforeEach(() => {
    hostDao = new FakeHostDao()
    deviceManager = new FakeDeviceManager()
    notifyFrontend = vi.fn()

    manager = Object.create(HostManager.prototype) as InstanceType<typeof HostManager>
    ;(manager as unknown as { hostDao: FakeHostDao }).hostDao = hostDao
    ;(manager as unknown as { deviceManager: FakeDeviceManager }).deviceManager = deviceManager
    ;(manager as unknown as {
      dbInstance: { transaction<T>(callback: () => T): T }
      notifyFrontend: ReturnType<typeof vi.fn>
    }).dbInstance = {
      transaction<T>(callback: () => T): T {
        return callback()
      }
    }
    ;(manager as unknown as { notifyFrontend: ReturnType<typeof vi.fn> }).notifyFrontend =
      notifyFrontend
  })

  test('deleteHost rejects online hosts', () => {
    const onlineHost = createHost({ id: 'online-host', ip: '10.0.0.1', status: 'online' })
    hostDao.add(onlineHost)

    expect(() => manager.deleteHost(onlineHost)).toThrow('Only offline hosts can be deleted')
    expect(hostDao.has('online-host')).toBe(true)
    expect(deviceManager.deleteByHostIp).not.toHaveBeenCalled()
  })

  test('deleteHosts only removes offline hosts and deletes their devices', () => {
    const offlineHost = createHost({ id: 'offline-host', ip: '10.0.0.2', status: 'offline' })
    const onlineHost = createHost({ id: 'online-host', ip: '10.0.0.3', status: 'online' })
    hostDao.add(offlineHost)
    hostDao.add(onlineHost)

    const deletedCount = (manager as any).deleteHosts([offlineHost, onlineHost])

    expect(deletedCount).toBe(1)
    expect(hostDao.has('offline-host')).toBe(false)
    expect(hostDao.has('online-host')).toBe(true)
    expect(deviceManager.deleteByHostIp).toHaveBeenCalledWith(offlineHost.ip, offlineHost.id)
    expect(deviceManager.deleteByHostIp).not.toHaveBeenCalledWith(onlineHost.ip, onlineHost.id)
  })
})
