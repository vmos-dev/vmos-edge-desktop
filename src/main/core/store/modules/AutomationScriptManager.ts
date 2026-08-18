import { BaseManager } from './BaseManager'
import { logger } from '../../logger'
import { AutomationScriptDao } from '../../dao/AutomationScriptDao'
import { v4 as uuidv4 } from 'uuid'
import type { WorkflowScript } from '@shared/ipc/agent.types'
import type { AutomationScriptRecord } from '@shared/ipc/automationScript.types'

/**
 * 自动化脚本管理器
 * 提供脚本的存储、读取、更新和删除功能
 */
export class AutomationScriptManager extends BaseManager {
  private scriptDao: AutomationScriptDao

  constructor() {
    super()
    this.scriptDao = new AutomationScriptDao(this.dbInstance)
  }

  /**
   * 获取所有脚本
   */
  public getScripts(): AutomationScriptRecord[] {
    logger.debug('[AutomationScriptManager] getScripts called')
    try {
      return this.scriptDao.getAllOrderByUpdateTime()
    } catch (error) {
      logger.error('[AutomationScriptManager] getScripts failed:', error)
      throw error
    }
  }

  /**
   * 保存脚本
   */
  public saveScript(data: {
    id?: string
    name: string
    description?: string
    workflow: WorkflowScript
  }): string {
    const startTime = Date.now()
    logger.info(`[AutomationScriptManager] saveScript called:`, { id: data.id, name: data.name })

    try {
      const id = data.id || uuidv4()
      const isUpdate = !!data.id && this.scriptDao.exists(data.id)
      const now = Date.now()

      const record: AutomationScriptRecord = {
        id,
        name: data.name,
        description: data.description,
        content: JSON.stringify(data.workflow),
        createTime: isUpdate ? this.scriptDao.getById(id)?.createTime || now : now,
        updateTime: now
      }

      this.scriptDao.insert(record)

      const duration = Date.now() - startTime
      logger.info(
        `[AutomationScriptManager] saveScript success: id=${id}, isUpdate=${isUpdate}, duration=${duration}ms`
      )
      return id
    } catch (error) {
      logger.error('[AutomationScriptManager] saveScript failed:', error)
      throw error
    }
  }

  /**
   * 删除脚本
   */
  public deleteScript(id: string): void {
    logger.info(`[AutomationScriptManager] deleteScript called: id=${id}`)
    try {
      const deleted = this.scriptDao.delete(id)
      if (!deleted) {
        throw new Error(`Script not found: id=${id}`)
      }
      logger.info(`[AutomationScriptManager] deleteScript success: id=${id}`)
    } catch (error) {
      logger.error('[AutomationScriptManager] deleteScript failed:', error)
      throw error
    }
  }

  /**
   * 根据 ID 获取脚本
   */
  public getScriptById(id: string): AutomationScriptRecord | undefined {
    try {
      return this.scriptDao.getById(id)
    } catch (error) {
      logger.error(`[AutomationScriptManager] getScriptById failed: id=${id}`, error)
      throw error
    }
  }
}
