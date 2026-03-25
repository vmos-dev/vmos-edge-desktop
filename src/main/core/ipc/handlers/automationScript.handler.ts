import { handle } from '../IpcBus'
import { AUTOMATION_SCRIPT_EVENTS } from '@shared/ipc/automationScript.types'
import { logger } from '../../logger'
import { automationScriptManager } from '../../store/managers'
import type { AutomationScriptRecord } from '@shared/ipc/automationScript.types'
import type { WorkflowScript } from '@shared/ipc/agent.types'

/**
 * 处理错误，只返回错误信息
 */
function handleError(error: any): { success: false; error: string } {
  const errorMsg = error?.msg || error?.message || String(error)
  return {
    success: false,
    error: errorMsg
  }
}

export function registerAutomationScriptHandlers() {
  // 获取所有脚本
  handle<void, AutomationScriptRecord[]>(AUTOMATION_SCRIPT_EVENTS.GET_SCRIPTS, async () => {
    logger.debug('[AutomationScriptHandler] GET_SCRIPTS request')
    try {
      const scripts = automationScriptManager.getScripts()
      return {
        success: true,
        data: scripts
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 根据 ID 获取脚本
  handle<string, AutomationScriptRecord | undefined>(
    AUTOMATION_SCRIPT_EVENTS.GET_SCRIPT_BY_ID,
    async (id) => {
      logger.debug(`[AutomationScriptHandler] GET_SCRIPT_BY_ID request: id=${id}`)
      try {
        const script = automationScriptManager.getScriptById(id)
        return {
          success: true,
          data: script
        }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 保存脚本
  handle<
    {
      id?: string
      name: string
      description?: string
      workflow: WorkflowScript
    },
    string
  >(AUTOMATION_SCRIPT_EVENTS.SAVE_SCRIPT, async (data) => {
    logger.info('[AutomationScriptHandler] SAVE_SCRIPT request:', { id: data.id, name: data.name })
    try {
      const id = automationScriptManager.saveScript(data)
      return {
        success: true,
        data: id
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 删除脚本
  handle<string, void>(AUTOMATION_SCRIPT_EVENTS.DELETE_SCRIPT, async (id) => {
    logger.info(`[AutomationScriptHandler] DELETE_SCRIPT request: id=${id}`)
    try {
      automationScriptManager.deleteScript(id)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  logger.info('[AutomationScriptHandler] ✅ 自动化脚本处理器已注册')
}
