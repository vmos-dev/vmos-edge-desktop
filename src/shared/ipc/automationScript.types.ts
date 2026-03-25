/**
 * 自动化脚本 IPC 事件类型定义
 */

export const AUTOMATION_SCRIPT_EVENTS = {
  /** 获取所有脚本 */
  GET_SCRIPTS: 'automationScript:getScripts',
  /** 根据 ID 获取脚本 */
  GET_SCRIPT_BY_ID: 'automationScript:getScriptById',
  /** 保存脚本 */
  SAVE_SCRIPT: 'automationScript:saveScript',
  /** 删除脚本 */
  DELETE_SCRIPT: 'automationScript:deleteScript'
} as const

export interface AutomationScriptRecord {
  id: string
  name: string
  description?: string
  content: string // JSON string of WorkflowScript
  createTime: number
  updateTime: number
}
