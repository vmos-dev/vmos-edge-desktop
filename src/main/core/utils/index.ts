import os from 'os'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from '../logger'

const execAsync = promisify(exec)

export const getFreeDiskSpace = async (directory: string): Promise<number> => {
  const platform = os.platform()
  let command: string

  try {
    if (platform === 'win32') {
      const driveRoot = path.parse(directory).root
      const driveLetter = driveRoot.replace(/[\\/:]/g, '').toUpperCase()
      if (!driveLetter) throw new Error(`Cannot parse drive letter: ${directory}`)
      command = `powershell -Command "(Get-PSDrive -Name '${driveLetter}').Free"`
    } else {
      // Mac/Linux
      command = `df -k "${directory}" | tail -1 | awk '{print $4}'`
    }

    const { stdout } = await execAsync(command, { encoding: 'utf8', timeout: 5000 })

    if (platform === 'win32') {
      // PowerShell 返回字节
      return parseInt(stdout.trim(), 10) || 0
    } else {
      // df 返回 KB
      return (parseInt(stdout.trim(), 10) || 0) * 1024
    }
  } catch (error) {
    logger.warn(`[getFreeDiskSpace] getFreeDiskSpace failed, assuming sufficient space:`, error)
    return Number.MAX_SAFE_INTEGER
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
