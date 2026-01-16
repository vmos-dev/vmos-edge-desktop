/**
 * 分组相关的 IPC 处理器
 */
import { handle } from '../IpcBus'
import { DATA_EVENTS, type Group } from '@shared/ipc/data.types'
import { groupManager } from '../../store/managers'
import { logger } from '../../logger'
import { isAxiosError } from '@shared/api/request'

/**
 * 处理错误，只返回错误信息，不打印日志（日志已在 manager 层打印）
 */
function handleError(error: any): { success: false; error: string } {
  let errorMsg: string

  if (isAxiosError(error)) {
    // axios 错误：优先从 response.data.msg 获取，其次从 response.data.message，最后从 error.message
    // 注意：拦截器可能 reject 的是 data 对象（有 msg 字段），所以也需要检查 error.msg
    errorMsg =
      error.response?.data?.msg ||
      error.response?.data?.message ||
      (error as any)?.msg ||
      error.message ||
      String(error)
  } else {
    // 非 axios 错误：优先从 error.msg，其次从 error.message
    errorMsg = error?.msg || error?.message || String(error)
  }

  return {
    success: false,
    error: errorMsg
  }
}

export function registerGroupHandlers() {
  // 获取所有分组
  handle<void, Group[]>(DATA_EVENTS.GET_GROUPS, async () => {
    const startTime = Date.now()
    logger.debug('[GroupHandler] GET_GROUPS request received')
    try {
      const groups = groupManager.getGroups()
      const duration = Date.now() - startTime
      logger.info(
        `[GroupHandler] GET_GROUPS success: count=${groups.length}, duration=${duration}ms`
      )
      return {
        success: true,
        data: groups
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 添加分组
  handle<{ name: string }, Group>(DATA_EVENTS.ADD_GROUP, async ({ name }) => {
    const startTime = Date.now()
    logger.info(`[GroupHandler] ADD_GROUP request: name=${name}`)
    try {
      const res = groupManager.addGroup(name)
      const duration = Date.now() - startTime
      logger.info(
        `[GroupHandler] ADD_GROUP success: id=${res.id}, name=${res.name}, duration=${duration}ms`
      )
      return { success: true, data: res }
    } catch (error) {
      return handleError(error)
    }
  })

  // 更新分组
  handle<Partial<Group>, void>(DATA_EVENTS.UPDATE_GROUP, async (params: Partial<Group>) => {
    const startTime = Date.now()
    logger.info(`[GroupHandler] UPDATE_GROUP request:`, params)
    try {
      groupManager.updateGroup(params)
      const duration = Date.now() - startTime
      logger.info(`[GroupHandler] UPDATE_GROUP success: id=${params.id}, duration=${duration}ms`)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 删除分组
  handle<string, void>(DATA_EVENTS.DELETE_GROUP, async (id) => {
    const startTime = Date.now()
    logger.info(`[GroupHandler] DELETE_GROUP request: id=${id}`)
    try {
      groupManager.deleteGroup(id)
      const duration = Date.now() - startTime
      logger.info(`[GroupHandler] DELETE_GROUP success: id=${id}, duration=${duration}ms`)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  logger.info('[GroupHandler] ✅ 分组处理器已注册')
}
