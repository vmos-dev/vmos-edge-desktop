import { BaseManager } from './BaseManager'
import { logger } from '../../logger'
import { Adi, ADI_EVENTS } from '@shared/ipc/adi.types'
import { request } from '@shared/api/request'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'
import FormData from 'form-data'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { Host } from '@shared/ipc/data.types'
/**
 * 机型设置管理器
 * 提供机型设置的存储和读取功能
 */
export class AdiManager extends BaseManager {
  constructor() {
    super()
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
   * 获取机型设置
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
   * 上传机型模板到主机
   */
  public async uploadAdiToHost(data: Adi, host: Host): Promise<boolean> {
    logger.info(`[AdiManager] uploadAdiToHost called:`, { data, host })
    try {
      const startTime = Date.now()
      // 获取adi 文件
      const adiFilePath = this.getResourcePath('adi', `${data.name}`)
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
