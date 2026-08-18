import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { WebDavProvider } from '../shared-folder/providers'

const { SharedFolderManager } = await import('../SharedFolderManager')

class FakeConfigManager {
  private readonly values = new Map<string, string>()

  getValue(key: string): string | undefined {
    return this.values.get(key)
  }

  setValue(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function createFakeProvider(overrides?: Partial<WebDavProvider>): WebDavProvider {
  return {
    validate: vi.fn(async () => {}),
    start: vi.fn(async () => ({
      lanAddress: '192.168.1.10',
      accessUrl: 'http://192.168.1.10:8788'
    })),
    stop: vi.fn(async () => {}),
    ...overrides
  }
}

describe('SharedFolderManager', () => {
  let tempRoot: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-folder-manager-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  test('getStatus returns WebDAV-shaped status with protocol and port', () => {
    const configManager = new FakeConfigManager()
    const manager = new SharedFolderManager(configManager, { provider: createFakeProvider() })

    const status = manager.getStatus()
    expect(status).toMatchObject({
      protocol: 'webdav',
      port: 8788,
      username: 'vmosedge',
      password: 'vmosedge-damai',
      directory: '',
      enabled: false,
      running: false,
      pathExists: false
    })
    expect(status).not.toHaveProperty('shareName')
  })

  test('startSharing rejects when the selected directory does not exist', async () => {
    const provider = createFakeProvider()
    const configManager = new FakeConfigManager()
    const manager = new SharedFolderManager(configManager, { provider })
    const missingPath = path.join(tempRoot, 'missing')

    await expect(manager.startSharing(missingPath)).rejects.toThrow('Shared folder does not exist')

    expect(provider.start).not.toHaveBeenCalled()
    expect(configManager.getValue('shared.folder.path')).toBeUndefined()
    expect(configManager.getValue('shared.folder.enabled')).toBeUndefined()
    expect(manager.getStatus()).toMatchObject({
      directory: missingPath,
      enabled: false,
      running: false,
      pathExists: false
    })
  })

  test('startSharing calls provider and persists directory plus enabled state', async () => {
    const provider = createFakeProvider()
    const configManager = new FakeConfigManager()
    const manager = new SharedFolderManager(configManager, { provider })
    const sharedDirectory = path.join(tempRoot, 'shared')
    fs.mkdirSync(sharedDirectory, { recursive: true })

    await manager.startSharing(sharedDirectory)

    expect(provider.validate).toHaveBeenCalledTimes(1)
    expect(provider.start).toHaveBeenCalledWith(sharedDirectory)
    expect(configManager.getValue('shared.folder.path')).toBe(sharedDirectory)
    expect(configManager.getValue('shared.folder.enabled')).toBe('1')
    expect(manager.getStatus()).toMatchObject({
      protocol: 'webdav',
      port: 8788,
      directory: sharedDirectory,
      enabled: true,
      running: true,
      pathExists: true,
      lanAddress: '192.168.1.10',
      accessUrl: 'http://192.168.1.10:8788'
    })
  })

  test('stopSharing calls provider stop and persists disabled state by default', async () => {
    const provider = createFakeProvider()
    const configManager = new FakeConfigManager()
    const manager = new SharedFolderManager(configManager, { provider })
    const sharedDirectory = path.join(tempRoot, 'shared')
    fs.mkdirSync(sharedDirectory, { recursive: true })

    await manager.startSharing(sharedDirectory)
    await manager.stopSharing()

    expect(provider.stop).toHaveBeenCalledTimes(1)
    expect(configManager.getValue('shared.folder.enabled')).toBe('0')
    expect(manager.getStatus()).toMatchObject({
      directory: sharedDirectory,
      enabled: false,
      running: false,
      pathExists: true
    })
  })

  test('restoreFromConfig auto-starts sharing when directory is valid (no admin prompt needed)', async () => {
    const existingDirectory = path.join(tempRoot, 'existing')
    fs.mkdirSync(existingDirectory, { recursive: true })

    const provider = createFakeProvider()
    const configManager = new FakeConfigManager()
    configManager.setValue('shared.folder.path', existingDirectory)
    configManager.setValue('shared.folder.enabled', '1')

    const manager = new SharedFolderManager(configManager, { provider })
    await manager.restoreFromConfig()

    // WebDAV requires no admin privileges — should start automatically
    expect(provider.start).toHaveBeenCalledTimes(1)
    expect(manager.getStatus()).toMatchObject({
      directory: existingDirectory,
      enabled: true,
      running: true,
      pathExists: true
    })
  })

  test('restoreFromConfig clears enabled flag when directory is missing', async () => {
    const missingDirectory = path.join(tempRoot, 'missing')
    const provider = createFakeProvider()
    const configManager = new FakeConfigManager()
    configManager.setValue('shared.folder.path', missingDirectory)
    configManager.setValue('shared.folder.enabled', '1')

    const manager = new SharedFolderManager(configManager, { provider })
    await manager.restoreFromConfig()

    expect(provider.start).not.toHaveBeenCalled()
    expect(manager.getStatus()).toMatchObject({
      directory: missingDirectory,
      enabled: false,
      running: false,
      pathExists: false
    })
    expect(configManager.getValue('shared.folder.enabled')).toBe('0')
  })

  test('stopSharing can skip clearing the persisted enabled flag during app shutdown', async () => {
    const provider = createFakeProvider()
    const configManager = new FakeConfigManager()
    const manager = new SharedFolderManager(configManager, { provider })
    const sharedDirectory = path.join(tempRoot, 'shared')
    fs.mkdirSync(sharedDirectory, { recursive: true })

    await manager.startSharing(sharedDirectory)
    await manager.stopSharing({ persistEnabled: false })

    expect(configManager.getValue('shared.folder.enabled')).toBe('1')
    expect(manager.getStatus()).toMatchObject({
      directory: sharedDirectory,
      enabled: true,
      running: false,
      pathExists: true
    })
  })

  test('startSharing stops existing server before starting new one', async () => {
    const provider = createFakeProvider()
    const configManager = new FakeConfigManager()
    const manager = new SharedFolderManager(configManager, { provider })

    const dir1 = path.join(tempRoot, 'dir1')
    const dir2 = path.join(tempRoot, 'dir2')
    fs.mkdirSync(dir1, { recursive: true })
    fs.mkdirSync(dir2, { recursive: true })

    await manager.startSharing(dir1)
    await manager.startSharing(dir2)

    expect(provider.stop).toHaveBeenCalledTimes(1)
    expect(provider.start).toHaveBeenCalledTimes(2)
    expect(configManager.getValue('shared.folder.path')).toBe(dir2)
  })
})
