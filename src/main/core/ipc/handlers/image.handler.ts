import { handle } from '../IpcBus'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import { logger } from '../../logger'
import { imageManager } from '../../store/managers'
import type { Image } from '@shared/ipc/data.types'
import { isAxiosError } from '@shared/api/request'
import type { Host } from '@shared/ipc/data.types'

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

export function registerImageHandlers() {
  // 更改存储路径
  handle<void, void>(IMAGES_EVENTS.CHANGE_STORAGE_PATH, async () => {
    logger.info('[ImageHandler] CHANGE_STORAGE_PATH request')
    try {
      await imageManager.changeStoragePath()
      logger.info('[ImageHandler] CHANGE_STORAGE_PATH success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 获取所有镜像
  handle<void, Image[]>(IMAGES_EVENTS.GET_IMAGES, async () => {
    logger.debug('[ImageHandler] GET_IMAGES request')
    try {
      const images = imageManager.getImages()
      logger.info(`[ImageHandler] GET_IMAGES success: count=${images.length}`)
      return {
        success: true,
        data: images
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 查询镜像
  handle<{ name?: string; androidVersion?: string }, Image[]>(
    IMAGES_EVENTS.QUERY_IMAGES,
    async (options) => {
      logger.debug('[ImageHandler] QUERY_IMAGES request:', options)
      try {
        const images = imageManager.queryImages(options)
        logger.info(`[ImageHandler] QUERY_IMAGES success: count=${images.length}`)
        return {
          success: true,
          data: images
        }
      } catch (error) {
        return handleError(error)
      }
    }
  )

  // 根据ID获取镜像
  handle<string, Image | undefined>(IMAGES_EVENTS.GET_IMAGE_BY_ID, async (id) => {
    logger.debug(`[ImageHandler] GET_IMAGE_BY_ID request: id=${id}`)
    try {
      const image = imageManager.getImageById(id)
      logger.info(`[ImageHandler] GET_IMAGE_BY_ID success: found=${!!image}`)
      return {
        success: true,
        data: image
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 添加镜像
  handle<Omit<Image, 'id'>, void>(IMAGES_EVENTS.ADD_IMAGE, async (image) => {
    logger.info('[ImageHandler] ADD_IMAGE request:', image)
    try {
      imageManager.addImage(image)
      logger.info('[ImageHandler] ADD_IMAGE success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 删除镜像
  handle<string, void>(IMAGES_EVENTS.DELETE_IMAGE, async (id) => {
    logger.info(`[ImageHandler] DELETE_IMAGE request: id=${id}`)
    try {
      imageManager.deleteImage(id)
      logger.info('[ImageHandler] DELETE_IMAGE success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 批量删除镜像
  handle<string[], number>(IMAGES_EVENTS.DELETE_IMAGES, async (ids) => {
    logger.info(`[ImageHandler] DELETE_IMAGES request: count=${ids.length}`)
    try {
      const deletedCount = imageManager.deleteImages(ids)
      logger.info(`[ImageHandler] DELETE_IMAGES success: deleted=${deletedCount}`)
      return {
        success: true,
        data: deletedCount
      }
    } catch (error) {
      return handleError(error)
    }
  })

  // 上传镜像
  handle<{ filePath: string; name: string }, void>(IMAGES_EVENTS.UPLOAD_IMAGE, async (data) => {
    logger.info(`[ImageHandler] UPLOAD_IMAGE request: name=${data.name}`)
    try {
      await imageManager.uploadImage(data)
      logger.info('[ImageHandler] UPLOAD_IMAGE success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 上传镜像到主机
  handle<{ image: Image; host: Host }, void>(IMAGES_EVENTS.UPLOAD_IMAGE_TO_HOST, async (data) => {
    logger.info(
      `[ImageHandler] UPLOAD_IMAGE_TO_HOST request: image=${data.image.name}, host=${data.host.ip}`
    )
    try {
      await imageManager.uploadImageToHost(data.image, data.host)
      logger.info('[ImageHandler] UPLOAD_IMAGE_TO_HOST success')
      return { success: true }
    } catch (error) {
      return handleError(error)
    }
  })

  // 检测镜像存储路径是否存在
  handle<void, boolean>(IMAGES_EVENTS.CHECK_STORAGE_PATH, async () => {
    logger.info('[ImageHandler] CHECK_STORAGE_PATH request')
    try {
      const exists = imageManager.checkStoragePath()
      return { success: true, data: exists }
    } catch (error) {
      return handleError(error)
    }
  })

  logger.info('[ImageHandler] ✅ 镜像处理器已注册')
}
