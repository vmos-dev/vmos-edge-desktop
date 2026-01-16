import { BaseManager } from './BaseManager'
import { logger } from '../../logger'
import { ConfigManager } from './ConfigManager'
import { ImageDao } from '../../dao/ImageDao'
import { CONFIG_KEYS } from '@shared/constant'
import { dialog } from 'electron'
import { Image } from '@shared/ipc/data.types'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { extract } from 'tar'
import { pipeline } from 'stream/promises' // Node 15+ 原生支持流管道 Promise
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import { ZstdDecompressStream } from '../../utils/ZstdDecompressStream'
import { request } from '@shared/api/request'
import { buildApiUrl } from '@shared/api/config'
import { API_CONFIG } from '@shared/api/config'
import FormData from 'form-data'
import { Host } from '@shared/ipc/data.types'
import { getFreeDiskSpace } from '../../utils'
/**
 * 镜像管理器
 * 提供镜像的存储和读取功能
 */
export class ImageManager extends BaseManager {
  private configManager: ConfigManager
  private imageDao: ImageDao

  constructor(configManager: ConfigManager) {
    super()
    this.configManager = configManager
    this.imageDao = new ImageDao(this.dbInstance)
  }

  /**
   * 修改镜像存储路径
   */
  public async changeStoragePath(): Promise<void> {
    logger.info('[ImageManager] changeStoragePath called')
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: this.configManager.getValue(CONFIG_KEYS.IMAGE_STORAGE_PATH)
      })

      if (result.filePaths.length === 0) {
        logger.warn('[ImageManager] changeStoragePath: user cancelled or no path selected')
        return
      }
      const path = result.filePaths[0]
      this.configManager.setValue(CONFIG_KEYS.IMAGE_STORAGE_PATH, path)
      logger.info(`[ImageManager] changeStoragePath success: path=${path}`)
    } catch (error) {
      logger.error(`[ImageManager] changeStoragePath failed:`, {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  /**
   * 获取所有镜像
   */
  public getImages(): Image[] {
    const startTime = Date.now()
    logger.debug('[ImageManager] getImages called')
    try {
      const images = this.imageDao.getAll()
      const duration = Date.now() - startTime
      logger.debug(
        `[ImageManager] getImages success: count=${images.length}, duration=${duration}ms`
      )
      return images
    } catch (error) {
      logger.error('[ImageManager] getImages failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  /**
   * 查询镜像
   */
  public queryImages(options?: { name?: string; androidVersion?: string }): Image[] {
    const startTime = Date.now()
    logger.debug('[ImageManager] queryImages called', options)
    try {
      const images = this.imageDao.query(options)
      const duration = Date.now() - startTime
      logger.debug(
        `[ImageManager] queryImages success: count=${images.length}, duration=${duration}ms`
      )
      return images
    } catch (error) {
      logger.error('[ImageManager] queryImages failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        options
      })
      throw error
    }
  }

  /**
   * 根据ID获取镜像
   */
  public getImageById(id: string): Image | undefined {
    logger.debug(`[ImageManager] getImageById called: id=${id}`)
    try {
      const image = this.imageDao.getById(id)
      logger.debug(`[ImageManager] getImageById success: id=${id}, found=${!!image}`)
      return image
    } catch (error) {
      logger.error(`[ImageManager] getImageById failed:`, {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id
      })
      throw error
    }
  }

  /**
   * 添加镜像
   */
  public addImage(image: Omit<Image, 'id'>): void {
    const startTime = Date.now()
    logger.info(`[ImageManager] addImage called:`, image)
    try {
      if (!image.name || !image.version) {
        logger.warn(
          `[ImageManager] addImage: invalid input name=${image.name}, version=${image.version}`
        )
        throw new Error('Incomplete image data: name, version are required fields')
      }
      const newImage: Image = {
        id: uuidv4(),
        ...image
      }
      this.imageDao.addImage(newImage)
      const duration = Date.now() - startTime
      logger.info(`[ImageManager] addImage success: id=${newImage.id}, duration=${duration}ms`)
    } catch (error) {
      logger.error('[ImageManager] addImage failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        image: image
      })
      throw error
    }
  }

  /**
   * 删除镜像
   */
  public deleteImage(id: string): void {
    const startTime = Date.now()
    logger.info(`[ImageManager] deleteImage called: id=${id}`)
    try {
      if (!id) {
        logger.warn(`[ImageManager] deleteImage: invalid input id=${id}`)
        throw new Error('Invalid input: id is required')
      }

      const version = this.imageDao.getById(id)?.version ?? ''

      if (version) {
        // 查询当前id 版本关联了几条数据
        const images = this.imageDao.query({ version: version })

        const deleted = this.imageDao.deleteImage(id)
        if (
          images.length === 1 &&
          images?.[0]?.storagePath &&
          fs.existsSync(images?.[0]?.storagePath)
        ) {
          // 删除版本文件
          fs.rmSync(path.join(images?.[0]?.storagePath))
        }

        const duration = Date.now() - startTime
        if (!deleted) {
          logger.warn(`[ImageManager] deleteImage not found: id=${id}, duration=${duration}ms`)
          throw new Error(`Image not found: id=${id}`)
        }
        logger.info(`[ImageManager] deleteImage success: id=${id}, duration=${duration}ms`)
      }
    } catch (error) {
      logger.error('[ImageManager] deleteImage failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        id: id
      })
      throw error
    }
  }

  /**
   * 批量删除镜像
   */
  public deleteImages(ids: string[]): number {
    const startTime = Date.now()
    logger.info(`[ImageManager] deleteImages called: count=${ids.length}, ids=${ids.join(',')}`)
    try {
      if (ids.length === 0) {
        logger.warn('[ImageManager] deleteImages: empty ids array')
        throw new Error('Empty ids array: ids is required')
      }

      const deletedCount = this.imageDao.deleteImages(ids)
      const duration = Date.now() - startTime
      logger.info(
        `[ImageManager] deleteImages success: requested=${ids.length}, deleted=${deletedCount}, duration=${duration}ms`
      )
      return deletedCount
    } catch (error) {
      logger.error('[ImageManager] deleteImages failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        count: ids.length,
        ids
      })
      throw error
    }
  }

  /**
   * 删除镜像文件（uuid 开头的文件）
   */
  private deleteImageFiles(uuid: string, imageStoragePath: string): void {
    try {
      const files = fs.readdirSync(imageStoragePath)
      for (const file of files) {
        if (file.startsWith(uuid)) {
          fs.rmSync(path.join(imageStoragePath, file))
        }
      }
    } catch (error) {
      logger.error('[ImageManager] deleteImageFiles failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        uuid,
        imageStoragePath
      })
      throw error
    }
  }

  /**
   * 上传镜像 (入口函数)
   */
  public async uploadImage(data: { filePath: string; name: string }): Promise<boolean> {
    const startTime = Date.now()
    logger.info(`[ImageManager] uploadImage called: filePath=${data.filePath}, name=${data.name}`)
    const { filePath, name: imageName } = data

    let uuid: string = ''
    let imageStoragePath = ''
    try {
      // 1. 基础校验
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }
      if (!filePath.endsWith('.tar.zst')) {
        throw new Error('Invalid file format: only .tar.zst files are supported')
      }

      const fileStats = fs.statSync(filePath)

      const fileSize = fileStats.size
      logger.info(`[ImageManager] uploadImage: file size=${this.formatBytes(fileSize)}`)

      // 2. 获取存储配置
      imageStoragePath = this.configManager.getValue(CONFIG_KEYS.IMAGE_STORAGE_PATH) ?? ''

      if (!imageStoragePath) {
        throw new Error('Image storage path is not configured. Please set storage path first.')
      }

      // 校验存储路径是否存在
      if (!fs.existsSync(imageStoragePath)) {
        throw new Error(`Storage path not found: ${imageStoragePath}`)
      }

      // 3. 检查空间
      await this.checkDiskSpace(imageStoragePath, fileSize)

      // 4. 预读取 Meta 并校验
      logger.info('[ImageManager] Pre-validating image meta...')
      // const meta = await this.readMetaFromTarZst(filePath)

      // const connection_mode = meta?.scd?.connection_mode

      // if (!connection_mode || connection_mode !== 'websocket') {
      //   throw new Error(
      //     '当前镜像版本过低，VMOS Edge PC 端 2.0 仅支持最新镜像版本，请参考镜像历史发布文档获取最新镜像。'
      //   )
      // }

      // 5. 创建唯一的解压目录 文件名(时间戳)
      const extractDir = path.join(imageStoragePath)

      // 5. 执行高性能解压
      uuid = uuidv4()

      await this.extractTarZst(filePath, extractDir, uuid, fileSize)

      const duration = Date.now() - startTime
      logger.info(
        `[ImageManager] uploadImage success: duration=${duration}ms, extractDir=${extractDir}`
      )

      // 读取 vcloud.meta 文件的name
      const vcloudMeta = fs.readFileSync(path.join(extractDir, `${uuid}_vcloud.meta`), 'utf8')
      const vcloudMetaJson = JSON.parse(vcloudMeta)
      const name = vcloudMetaJson.name

      // 删除vcloud.meta文件
      fs.unlinkSync(path.join(extractDir, `${uuid}_vcloud.meta`))

      const newName = `${name}.tar.gz`

      // 修改文件名 uuid.tar.gz 为 name.tar.gz
      fs.renameSync(path.join(extractDir, `${uuid}.tar.gz`), path.join(extractDir, newName))

      // 获取newName的文件大小
      const newNameFileSize = fs.statSync(path.join(extractDir, newName)).size

      // 解析安卓版本
      const metaMatch = vcloudMetaJson?.android_version_enum?.match(/android(\d+)/i)
      const nameMatch = name?.match(/android(\d+)/i)

      const androidVersion = metaMatch ? metaMatch[1] : nameMatch ? nameMatch[1] : null

      if (!androidVersion) {
        throw new Error(`Invalid android version: ${name}`)
      }

      // 6. 添加镜像
      this.addImage({
        name: imageName == '' ? name : imageName,
        version: name || '',
        // 安卓版本
        androidVersion: androidVersion || '',
        size: newNameFileSize,
        importTime: Date.now(),
        storagePath: path.join(extractDir, newName),
        connectionMode: vcloudMetaJson?.scd?.connection_mode
      })
      return true
    } catch (error) {
      // 删除 uuid 开头的文件
      if (uuid && imageStoragePath) {
        this.deleteImageFiles(uuid, imageStoragePath)
      }
      logger.error('[ImageManager] uploadImage failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        filePath
      })
      throw error
    }
  }

  /**
   * 检查磁盘空间
   */
  private async checkDiskSpace(directory: string, requiredSize: number): Promise<void> {
    try {
      const estimatedUncompressedSize = requiredSize * 3
      const freeSpace = await getFreeDiskSpace(directory)

      if (freeSpace < estimatedUncompressedSize) {
        const errorMsg = `Insufficient disk space: Available ${this.formatBytes(freeSpace)}, required approximately ${this.formatBytes(estimatedUncompressedSize)}`
        logger.error(`[ImageManager] checkDiskSpace failed: ${errorMsg}`)
        throw new Error(errorMsg)
      }
    } catch (error) {
      logger.error('[ImageManager] checkDiskSpace failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        directory,
        requiredSize
      })
      throw error // 空间检查失败应阻断流程
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 仅读取压缩包中的 meta 文件 (流式处理，不解压其他文件)
   */
  // private async readMetaFromTarZst(filePath: string): Promise<any> {
  //   return new Promise((resolve, reject) => {
  //     let rs: fs.ReadStream | null = null
  //     let parser: Parser | null = null
  //     try {
  //       const STOP = new Error('__STOP_AFTER_META__')

  //       let settled = false
  //       let found = false
  //       const chunks: Buffer[] = []

  //       parser = new Parser({
  //         zstd: true,
  //         strict: true,
  //         maxMetaEntrySize: 1024 * 1024
  //       })

  //       rs = fs.createReadStream(filePath)

  //       const doneResolve = (v: any) => {
  //         if (settled) return
  //         settled = true
  //         resolve(v)
  //         parser?.abort(STOP)
  //         // 不立即 destroy，避免 premature close
  //         process.nextTick(() => rs?.destroy())
  //       }

  //       const doneReject = (e: any) => {
  //         if (settled) return
  //         settled = true
  //         reject(e)
  //         parser?.abort(e)
  //         process.nextTick(() => rs?.destroy())
  //       }

  //       parser?.on('entry', (entry: any) => {
  //         if (settled) {
  //           entry.resume?.()
  //           return
  //         }

  //         const p = entry?.name || entry?.path
  //         if (p && p?.endsWith('.meta')) {
  //           found = true
  //           entry?.on('data', (buf: Buffer) => chunks.push(buf))
  //           entry?.on('end', () => {
  //             try {
  //               const metaStr = Buffer.concat(chunks).toString('utf-8')
  //               const meta = JSON.parse(metaStr)
  //               doneResolve?.(meta)
  //             } catch {
  //               doneReject?.(new Error('Invalid meta file format'))
  //             }
  //           })
  //           return
  //         }

  //         entry?.resume?.()
  //       })

  //       parser?.on('error', (err: any) => {
  //         if (err === STOP || err?.message === STOP.message) {
  //           return
  //         }
  //         if (!settled) doneReject?.(err)
  //       })

  //       parser.on('end', () => {
  //         if (!found && !settled) {
  //           doneReject?.(new Error('Meta file not found in archive'))
  //         }
  //       })

  //       rs?.on('error', doneReject)
  //       rs.pipe(parser)
  //     } catch (error) {
  //       process.nextTick(() => rs?.destroy())
  //       parser?.abort(error as any)
  //       reject(error)
  //     }
  //   })
  // }

  /**
   * 核心解压逻辑：路由策略
   */
  private async extractTarZst(
    filePath: string,
    outputDir: string,
    uuid: string,
    fileSize: number
  ): Promise<void> {
    logger.info(`[ImageManager] extractTarZst: ${filePath} -> ${outputDir}`)

    try {
      logger.info('[ImageManager] Strategy: Node.js Stream (fzstd + tar)')
      return await this.extractWithNodeStream(filePath, outputDir, uuid, fileSize)
    } catch (error) {
      logger.error('[ImageManager] extractTarZst failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        filePath,
        outputDir
      })
      throw error
    }
  }

  /**
   * 使用 Node.js 流式解压
   */
  private async extractWithNodeStream(
    filePath: string,
    outputDir: string,
    uuid: string,
    fileSize: number
  ): Promise<void> {
    const startTime = Date.now()
    try {
      // 创建管道：源文件流 -> 解压流 -> 解包流
      await pipeline(
        fs.createReadStream(filePath),
        new ZstdDecompressStream(fileSize, (percent) => {
          if (percent % 20 === 0 || percent === 100) {
            logger.info(`[ImageManager] Node stream extraction progress: ${percent}%`)
          }

          // 通知前端进度
          this.notifyFrontend(IMAGES_EVENTS.IMAGE_EXTRACT_PROGRESS, percent)
        }), // 使用我们自定义的包装类
        extract({
          cwd: outputDir,
          strict: true,

          onentry(entry) {
            // 获取文件名
            const fileName = path.basename(entry.path)

            // 识别 .tar.gz 文件
            if (fileName.endsWith(`.tar.gz`)) {
              entry.path = `${uuid}.tar.gz` // 解压出来就是最终文件名
            }

            // 识别 meta 文件也可以重命名
            if (fileName.endsWith(`meta`)) {
              entry.path = `${uuid}_vcloud.meta`
            }
          }
        })
      )

      const duration = Date.now() - startTime
      logger.info(`[ImageManager] Node stream extraction completed in ${duration}ms`)
    } catch (error) {
      logger.error('[ImageManager] Node stream extraction failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        filePath,
        outputDir
      })
      throw error
    }
  }

  /**
   * 上传镜像到主机
   */
  public async uploadImageToHost(image: Image, host: Host): Promise<boolean> {
    const startTime = Date.now()
    logger.info(`[ImageManager] uploadImageToHost called:`, { image, host })
    try {
      const { storagePath } = image
      const filePath = path.normalize(storagePath)
      // 1️⃣ 校验文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }

      // 2️⃣ 使用流（关键）
      const fileStream = fs.createReadStream(filePath)

      const fileName = path.basename(filePath)
      const formData = new FormData()
      formData.append('file', fileStream, {
        filename: fileName,
        contentType: 'application/gzip'
      })
      await request.post(buildApiUrl(host.ip, API_CONFIG.PATHS.IMPORT_IMAGE), formData, {
        // responseType: 'blob',
        headers: {
          ...formData.getHeaders()
        },
        timeout: 20 * 60 * 1000,

        onUploadProgress: (ev) => {
          const percent = ev.total ? Math.round((ev.loaded * 100) / ev.total) : 0
          if (percent % 20 === 0 || percent === 100) {
            logger.info(`[ImageManager] uploadImageToHost progress: ${percent}%`)
          }
          this.notifyFrontend(IMAGES_EVENTS.UPLOAD_IMAGE_TO_HOST_PROGRESS, percent)
        }
      })
      const duration = Date.now() - startTime
      logger.info(
        `[ImageManager] uploadImageToHost success: image=${image.id}, duration=${duration}ms`
      )
      return true
    } catch (error) {
      logger.error('[ImageManager] uploadImageToHost failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        imageId: image.id,
        hostIp: host.ip
      })
      throw error
    }
  }

  /**
   * 检测镜像存储路径是否存在
   */
  public checkStoragePath(): boolean {
    try {
      const imageStoragePath = this.configManager.getValue(CONFIG_KEYS.IMAGE_STORAGE_PATH)

      // 空值直接不通过
      if (!imageStoragePath) {
        return false
      }

      // 存在即可（不做复杂校验）
      return fs.existsSync(imageStoragePath)
    } catch (error) {
      logger.error('[ImageManager] checkStoragePath failed:', {
        error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return false
    }
  }
}
