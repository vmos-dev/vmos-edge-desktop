/**
 * UiNode attr 读取工具 + 能力信号提取(共享)
 *
 * 底层属性读取(isClickable 等)供 targetResolver / 旧路径使用。
 * extractSignals() 是评分引擎的唯一入口:
 *   UiNode → ElementSignals(纯 boolean,平台无关)
 *
 * 平台适配原则:
 *   className 等 Android 特有信息仅在 extractSignals 内部消化,
 *   产出的 ElementSignals 不包含任何平台字符串,评分层完全解耦。
 */

import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { ElementSignals, NodeTreeContext } from '../types'
import { findAncestor } from './nodeTreeContext'

function attrTrue(node: UiNode, key: string): boolean {
  const v = node.attrs[key]
  return v === 'true' || v === '1'
}

export function isClickable(node: UiNode): boolean {
  return attrTrue(node, 'clickable')
}

export function isLongClickable(node: UiNode): boolean {
  return attrTrue(node, 'long-clickable')
}

export function isCheckable(node: UiNode): boolean {
  return attrTrue(node, 'checkable')
}

export function isScrollable(node: UiNode): boolean {
  return attrTrue(node, 'scrollable')
}

export function isEnabled(node: UiNode): boolean {
  // 只要不是显式 false 都当 enabled(大部分节点不声明此 attr)
  return node.attrs['enabled'] !== 'false' && node.attrs['enabled'] !== '0'
}

export function isEditable(node: UiNode): boolean {
  const cls = node.className || ''
  const simple = cls.split('.').pop() ?? ''
  return (
    cls.includes('EditText') ||
    simple === 'TextInputEditText' ||
    cls.includes('SearchView') ||
    cls.includes('AutoCompleteTextView')
  )
}

export function hasText(node: UiNode): boolean {
  return !!node.attrs['text']?.trim()
}

export function hasContentDesc(node: UiNode): boolean {
  return !!node.attrs['content-desc']?.trim()
}

export function isImage(node: UiNode): boolean {
  return (node.className || '').includes('ImageView')
}

/** 元素中心点是否在屏幕内;屏幕尺寸未知视为可见 */
export function isOnScreen(node: UiNode, screen?: { width: number; height: number }): boolean {
  if (!screen) return true
  const [x1, y1, x2, y2] = node.bounds
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  return cx >= 0 && cx <= screen.width && cy >= 0 && cy <= screen.height
}

export function isFocusable(node: UiNode): boolean {
  return attrTrue(node, 'focusable')
}

export function isChecked(node: UiNode): boolean {
  return attrTrue(node, 'checked')
}

export function isSelected(node: UiNode): boolean {
  return attrTrue(node, 'selected')
}

/** 任一种可交互特征 */
export function isActionable(node: UiNode): boolean {
  return (
    isClickable(node) ||
    isLongClickable(node) ||
    isCheckable(node) ||
    isScrollable(node) ||
    isEditable(node)
  )
}

// ═══════════════ 能力信号提取(平台适配层) ═══════════════

function isSliderLike(node: UiNode): boolean {
  const cls = node.className ?? ''
  const simple = cls.split('.').pop() ?? ''
  if (/SeekBar|Slider|RangeSlider/i.test(simple)) return true
  return isScrollable(node) && !node.children?.length
}

function isPageLike(node: UiNode): boolean {
  const cls = node.className ?? ''
  return /ViewPager/i.test(cls)
}

function isSelectLike(node: UiNode): boolean {
  const cls = node.className ?? ''
  return /Spinner/i.test(cls)
}

function isDialogLike(node: UiNode): boolean {
  const cls = node.className ?? ''
  return /Dialog|BottomSheet/i.test(cls)
}

export function extractSignals(
  node: UiNode,
  screen?: { width: number; height: number },
  tree?: NodeTreeContext
): ElementSignals {
  const clickable = isClickable(node)
  const checkable = isCheckable(node)
  const scrollable = isScrollable(node)
  const slider = isSliderLike(node)

  return {
    canTap: clickable && !checkable,
    canLongPress: isLongClickable(node),
    canInput: isEditable(node),
    canToggle: checkable,
    canSlide: slider,
    canSelect: isSelectLike(node),
    canScroll: scrollable && !slider,
    canPage: isPageLike(node),

    hasText: hasText(node),
    hasDescription: hasContentDesc(node),
    hasIdentifier: !!node.attrs['resource-id']?.trim(),

    enabled: isEnabled(node),

    onScreen: isOnScreen(node, screen),
    isLeaf: !node.children?.length,
    isInScrollable: tree ? !!findAncestor(node, tree, isScrollable) : false,
    isInDialog: tree ? !!findAncestor(node, tree, isDialogLike) : false
  }
}
