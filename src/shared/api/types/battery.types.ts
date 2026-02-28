import { ApiResponse } from './common'

/**
 * 电池信息接口
 */
export interface BatteryInfo {
  /** 当前电量值 (0-scale)，-1 表示未知 */
  level: number
  /** 最大电量值，通常为 100 */
  scale: number
  /** 电池状态：1=未知、2=充电中、3=放电中、4=未充电、5=已满 */
  status: number
  /** 充电器连接类型：0=未连接、1=AC、2=USB、4=无线充电 */
  plugged: number
  /** 电池健康状态：1=未知、2=良好、3=过热、4=损坏、5=过压、6=未知故障、7=过冷 */
  health: number
  /** 电池电压 (mV)，-1 表示未知 */
  voltage: number
  /** 电池温度 (0.1°C，需除以10得到摄氏度)，-1 表示未知 */
  temperature: number
  /** 电池技术类型 (如 Li-ion)，可能为 null */
  technology: string | null
  /** 是否存在电池 */
  present: boolean
  /** 电池图标资源 ID */
  'icon-small': number
  /** 最大充电电压 (微伏) */
  max_charging_voltage: number
  /** 最大充电电流 (微安) */
  max_charging_current: number
  /** 电池状态序列号 */
  seq: number
  /** 电池充电计数器 */
  charge_counter: number
  /** 无效充电器标识 */
  invalid_charger: number
  /** 是否低电量 */
  battery_low: boolean
}

/**
 * 获取电池信息响应
 */
export type BatteryInfoResponse = ApiResponse<BatteryInfo>

/**
 * 设置电池信息请求参数
 */
export interface SetBatteryRequest {
  /** 电池电量 (0-100) */
  level?: number
  /** 电池状态: 1=未知、2=充电中、3=放电中、4=未充电、5=已满 */
  status?: number
  /** 电池健康状态: 1=未知、2=良好、3=过热、4=损坏、5=过压、6=未知故障、7=过冷 */
  health?: number
  /** 充电方式: 0=未连接、1=AC充电、2=USB充电、4=无线充电 */
  plugged?: number
  /** 电池技术类型 (如 "Li-ion") */
  technology?: string
  /** 电池温度 (单位: 0.1°C, 如 343 表示 34.3°C) */
  temperature?: number
  /** 当前电压 (单位: mV) */
  voltage?: number
}
