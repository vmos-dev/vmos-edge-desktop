import type { ApiResponse } from './common'
import type { Contact } from './contact.types'

/**
 * 短信 API 相关类型
 */

// API 返回的短信数据项（匹配 API 文档格式）
export interface SmsApiItem {
  /** 短信唯一 ID */
  _id: number
  /** 对方号码 */
  address: string
  /** 短信内容 */
  body: string
  /** 时间戳 (ms) */
  date: number
  /** 短信类型：1=收件箱, 2=已发送, 3=草稿, 4=待发送, 5=失败, 6=队列 */
  type: number
  /** 短信类型常量名 (如 MESSAGE_TYPE_INBOX) */
  type_name?: string
  /** 是否已读：1=是, 0=否 */
  read: number
  /** 是否已展示：1=是, 0=否 */
  seen: number
  /** 创建者包名 */
  creator?: string
  /** 联系人姓名 */
  contact?: Contact
}

// 短信列表响应数据
export interface SmsListResponseData {
  /** 短信类型筛选 */
  type?: number
  /** 偏移量 */
  offset?: number
  /** 限制数量 */
  limit?: number
  /** 总记录数 */
  count?: number
  /** 短信列表（优先使用） */
  list?: SmsApiItem[]
  /** 短信列表（旧字段，兼容用） */
  sms_list?: SmsApiItem[]
}

// 短信列表完整 API 响应
export type SmsListApiResponse = ApiResponse<SmsListResponseData>

// 添加短信请求参数
export interface AddSmsRequest {
  /** 对方号码（必填） */
  address: string
  /** 短信内容（必填） */
  body: string
  /** 短信类型 (1: 收件箱, 2: 已发送, 3: 草稿, 4: 待发送, 5: 失败, 6: 队列)，默认 1 */
  type?: number
  /** 时间戳，默认当前时间 */
  date?: number
  /** 是否已读，默认 true */
  read?: boolean
  /** 是否已展示，默认 true */
  seen?: boolean
}

// 批量添加短信请求参数
export interface AddSmsListRequest {
  /** 短信列表 */
  sms_list: AddSmsRequest[]
}

// 批量添加短信响应（返回创建的短信列表）
export type AddSmsListResponse = ApiResponse<SmsApiItem[]>

// 发送短信请求参数（模拟接收短信）
export interface SendSmsRequest {
  /** 发送者号码（必填） */
  sender: string
  /** 短信内容（必填） */
  body: string
}

// 删除短信请求参数
export interface DeleteSmsRequest {
  /** 短信 ID */
  id: number
}

// 批量删除短信请求参数
export interface DeleteSmsListRequest {
  /** 短信 ID 数组 */
  ids: number[]
}

// 批量删除短信响应（返回成功删除的记录条数）
export type DeleteSmsListResponse = ApiResponse<number>

/**
 * 组件使用的短信类型（UI 层）
 */
export interface SmsRecord {
  /** 短信 ID（字符串格式，用于 UI） */
  id: string
  /** 对方号码 */
  address: string
  /** 短信内容 */
  body: string
  /** 时间戳 (ms) */
  date: number
  /** 短信类型 */
  type: number
  /** 是否已读 */
  read: number
  /** 是否已展示 */
  seen?: number
  /** 用于显示的字段 */
  contactName?: string
  formattedDate?: string,
  contact?: Contact
}
