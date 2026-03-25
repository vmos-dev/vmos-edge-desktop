import { handle, on } from '../IpcBus'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { isAxiosError } from '@shared/api/request'
import { logger } from '../../logger'
import { OpenDialogOptions, shell } from 'electron'
import { dialog } from 'electron'
import { formatTime } from '@shared/api'
import path from 'path'
import fs from 'fs'
import os from 'os'
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
      shell.openExternal(url).catch((err) => {
        logger.error(`[SharedHandler] Failed to open browser window: ${url}`, err)
      })
    } catch (error) {
      logger.error(`[SharedHandler] OPEN_BROWSER_WINDOW failed: ${url}`, error)
    }
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
  handle<void, { filePath: string }>(SHARED_EVENTS.EXPORT_TODAY_LOG, async () => {
    logger.info('[SharedHandler] EXPORT_TODAY_LOG request')
    let tempDir = ''
    try {
      const logFiles = logger.getTodayLogFiles()

      if (logFiles.length === 0) {
        logger.warn(`[SharedHandler] Today's log file not found`)
        return { success: false, error: '今日暂无日志文件' }
      }

      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `vmos-edge-logs-${formatTime(Date.now(), 'yyyy-MM-dd HH_mm_ss')}.tar`,
        filters: [{ name: 'Tar Archive', extensions: ['tar'] }]
      })

      if (canceled || !filePath) {
        return { success: false, error: '已取消导出' }
      }

      // 先复制到临时目录做快照，再打包，避免日志正在写入时造成归档不稳定
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vmos-edge-log-export-'))
      const fileNames: string[] = []
      const usedNames = new Set<string>()

      for (const logFile of logFiles) {
        const srcPath = logFile.path
        const ext = path.extname(srcPath)
        const stem = path.basename(srcPath, ext)
        let targetName = `${stem}${ext}`
        let seq = 1
        while (usedNames.has(targetName)) {
          targetName = `${stem}-${seq}${ext}`
          seq++
        }
        usedNames.add(targetName)
        fs.copyFileSync(srcPath, path.join(tempDir, targetName))
        fileNames.push(targetName)
      }

      await tar.create(
        {
          // 生成更通用的 tar 头，提升 macOS 归档工具兼容性
          gzip: false,
          portable: true,
          noPax: true,
          file: filePath,
          cwd: tempDir
        },
        fileNames
      )

      logger.info(`[SharedHandler] Logs exported to: ${filePath}`)
      return { success: true, data: { filePath } }
    } catch (error) {
      logger.error('[SharedHandler] Failed to export log:', error)
      return { success: false, error: error instanceof Error ? error.message : '导出失败' }
    } finally {
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true })
        } catch (cleanupError) {
          logger.warn('[SharedHandler] Failed to cleanup temp export dir:', cleanupError)
        }
      }
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
      shell.openPath(path).then((errorMessage) => {
        if (errorMessage) {
          logger.error(`[SharedHandler] Failed to open path: ${path}`, errorMessage)
        }
      })
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
