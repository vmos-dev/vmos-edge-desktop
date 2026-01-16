import { ConfigDao } from '../../dao/ConfigDao'
import { BaseManager } from './BaseManager'
import { logger } from '../../logger'

/**
 * 配置管理器
 * 提供配置项的存储和读取功能
 */
export class ConfigManager extends BaseManager {
  private configDao: ConfigDao

  constructor() {
    super()
    this.configDao = new ConfigDao(this.dbInstance)
  }

  /**
   * 获取配置值
   */
  public getValue(key: string): string | undefined {
    try {
      logger.debug(`[ConfigManager] getValue called: key=${key}`)
      return this.configDao.getValue(key)
    } catch (error) {
      logger.error(`[ConfigManager] getValue failed for key ${key}:`, error)
      throw error
    }
  }

  /**
   * 设置配置值
   */
  public setValue(key: string, value: string): void {
    try {
      logger.debug(`[ConfigManager] setValue called: key=${key}, value=${value}`)
      this.configDao.setValue(key, value)
    } catch (error) {
      logger.error(`[ConfigManager] setValue failed for key ${key}:`, error)
      throw error
    }
  }

  /**
   * 删除配置项
   */
  public deleteValue(key: string): void {
    try {
      logger.debug(`[ConfigManager] deleteValue called: key=${key}`)
      const deleted = this.configDao.deleteByKey(key)
      if (!deleted) {
        throw new Error(`Config not found: key=${key}`)
      }
    } catch (error) {
      logger.error(`[ConfigManager] deleteValue failed for key ${key}:`, error)
      throw error
    }
  }

  /**
   * 检查配置项是否存在
   */
  public hasKey(key: string): boolean {
    try {
      logger.debug(`[ConfigManager] hasKey called: key=${key}`)
      return this.configDao.hasKey(key)
    } catch (error) {
      logger.error(`[ConfigManager] hasKey failed for key ${key}:`, error)
      throw error
    }
  }

  /**
   * 批量获取配置值
   */
  public getValues(keys: string[]): Record<string, string | undefined> {
    try {
      logger.debug(`[ConfigManager] getValues called: keys=${keys.join(',')}`)
      return this.configDao.getValues(keys)
    } catch (error) {
      logger.error('[ConfigManager] getValues failed:', error)
      throw error
    }
  }

  /**
   * 批量设置配置值
   */
  public setValues(configs: Record<string, string>): void {
    try {
      logger.debug(`[ConfigManager] setValues called:`, configs)
      this.configDao.setValues(configs)
    } catch (error) {
      logger.error('[ConfigManager] setValues failed:', error)
      throw error
    }
  }

  /**
   * 获取所有配置项
   */
  public getAllConfigs(): Record<string, string> {
    try {
      logger.debug('[ConfigManager] getAllConfigs called')
      return this.configDao.getAllConfigs()
    } catch (error) {
      logger.error('[ConfigManager] getAllConfigs failed:', error)
      throw error
    }
  }

  /**
   * 初始化默认配置
   * 只设置不存在的配置项，不会覆盖已存在的配置
   * @param defaultConfigs 默认配置对象
   */
  public initDefaults(defaultConfigs: Record<string, string>): void {
    const startTime = Date.now()
    const configKeys = Object.keys(defaultConfigs)
    logger.info(
      `[ConfigManager] initDefaults called: count=${configKeys.length}, keys=${configKeys.join(',')}`
    )
    try {
      const configsToSet: Record<string, string> = {}

      // 检查每个默认配置，只添加不存在的
      for (const [key, value] of Object.entries(defaultConfigs)) {
        if (!this.configDao.hasKey(key)) {
          logger.debug(`[ConfigManager] initDefaults: adding new config key=${key}`)
          configsToSet[key] = value
        } else {
          logger.debug(`[ConfigManager] initDefaults: skipping existing config key=${key}`)
        }
      }

      // 批量设置不存在的配置项
      if (Object.keys(configsToSet).length > 0) {
        logger.info(
          `[ConfigManager] initDefaults: setting ${Object.keys(configsToSet).length} new configs`
        )
        this.configDao.setValues(configsToSet)
      } else {
        logger.info('[ConfigManager] initDefaults: all configs already exist, no changes needed')
      }

      const duration = Date.now() - startTime
      logger.info(
        `[ConfigManager] initDefaults success: total=${configKeys.length}, added=${Object.keys(configsToSet).length}, skipped=${configKeys.length - Object.keys(configsToSet).length}, duration=${duration}ms`
      )
    } catch (error) {
      logger.error('[ConfigManager] initDefaults failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: configKeys.length,
        keys: configKeys
      })
      throw error
    }
  }

  /**
   * 重置配置为默认值（会覆盖已存在的配置）
   * @param defaultConfigs 默认配置对象
   */
  public resetToDefaults(defaultConfigs: Record<string, string>): void {
    const startTime = Date.now()
    const configKeys = Object.keys(defaultConfigs)
    logger.info(
      `[ConfigManager] resetToDefaults called: count=${configKeys.length}, keys=${configKeys.join(',')}`
    )
    try {
      this.configDao.setValues(defaultConfigs)
      const duration = Date.now() - startTime
      logger.info(
        `[ConfigManager] resetToDefaults success: count=${configKeys.length}, duration=${duration}ms`
      )
    } catch (error) {
      logger.error('[ConfigManager] resetToDefaults failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: configKeys.length
      })
      throw error
    }
  }
}
