/**
 * UI 节点"可交互性"判定(对齐 Android 工业标准算法)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 算法出处
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 本实现对齐 Android AOSP 的 accessibility importance 判定,并扩展到自动化场景。
 * 参考:
 *
 *   1. Android `View.isActionableForAccessibility()` (AOSP)
 *      = clickable | long-clickable | focusable
 *
 *   2. Android `AccessibilityNodeInfo.isImportantForAccessibility()` AUTO 模式
 *      (frameworks/base/core/java/android/view/View.java)
 *      = isActionableForAccessibility()
 *        || hasContentDescription()
 *        || (TextView && hasText)
 *        || accessibilityDelegate/headingFor 等高级标志
 *
 *   3. AndroidX UiAutomator `AccessibilityNodeInfo` filter — 增加 scrollable / editable / checkable
 *      用于自动化测试目的(非纯 a11y),覆盖:
 *        - RecyclerView / ScrollView 滚动
 *        - CheckBox / Switch 状态切换
 *        - EditText 文本输入
 *
 *   4. Maestro/Appium Inspector 的 view filter — 实际使用该算法的现代移动自动化框架
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 为什么这是"适配所有 dump"的通用解
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. 不依赖 App 特定的 resource-id / 类名 / 业务关键字 —— 只看 Android 视图系统
 *    本身的可交互/可语义标志。这些标志由 Android 框架定义,所有遵循 a11y 规范的
 *    App(压倒性多数,包括原生 View、Jetpack Compose、WebView 外壳、游戏、自定义
 *    控件)都会正确设置。
 *
 * 2. 不需要"纯装饰叶子"这种启发式。规范 App 里装饰图片总是被 clickable/focusable
 *    祖先包裹(CardView / action_target / ListItem / Button)。祖先被准则 B 命中
 *    后画出边框,Android 的 touch 事件冒泡机制保证点子节点触发祖先 onClick。
 *
 * 3. 不考虑 enabled=false:automation 脚本合法场景包括"断言按钮禁用"(assertNot-
 *    Visible 或 assertTrue)以及"禁用后仍点击触发 Toast"。把 enabled 检查交给
 *    脚本运行时,而非渲染层过滤。
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 准则
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   前置: 面积 > 0(零大小节点无法点击,也不能绘制)
 *
 *   准则 A — SEMANTIC(Android isImportantForAccessibility 语义部分)
 *     hasText(node) || hasContentDescription(node)
 *
 *   准则 B — INTERACTIVE(Android isActionableForAccessibility + automation 扩展)
 *     clickable | long-clickable | focusable     -- Android 原生可交互三要素
 *     | checkable | scrollable                   -- automation 扩展
 *
 *   准则 C — INPUT(Android IME 接收目标)
 *     className ∈ {EditText, TextInput, SearchView, AutoCompleteTextView,
 *                  TextInputEditText}
 *
 *   → 节点可交互 ⇔ A ∨ B ∨ C
 */

import type { UiNode } from './types'

// ──────────────── 基础访问器(纯函数,与 workflow/utils/nodeAttr 独立,避免跨层依赖) ────────────────

function boolAttr(v: string | undefined): boolean {
  // Android dump 里布尔 attr 是字符串 "true"/"false",历史 dump 也见过 "1"/"0"
  return v === 'true' || v === '1'
}

export function hasText(node: UiNode): boolean {
  const v = node.attrs['text']
  return typeof v === 'string' && v.trim().length > 0
}

export function hasContentDescription(node: UiNode): boolean {
  const v = node.attrs['content-desc']
  return typeof v === 'string' && v.trim().length > 0
}

export function isClickable(node: UiNode): boolean {
  return boolAttr(node.attrs['clickable'])
}

export function isLongClickable(node: UiNode): boolean {
  return boolAttr(node.attrs['long-clickable'])
}

export function isFocusable(node: UiNode): boolean {
  return boolAttr(node.attrs['focusable'])
}

export function isCheckable(node: UiNode): boolean {
  return boolAttr(node.attrs['checkable'])
}

export function isScrollable(node: UiNode): boolean {
  return boolAttr(node.attrs['scrollable'])
}

/**
 * 输入控件类判定(按 className 后缀匹配)。
 * 注:Android 的输入能力没有"isEditable" 属性,只能用类名识别。
 * 列入的都是 Android API 层明确标记为 "accepts text input" 的组件。
 */
export function isEditableByClass(node: UiNode): boolean {
  const cls = node.className || ''
  return (
    cls.endsWith('EditText') ||
    cls.endsWith('TextInputEditText') ||
    cls.endsWith('TextInput') ||
    cls.endsWith('SearchView') ||
    cls.endsWith('AutoCompleteTextView')
  )
}

export function hasPositiveArea(node: UiNode): boolean {
  const [x1, y1, x2, y2] = node.bounds
  return x2 - x1 > 0 && y2 - y1 > 0
}

// ──────────────── 准则分组 ────────────────

/** 准则 A —— 语义锚点 */
export function hasSemanticAnchor(node: UiNode): boolean {
  return hasText(node) || hasContentDescription(node)
}

/** 准则 B —— 交互特征 */
export function hasInteractiveTrait(node: UiNode): boolean {
  return (
    isClickable(node) ||
    isLongClickable(node) ||
    isFocusable(node) ||
    isCheckable(node) ||
    isScrollable(node)
  )
}

/** 准则 C —— 输入控件 */
export function isInputControl(node: UiNode): boolean {
  return isEditableByClass(node)
}

// ──────────────── 顶层判定 ────────────────

/**
 * 节点是否"可交互"(overlay 应该画边框 + 推荐算法应该能选中)
 *
 * 返回 true 当且仅当:
 *   面积 > 0 且 (hasSemanticAnchor ∨ hasInteractiveTrait ∨ isInputControl)
 */
export function isInteractable(node: UiNode): boolean {
  if (!hasPositiveArea(node)) return false
  return hasSemanticAnchor(node) || hasInteractiveTrait(node) || isInputControl(node)
}

/**
 * 节点命中了哪条准则(调试/可视化/分级样式用)
 * 返回空数组表示不可交互
 */
export function classifyNode(node: UiNode): Array<'semantic' | 'interactive' | 'input'> {
  if (!hasPositiveArea(node)) return []
  const tags: Array<'semantic' | 'interactive' | 'input'> = []
  if (hasSemanticAnchor(node)) tags.push('semantic')
  if (hasInteractiveTrait(node)) tags.push('interactive')
  if (isInputControl(node)) tags.push('input')
  return tags
}

// ═══════════════ 定位价值评分(selector quality) ═══════════════
//
// 一个节点对于"生成稳定脚本 selector"的价值,用于 hit-test tie-break、
// effective target 选择、overlay 渲染优先级等场景。
//
// 评分依据(从最稳到最脆):
//   1. text:用户可见文本。极稳定的锚点。脚本里 `tapOn: "登录"` 几乎不随版本变。
//   2. content-desc:a11y 描述,由 App 开发者显式设定,基本等价 text 的稳定度。
//   3. resource-id:开发者设的视图 id。通常稳定,但偶有混淆(如 "com.x:id/abc")。
//   4. 交互特征:无锚点的 clickable/focusable 节点 —— 只能退回到 point 坐标,
//      容易因布局变化失效。
//
// 不依赖类名、不依赖业务关键词。任何遵循 Android a11y 规范的 App 都适用。
//
// 权重相对值比绝对值重要:确保 text ≈ desc > resource-id ≥ interactive-only。

const WEIGHT_TEXT = 5
const WEIGHT_CONTENT_DESC = 5
const WEIGHT_RESOURCE_ID = 2
const WEIGHT_INTERACTIVE = 1

export function selectorLocatability(node: UiNode): number {
  let s = 0
  if (node.attrs['text']?.trim()) s += WEIGHT_TEXT
  if (node.attrs['content-desc']?.trim()) s += WEIGHT_CONTENT_DESC
  if (node.attrs['resource-id']?.trim()) s += WEIGHT_RESOURCE_ID
  // 交互特征作为最弱 tie-breaker(纯坐标可定位但不稳)
  if (hasInteractiveTrait(node)) s += WEIGHT_INTERACTIVE
  return s
}
