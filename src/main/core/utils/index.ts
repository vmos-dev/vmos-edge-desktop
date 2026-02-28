import checkDiskSpaceModule from 'check-disk-space'
import { logger } from '../logger'

// 兼容 ESM/CJS 导入差异 (构建后可能是 { default: fn } 或直接是 fn)
const checkDiskSpace =
  typeof checkDiskSpaceModule === 'function'
    ? checkDiskSpaceModule
    : (checkDiskSpaceModule as any).default

/**
 * 获取指定目录所在磁盘的剩余空间 (字节)
 * 使用 check-disk-space 库，跨平台支持 Windows/macOS/Linux
 */
export const getFreeDiskSpace = async (directory: string): Promise<number> => {
  try {
    const { free } = await checkDiskSpace(directory)
    return free
  } catch (error) {
    logger.warn(`[getFreeDiskSpace] Failed to get disk space for "${directory}":`, error)
    return Number.MAX_SAFE_INTEGER // 失败时假设空间充足，避免阻塞业务
  }
}

/**
 * 获取指定目录所在磁盘的完整信息
 */
export const getDiskInfo = async (
  directory: string
): Promise<{
  diskPath: string
  free: number
  size: number
  used: number
} | null> => {
  try {
    const { diskPath, free, size } = await checkDiskSpace(directory)
    return {
      diskPath,
      free,
      size,
      used: size - free
    }
  } catch (error) {
    logger.warn(`[getDiskInfo] Failed to get disk info for "${directory}":`, error)
    return null
  }
}

export { TaskQueue } from './TaskQueue'
export { ZstdDecompressStream } from './ZstdDecompressStream'
export {
  ProxyCheckStrategyFactory,
  type IProxyCheckStrategy,
  type ProxyCheckResult,
  type ProxyInfo
} from './ProxyCheckStrategy'
