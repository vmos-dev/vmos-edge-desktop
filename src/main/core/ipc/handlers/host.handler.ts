/**
 * 主机相关的 IPC 处理器
 */
import { handle } from '../IpcBus'
import { DATA_EVENTS, type Host, type Device } from '@shared/ipc/data.types'
import { hostManager } from '../../store/managers'
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

export function registerHostHandlers() {
  // 获取主机和关联的分组信息
  handle<void, Host[]>(DATA_EVENTS.GET_HOSTS, async () => {
    const startTime = Date.now()
    logger.debug('[HostHandler] GET_HOSTS request received')
    try {
      const hosts = hostManager.getHostsWithGroup()
      const duration = Date.now() - startTime
      logger.info(`[HostHandler] GET_HOSTS success: count=${hosts.length}, duration=${duration}ms`)
      return {
        success: true,
        data: hosts
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 添加主机
  handle<{ groupId: string; hosts: { ip: string; id: string }[] }, void>(
    DATA_EVENTS.ADD_HOST,
    async ({ groupId, hosts }) => {
      const startTime = Date.now()
      logger.info(
        `[HostHandler] ADD_HOST request: groupId=${groupId}, hosts=${hosts.map((h) => `${h.ip}:${h.id}`).join(',')}, count=${hosts.length}`
      )
      try {
        const hostsToAdd = hosts.map((h) => ({
          ip: h.ip,
          id: h.id,
          groupId,
          name: h.ip
        }))

        const addedHosts = hostManager.addHosts(hostsToAdd)
        const duration = Date.now() - startTime
        logger.info(
          `[HostHandler] ADD_HOST success: added=${addedHosts.length}, skipped=${hosts.length - addedHosts.length}, duration=${duration}ms`
        )
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 更新主机信息
  handle<{ id: string; updates: Partial<Host> }, void>(
    DATA_EVENTS.UPDATE_HOST,
    async ({ id, updates }) => {
      const startTime = Date.now()
      logger.info(`[HostHandler] UPDATE_HOST request: id=${id}`, updates)
      try {
        hostManager.updateHost(id, updates)
        const duration = Date.now() - startTime
        logger.info(`[HostHandler] UPDATE_HOST success: id=${id}, duration=${duration}ms`)
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 移动主机到分组
  handle<{ hostId: string; groupId: string }, void>(
    DATA_EVENTS.MOVE_HOST,
    async ({ hostId, groupId }) => {
      const startTime = Date.now()
      logger.info(`[HostHandler] MOVE_HOST request: hostId=${hostId}, groupId=${groupId}`)
      try {
        hostManager.updateHost(hostId, { groupId })
        const duration = Date.now() - startTime
        logger.info(
          `[HostHandler] MOVE_HOST success: hostId=${hostId}, groupId=${groupId}, duration=${duration}ms`
        )
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 批量移动主机到分组
  handle<{ hostIds: string[]; groupId: string }, void>(
    DATA_EVENTS.MOVE_HOSTS,
    async ({ hostIds, groupId }) => {
      const startTime = Date.now()
      logger.info(
        `[HostHandler] MOVE_HOSTS request: hostIds=${hostIds.join(',')}, count=${hostIds.length}, groupId=${groupId}`
      )
      try {
        hostManager.moveHosts(hostIds, groupId)
        const duration = Date.now() - startTime
        logger.info(
          `[HostHandler] MOVE_HOSTS success: count=${hostIds.length}, groupId=${groupId}, duration=${duration}ms`
        )
        return { success: true }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 打开api 详情
  handle<Device[], void>(DATA_EVENTS.HOST_OPEN_API_DETAIL, async (devices: Device[]) => {
    const startTime = Date.now()
    const device = devices[0]
    logger.info(
      `[HostHandler] HOST_OPEN_API_DETAIL request: deviceId=${device?.id}, hostIp=${device?.host_ip}`
    )
    try {
      hostManager.openApiDetail(device)
      const duration = Date.now() - startTime
      logger.info(
        `[HostHandler] HOST_OPEN_API_DETAIL success: deviceId=${device?.id}, duration=${duration}ms`
      )
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 根据 IP 或 ID 模糊匹配 + 状态过滤
  handle<{ keyword: string; status: string }, Host[]>(
    DATA_EVENTS.SEARCH_HOSTS_BY_IDENTIFIER_AND_STATUS_WITH_DEVICE_COUNT,
    async ({ keyword, status }) => {
      const startTime = Date.now()
      try {
        logger.info(
          `[HostHandler] SEARCH_HOSTS_BY_IDENTIFIER_AND_STATUS_WITH_DEVICE_COUNT request: keyword=${keyword}, status=${status}`
        )

        const hosts = hostManager.searchHostsByIdentifierAndStatusWithDeviceCount(keyword, status)
        const duration = Date.now() - startTime
        logger.info(
          `[HostHandler] SEARCH_HOSTS_BY_IDENTIFIER_AND_STATUS_WITH_DEVICE_COUNT success: count=${hosts.length}, duration=${duration}ms`
        )
        return { success: true, data: hosts }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 重启主机
  handle<Host, void>(DATA_EVENTS.RESTART_HOST, async (host) => {
    const startTime = Date.now()
    logger.info(`[HostHandler] RESTART_HOST request: id=${host.id}, ip=${host.ip}`)
    try {
      await hostManager.restartHost(host)
      const duration = Date.now() - startTime
      logger.info(`[HostHandler] RESTART_HOST success: id=${host.id}, duration=${duration}ms`)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 重置主机
  handle<Host, void>(DATA_EVENTS.RESET_HOST, async (host) => {
    const startTime = Date.now()
    logger.info(`[HostHandler] RESET_HOST request: id=${host.id}, ip=${host.ip}`)
    try {
      await hostManager.resetHost(host)
      const duration = Date.now() - startTime
      logger.info(`[HostHandler] RESET_HOST success: id=${host.id}, duration=${duration}ms`)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 清理镜像
  handle<Host, void>(DATA_EVENTS.CLEAN_HOST_IMAGE, async (host) => {
    const startTime = Date.now()
    logger.info(`[HostHandler] CLEAN_HOST_IMAGE request: id=${host.id}, ip=${host.ip}`)
    try {
      await hostManager.cleanHostImage(host)
      const duration = Date.now() - startTime
      logger.info(`[HostHandler] CLEAN_HOST_IMAGE success: id=${host.id}, duration=${duration}ms`)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 删除主机
  handle<Host, void>(DATA_EVENTS.HOST_DELETED, async (host) => {
    const startTime = Date.now()
    logger.info(`[HostHandler] HOST_DELETED request: id=${host.id}, ip=${host.ip}`)
    try {
      hostManager.deleteHost(host)
      const duration = Date.now() - startTime
      logger.info(
        `[HostHandler] HOST_DELETED success: id=${host.id}, ip=${host.ip}, duration=${duration}ms`
      )
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 根据ip 查询主机信息
  handle<string, Host>(DATA_EVENTS.GET_HOST_BY_IP, async (ip) => {
    const startTime = Date.now()
    logger.info(`[HostHandler] GET_HOST_BY_IP request: ip=${ip}`)
    try {
      const host = hostManager.getHostByIp(ip)
      const duration = Date.now() - startTime
      logger.info(`[HostHandler] GET_HOST_BY_IP success: ip=${ip}, duration=${duration}ms`)
      return { success: true, data: host }
    } catch (error) {
      logger.error('[HostHandler] GET_HOST_BY_IP failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        ip
      })
      return handleError(error)
    }
  })

  logger.info('[HostHandler] ✅ 主机处理器已注册')
}
