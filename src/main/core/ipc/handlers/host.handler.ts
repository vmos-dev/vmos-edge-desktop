/**
 * 主机相关的 IPC 处理器
 */
import { handle, on, sendToMain } from '../IpcBus'
import { DATA_EVENTS, type Host, type Device } from '@shared/ipc/data.types'
import { hostManager, udpScanner } from '../../store/managers'
import { logger } from '../../logger'
import { isAxiosError } from '@shared/api/request'
import dns from 'dns'
import { promisify } from 'util'
import ipLib from 'ip'

const resolve4 = promisify(dns.resolve4)

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
      await hostManager.openApiDetail(device)
      const duration = Date.now() - startTime
      logger.info(
        `[HostHandler] HOST_OPEN_API_DETAIL success: deviceId=${device?.id}, duration=${duration}ms`
      )
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 根据 IP 或 ID 模糊匹配 + 状态过滤 + 分组过滤
  handle<{ keyword: string; status: string; groupId: string }, Host[]>(
    DATA_EVENTS.SEARCH_HOSTS_BY_IDENTIFIER_AND_STATUS_WITH_DEVICE_COUNT,
    async ({ keyword, status, groupId }) => {
      const startTime = Date.now()
      try {
        logger.info(
          `[HostHandler] SEARCH_HOSTS_BY_IDENTIFIER_AND_STATUS_WITH_DEVICE_COUNT request: keyword=${keyword}, status=${status}, groupId=${groupId}`
        )

        const hosts = hostManager.searchHostsByIdentifierAndStatusWithDeviceCount(
          keyword,
          status,
          groupId
        )
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
  // 清除本地主机下离线云机
  handle<Host, { deletedCount: number }>(DATA_EVENTS.CLEAR_HOST_OFFLINE_DEVICES, async (host) => {
    const startTime = Date.now()
    logger.info(
      `[HostHandler] CLEAR_HOST_OFFLINE_DEVICES request: id=${host.id}, ip=${host.ip}, status=${host.status}`
    )
    try {
      const deletedDevices = hostManager.clearHostOfflineDevices(host)
      const duration = Date.now() - startTime
      logger.info(
        `[HostHandler] CLEAR_HOST_OFFLINE_DEVICES success: id=${host.id}, deleted=${deletedDevices.length}, duration=${duration}ms`
      )
      return { success: true, data: { deletedCount: deletedDevices.length } }
    } catch (error) {
      return handleError(error)
    }
  })

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

  handle<Host[], number>(DATA_EVENTS.DELETE_HOSTS, async (hosts) => {
    const startTime = Date.now()
    logger.info(
      `[HostHandler] DELETE_HOSTS request: count=${hosts.length}, hostIds=${hosts.map((host) => host.id).join(',')}`
    )
    try {
      const deletedCount = hostManager.deleteHosts(hosts)
      const duration = Date.now() - startTime
      logger.info(
        `[HostHandler] DELETE_HOSTS success: requested=${hosts.length}, deleted=${deletedCount}, duration=${duration}ms`
      )
      return { success: true, data: deletedCount }
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

  // 解析域名返回 IP
  handle<string, string>(DATA_EVENTS.RESOLVE_DOMAIN, async (domain) => {
    const startTime = Date.now()
    logger.info(`[HostHandler] RESOLVE_DOMAIN request: domain=${domain}`)
    try {
      // 如果已经是 IP，直接返回
      if (ipLib.isV4Format(domain) || ipLib.isV6Format(domain)) {
        return { success: true, data: domain }
      }

      // 处理 localhost
      if (domain.toLowerCase() === 'localhost') {
        return { success: true, data: '127.0.0.1' }
      }

      const addresses = await resolve4(domain)
      if (!addresses || addresses.length === 0) {
        throw new Error(`无法解析域名: ${domain}`)
      }

      const ip = addresses[0]
      const duration = Date.now() - startTime
      logger.info(
        `[HostHandler] RESOLVE_DOMAIN success: domain=${domain}, ip=${ip}, duration=${duration}ms`
      )
      return { success: true, data: ip }
    } catch (error) {
      logger.error(`[HostHandler] RESOLVE_DOMAIN failed: domain=${domain}`, error)
      return handleError(error)
    }
  })

  // 开始扫描
  handle<void, void>(DATA_EVENTS.START_HOST_SCAN, async () => {
    logger.info('[HostHandler] START_HOST_SCAN request received')

    try {
      // 异步扫描，不阻塞 invoke 返回
      // 不过滤已入库主机，重复添加时通过 id 做 upsert 更新
      udpScanner
        .discoverUdpDevices((device) => {
          try {
            sendToMain(DATA_EVENTS.HOST_SCAN_FOUND, device)
          } catch (err) {
            logger.error('[HostHandler] Error sending scan found event:', err)
          }
        })
        .then(() => {
          sendToMain(DATA_EVENTS.HOST_SCAN_COMPLETE)
          logger.info('[HostHandler] HOST_SCAN_COMPLETE sent')
        })
        .catch((err) => {
          logger.error('[HostHandler] Scan error:', err)
          sendToMain(DATA_EVENTS.HOST_SCAN_COMPLETE)
        })
    } catch (err) {
      logger.error('[HostHandler] START_HOST_SCAN failed:', err)
      sendToMain(DATA_EVENTS.HOST_SCAN_COMPLETE)
      return handleError(err)
    }

    return { success: true }
  })

  // 取消扫描
  on<void>(DATA_EVENTS.CANCEL_HOST_SCAN, () => {
    try {
      logger.info('[HostHandler] CANCEL_HOST_SCAN received')
      udpScanner.cancel()
    } catch (err) {
      logger.error('[HostHandler] CANCEL_HOST_SCAN failed:', err)
    }
  })

  logger.info('[HostHandler] ✅ 主机处理器已注册')
}
