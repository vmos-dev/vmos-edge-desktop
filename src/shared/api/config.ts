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
    // 获取主机网络配置（旧接口）
    GET_HOST_NETWORK_CONFIG: '/v1/net_info',
    // 获取主机网络配置（新接口）
    GET_NETWORK_CONFIG: '/sys/network/config',
    // 修改主机网络配置
    SET_NETWORK_CONFIG: '/sys/network/config',
    // 重置主机网络为 DHCP
    RESET_NETWORK_CONFIG: '/sys/network/config/reset',
    // 设置 Swap 大小（路径后需追加 /{size_gb}）
    SET_SWAP_SIZE: '/v1/swap_size',
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
    SET_DEVICE_LOCATION: '/android_api/v1/gps_inject',
    // 执行命令
    EXEC_COMMAND: '/android_api/v1/shell',
    // 修改系统属性
    UPDATE_USER_PROP: '/container_api/v1/update_user_prop',
    // 视频注入
    VIDEO_INJECT: '/android_api/v1/video_inject',
    // 关闭视频注入
    CLOSE_VIDEO_INJECT: '/android_api/v1/video_inject_off',
    // 获取视频注入状态
    GET_VIDEO_INJECT_STATUS: '/android_api/v1/getInjectStatus',

    // 音频注入
    AUDIO_INJECT: '/android_api/v1/audio_inject',
    // 关闭音频注入
    CLOSE_AUDIO_INJECT: '/android_api/v1/audio_inject_off',
    // 获取音频注入状态
    GET_AUDIO_INJECT_STATUS: '/android_api/v1/getInjectAudioStatus',

    // 获取指定实例详细信息
    GET_CLOUD_PHONE_INFO: '/container_api/v1/get_android_detail',
    // 导入备份
    IMPORT_BACKUP: '/backup/import',
    // 备份云机
    EXPORT_BACKUP: '/backup/export',
    // 取消备份
    CANCEL_BACKUP: '/backup/cancel',

    // ==================== SCD 音频 (云机窗口) ====================
    /** 查询 SCD 配置（含音频是否开启状态）- GET，路径需拼接 :db_id */
    GET_SCD_CONFIG: '/container_api/v1/scd_config',
    /** 设置 SCD 配置（开启/关闭音频参数）- POST，路径需拼接 :db_id */
    POST_SCD_CONFIG: '/container_api/v1/scd_config',
    /** 重启 SCD 使音频配置生效 - POST，路径需拼接 :db_id */
    POST_SCD_RESTART: '/container_api/v1/scd_restart',

    // 加入共享 - POST，参数 { url: string }
    SHARE_OPEN: '/v1/share/open',
    // 关闭共享 - POST，无参数
    SHARE_CLOSE: '/v1/share/close',

    // ==================== SSH 远程调试隧道 ====================
    /** 开启隧道 - POST */
    TUNNEL_ENABLE: '/tunnel/enable',
    /** 查询隧道状态 - GET */
    TUNNEL_STATUS: '/tunnel/status',
    /** 关闭隧道（锁定） - POST */
    TUNNEL_DISABLE: '/tunnel/disable',
    /** 解锁隧道 - POST */
    TUNNEL_UNLOCK: '/tunnel/unlock'
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
