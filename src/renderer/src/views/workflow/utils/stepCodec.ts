/**
 * stepCodec · Step ↔ YAML body 的单一真相源(serialize 侧)
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *                                架构动机
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 之前 serialize 逻辑存在两份:
 *   - stepsToYaml.ts::trySerializeAction (全量保存用)
 *   - yamlOps.ts::stepToYamlValue       (在线编辑用)
 * 两份同一套 switch,修一处常忘另一处(scrollUntilVisible 的 direction 丢失 bug 即源于此)。
 *
 * 现在两者都 delegate 到本模块的 serializeActionBody(step)。单一真相源。
 * 加字段 / 改格式 / 对齐 schema 只改这里一处。
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *                          数据完整性原则
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 1. opaque 透传:step.opaque && step.raw 的整条写回,不动内部
 * 2. 选择器动作:{ dedicated: selVal, ...step.params, ...meta }
 * 3. 纯参数动作:基础字段(text/duration/...) + spread step.params 里的其他键
 * 4. 复合容器:{ ...step.params, commands: children, ...meta }
 * 5. 未知 action 兜底:{ action: params ?? {} }
 *
 * "params 剩余键必 spread" 是防丢的通用不变量:
 * 只要 parse 把未消费的字段塞进 params,serialize 就自动还原出去。
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *                        返回值约定
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 返回值是 YAML 中 `- ...` 那一项的值:
 *   - string  → YAML 输出为 bare 命令 `- action`
 *   - object  → YAML 输出为 `- action: { ...body }`(可能是 { [action]: body })
 *   - null    → 表示"放弃序列化";由调用方决定用 bare 兜底还是拒绝写入
 *
 * 本模块不认识 Step.disabled 的含义(runtime 状态),调用方自己决定是否 skip。
 */

import type { Step, ActionType } from '@shared/ipc/workflow.types'
import { ATOMIC_WITH_SELECTOR, BARE_OR_OBJECT, COMPOSITE_WITH_CHILDREN } from './actionSets'

/** 通用 meta 字段:和 body 里能冒出的 YAML key 同名 */
const COMMON_META_KEYS = ['label', 'optional', 'chance', 'when'] as const

/** 仅在 Step 内部使用、不该写入 YAML 的 params key(parse 侧标识用) */
const INTERNAL_PARAM_KEYS: ReadonlySet<string> = new Set([
  'waitForVisible' // extendedWaitUntil 的 polarity 标记(解码成 visible/notVisible 键名)
])

// ──────────────── helpers ────────────────

function attachMeta(step: Step, target: Record<string, unknown>): Record<string, unknown> {
  if (step.label) target.label = step.label
  if (step.optional) target.optional = true
  if (step.when) target.when = step.when
  if (typeof step.chance === 'number') target.chance = step.chance
  return target
}

/** 把 step.params 里"可写回 YAML 的键"收集成对象;过滤 internal key 和 meta key */
function publicParams(step: Step): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(step.params ?? {})) {
    if (INTERNAL_PARAM_KEYS.has(k)) continue
    if ((COMMON_META_KEYS as readonly string[]).includes(k)) continue
    out[k] = v
  }
  return out
}

function selectorValue(step: Step): unknown {
  const primary = step.selector?.primary
  if (!primary) return undefined
  const v = primary.value
  if (v == null) return undefined
  if (typeof v === 'object') return v
  if (primary.type === 'id') return { id: v }
  if (primary.type === 'point') return { point: v }
  return v
}

/** 返回 true 表示 step 的 params 里没有任何可写回 YAML 的键(可以 bare 输出) */
function hasNoPublicParams(step: Step): boolean {
  return Object.keys(publicParams(step)).length === 0
}

// ──────────────── main codec ────────────────

/**
 * 把 Step 序列化为 YAML item 的 value。
 * 返回 null 表示"无法完整序列化",调用方决定兜底策略。
 */
export function serializeActionBody(step: Step): unknown {
  // 1) opaque 透传
  if (step.opaque && step.raw !== undefined) {
    return step.raw
  }

  // 2) 复合容器:repeat / retry / runFlow
  if (step.children && COMPOSITE_WITH_CHILDREN.has(step.action)) {
    const body: Record<string, unknown> = { ...publicParams(step) }
    body.commands = step.children
      .map((child) => wrapStepItem(serializeActionBody(child)))
      .filter((v) => v !== null)
    attachMeta(step, body)
    return { [step.action]: body }
  }

  // 3) branch
  if (step.action === 'branch' && step.branches) {
    const arms = step.branches.map((arm) => {
      const armObj: Record<string, unknown> = {}
      if (arm.when) armObj.when = arm.when
      armObj.commands = arm.children
        .map((child) => wrapStepItem(serializeActionBody(child)))
        .filter((v) => v !== null)
      return armObj
    })
    return { branch: arms }
  }

  // 4) 选择器动作
  if (ATOMIC_WITH_SELECTOR.has(step.action)) {
    const selVal = selectorValue(step)
    if (selVal == null) return null // 调用方兜底

    // 极简路径:纯字符串 selector + 无 meta + 无 public params → `- action: "text"`
    const noMeta = !step.label && !step.optional && !step.when && step.chance == null
    if (typeof selVal === 'string' && noMeta && hasNoPublicParams(step)) {
      return { [step.action]: selVal }
    }

    const base: Record<string, unknown> =
      typeof selVal === 'string' ? { text: selVal } : { ...(selVal as Record<string, unknown>) }

    // 非 selector 的 params(timeout / repeat / ...) 也要写回
    for (const [k, v] of Object.entries(publicParams(step))) base[k] = v
    attachMeta(step, base)
    return { [step.action]: base }
  }

  // 5) inputText / pressKey / takeScreenshot:核心字段 + 其他 params
  // 规则:无 extras + 无 meta → 扁平形式;否则对象形式(并 attach meta)
  if (step.action === 'inputText') {
    const text = (step.params?.text as string | undefined) ?? ''
    const extras = omit(publicParams(step), ['text'])
    if (Object.keys(extras).length === 0 && !hasAnyMeta(step)) {
      return { inputText: text || '' }
    }
    const body: Record<string, unknown> = { text, ...extras }
    attachMeta(step, body)
    return { inputText: body }
  }
  if (step.action === 'pressKey') {
    const key =
      (step.params?.key as string | undefined) ??
      (step.params?.text as string | undefined) ??
      'Back'
    const extras = omit(publicParams(step), ['key', 'text'])
    if (Object.keys(extras).length === 0 && !hasAnyMeta(step)) return { pressKey: key }
    const body: Record<string, unknown> = { key, ...extras }
    attachMeta(step, body)
    return { pressKey: body }
  }
  if (step.action === 'takeScreenshot') {
    const path =
      (step.params?.path as string | undefined) ?? (step.params?.text as string | undefined) ?? ''
    const extras = omit(publicParams(step), ['path', 'text'])
    if (Object.keys(extras).length === 0 && !hasAnyMeta(step)) {
      return { takeScreenshot: path || 'screenshot.png' }
    }
    const body: Record<string, unknown> = { path: path || 'screenshot.png', ...extras }
    attachMeta(step, body)
    return { takeScreenshot: body }
  }

  // 6) sleep
  if (step.action === 'sleep') {
    const duration = step.params?.duration
    const extras = omit(publicParams(step), ['duration'])
    if (Object.keys(extras).length === 0 && !hasAnyMeta(step)) {
      return { sleep: duration ?? 1000 }
    }
    const body: Record<string, unknown> = { duration: duration ?? 1000, ...extras }
    attachMeta(step, body)
    return { sleep: body }
  }

  // 7) scrollUntilVisible / extendedWaitUntil:selector + params
  if (step.action === 'scrollUntilVisible') {
    const selVal = selectorValue(step)
    if (selVal == null) return null
    const el = typeof selVal === 'string' ? { text: selVal } : selVal
    const body: Record<string, unknown> = { element: el, ...publicParams(step) }
    attachMeta(step, body)
    return { scrollUntilVisible: body }
  }
  if (step.action === 'extendedWaitUntil') {
    const selVal = selectorValue(step)
    if (selVal == null) return null
    const el = typeof selVal === 'string' ? { text: selVal } : selVal
    const waitForVisible = step.params?.waitForVisible !== false
    const body: Record<string, unknown> = waitForVisible
      ? { visible: el, ...publicParams(step) }
      : { notVisible: el, ...publicParams(step) }
    attachMeta(step, body)
    return { extendedWaitUntil: body }
  }

  // 8) 无 selector、body 可以 bare / object 的命令
  if (BARE_OR_OBJECT.has(step.action)) {
    if (hasNoPublicParams(step) && !hasAnyMeta(step)) {
      return step.action // `- eraseText`
    }
    const body: Record<string, unknown> = { ...publicParams(step) }
    attachMeta(step, body)
    return { [step.action]: body } // `- scroll: { direction: DOWN }`
  }

  // 9) 未知 action 兜底:保留 params(可能空对象,引擎按需报错)
  return { [step.action]: step.params ?? {} }
}

/**
 * 把 serializeActionBody 的返回值包装成 flatMap 用的 "item"(同时处理 null 兜底)。
 * 供复合容器的 child 序列化使用;外层调用方自己决定兜底策略。
 */
function wrapStepItem(serialized: unknown): Record<string, unknown> | string | null {
  if (serialized === null) return null
  return serialized as Record<string, unknown> | string
}

function omit<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.includes(k)) out[k] = v
  }
  return out as T
}

function hasAnyMeta(step: Step): boolean {
  return !!step.label || step.optional === true || !!step.when || typeof step.chance === 'number'
}

// 类型出口
export type { Step, ActionType }
