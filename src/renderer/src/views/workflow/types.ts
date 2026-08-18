/**
 * 工作流视图的本地类型
 *
 * 共享类型(与主进程通信用)来自 @shared/ipc/workflow.types
 * 这里只放纯 UI 类型
 */

export type {
  Workflow,
  WorkflowListItem,
  Step,
  StepMetadata,
  Selector,
  SelectorStrategy,
  ActionType,
  ElementType,
  ActionParams,
  StepCondition,
  AppInfo,
  Recommendation
} from '@shared/ipc/workflow.types'

import type { ActionType, Step } from '@shared/ipc/workflow.types'
import type { UiNode } from '@renderer/components/ui-inspector/types'

// ═══════════════ UI 层类型 ═══════════════

/** 运行状态 */
export type RunState = 'idle' | 'running' | 'error' | 'success'

// ─── 能力信号(平台无关,评分引擎唯一输入) ───

export interface ElementSignals {
  canTap: boolean
  canLongPress: boolean
  canInput: boolean
  canToggle: boolean
  canSlide: boolean
  canSelect: boolean
  canScroll: boolean
  canPage: boolean

  hasText: boolean
  hasDescription: boolean
  hasIdentifier: boolean

  enabled: boolean

  onScreen: boolean
  isLeaf: boolean
  isInScrollable: boolean
  isInDialog: boolean
}

// ─── Effective Target Resolution(两阶段推荐:阶段 1) ───

/** 节点树上下文:推荐器做父链回溯/子树遍历需要的最小结构 */
export interface NodeTreeContext {
  /** 整棵树根节点数组(沿用 DumpResult.tree) */
  roots: readonly UiNode[]
  /** 节点 id → 父节点的 O(1) 索引 */
  parentMap: ReadonlyMap<number, UiNode>
  /** 节点 id → 节点本身 */
  nodeMap: ReadonlyMap<number, UiNode>
  /** 屏幕尺寸(用于 isOnScreen) */
  screen?: { width: number; height: number }
}

/** target resolution 时的抽象动作大类(仅算法内部使用,不外泄为最终 action) */
export type TargetKind =
  | 'click-like'
  | 'input-like'
  | 'scroll-like'
  | 'toggle-like'
  | 'verify-like'
  | 'generic'

/** effective target 的候选(source 自己/最近 clickable 祖先/最近 editable 祖先...) */
export interface TargetCandidate {
  node: UiNode
  relation:
    | 'self'
    | 'ancestor-clickable'
    | 'ancestor-scrollable'
    | 'ancestor-editable'
    | 'ancestor-checkable'
    | 'ancestor-focusable'
  /** 向上回溯的距离,0 = self */
  distance: number
  /** 0-100 */
  targetScore: number
  featuresUsed: string[]
}

/** effective target 解析结果 */
export interface EffectiveTarget {
  /** 用户点击的原始节点 */
  source: UiNode
  /** 真正应该操作的节点(= candidates[0].node,已按 targetScore 降序) */
  target: UiNode
  /** 所有候选(降序);调试和兜底用 */
  candidates: TargetCandidate[]
}

// ─── 推荐上下文 ───

/** 推荐算法的上下文(看前序步骤、历史操作做智能推荐) */
export interface RecommendationContext {
  /** 上一步信息,影响当前推荐 */
  lastAction?: ActionType
  lastTargetId?: string
  /** 最近步骤中是否用过变量定义 */
  hasVariableUsage: boolean
  /** 总步骤数 */
  stepCount: number
  /** 整棵树上下文(可选;未提供则退化为只看 sourceNode) */
  tree?: NodeTreeContext
}

/** 动作打分函数的入参 */
export interface ActionScoreContext {
  /** 打分时实际使用的节点(= effectiveTarget?.target ?? 源节点) */
  node: UiNode
  /** 能力信号(评分函数通过 signals 读取,不直接读 node.attrs) */
  signals: ElementSignals
  /** 两阶段流程解析出的 effective target;未提供 tree 时为 undefined */
  effectiveTarget?: EffectiveTarget
  recContext: RecommendationContext
  /** 屏幕尺寸,用于判断元素是否可见 */
  screen?: { width: number; height: number }
}

/** 工程级推荐结果(recommendActions 主流程输出) */
export interface ActionRecommendation {
  /** 用户点击的源节点 id */
  sourceId: number
  /** 实际被操作的节点 id(可能=source,也可能是某个祖先) */
  targetId: number
  /** 最终使用的现有 ActionType(不发明新的) */
  action: ActionType
  /** 综合分 0-100 */
  score: number
  /** 置信度 0-1 */
  confidence: number
  /** 人类可读理由 */
  reason: string
  /** 参与打分的特征(调试用) */
  featuresUsed: string[]
  /** 最终物化的步骤(可能多步,每步 action 都是现有 ActionType) */
  steps: Array<Omit<Step, 'id'>>
  bucket: 'top' | 'ok' | 'more'
}

/** 每条动作的元数据 + 打分函数(数据驱动) */
export interface ActionRule {
  id: ActionType
  name: string
  icon: string
  /** 分组标签,仅供展示 */
  group: '基础交互' | '输入' | '找到再操作' | '检查' | '读取' | '通用'
  /** 视觉变体 */
  variant?: 'primary' | 'success' | 'danger' | 'brand'
  /**
   * 动作相关度打分
   * 0       = 完全不适用(UI 也可以直接不渲染)
   * 1–29    = 冷门兜底,默认归入"更多"桶
   * 30–69   = 可以做,归入"也可以"桶
   * 70–100  = 推荐做,归入"推荐"桶
   * 返回值直接用于排序,越大越靠前
   */
  score: (ctx: ActionScoreContext) => number
}

/** 评分后的动作(UI 展示用) */
export interface ScoredAction {
  rule: ActionRule
  /** 评分结果 0–100 */
  value: number
  /** 落在哪个桶:top ≥70,ok 30–69,more <30 */
  bucket: 'top' | 'ok' | 'more'
}

/** 三档分桶结果(都显示,桶内按分排序) */
export interface ActionBuckets {
  top: ScoredAction[]
  ok: ScoredAction[]
  more: ScoredAction[]
}
