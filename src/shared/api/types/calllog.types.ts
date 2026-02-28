import type { ApiResponse } from './common'
import type { Contact } from './contact.types'

/**
 * 通话记录 API 相关类型
 * 
 * 参考 Android CallLog.Calls API 规范
 * @see {@link https://developer.android.com/reference/android/provider/CallLog.Calls Android CallLog API}
 */

/**
 * 通话类型枚举
 * 对应 Android CallLog.Calls 中的 TYPE 字段
 */
export enum CallLogType {
  /** 来电 - INCOMING_TYPE */
  INCOMING = 1,
  /** 去电 - OUTGOING_TYPE */
  OUTGOING = 2,
  /** 未接 - MISSED_TYPE */
  MISSED = 3,
  /** 拒接 - REJECTED_TYPE */
  REJECTED = 5,
  /** 语音信箱 - VOICEMAIL_TYPE */
  VOICEMAIL = 4
}

/**
 * API 返回的通话记录数据项（匹配 API 文档格式）
 */
export interface CallLogApiItem {
  /** 通话记录唯一标识符 */
  _id: number
  /** 电话号码 */
  number: string
  /** 通话类型：1=来电, 2=去电, 3=未接 */
  type: number
  /** 通话类型名称：INCOMING_TYPE, OUTGOING_TYPE, MISSED_TYPE */
  type_name?: string
  /** 通话时间（Unix 时间戳，毫秒） */
  date: number
  /** 通话时长（秒） */
  duration: number
  /** 是否为新记录：0=否, 1=是 */
  new?: number
  /** 缓存的联系人姓名 */
  cached_name?: string | null
  /** 联系人 */
  contact?: Contact
}

/**
 * 通话记录列表响应数据
 */
export interface CallLogListResponseData {
  /** 总记录数 */
  total?: number
  /** 总记录数（API 实际返回字段） */
  count?: number
  /** 通话记录列表（优先使用） */
  list?: CallLogApiItem[]
  /** 通话记录列表（旧字段，兼容用） */
  calllog_list?: CallLogApiItem[]
}

/**
 * 通话记录列表完整 API 响应
 */
export type CallLogListApiResponse = ApiResponse<CallLogListResponseData>

/**
 * 添加通话记录请求参数
 */
export interface AddCallLogRequest {
  /** 电话号码（必填） */
  number: string
  /** 通话类型：1=来电, 2=去电, 3=未接（默认 1） */
  type?: number
  /** 通话时间（Unix 时间戳，毫秒，默认当前时间） */
  date?: number
  /** 通话时长（秒，默认 0） */
  duration?: number
}

/**
 * 批量添加通话记录请求参数
 */
export interface AddCallLogListRequest {
  /** 通话记录列表 */
  calllog_list: AddCallLogRequest[]
}

/**
 * 批量添加通话记录响应（返回创建的通话记录列表）
 */
export type AddCallLogListResponse = ApiResponse<CallLogApiItem[]>

/**
 * 删除通话记录请求参数
 */
export interface DeleteCallLogRequest {
  /** 通话记录 ID */
  id: number
}

/**
 * 批量删除通话记录请求参数
 */
export interface DeleteCallLogListRequest {
  /** 通话记录 ID 数组 */
  ids: number[]
}

/**
 * 批量删除通话记录响应（返回成功删除的记录条数）
 */
export type DeleteCallLogListResponse = ApiResponse<number>

/**
 * 组件使用的通话记录类型（UI 层）
 */
export interface CallLogRecord {
  /** 通话记录 ID（字符串格式，用于 UI） */
  id: string
  /** 电话号码 */
  number: string
  /** 通话类型 */
  type: number
  /** 通话时间（Unix 时间戳，毫秒） */
  date: number
  /** 通话时长（秒） */
  duration: number
  /** 格式化后的通话时间（用于显示） */
  formattedDate?: string
  /** 格式化后的通话时长（用于显示，如：00:05:23） */
  formattedDuration?: string
  /** 通话类型文本（用于显示，如：来电、去电、未接） */
  typeText?: string
  /** 通话类型图标类名 */
  typeIcon?: string
  /** 关联的联系人 */
  contact?: Contact
}
