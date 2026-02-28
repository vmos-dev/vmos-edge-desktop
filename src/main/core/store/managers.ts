/**
 * Manager singleton registry.
 */
import { GroupManager } from './modules/GroupManager'
import { HostManager } from './modules/HostManager'
import { DeviceManager } from './modules/DeviceManager'
import { ConfigManager } from './modules/ConfigManager'
import { ImageManager } from './modules/ImageManager'
import { AdiManager } from './modules/AdiManager'
import { ProxyManager } from './modules/ProxyManager'
import { GroupControlManager } from './modules/GroupControlManager'
import { MediaMtxManager } from './modules/MediaMtxManager'
import { logger } from '../logger'

export type { Group, Host, Device, FlatData } from '@shared/ipc/data.types'

class Managers {
  private static instance: Managers

  public readonly deviceManager: DeviceManager
  public readonly hostManager: HostManager
  public readonly groupManager: GroupManager
  public readonly configManager: ConfigManager
  public readonly imageManager: ImageManager
  public readonly adiManager: AdiManager
  public readonly proxyManager: ProxyManager
  public readonly groupControlManager: GroupControlManager
  public readonly mediaMtxManager: MediaMtxManager

  private constructor() {
    logger.info('[Managers] Initializing managers...')
    this.configManager = new ConfigManager()
    this.adiManager = new AdiManager()
    this.proxyManager = new ProxyManager()
    this.mediaMtxManager = new MediaMtxManager()
    this.deviceManager = new DeviceManager(this.configManager)
    this.hostManager = new HostManager(this.deviceManager)
    this.groupManager = new GroupManager(this.hostManager, this.deviceManager)
    this.imageManager = new ImageManager(this.configManager)
    this.groupControlManager = new GroupControlManager()
  }

  public static getInstance(): Managers {
    if (!Managers.instance) {
      Managers.instance = new Managers()
    }
    return Managers.instance
  }
}

export const managers = Managers.getInstance()

export const deviceManager = managers.deviceManager
export const hostManager = managers.hostManager
export const groupManager = managers.groupManager
export const configManager = managers.configManager
export const imageManager = managers.imageManager
export const adiManager = managers.adiManager
export const proxyManager = managers.proxyManager
export const groupControlManager = managers.groupControlManager
export const mediaMtxManager = managers.mediaMtxManager
