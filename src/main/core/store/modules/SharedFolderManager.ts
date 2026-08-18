import fs from 'node:fs'
import { logger } from '../../logger'
import { CONFIG_KEYS } from '@shared/constant'
import type { SharedFolderStatus } from '@shared/ipc/sharedFolder.types'
import type { ConfigManager } from './ConfigManager'
import {
  WEBDAV_PROTOCOL,
  WEBDAV_PORT,
  WEBDAV_USERNAME,
  WEBDAV_PASSWORD
} from './shared-folder/constants'
import { createWebDavProvider, type WebDavProvider } from './shared-folder/providers'

const TAG = '[SharedFolder]'

interface SharedFolderManagerOptions {
  provider?: WebDavProvider
}

export class SharedFolderManager {
  private readonly configManager: Pick<ConfigManager, 'getValue' | 'setValue'>
  private readonly provider: WebDavProvider

  private running = false
  private currentDirectory = ''
  private lanAddress: string | undefined
  private accessUrl: string | undefined
  private lastError: string | undefined

  constructor(
    configManager: Pick<ConfigManager, 'getValue' | 'setValue'>,
    options: SharedFolderManagerOptions = {}
  ) {
    this.configManager = configManager
    this.provider = options.provider ?? createWebDavProvider()
    logger.info(`${TAG} Initialized`, { platform: process.platform })
  }

  public getStatus(): SharedFolderStatus {
    const directory = this.getConfiguredDirectory()

    return {
      protocol: WEBDAV_PROTOCOL,
      directory,
      enabled: this.isEnabled(),
      running: this.running,
      pathExists: this.directoryExists(directory),
      port: WEBDAV_PORT,
      username: WEBDAV_USERNAME,
      password: WEBDAV_PASSWORD,
      accessUrl: this.accessUrl,
      lanAddress: this.lanAddress,
      lastError: this.lastError
    }
  }

  public async restoreFromConfig(): Promise<void> {
    const directory = this.getConfiguredDirectory()
    const enabled = this.isEnabled()
    this.currentDirectory = directory

    logger.info(`${TAG} Restoring from config`, { directory, enabled })

    if (!enabled) {
      logger.info(`${TAG} Restore skipped: sharing is disabled`)
      return
    }

    if (!this.directoryExists(directory)) {
      this.lastError = 'Shared folder does not exist'
      this.configManager.setValue(CONFIG_KEYS.SHARED_FOLDER_ENABLED, '0')
      logger.warn(`${TAG} Restore skipped: directory missing, disabled sharing`, { directory })
      return
    }

    // WebDAV requires no admin privileges — auto-start on restore
    logger.info(`${TAG} Restore: auto-starting WebDAV server`, { directory })
    try {
      await this.startSharing(directory)
    } catch (error) {
      logger.error(`${TAG} Restore: auto-start failed`, {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  public async startSharing(directory?: string): Promise<SharedFolderStatus> {
    const nextDirectory = directory ?? this.getConfiguredDirectory()
    this.currentDirectory = nextDirectory

    logger.info(`${TAG} Start requested`, { directory: nextDirectory })

    if (!nextDirectory) {
      this.lastError = 'Shared folder is not configured'
      logger.error(`${TAG} Start failed: no directory configured`)
      throw new Error(this.lastError)
    }

    if (!this.directoryExists(nextDirectory)) {
      this.lastError = 'Shared folder does not exist'
      logger.error(`${TAG} Start failed: directory does not exist`, { directory: nextDirectory })
      throw new Error(this.lastError)
    }

    if (this.running) {
      logger.info(`${TAG} Stopping existing server before restart`)
      await this.stopSharing({ persistEnabled: false })
    }

    try {
      await this.provider.validate()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      logger.error(`${TAG} Provider validation failed`, { error: this.lastError })
      throw error
    }

    logger.info(`${TAG} Starting WebDAV server`, { directory: nextDirectory })
    let result: { lanAddress?: string; accessUrl?: string }
    try {
      result = await this.provider.start(nextDirectory)
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      logger.error(`${TAG} Provider start failed`, { error: this.lastError })
      throw error
    }

    this.running = true
    this.lanAddress = result.lanAddress
    this.accessUrl = result.accessUrl
    this.lastError = undefined
    this.configManager.setValue(CONFIG_KEYS.SHARED_FOLDER_PATH, nextDirectory)
    this.configManager.setValue(CONFIG_KEYS.SHARED_FOLDER_ENABLED, '1')

    logger.info(`${TAG} WebDAV server started`, {
      directory: nextDirectory,
      lanAddress: this.lanAddress,
      accessUrl: this.accessUrl
    })

    return this.getStatus()
  }

  public async stopSharing(
    options: { persistEnabled?: boolean } = {}
  ): Promise<SharedFolderStatus> {
    const { persistEnabled = true } = options

    logger.info(`${TAG} Stop requested`, { running: this.running, persistEnabled })

    if (this.running) {
      logger.info(`${TAG} Stopping WebDAV server`)
      try {
        await this.provider.stop()
        logger.info(`${TAG} Provider stop completed`)
      } catch (error) {
        logger.warn(`${TAG} Provider stop failed (best-effort)`, {
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    this.running = false
    this.lanAddress = undefined
    this.accessUrl = undefined

    if (persistEnabled) {
      this.configManager.setValue(CONFIG_KEYS.SHARED_FOLDER_ENABLED, '0')
    }

    logger.info(`${TAG} WebDAV server stopped`, {
      persistEnabled,
      directory: this.getConfiguredDirectory()
    })

    return this.getStatus()
  }

  private getConfiguredDirectory(): string {
    return (
      this.configManager.getValue(CONFIG_KEYS.SHARED_FOLDER_PATH) ?? this.currentDirectory ?? ''
    )
  }

  private isEnabled(): boolean {
    return (this.configManager.getValue(CONFIG_KEYS.SHARED_FOLDER_ENABLED) ?? '0') === '1'
  }

  private directoryExists(directory: string): boolean {
    if (!directory) return false
    try {
      return fs.existsSync(directory) && fs.statSync(directory).isDirectory()
    } catch {
      return false
    }
  }
}
