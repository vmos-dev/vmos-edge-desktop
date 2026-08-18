/**
 * actionCategoryStyle · 类别色板 + 图标(纯数据)
 *
 * 灵感来源:Apple Shortcuts(每类一个圆色 icon)/ Linear(slate 底 + 类别色点)
 *
 * 单一职责:把 ActionCategory → { 4 档色板, 矢量图标 }。
 * 不知道 action 的存在;调用方先用 ACTION_REGISTRY[id].category 拿到 category,再喂给本模块。
 *
 * 色板 4 档(对应交互 / 选中 / 描边 / 文字):
 *   bg50  → icon 圆背景 / 行 hover 背景
 *   bg100 → 行 selected 背景
 *   c500  → 类别色条 / icon 描边 / chip 文字
 *   c700  → 暗色文字(高对比 ≥ 4.5:1)
 *
 * 颜色基线 = Tailwind v3 调色板;EP token 没有这十种 hue,直接落 hex。
 */

import type { Component } from 'vue'
import {
  Aim,
  Check,
  Clock,
  Connection,
  EditPen,
  Iphone,
  Link,
  MagicStick,
  Setting,
  Sort,
  Switch
} from '@element-plus/icons-vue'
import type { ActionCategory } from './actionRegistry'

export interface CategoryStyle {
  /** icon 圆背景 / row hover */
  bg50: string
  /** row selected */
  bg100: string
  /** 色条 / icon 描边 / chip 文字 */
  c500: string
  /** 暗色文字(WCAG 4.5:1 安全) */
  c700: string
  /** 类别图标(EP icons,统一 stroke 风格) */
  icon: Component
}

export const CATEGORY_STYLES: Record<ActionCategory, CategoryStyle> = {
  tap: {
    bg50: '#eff6ff',
    bg100: '#dbeafe',
    c500: '#3b82f6',
    c700: '#1d4ed8',
    icon: Aim
  },
  input: {
    bg50: '#eef2ff',
    bg100: '#e0e7ff',
    c500: '#6366f1',
    c700: '#4338ca',
    icon: EditPen
  },
  scroll: {
    bg50: '#ecfeff',
    bg100: '#cffafe',
    c500: '#06b6d4',
    c700: '#0e7490',
    icon: Sort
  },
  wait: {
    bg50: '#fffbeb',
    bg100: '#fef3c7',
    c500: '#f59e0b',
    c700: '#b45309',
    icon: Clock
  },
  app: {
    bg50: '#f0fdfa',
    bg100: '#ccfbf1',
    c500: '#14b8a6',
    c700: '#0f766e',
    icon: Iphone
  },
  assert: {
    bg50: '#ecfdf5',
    bg100: '#d1fae5',
    c500: '#10b981',
    c700: '#047857',
    icon: Check
  },
  flow: {
    bg50: '#f5f3ff',
    bg100: '#ede9fe',
    c500: '#8b5cf6',
    c700: '#6d28d9',
    icon: Switch
  },
  device: {
    bg50: '#f8fafc',
    bg100: '#f1f5f9',
    c500: '#64748b',
    c700: '#334155',
    icon: Setting
  },
  http: {
    bg50: '#fdf2f8',
    bg100: '#fce7f3',
    c500: '#ec4899',
    c700: '#be185d',
    icon: Link
  },
  script: {
    bg50: '#faf5ff',
    bg100: '#f3e8ff',
    c500: '#a855f7',
    c700: '#7e22ce',
    icon: MagicStick
  }
}

/** 兜底色板:未知 category(理论上不会发生)用 device(slate)代替 */
const FALLBACK_STYLE: CategoryStyle = CATEGORY_STYLES.device

/** 取某 category 的色板;未知返回 fallback,绝不抛 */
export function categoryStyle(category: ActionCategory | undefined): CategoryStyle {
  if (!category) return FALLBACK_STYLE
  return CATEGORY_STYLES[category] ?? FALLBACK_STYLE
}

/** Connection 也作为可选 icon 暴露(给将来 picker 等场景) */
export { Connection }
