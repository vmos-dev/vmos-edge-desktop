/** 通用响应格式 */
export interface BaseResponse<T = any> {
  code: number // 0 为成功，非 0 为失败
  message: string
  data?: T
}

/**
 * AI 工具调用响应格式
 */
export interface AiToolResponse<T = any> {
  code: number // 0 为成功，非 0 为失败
  message: string
  data?: T
}

/**
 * 系统信息响应
 */
export interface SystemInfo {
  device_id: string
  kernel_version: string
  version: string
}

/**
 * 云机详细信息响应
 */
export interface CloudPhoneInfo {
  // 云机ID
  name: string
  // 镜像版本
  image: string
  // 云机IP
  ip: string
  // 云机运行状态
  status: string
  // 当前网络模式
  network: string
  // 安卓版本
  aosp_version: string
  // DNS
  dns: string
  // FPS
  fps: string
  // 分辨率 DPI
  dpi: string
  // 屏幕宽高
  width: string
  height: string
}
