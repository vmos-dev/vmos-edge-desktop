import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

/**
 * 日志管理器
 */
class Logger {
  private logger: winston.Logger
  private logsDir: string
  private static instance: Logger | null = null

  private formatLogLine(
    appVersion: string,
    timestamp: unknown,
    level: string,
    message: unknown,
    meta: Record<string, unknown>,
    options: { uppercaseLevel?: boolean } = {}
  ): string {
    const normalizedLevel = options.uppercaseLevel === false ? level : level.toUpperCase()
    const metaStr = Object.keys(meta).length ? ` ${this.safeSerialize(meta)}` : ''
    return `[v${appVersion}] [${String(timestamp ?? '')}] [${normalizedLevel}] ${String(message)}${metaStr}`
  }

  private safeSerialize(value: unknown): string {
    const seen = new WeakSet<object>()

    try {
      return JSON.stringify(value, (_key, currentValue) => {
        if (currentValue instanceof Error) {
          return this.serializeError(currentValue)
        }

        if (typeof currentValue === 'bigint') {
          return currentValue.toString()
        }

        if (typeof currentValue === 'function') {
          return `[Function ${currentValue.name || 'anonymous'}]`
        }

        if (typeof currentValue === 'object' && currentValue !== null) {
          if (seen.has(currentValue)) {
            return '[Circular]'
          }
          seen.add(currentValue)
        }

        return currentValue
      })
    } catch (error) {
      return JSON.stringify({
        serializationError: this.getReadableErrorMessage(error)
      })
    }
  }

  private serializeError(error: Error): Record<string, unknown> {
    const serialized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
    const errorRecord = error as unknown as Record<string, unknown>

    const keys = new Set([
      ...Object.getOwnPropertyNames(error),
      ...Object.keys(errorRecord)
    ])

    for (const key of keys) {
      if (key === 'name' || key === 'message' || key === 'stack') {
        continue
      }

      try {
        serialized[key] = errorRecord[key]
      } catch (readError) {
        serialized[key] = `[Property read failed: ${this.getReadableErrorMessage(readError)}]`
      }
    }

    return serialized
  }

  private getReadableErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`
    }
    return String(error)
  }

  private write(level: 'debug' | 'info' | 'warn' | 'error', message: string, args: any[]): void {
    try {
      if (args.length > 0) {
        this.logger.log(level, message, ...args)
      } else {
        this.logger.log(level, message)
      }
    } catch (error) {
      // 日志系统本身不能再把主进程带崩，退化到控制台输出。
      console.error(`[Logger] Failed to write ${level} log`, {
        error,
        message,
        args
      })
    }
  }

  private constructor() {
    this.logsDir = path.join(app.getPath('userData'), 'vmosedge', 'logs')

    // 确保日志目录存在
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }

    // 获取应用版本
    const appVersion = app.getVersion()

    // 本地时间格式化函数 (YYYY-MM-DD HH:mm:ss)
    const getLocalTimeStr = () => {
      const now = new Date()
      const Y = now.getFullYear()
      const M = String(now.getMonth() + 1).padStart(2, '0')
      const D = String(now.getDate()).padStart(2, '0')
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      const s = String(now.getSeconds()).padStart(2, '0')
      return `${Y}-${M}-${D} ${h}:${m}:${s}`
    }

    // 配置日志格式
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: getLocalTimeStr }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return this.formatLogLine(appVersion, timestamp, level, message, meta)
      })
    )

    // 配置按天轮转的文件传输
    const dailyRotateTransport = new DailyRotateFile({
      dirname: this.logsDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m', // 单个文件最大10MB
      maxFiles: '3d', // 保留3天的日志
      format: logFormat,
      zippedArchive: true, // 压缩旧日志文件
      auditFile: path.join(this.logsDir, '.audit.json') // 审计文件路径
    })

    // 创建 winston logger
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: logFormat,
      exitOnError: false,
      transports: [
        dailyRotateTransport,
        // 开发环境也输出到控制台
        ...(process.env.NODE_ENV === 'development'
          ? [
            new winston.transports.Console({
              format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                  return this.formatLogLine(appVersion, timestamp, level, message, meta, {
                    uppercaseLevel: false
                  })
                })
              )
            })
          ]
          : [])
      ],
      exceptionHandlers: [
        new DailyRotateFile({
          dirname: this.logsDir,
          filename: 'exceptions-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '3d'
        })
      ],
      rejectionHandlers: [
        new DailyRotateFile({
          dirname: this.logsDir,
          filename: 'rejections-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: '3d'
        })
      ]
    })

    // 启动时清理旧日志文件（超过3天）
    this.cleanupOldLogs()
  }

  /**
   * 清理超过3天的日志文件
   * 重要：在保留期内（3天）不会删除任何日志文件，确保日志完整性
   */
  private cleanupOldLogs(): void {
    try {
      // 再次确保存储目录存在，防止被误删
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true })
        return // 目录刚创建，肯定没有旧文件需要清理
      }

      const files = fs.readdirSync(this.logsDir)
      const now = Date.now()
      const retentionPeriod = 3 * 24 * 60 * 60 * 1000 // 3天的毫秒数
      let deletedCount = 0
      let totalSize = 0

      for (const file of files) {
        try {
          const filePath = path.join(this.logsDir, file)
          const stats = fs.statSync(filePath)

          // 只处理超过保留期的文件
          if (stats.mtimeMs >= now - retentionPeriod) {
            continue // 保留期内的文件不删除
          }

          // 匹配日志文件：app-YYYY-MM-DD.log, app-YYYY-MM-DD.log.N, app-YYYY-MM-DD.log.N.gz, app-YYYY-MM-DD.log.gz
          // 以及 exceptions-YYYY-MM-DD.log, rejections-YYYY-MM-DD.log 等
          const isLogFile =
            /^(app|exceptions|rejections)-\d{4}-\d{2}-\d{2}\.log(?:\.\d+)?(?:\.gz)?$/.test(file)

          // 匹配 audit.json 文件（保留最新的 .audit.json）
          const isAuditFile =
            file.startsWith('.') && file.endsWith('-audit.json') && file !== '.audit.json'

          if (isLogFile || isAuditFile) {
            totalSize += stats.size
            fs.unlinkSync(filePath)
            deletedCount++
            this.logger.debug(
              `Deleted old log file: ${file} (age: ${Math.round((now - stats.mtimeMs) / (24 * 60 * 60 * 1000))} days)`
            )
          }
        } catch (fileError) {
          // 单个文件处理失败不影响整体清理
          this.logger.warn(`Failed to process file ${file} during cleanup:`, fileError)
        }
      }

      if (deletedCount > 0) {
        const freedMB = (totalSize / (1024 * 1024)).toFixed(2)
        this.logger.info(
          `Log cleanup completed: deleted ${deletedCount} files, freed ${freedMB} MB`
        )
      }
    } catch (error) {
      // 清理失败不影响日志功能，使用 winston 的 error 方法记录
      this.logger.error('Failed to cleanup old logs:', error)
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * 记录 debug 级别日志
   */
  public debug(message: string, ...args: any[]): void {
    this.write('debug', message, args)
  }

  /**
   * 记录 info 级别日志
   */
  public info(message: string, ...args: any[]): void {
    this.write('info', message, args)
  }

  /**
   * 记录 warn 级别日志
   */
  public warn(message: string, ...args: any[]): void {
    this.write('warn', message, args)
  }

  /**
   * 记录 error 级别日志
   */
  public error(message: string, ...args: any[]): void {
    this.write('error', message, args)
  }

  /**
   * 获取今天的日志文件列表（包含轮转和压缩的文件）
   */
  public getTodayLogFiles(): { path: string; isGzipped: boolean }[] {
    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}` // e.g. 2023-10-27

      if (!fs.existsSync(this.logsDir)) return []

      const files = fs.readdirSync(this.logsDir)
      const logFiles: { path: string; isGzipped: boolean; mtime: number }[] = []

      // 匹配规则：app-2023-10-27.log 或 app-2023-10-27.log.1 或 app-2023-10-27.log.1.gz 或 app-2023-10-27.log.gz
      // 注意：winston-daily-rotate-file 的命名可能是 .log.N 或 .log.gz
      const pattern = new RegExp(`^app-${dateStr}\\.log(?:\\.\\d+)?(?:\\.gz)?$`)

      for (const file of files) {
        if (pattern.test(file)) {
          const filePath = path.join(this.logsDir, file)
          const stats = fs.statSync(filePath)
          logFiles.push({
            path: filePath,
            isGzipped: file.endsWith('.gz'),
            mtime: stats.mtimeMs // 用于排序
          })
        }
      }

      // 按时间排序（旧的在前，新的在后）
      // 注意：winston-daily-rotate-file 的轮转机制通常是 .log 是最新的，.1.log 是次新的
      // 但为了确保时间线正确，我们按修改时间排序即可
      return logFiles
        .sort((a, b) => a.mtime - b.mtime)
        .map(({ path, isGzipped }) => ({ path, isGzipped }))
    } catch (error) {
      this.logger.error('Failed to get today log files:', error)
      return []
    }
  }

  /**
   * 销毁日志实例
   */
  public destroy(): void {
    this.logger.close()
  }
}

// 导出单例实例
export const logger = Logger.getInstance()

// 导出类型
export type { Logger }
