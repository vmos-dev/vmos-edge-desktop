import { BaseManager } from './BaseManager'
import { logger } from '../../logger'
import { Adi, ADI_EVENTS, CustomAdi } from '@shared/ipc/adi.types'
import { request } from '@shared/api/request'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'
import FormData from 'form-data'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import type { Host } from '@shared/ipc/data.types'
import yauzl from 'yauzl'
import { CustomAdiDao } from '../../dao/CustomAdiDao'

/**
 * 机型设置管理器
 * 提供机型设置的存储与读取功能
 */
export class AdiManager extends BaseManager {
  private customAdiDao: CustomAdiDao

  constructor() {
    super()
    this.customAdiDao = new CustomAdiDao(this.dbInstance)
  }

  /**
   * 获取 resources 下的资源路径
   * @example getResourcePath('adi', 'template.json')
   */
  private getResourcePath(...paths: string[]) {
    if (app.isPackaged) {
      // 生产环境：YourApp/resources/
      return path.join(process.resourcesPath, ...paths)
    }

    // 本地开发：项目根目录/resources/
    return path.join(process.cwd(), 'resources', ...paths)
  }

  /**
   * 获取自定义机型存储目录
   */
  private getCustomAdiDir() {
    const dir = path.join(app.getPath('userData'), 'custom_adi')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  /**
   * 获取所有机型（包括内置和自定义）
   */
  public getAdis(): Adi[] {
    logger.debug('[AdiManager] getAdis called')
    try {
      const filePath = this.getResourcePath('adi', 'template.json')
      const adis = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      return adis
    } catch (error) {
      logger.error(`[AdiManager] getAdis failed:`, {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  /**
   * 获取自定义机型
   */
  public getCustomAdis(): CustomAdi[] {
    return this.customAdiDao.getAll()
  }

  /**
   * 导入自定义机型
   * @param filePath 压缩包文件路径
   */
  public async importCustomAdi(filePath: string): Promise<CustomAdi> {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      const got =
        typeof filePath === 'object' && filePath !== null
          ? `object with keys [${Object.keys(filePath).join(', ')}]`
          : typeof filePath
      throw new Error(`Invalid filePath: expected non-empty string, got ${got}`)
    }
    logger.info(`[AdiManager] importCustomAdi: ${filePath}`)

    try {
      // 1. 校验文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`)
      }

      // 2. 校验文件是否是压缩包
      if (!filePath.endsWith('.zip')) {
        throw new Error(`Invalid file format: ${filePath} is not a zip file`)
      }

      // 1. 从压缩包中读取特定文件内容，要求在根目录
      const buffer = await this.readEntryFromZip(filePath, ['adb_debug.prop'], true)
      if (!buffer) {
        throw new Error('Invalid ADI package: adb_debug.prop not found in the root directory')
      }

      // 2. 计算属性文件的 MD5 值作为新的文件名
      const adiMd5 = crypto.createHash('md5').update(buffer).digest('hex')
      const newFileName = `${adiMd5}.zip`

      // 3. 解析属性
      const content = buffer.toString()
      const props = this.parseProps(content)

      const brand = props['ro.product.brand'] || ''
      const model = props['ro.product.model'] || ''

      // 关键信息校验：如果 brand 或 model 为空，很可能是文件被加密导致读出乱码
      if (!brand && !model) {
        throw new Error(
          'Failed to parse model info from adb_debug.prop (file might be encrypted or invalid format)'
        )
      }

      const asopVersion = props['ro.build.version.release'] || ''
      const fb = props['persist.vendor.framebuffer.main'] || ''
      const density = props['ro.sf.lcd_density'] || ''

      // 处理布局信息 (widthxheightxdpi)
      // 例如: persist.vendor.framebuffer.main = 1080x2400@60
      // ro.sf.lcd_density = 420
      // 结果应为: 1080x2400x420
      let layout = ''
      if (fb) {
        // 提取宽度和高度 (例如从 1080x2400@60 提取出 1080x2400)
        const match = fb.match(/^(\d+)x(\d+)/)
        if (match) {
          layout = `${match[1]}x${match[2]}`
        } else if (fb.includes(',')) {
          const parts = fb.split(',')
          if (parts.length >= 2) {
            layout = `${parts[0]}x${parts[1]}`
          }
        }
      }

      if (layout && density) {
        layout += `x${density}`
      }

      // 4. 将压缩包复制到用户目录，使用 MD5 命名
      const customDir = this.getCustomAdiDir()
      const targetPath = path.join(customDir, newFileName)
      fs.copyFileSync(filePath, targetPath)

      // 5. 持久化到数据库
      const now = new Date()
      const updateTime = now.toISOString().replace(/T/, ' ').replace(/\..+/, '')

      const customAdi: CustomAdi = {
        id: uuidv4(),
        brand,
        model,
        model_name: model, // 优先使用页面传入的名称，否则使用 model
        asopVersion,
        layout,
        name: newFileName,
        path: targetPath,
        updateTime
      }

      this.customAdiDao.insert(customAdi)
      logger.info(`[AdiManager] Custom ADI imported:`, customAdi)

      return customAdi
    } catch (error) {
      logger.error(`[AdiManager] importCustomAdi failed:`, error)
      throw error
    }
  }

  /**
   * 使用 yauzl 读取压缩包中的特定文件内容
   */
  private readEntryFromZip(
    zipPath: string,
    entryNames: string[],
    rootOnly: boolean = false
  ): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err)

        zipfile.readEntry()
        zipfile.on('entry', (entry) => {
          const fileName = entry.fileName
          // 检查是否在根目录：不包含任何正斜杠 (/) 或反斜杠 (\)
          const isRoot = !/[/\\]/.test(fileName)

          if (rootOnly && !isRoot) {
            zipfile.readEntry()
            return
          }

          const baseName = fileName.replace(/.*[/\\]/, '')
          const lowerNames = entryNames.map((n) => n.toLowerCase())
          const matched = lowerNames.includes(baseName.toLowerCase())

          if (matched) {
            logger.info(
              `[AdiManager] Found matching entry: "${entry.fileName}" (encrypted=${entry.isEncrypted()})`
            )

            const onStream = (err: Error | null, readStream: import('stream').Readable) => {
              if (err) {
                // 读取流出错，尝试继续读下一个条目（虽然这种情况下通常意味着zip损坏）
                logger.warn(`[AdiManager] Failed to open stream for ${entry.fileName}:`, err)
                zipfile.readEntry()
                return
              }

              const chunks: Buffer[] = []
              readStream.on('data', (chunk) => chunks.push(chunk))
              readStream.on('end', () => {
                zipfile.close()
                resolve(Buffer.concat(chunks))
              })
              readStream.on('error', (err) => {
                logger.error(`[AdiManager] Error reading stream for ${entry.fileName}:`, err)
                reject(err)
                zipfile.close()
              })
            }

            if (entry.isEncrypted()) {
              // 尝试强制读取（忽略加密标记），适配某些错误标记加密的 zip 包
              zipfile.openReadStream(
                entry,
                { decompress: null, decrypt: false, start: null, end: null },
                onStream
              )
            } else {
              zipfile.openReadStream(entry, onStream)
            }
          } else {
            zipfile.readEntry()
          }
        })

        zipfile.on('end', () => {
          logger.warn(`[AdiManager] No matching entry found in zip for: ${entryNames.join(', ')}`)
          resolve(null)
        })

        zipfile.on('error', (err) => {
          reject(err)
        })
      })
    })
  }

  /**
   * 删除自定义机型
   */
  public deleteCustomAdi(id: string): boolean {
    try {
      const adi = this.customAdiDao.getById(id)
      if (adi) {
        if (fs.existsSync(adi.path)) {
          try {
            fs.unlinkSync(adi.path)
          } catch (e) {
            logger.warn(`[AdiManager] Failed to delete file: ${adi.path}`, e)
          }
        }
        return this.customAdiDao.delete(id)
      }
      return false
    } catch (error) {
      logger.error(`[AdiManager] deleteCustomAdi failed:`, error)
      throw error
    }
  }

  /**
   * 解析 adb debug 文件内容
   */
  private parseProps(content: string): Record<string, string> {
    const props: Record<string, string> = {}
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      // 处理 [prop]: [value] 格式
      const bracketMatch = trimmed.match(/^\[(.+)\]: \[(.*)\]$/)
      if (bracketMatch) {
        props[bracketMatch[1]] = bracketMatch[2]
        continue
      }

      // 处理 prop=value 格式
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim()
        const value = trimmed.substring(eqIndex + 1).trim()
        props[key] = value
      }
    }
    return props
  }

  /**
   * 上传机型模板到主机
   */
  public async uploadAdiToHost(data: Adi | CustomAdi, host: Host): Promise<boolean> {
    logger.info(`[AdiManager] uploadAdiToHost called:`, { data, host })
    try {
      const startTime = Date.now()
      // 获取adi 文件路径
      let adiFilePath: string
      if ('path' in data && data.path) {
        // 自定义机型使用 path 字段
        adiFilePath = data.path
      } else {
        // 内置机型在 resources 下
        adiFilePath = this.getResourcePath('adi', `${data.name}`)
      }

      // 1️⃣ 校验文件是否存在
      if (!fs.existsSync(adiFilePath)) {
        throw new Error(`ADI file does not exist: ${adiFilePath}`)
      }

      // 2️⃣ 使用流（关键）
      const fileStream = fs.createReadStream(adiFilePath)

      // 2️⃣ 创建 FormData 对象
      const formData = new FormData()
      formData.append('adiZip', fileStream, {
        filename: data.name,
        contentType: 'application/zip'
      })
      const res = await request.post(
        buildApiUrl(host.ip, API_CONFIG.PATHS.IMPORT_ADI_TEMPLATE),
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 10 * 60 * 1000,
          onUploadProgress: (ev) => {
            const percent = ev.total ? Math.round((ev.loaded * 100) / ev.total) : 0
            if (percent % 20 === 0 || percent === 100) {
              logger.info(`[AdiManager] uploadAdiToHost progress: ${percent}%`)
            }
            this.notifyFrontend(ADI_EVENTS.UPLOAD_ADI_TO_HOST_PROGRESS, percent)
          }
        }
      )
      const duration = Date.now() - startTime
      logger.info(`[AdiManager] uploadAdiToHost success: adi=${data.id}, duration=${duration}ms`)
      return res
    } catch (error) {
      logger.error(`[AdiManager] uploadAdiToHost failed:`, {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        adiName: data.name,
        hostIp: host.ip
      })
      throw error
    }
  }
}
