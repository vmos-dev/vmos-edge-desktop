/**
 * 设备控制 API 配置
 * 
 * 本配置模块定义了与云手机设备控制相关的 API 端点路径和基础配置项。
 * 所有 API 路径均遵循 RESTful 设计规范，通过 buildDeviceApiUrl 函数构建完整的请求 URL。
 * 
 * @module controlConfig
 * @see {@link https://developer.android.com/reference/android/provider/CallLog.Calls Android CallLog API}
 */

/**
 * API 控制配置常量
 * 
 * 包含成功状态码、默认端口号以及所有设备控制相关的 API 路径定义。
 * 使用 `as const` 确保类型安全，防止意外修改。
 */
export const API_CONTROL_CONFIG = {
  /** HTTP 请求成功状态码 */
  SUCCESS_CODE: 200,

  /** 默认 API 服务端口号 */
  DEFAULT_PORT: 18182,

  /**
   * API 路径定义
   * 
   * 所有路径均为相对路径，不包含协议、主机和端口信息。
   * 完整 URL 需要通过 buildDeviceApiUrl 函数构建。
   */
  PATHS: {
    // ==================== 短信管理 (SMS) ====================
    /** 获取短信列表 - 支持分页查询和类型筛选（type, offset, limit） */
    GET_SMS_LIST: '/sms/list',
    /** 添加短信记录 - 支持发送和接收类型 */
    ADD_SMS: '/sms/add',
    /** 批量添加短信记录 - 支持一次添加多个短信 */
    ADD_SMS_LIST: '/sms/add_list',
    /** 删除短信记录 - 根据短信 ID 删除 */
    DELETE_SMS: '/sms/delete',
    /** 批量删除短信记录 - 根据短信 ID 数组批量删除 */
    DELETE_SMS_LIST: '/sms/delete_list',
    /** 接收短信（模拟发送短信）- 会触发系统短信接收流程 */
    SEND_SMS: '/sms/receive',

    // ==================== 联系人管理 (Contact) ====================
    /** 获取联系人列表 - 支持分页查询（offset、limit） */
    GET_CONTACT_LIST: '/contact/list',
    /** 添加联系人 - 支持姓名、电话、邮箱、公司、职位、备注等信息 */
    ADD_CONTACT: '/contact/add',
    /** 批量添加联系人 - 支持一次添加多个联系人 */
    ADD_CONTACT_LIST: '/contact/add_list',
    /** 删除联系人 - 根据联系人 ID 删除 */
    DELETE_CONTACT: '/contact/delete',
    /** 批量删除联系人 - 根据联系人 ID 数组批量删除 */
    DELETE_CONTACT_LIST: '/contact/delete_list',

    // ==================== 通话记录管理 (CallLog) ====================
    /** 获取通话记录列表 - 支持分页查询（limit、offset） */
    GET_CALL_LOG_LIST: '/calllog/list',
    /** 添加通话记录 - 支持来电、去电、未接等类型 */
    ADD_CALL_LOG: '/calllog/add',
    /** 批量添加通话记录 - 支持一次添加多个通话记录 */
    ADD_CALL_LOG_LIST: '/calllog/add_list',
    /** 删除通话记录 - 根据通话记录 ID 删除 */
    DELETE_CALL_LOG: '/calllog/delete',
    /** 批量删除通话记录 - 根据通话记录 ID 数组批量删除 */
    DELETE_CALL_LOG_LIST: '/calllog/delete_list',
    /** 清空通话记录 - 删除所有通话记录 */
    CLEAR_CALL_LOG: '/calllog/clear',

    // ==================== 电池管理 (Battery) ====================
    /** 获取电池信息 */
    GET_BATTERY: '/battery/get',
    /** 设置电池信息 */
    SET_BATTERY: '/battery/set',

    // ==================== 传感器管理 (Sensor) ====================
    /** 获取传感器列表 */
    GET_SENSOR_LIST: '/sensor/list',
    /** 获取传感器数据 */
    GET_SENSOR_DATA: '/sensor/get_data',
    /** 设置传感器数据 */
    SET_SENSOR_DATA: '/sensor/set_data',

    // ==================== 系统属性 (SystemProp) ====================

    /** 设置系统属性 */
    SET_SYSTEM_PROP: '/system/set_prop',

    /** 获取api版本 */
    GET_API_VERSION: '/base/version_info',
  },
} as const

/**
 * 构建设备 API 的完整请求 URL
 * 
 * 根据提供的参数构建符合 Android API v2 规范的完整 URL。
 * 函数会自动处理路径格式，确保生成的 URL 符合规范。
 * 
 * @param ip - 云手机主机 IP 地址（IPv4 格式，如：192.168.1.100）
 * @param deviceId - 云手机设备唯一标识符（设备 ID）
 * @param path - API 相对路径（支持带或不带前导斜杠，如：'sms/list' 或 '/sms/list'）
 * @param port - 目标服务端口号（可选，默认使用 API_CONTROL_CONFIG.DEFAULT_PORT）
 * 
 * @returns 完整的 HTTP URL 字符串
 * 
 * @example
 * ```typescript
 * // 基本用法
 * const url = buildDeviceApiUrl('192.168.1.100', 'device-123', 'sms/list')
 * // 返回: 'http://192.168.1.100:18182/android_api/v2/device-123/sms/list'
 * 
 * // 使用配置中的路径常量
 * const url = buildDeviceApiUrl(
 *   '192.168.1.100',
 *   'device-123',
 *   API_CONTROL_CONFIG.PATHS.GET_SMS_LIST
 * )
 * 
 * // 自定义端口
 * const url = buildDeviceApiUrl('192.168.1.100', 'device-123', 'sms/list', 8080)
 * ```
 * 
 * @throws {Error} 当 path 参数为空或无效时可能抛出错误
 */
export function buildDeviceApiUrl(
  ip: string,
  deviceId: string,
  path: string,
  port: number = API_CONTROL_CONFIG.DEFAULT_PORT
): string {
  // 参数校验
  if (!ip || typeof ip !== 'string') {
    throw new Error('IP address must be a non-empty string')
  }
  if (!deviceId || typeof deviceId !== 'string') {
    throw new Error('Device ID must be a non-empty string')
  }
  if (!path || typeof path !== 'string') {
    throw new Error('API path must be a non-empty string')
  }
  if (port <= 0 || port > 65535) {
    throw new Error(`Port must be between 1 and 65535, got: ${port}`)
  }

  // 规范化路径：移除前导斜杠，确保路径格式统一
  const cleanPath = path.trim().startsWith('/') ? path.trim().slice(1) : path.trim()

  // 构建完整的 API URL
  // 格式: http://{ip}:{port}/android_api/v2/{deviceId}/{path}
  return `http://${ip}:${port}/android_api/v2/${deviceId}/${cleanPath}`
}
