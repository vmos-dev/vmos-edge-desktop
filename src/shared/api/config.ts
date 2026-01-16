export const API_CONFIG = {
  SUCCESS_CODE: 200,
  // 默认端口
  DEFAULT_PORT: 18182,
  // API 路径定义
  PATHS: {
    // 心跳检测
    HEARTBEAT: '/v1/heartbeat',
    // 获取主机系统信息
    GET_SYSTEM_INFO: '/v1/systeminfo',
    // 获取主机硬件配置
    GET_HARDWARE_CFG: '/v1/get_hardware_cfg',
    // 获取主机下所有实例
    GET_DB: '/container_api/v1/get_db',
    // 批量上传文件
    UPLOAD_BATCH: '/android_api/v1/upload_file_android_batch',
    // 单个上传文件
    UPLOAD_SINGLE: '/android_api/v1/upload_file_android_upload',
    // 批量重置设备
    RESET_DEVICE_BATCH: '/container_api/v1/reset',
    // 批量重启设备
    RESTART_DEVICE_BATCH: '/container_api/v1/reboot',
    // 修改设备名称
    UPDATE_DEVICE_NAME: '/container_api/v1/rename',
    // 删除设备
    DEVICE_DELETED: '/container_api/v1/delete',
    // 批量关闭设备
    SHUTDOWN_DEVICE_BATCH: '/container_api/v1/stop',
    // 批量启动设备
    START_DEVICE_BATCH: '/container_api/v1/run',
    // 获取实例截图
    GET_SCREENSHOT: '/container_api/v1/screenshots',
    // CBS版本更新
    UPDATE_CBS: '/v1/update_cbs',
    // 内核版本更新
    UPDATE_KERNEL: '/v1/update_kernel',
    // 清理镜像
    CLEAN_IMAGE: '/v1/prune_images',
    // 重启主机
    RESTART_HOST: '/v1/reboot_for_arm',
    // 重置主机
    RESET_HOST: '/v1/reset',
    // 获取主机镜像列表
    GET_HOST_IMG_LIST: '/v1/get_img_list',
    // 获取主机网络配置
    GET_HOST_NETWORK_CONFIG: '/v1/net_info',
    // 导出机型模板
    IMPORT_ADI_TEMPLATE: '/v1/import_adi',
    // 导入镜像
    IMPORT_IMAGE: '/v1/import_image',
    // 获取主机机型模板列表
    GET_HOST_ADI_TEMPLATE_LIST: '/v1/get_adi_list',
    // 创建云手机
    CREATE_CLOUD_PHONE: '/container_api/v1/create',
    // 修改云手机镜像
    UPDATE_CLOUD_PHONE_IMAGE: '/container_api/v1/upgrade_image',
    // 一键新机
    REPLACE_DEVICE_INFO: '/container_api/v1/replace_devinfo',
    // 修改示例ip
    SET_DEVICE_IP: '/container_api/v1/set_ip',
    // 克隆实例
    CLONE_DEVICE: '/container_api/v1/clone',
    // 设置代理
    SET_PROXY: '/android_api/v1/proxy_set',
    //查询云手机代理
    GET_CLOUD_PHONE_PROXY: '/android_api/v1/proxy_get',
    // 关闭代理
    CLOSE_PROXY: '/android_api/v1/proxy_stop',
    //文本内容上传证书
    UPLOAD_CONTENT_CERT: '/certificate_manage/content_import_cert',
    // 批量上传证书
    UPLOAD_CERT_BATCH: '/certificate_manage/file_import_cert',

    // 查询实例地区、语言、时区
    GET_DEVICE_COUNTRY_LANGUAGE_TIMEZONE: '/android_api/v1/get_timezone_locale',
    // 设置语言
    SET_DEVICE_LANGUAGE: '/android_api/v1/language_set',
    // 设置地区
    SET_DEVICE_COUNTRY: '/android_api/v1/country_set',
    // 设置时区
    SET_DEVICE_TIMEZONE: '/android_api/v1/timezone_set',
    // 设置实例经纬度
    SET_DEVICE_LOCATION: '/android_api/v1/gps_inject'
  }
} as const

/**
 * 构建完整的 API URL
 * @param ip 目标 IP
 * @param path API 路径
 * @param port 目标端口 (可选，默认使用配置端口)
 */
export function buildApiUrl(
  ip: string,
  path: string,
  port: number = API_CONFIG.DEFAULT_PORT
): string {
  return `http://${ip}:${port}${path?.trim()}`
}
