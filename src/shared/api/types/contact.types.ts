import type { ApiResponse } from './common'

/**
 * 联系人 API 相关类型
 */

// API 返回的联系人数据项（匹配 API 文档格式）
export interface ContactApiItem {
  _id: number
  display_name: string
  has_phone_number: number // 1=有, 0=无
  phones: string[]
}

// 联系人列表响应数据
export interface ContactListResponseData {
  offset?: number
  limit?: number
  count?: number
  /** 联系人列表（优先使用） */
  list?: ContactApiItem[]
  /** 联系人列表（旧字段，兼容用） */
  contacts?: ContactApiItem[]
}

// 联系人列表完整 API 响应
export type ContactListApiResponse = ApiResponse<ContactListResponseData>

// 添加联系人请求参数
export interface AddContactRequest {
  name: string
  phone: string
  email?: string
  organization?: string
  title?: string
  note?: string
}

// 批量添加联系人请求参数
export interface AddContactListRequest {
  contact_list: AddContactRequest[]
}

// 批量添加联系人响应（返回创建的联系人列表）
export type AddContactListResponse = ApiResponse<ContactApiItem[]>

// 删除联系人请求参数
export interface DeleteContactRequest {
  id: number
}

// 批量删除联系人请求参数
export interface DeleteContactListRequest {
  ids: number[]
}

// 批量删除联系人响应（返回成功删除的记录条数）
export type DeleteContactListResponse = ApiResponse<number>

/**
 * 组件使用的联系人类型（UI 层）
 */
export interface Contact {
  id: string
  name: string
  phone: string
  phones?: string[]
  email?: string
  company?: string
  organization?: string
  title?: string
  notes?: string
  note?: string
  display_name?: string
}
