import { handle, on } from '../IpcBus'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { isAxiosError } from '@shared/api/request'
import { logger } from '../../logger'
import { OpenDialogOptions, shell } from 'electron'
import { dialog } from 'electron'
import { formatTime } from '@shared/api'
import path from 'path'
import fs from 'fs'
import * as tar from 'tar'

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

export function registerSharedHandlers() {
  on<string>(SHARED_EVENTS.OPEN_BROWSER_WINDOW, (url) => {
    try {
      logger.info(`[SharedHandler] OPEN_BROWSER_WINDOW request: url=${url}`)
      shell.openExternal(url)
    } catch (error) {}
  })

  handle<OpenDialogOptions, string>(SHARED_EVENTS.SELECT_FILE, async (options) => {
    try {
      logger.info(`[SharedHandler] SELECT_FILE request: options=${options}`)
      const result = await dialog.showOpenDialog(options)
      return {
        success: true,
        data: result?.filePaths?.[0] ?? ''
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 导出当天日志
  handle<void, { success: boolean; message?: string }>(SHARED_EVENTS.EXPORT_TODAY_LOG, async () => {
    logger.info('[SharedHandler] EXPORT_TODAY_LOG request')
    try {
      const logFiles = logger.getTodayLogFiles()

      if (logFiles.length === 0) {
        logger.warn(`[SharedHandler] Today's log file not found`)
        return { success: false, message: '今日暂无日志文件' }
      }

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `vmos-edge-logs-${formatTime(Date.now(), 'yyyy-MM-dd HH_mm_ss')}.tar`,
        filters: [{ name: 'Tar Archive', extensions: ['tar'] }]
      })

      if (canceled || !filePath) {
        return { success: false }
      }

      // 将所有日志文件打包到 tar
      // 1. 准备文件列表 (tar 需要相对路径或 cwd)
      // 为了简单，我们直接将文件作为流添加，或者使用 tar.c
      // 由于文件可能分散（虽然目前都在 logsDir），我们使用 cwd = logsDir

      const logsDir = path.dirname(logFiles[0].path)
      const fileNames = logFiles.map((f) => path.basename(f.path))

      await tar.create(
        {
          gzip: false, // 不再压缩为 .tar.gz，因为部分日志已经是 .gz 了，或者用户希望快速打包
          file: filePath,
          cwd: logsDir
        },
        fileNames
      )

      logger.info(`[SharedHandler] Logs exported to: ${filePath}`)
      return { success: true }
    } catch (error) {
      logger.error('[SharedHandler] Failed to export log:', error)
      return { success: false, message: error instanceof Error ? error.message : '导出失败' }
    }
  })

  on<string>(SHARED_EVENTS.OPEN_FOLDER, (path) => {
    try {
      logger.info(`[SharedHandler] OPEN_FOLDER request: path=${path}`)
      //判断path是否存在
      if (!fs.existsSync(path)) {
        logger.error(`[SharedHandler] OPEN_FOLDER request: path=${path} not exists`)
        throw new Error('Folder does not exist')
      }
      shell.openPath(path)
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 渲染进程日志上报
  on<any>(SHARED_EVENTS.RENDERER_LOG, (payload) => {
    try {
      const { level, message, ...meta } = payload
      // 确保使用有效的日志级别，默认为 info
      const validLevels = ['debug', 'info', 'warn', 'error']
      const logLevel = validLevels.includes(level) ? level : 'info'

      // 添加 Renderer 标识
      const logMessage = `[Renderer] ${message}`

      // 调用对应的日志方法
      ;(logger as any)[logLevel](logMessage, meta)
    } catch (error) {
      // 防止死循环，仅在控制台输出
      logger.error('Failed to process renderer log:', error)
    }
  })

  logger.info('[SharedHandler] ✅ 共享处理器已注册')
}
