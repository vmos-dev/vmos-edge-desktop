/**
 * 工作流视图的 UI 常量 + 动作评分规则
 *
 * 设计原则:
 * - 每条动作都有 score(ctx) 函数,基于 ElementSignals 能力信号实时打分
 * - 评分函数只读 ctx.signals(平台无关),不直接访问 node.attrs 或 className
 * - 0 = 不渲染;1-29 = 更多;30-69 = 也可以;70-100 = 推荐
 * - 新增动作:加一条规则 + 写打分函数(只依赖 ElementSignals)
 */

import type { ActionType } from '@shared/ipc/workflow.types'
import type { ActionRule, ActionScoreContext, TargetCandidate } from './types'

// ═══════════════ UI 默认值 ═══════════════

/** 应用扫描缓存 TTL ms(5 分钟) */
export const APP_SCAN_CACHE_TTL_MS = 5 * 60 * 1000

/** HTTP 调用超时 ms */
export const HTTP_TIMEOUT_MS = 15 * 1000

// ═══════════════ Flow Engine 轮询 ═══════════════

/** 轮询间隔 ms */
export const FLOW_POLL_INTERVAL_MS = 500

/** 连续失败多少次后认为 flow engine 不可达,停止轮询 */
export const FLOW_MAX_POLL_FAILURES = 3

/** 分桶阈值(详见 ActionRule.score 注释) */
export const BUCKET_THRESHOLDS = {
  top: 70,
  ok: 30
} as const

/** effective target 候选的基础分权重 */
export const TARGET_SCORE_WEIGHTS = {
  selfClickable: 100,
  ancestorClickableDistance1: 90,
  ancestorClickableDistance2: 75,
  ancestorClickableDistance3Plus: 55,
  ancestorScrollable: 70,
  ancestorEditable: 85,
  ancestorCheckable: 80,
  /** 自身是 leaf TextView(有 text/content-desc),父节点可能可点,此时 self 得分中等,让 clickable 祖先胜出 */
  selfLeafWithText: 50,
  unavailable: 0
} as const

/** target resolution 向上回溯的最大层数 */
export const TARGET_ASCEND_MAX_DEPTH = 4

/** recommendActions 的综合分权重(action/target/linkBonus) */
export const COMPOSITE_SCORE_WEIGHTS = {
  target: 0.35,
  action: 0.55,
  linkBonus: 0.1
} as const

// ═══════════════ 上下文加成(数据驱动:链路 + ET 升级 + 重复惩罚) ═══════════════
//
// 设计:
//   链路加分         —— lastAction → currentAction 的步骤链合理性
//   ET 升级加分      —— source 不可交互、升级到合适祖先时给出信号
//   重复操作降分    —— lastTargetId 命中当前 target 且 lastAction 相同时强力降分
//
// 全部用表驱动,新增组合只改表不改逻辑。

/** 链路加分表:lastAction -> currentAction -> 加分 */
const LINK_BONUS: Partial<Record<ActionType, Partial<Record<ActionType, number>>>> = {
  inputText: { tapOn: 15 },
  scrollUntilVisible: { tapOn: 20 },
  extendedWaitUntil: { tapOn: 15 },
  tapOn: { inputText: 10 }
}

/** effective target 升级加分表:action -> 被选中候选的 relation -> 加分 */
export const ET_UPGRADE_BONUS: Partial<
  Record<ActionType, Partial<Record<TargetCandidate['relation'], number>>>
> = {
  tapOn: {
    'ancestor-clickable': 10,
    'ancestor-checkable': 8
  },
  inputText: {
    'ancestor-editable': 10
  },
  scrollUntilVisible: {
    'ancestor-scrollable': 8
  }
}

/** 重复操作惩罚:上一步同动作同 target 时降的分 */
const REPEAT_PENALTY = 30

function contextBonus(actionId: string, ctx: ActionScoreContext): number {
  const last = ctx.recContext.lastAction
  let bonus = 0

  // ── 链路加分 ──
  if (last) {
    const chain = LINK_BONUS[last]?.[actionId as ActionType]
    if (chain) bonus += chain

    // 链路加分对"tapOn → inputText"需要 target editable(避免 Tap 一个按钮后马上推 input)
    if (last === 'tapOn' && actionId === 'inputText' && !ctx.signals.canInput) {
      bonus -= 10
    }

    // 连续断言链:继续断言(assertVisible/assertNotVisible/assertTrue 等)
    if (last.startsWith('assert') && actionId.startsWith('assert')) bonus += 10
  }

  // ── ET 升级加分 ──
  const et = ctx.effectiveTarget
  if (et && et.source.id !== et.target.id) {
    const rel = et.candidates.find((c) => c.node.id === et.target.id)?.relation
    if (rel) {
      const upgrade = ET_UPGRADE_BONUS[actionId as ActionType]?.[rel]
      if (upgrade) bonus += upgrade
    }
  }

  // ── 重复操作惩罚 ──
  // 上一步已经对同 target 执行过同一动作时,再推荐相同动作很可能是冗余。
  // lastTargetId 来自 ViewModel,是"上一步 selector 的主 value 或 target node id 字符串"。
  const lastTargetId = ctx.recContext.lastTargetId
  if (lastTargetId && last === actionId) {
    const currentTargetKey = targetKey(ctx)
    if (currentTargetKey !== null && currentTargetKey === lastTargetId) {
      bonus -= REPEAT_PENALTY
    }
  }

  return bonus
}

/** 产出当前候选 target 的字符串标识,用于与 recContext.lastTargetId 比较 */
function targetKey(ctx: ActionScoreContext): string | null {
  const node = ctx.effectiveTarget?.target ?? ctx.node
  const text = node.attrs['text']?.trim()
  if (text) return `text:${text}`
  const rid = node.attrs['resource-id']?.trim()
  if (rid) return `id:${rid}`
  return `node:${node.id}`
}

// ═══════════════ 动作规则(平坦列表,每条自带打分) ═══════════════

export const ACTION_RULES: readonly ActionRule[] = [
  // ─────────── 基础交互 ───────────
  {
    id: 'tapOn',
    name: '点击',
    icon: '👆',
    group: '基础交互',
    score: (ctx) => {
      const s = ctx.signals
      if (!s.enabled) return 5
      let base: number
      if (s.canTap) base = 100
      else if (s.canSelect) base = 95
      else if (s.canToggle) base = 90
      else if (s.canPage) base = 85
      else if (s.canLongPress) base = 70
      else if (s.isInDialog && (s.hasText || s.hasDescription)) base = 55
      else if (s.hasText || s.hasDescription) base = 40
      else base = 15
      return Math.min(100, base + contextBonus('tapOn', ctx))
    }
  },
  {
    id: 'longPressOn',
    name: '长按',
    icon: '👆',
    group: '基础交互',
    score: (ctx) => {
      const s = ctx.signals
      if (!s.enabled) return 0
      if (s.canLongPress) return 95
      if (s.canTap) return 35
      return 10
    }
  },
  {
    id: 'doubleTapOn',
    name: '双击',
    icon: '👆',
    group: '基础交互',
    score: (ctx) => {
      const s = ctx.signals
      if (!s.enabled) return 0
      if (s.canTap && s.isLeaf && !s.hasText && !s.hasDescription) return 75
      if (s.canTap) return 30
      return 15
    }
  },

  // ─────────── 输入 ───────────
  {
    id: 'inputText',
    name: '输入文字',
    icon: '⌨️',
    group: '输入',
    variant: 'brand',
    score: (ctx) => {
      const s = ctx.signals
      if (!s.enabled) return 0
      if (!s.canInput) return 10
      return Math.min(100, 100 + contextBonus('inputText', ctx))
    }
  },
  {
    id: 'eraseText',
    name: '清空输入',
    icon: '🧹',
    group: '输入',
    score: (ctx) => {
      const s = ctx.signals
      if (!s.enabled || !s.canInput) return 0
      return s.hasText ? 95 : 40
    }
  },
  {
    id: 'pasteText',
    name: '粘贴剪贴板',
    icon: '📋',
    group: '输入',
    score: (ctx) => {
      const s = ctx.signals
      if (!s.enabled || !s.canInput) return 0
      return 75
    }
  },

  // ─────────── 找到再操作 ───────────
  {
    id: 'scrollUntilVisible',
    name: '滚到可见后点击',
    icon: '🔍',
    group: '找到再操作',
    score: (ctx) => {
      const s = ctx.signals
      if (!s.onScreen) return 100
      if (s.canScroll) return 60
      if (s.isInScrollable) return 50
      return 35
    }
  },
  {
    id: 'extendedWaitUntil',
    name: '等它出现后操作',
    icon: '⏱',
    group: '找到再操作',
    score: () => 45
  },
  {
    id: 'scroll',
    name: '向下滚一次',
    icon: '📜',
    group: '找到再操作',
    score: (ctx) => {
      const s = ctx.signals
      if (s.canScroll) return 85
      if (s.isInScrollable) return 45
      return 15
    }
  },
  {
    id: 'swipe',
    name: '滑动屏幕',
    icon: '👉',
    group: '找到再操作',
    score: (ctx) => {
      const s = ctx.signals
      if (s.canSlide) return 95
      if (s.canPage) return 85
      if (s.canScroll) return 55
      if (s.isInScrollable) return 35
      return 12
    }
  },

  // ─────────── 检查 / 断言 ───────────
  {
    id: 'assertVisible',
    name: '检查必须可见',
    icon: '✅',
    group: '检查',
    variant: 'success',
    score: (ctx) => {
      const s = ctx.signals
      let base: number
      if (s.hasText) base = 90
      else if (s.hasDescription) base = 80
      else if (s.isLeaf && !s.hasText) base = 65
      else base = 45
      return Math.min(100, base + contextBonus('assertVisible', ctx))
    }
  },
  {
    id: 'assertNotVisible',
    name: '检查必须不可见',
    icon: '❌',
    group: '检查',
    variant: 'danger',
    score: () => 25
  },

  // ─────────── 读取 ───────────
  {
    id: 'copyTextFrom',
    name: '复制到剪贴板',
    icon: '📋',
    group: '读取',
    score: (ctx) => {
      const s = ctx.signals
      if (!s.hasText) return 15
      if (s.canInput) return 65
      return 85
    }
  }
] as const

// ═══════════════ 元素类型(metadata 用) ═══════════════
//
// ElementType 只用于 Step.metadata 持久化(便于后续分析/统计)
// 不再参与动作筛选

export const ELEMENT_CLASS_MAP: Record<string, string> = {
  'android.widget.Button': 'button',
  'android.widget.ImageButton': 'image-button',
  'android.widget.EditText': 'input-empty',
  'android.widget.Switch': 'toggle',
  'android.widget.CheckBox': 'toggle',
  'android.widget.RadioButton': 'toggle',
  'android.widget.TextView': 'text',
  'android.widget.ImageView': 'image',
  'android.webkit.WebView': 'webview'
}
