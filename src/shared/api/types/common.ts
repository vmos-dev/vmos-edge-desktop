/**
 * API 通用响应结构
 */
export interface ApiResponse<T = any> {
  code: number
  data: T
  msg: string
  request_id?: string
  cost?: number
}
