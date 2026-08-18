/**
 * YAML 文档解析层 —— 把 YAML 文本当成单一真相
 *
 * 提供:
 *  - parseDocument(text) → 包含 doc(yaml.Document)、steps(Step 树)、meta、errors
 *  - 路径编码 / 解码:Step.id 是结构化位置的字符串表示,纯 YAML 派生
 *  - resolveYamlPath(stepId) → yaml 库可以喂给 setIn/deleteIn/addIn 的路径
 *  - locateSeq(parentId) → 找到承载兄弟序列的 YAML AST 节点
 *
 * 关键设计:Step.id 不再随机生成,而是从位置编码而来,YAML 文本不变 → id 不变
 */

import {
  parseAllDocuments,
  isMap,
  isNode,
  isPair,
  isScalar,
  isSeq,
  LineCounter,
  type Document,
  type Node,
  type YAMLMap,
  type YAMLSeq
} from 'yaml'
import type { ActionType, Step, StepCondition } from '@shared/ipc/workflow.types'
import { ATOMIC_WITH_SELECTOR, BARE_OR_OBJECT, COMPOSITE_WITH_CHILDREN } from './actionSets'

// ═══════════════ 路径编码 ═══════════════

/**
 * 路径段:
 *  - { kind: 'index', idx } —— 进入兄弟序列的第 idx 个
 *  - { kind: 'arm',   armIdx } —— 进入 branch 的第 armIdx 个分支
 *
 * 编码到 id 字符串:
 *  - "0"        → root[0]
 *  - "0.1"      → root[0] (composite) → children[1]
 *  - "0.a0.1"   → root[0] (branch)    → arms[0].children[1]
 */
export type PathSegment = { kind: 'index'; idx: number } | { kind: 'arm'; armIdx: number }

export type StepPath = PathSegment[]

export function encodePath(path: StepPath): string {
  return path.map((seg) => (seg.kind === 'index' ? String(seg.idx) : `a${seg.armIdx}`)).join('.')
}

export function decodePath(id: string): StepPath {
  if (!id) return []
  return id.split('.').map((s) => {
    if (s.startsWith('a')) return { kind: 'arm', armIdx: Number(s.slice(1)) }
    return { kind: 'index', idx: Number(s) }
  })
}

// ═══════════════ Step 解析(带 path id) ═══════════════

function valueToSelector(value: unknown): Step['selector'] {
  if (value == null) return undefined
  if (typeof value === 'string') {
    return { primary: { type: 'text', value, stabilityScore: 80 } }
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return {
      primary: {
        type: 'id' in obj ? 'id' : 'text' in obj ? 'text' : 'traits',
        value: obj,
        stabilityScore: 70
      }
    }
  }
  return undefined
}

function extractCommonMeta(
  body: Record<string, unknown>
): Pick<Step, 'label' | 'optional' | 'chance' | 'when'> {
  const meta: Pick<Step, 'label' | 'optional' | 'chance' | 'when'> = {}
  if (typeof body.label === 'string') meta.label = body.label
  if (typeof body.optional === 'boolean') meta.optional = body.optional
  if (typeof body.chance === 'number') meta.chance = body.chance
  if (body.when && typeof body.when === 'object') meta.when = body.when as StepCondition
  return meta
}

function parseItem(item: unknown, path: StepPath): Step {
  const id = encodePath(path)
  const baseMeta = { elementType: 'unknown' as const, capturedAt: Date.now() }

  if (typeof item === 'string') {
    return {
      id,
      action: item,
      stability: 'ok',
      metadata: baseMeta,
      opaque: !BARE_OR_OBJECT.has(item),
      raw: BARE_OR_OBJECT.has(item) ? undefined : item
    }
  }

  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const entries = Object.entries(item)
    if (entries.length === 0) {
      return { id, action: 'unknown', stability: 'ok', metadata: baseMeta, opaque: true, raw: item }
    }
    const [actionName, body] = entries[0]
    if (entries.length > 1) {
      return {
        id,
        action: actionName,
        stability: 'ok',
        metadata: baseMeta,
        opaque: true,
        raw: item
      }
    }
    return parseKnownAction(actionName, body, item, path)
  }

  return { id, action: 'unknown', stability: 'ok', metadata: baseMeta, opaque: true, raw: item }
}

function parseKnownAction(action: string, body: unknown, raw: unknown, path: StepPath): Step {
  const id = encodePath(path)
  const baseMeta = { elementType: 'unknown' as const, capturedAt: Date.now() }

  if (COMPOSITE_WITH_CHILDREN.has(action)) {
    if (body && typeof body === 'object' && 'commands' in (body as object)) {
      const bodyObj = body as Record<string, unknown>
      const cmds = bodyObj.commands
      const children = Array.isArray(cmds)
        ? cmds.map((child, idx) => parseItem(child, [...path, { kind: 'index', idx }]))
        : []
      const params: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(bodyObj)) {
        if (k !== 'commands') params[k] = v
      }
      return {
        id,
        action: action as ActionType,
        stability: 'ok',
        metadata: baseMeta,
        children,
        params
      }
    }
    if (action === 'runFlow' && typeof body === 'string') {
      return {
        id,
        action: 'runFlow',
        stability: 'ok',
        metadata: baseMeta,
        params: { file: body }
      }
    }
    return { id, action, stability: 'ok', metadata: baseMeta, opaque: true, raw }
  }

  if (action === 'branch') {
    if (Array.isArray(body)) {
      const branches = body.map((arm, armIdx) => {
        if (arm && typeof arm === 'object') {
          const armObj = arm as Record<string, unknown>
          const when = (armObj.when as StepCondition | undefined) ?? undefined
          const cmds = armObj.commands
          const children = Array.isArray(cmds)
            ? cmds.map((child, idx) =>
                parseItem(child, [...path, { kind: 'arm', armIdx }, { kind: 'index', idx }])
              )
            : []
          return { when, children }
        }
        return { children: [] }
      })
      return { id, action: 'branch', stability: 'ok', metadata: baseMeta, branches }
    }
    return { id, action, stability: 'ok', metadata: baseMeta, opaque: true, raw }
  }

  if (ATOMIC_WITH_SELECTOR.has(action)) {
    if (typeof body === 'string') {
      return {
        id,
        action: action as ActionType,
        selector: valueToSelector(body),
        stability: 'ok',
        metadata: baseMeta
      }
    }
    if (body && typeof body === 'object') {
      const bodyObj = body as Record<string, unknown>
      const meta = extractCommonMeta(bodyObj)
      const selObj: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(bodyObj)) {
        if (!['label', 'optional', 'chance', 'when'].includes(k)) selObj[k] = v
      }
      return {
        id,
        action: action as ActionType,
        selector: valueToSelector(Object.keys(selObj).length === 0 ? undefined : selObj),
        ...meta,
        stability: 'ok',
        metadata: baseMeta
      }
    }
    return { id, action, stability: 'ok', metadata: baseMeta, opaque: true, raw }
  }

  if (action === 'inputText') {
    // body 可以是 string 或 { text, ...extras }。extras 通过 params 保留
    if (typeof body === 'string') {
      return {
        id,
        action: 'inputText',
        params: { text: body },
        stability: 'ok',
        metadata: baseMeta
      }
    }
    if (body && typeof body === 'object') {
      const bodyObj = body as Record<string, unknown>
      const meta = extractCommonMeta(bodyObj)
      const text = typeof bodyObj.text === 'string' ? bodyObj.text : ''
      const extras = collectExtraParams(bodyObj, ['text', 'label', 'optional', 'chance', 'when'])
      return {
        id,
        action: 'inputText',
        params: { text, ...(extras ?? {}) },
        ...meta,
        stability: 'ok',
        metadata: baseMeta
      }
    }
    return { id, action: 'inputText', params: { text: '' }, stability: 'ok', metadata: baseMeta }
  }

  if (action === 'sleep') {
    // body 形式:number / [min,max] / { duration, ...extras }
    if (typeof body === 'number' || Array.isArray(body)) {
      return {
        id,
        action: 'sleep',
        params: { duration: body as number | [number, number] },
        stability: 'ok',
        metadata: baseMeta
      }
    }
    if (body && typeof body === 'object') {
      const bodyObj = body as Record<string, unknown>
      const meta = extractCommonMeta(bodyObj)
      const extras = collectExtraParams(bodyObj, [
        'duration',
        'label',
        'optional',
        'chance',
        'when'
      ])
      return {
        id,
        action: 'sleep',
        params: {
          duration: bodyObj.duration as number | [number, number] | undefined,
          ...(extras ?? {})
        },
        ...meta,
        stability: 'ok',
        metadata: baseMeta
      }
    }
    return {
      id,
      action: 'sleep',
      params: { duration: 1000 },
      stability: 'ok',
      metadata: baseMeta
    }
  }

  if (action === 'pressKey' || action === 'takeScreenshot') {
    // pressKey body:string(key)或 { key, ...extras }
    // takeScreenshot body:string(path)或 { path, ...extras }
    const primaryKey = action === 'pressKey' ? 'key' : 'path'
    if (typeof body === 'string') {
      return {
        id,
        action: action as ActionType,
        // 存入 params 用 action 约定键(pressKey.key / takeScreenshot.path);
        // 也同时写入 text 字段,兼容旧代码路径
        params: { [primaryKey]: body, text: body },
        stability: 'ok',
        metadata: baseMeta
      }
    }
    if (body && typeof body === 'object') {
      const bodyObj = body as Record<string, unknown>
      const meta = extractCommonMeta(bodyObj)
      const primary = typeof bodyObj[primaryKey] === 'string' ? (bodyObj[primaryKey] as string) : ''
      const extras = collectExtraParams(bodyObj, [
        primaryKey,
        'text',
        'label',
        'optional',
        'chance',
        'when'
      ])
      return {
        id,
        action: action as ActionType,
        params: { [primaryKey]: primary, text: primary, ...(extras ?? {}) },
        ...meta,
        stability: 'ok',
        metadata: baseMeta
      }
    }
    return {
      id,
      action: action as ActionType,
      params: { [primaryKey]: '', text: '' },
      stability: 'ok',
      metadata: baseMeta
    }
  }

  if (action === 'scrollUntilVisible' && body && typeof body === 'object') {
    const bodyObj = body as Record<string, unknown>
    const meta = extractCommonMeta(bodyObj)
    const el = bodyObj.element
    // 把 element / 通用 meta 之外的字段(direction, timeout, speed, centerElement...)
    // 存进 params,保证 round-trip 不丢
    const params = collectExtraParams(bodyObj, ['element', 'label', 'optional', 'chance', 'when'])
    return {
      id,
      action: 'scrollUntilVisible',
      selector: valueToSelector(el),
      ...(params ? { params } : {}),
      ...meta,
      stability: 'ok',
      metadata: baseMeta
    }
  }
  if (action === 'extendedWaitUntil' && body && typeof body === 'object') {
    const bodyObj = body as Record<string, unknown>
    const meta = extractCommonMeta(bodyObj)
    // extendedWaitUntil 支持 visible / notVisible 两种 selector key;两者语义相反
    // (等出现 vs 等消失)。用 waitForVisible 布尔参数区分,serialize 时决定 key 名
    const visibleVal = bodyObj.visible
    const waitForVisible = visibleVal !== undefined
    const el = waitForVisible ? visibleVal : bodyObj.notVisible
    const extras = collectExtraParams(bodyObj, [
      'visible',
      'notVisible',
      'label',
      'optional',
      'chance',
      'when'
    ])
    return {
      id,
      action: 'extendedWaitUntil',
      selector: valueToSelector(el),
      params: { ...(extras ?? {}), waitForVisible },
      ...meta,
      stability: 'ok',
      metadata: baseMeta
    }
  }

  // BARE_OR_OBJECT 的 object 形式:`- scroll: { direction: DOWN }`
  // 不走 opaque(否则 UI 无法编辑);把非 meta 字段全收进 params
  if (BARE_OR_OBJECT.has(action) && body && typeof body === 'object' && !Array.isArray(body)) {
    const bodyObj = body as Record<string, unknown>
    const meta = extractCommonMeta(bodyObj)
    const params = collectExtraParams(bodyObj, ['label', 'optional', 'chance', 'when'])
    return {
      id,
      action: action as ActionType,
      ...(params ? { params } : {}),
      ...meta,
      stability: 'ok',
      metadata: baseMeta
    }
  }

  return { id, action, stability: 'ok', metadata: baseMeta, opaque: true, raw }
}

/** 从 body 里收集除给定 key 之外的所有字段作为 params;没有则返回 null */
function collectExtraParams(
  body: Record<string, unknown>,
  excludeKeys: readonly string[]
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!excludeKeys.includes(k)) out[k] = v
  }
  return Object.keys(out).length === 0 ? null : out
}

// ═══════════════ 解析入口 ═══════════════

export interface ParsedYamlMeta {
  name?: string
  appId?: string
  env?: Record<string, string>
  tags?: string[]
}

export interface YamlDocument {
  /** 原始文本 */
  text: string
  /** config Document(map);可能不存在 */
  configDoc: Document | null
  /** commands Document(seq);可能不存在 */
  commandsDoc: Document | null
  /** 行/字符位置换算器,用于光标跳转 */
  lineCounter: LineCounter
  /** 顶层 steps 树(只读视图) */
  steps: Step[]
  /** config 段提取的元信息 */
  meta: ParsedYamlMeta
  /** 解析错误,空数组 = 合法 */
  errors: string[]
}

export function parseYamlDocument(text: string): YamlDocument {
  const lineCounter = new LineCounter()
  const errors: string[] = []
  const meta: ParsedYamlMeta = {}
  let configDoc: Document | null = null
  let commandsDoc: Document | null = null
  let steps: Step[] = []

  if (!text || !text.trim()) {
    return { text, configDoc, commandsDoc, lineCounter, steps, meta, errors }
  }

  let docs: Document[]
  try {
    docs = parseAllDocuments(text, { lineCounter })
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
    return { text, configDoc, commandsDoc, lineCounter, steps, meta, errors }
  }

  for (const doc of docs) {
    for (const err of doc.errors) errors.push(err.message)
  }

  for (const doc of docs) {
    const c = doc.contents
    if (isMap(c)) {
      configDoc = doc
      for (const pair of c.items) {
        if (!isPair(pair)) continue
        const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key)
        const rawValue = pair.value
        let value: unknown
        if (rawValue && isScalar(rawValue)) {
          value = rawValue.value
        } else if (
          rawValue &&
          typeof (rawValue as { toJSON?: () => unknown }).toJSON === 'function'
        ) {
          value = (rawValue as { toJSON: () => unknown }).toJSON()
        }
        if (value === undefined) continue
        if (key === 'name' && typeof value === 'string') meta.name = value
        else if (key === 'appId' && typeof value === 'string') meta.appId = value
        else if (key === 'env' && value && typeof value === 'object')
          meta.env = value as Record<string, string>
        else if (key === 'tags' && Array.isArray(value))
          meta.tags = value.filter((t): t is string => typeof t === 'string')
      }
    } else if (isSeq(c)) {
      commandsDoc = doc
      const plain = c.toJSON() as unknown[]
      if (Array.isArray(plain)) {
        steps = plain.map((item, idx) => parseItem(item, [{ kind: 'index', idx }]))
      }
    }
  }

  return { text, configDoc, commandsDoc, lineCounter, steps, meta, errors }
}

// ═══════════════ AST 定位:stepId → YAMLPath / Node ═══════════════

/**
 * yaml 库 setIn/getIn 接受的路径段:数字(进 seq)、字符串(进 map)
 * 这里指的是 "在 commandsDoc.contents 之内的相对路径"
 */
export type YamlPath = Array<number | string>

/**
 * 找到 stepId 在 commandsDoc 内对应的 yaml 路径(给 setIn/deleteIn 用)
 * 同时返回 AST 节点本身(给 range 用)
 */
export function resolveStep(
  doc: YamlDocument,
  stepId: string
): { yamlPath: YamlPath; node: Node } | null {
  const seqRoot = doc.commandsDoc?.contents
  if (!seqRoot || !isSeq(seqRoot)) return null

  const segs = decodePath(stepId)
  if (segs.length === 0) return null

  let currentSeq: YAMLSeq = seqRoot
  const path: YamlPath = []
  let lastNode: Node | null = null

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]

    if (seg.kind === 'index') {
      if (seg.idx < 0 || seg.idx >= currentSeq.items.length) return null
      const item = currentSeq.items[seg.idx]
      if (!isNode(item)) return null
      path.push(seg.idx)
      lastNode = item

      // 还有后续段:必须能走进 children/branches
      if (i < segs.length - 1) {
        const next = segs[i + 1]
        if (!isMap(item)) return null

        if (next.kind === 'arm') {
          // item 应该是 branch:{ branch: [ ... ] }
          const branchSeq = findKeyedSeq(item, 'branch')
          if (!branchSeq) return null
          path.push('branch')
          currentSeq = branchSeq
        } else {
          // composite: { repeat|retry|runFlow: { commands: [...] } } 或 { commands: [...] }
          const located = locateChildCommands(item)
          if (!located) return null
          path.push(...located.subPath)
          currentSeq = located.seq
        }
      }
    } else {
      // arm 段
      if (seg.armIdx < 0 || seg.armIdx >= currentSeq.items.length) return null
      const armItem = currentSeq.items[seg.armIdx]
      if (!isMap(armItem)) return null
      path.push(seg.armIdx)
      lastNode = armItem

      if (i < segs.length - 1) {
        const cmds = findKeyedSeq(armItem, 'commands')
        if (!cmds) return null
        path.push('commands')
        currentSeq = cmds
      }
    }
  }

  if (!lastNode) return null
  return { yamlPath: path, node: lastNode }
}

/**
 * 找到承载某个 stepId 兄弟序列的 yaml 路径(给 insertAfter/reorder 用)
 * stepId === null:返回 root commands seq 路径(空数组 [])
 */
export function resolveParentSeq(
  doc: YamlDocument,
  parentId: string | null
): { yamlPath: YamlPath; seq: YAMLSeq } | null {
  const root = doc.commandsDoc?.contents
  if (!root || !isSeq(root)) return null

  if (parentId === null) {
    return { yamlPath: [], seq: root }
  }

  const resolved = resolveStep(doc, parentId)
  if (!resolved) return null
  if (!isMap(resolved.node)) return null

  const located = locateChildCommands(resolved.node)
  if (!located) return null
  return {
    yamlPath: [...resolved.yamlPath, ...located.subPath],
    seq: located.seq
  }
}

// ═══════════════ AST 帮手 ═══════════════

function findKeyedSeq(map: YAMLMap, keyName: string): YAMLSeq | null {
  for (const pair of map.items) {
    if (!isPair(pair)) continue
    const key = isNode(pair.key) ? String(pair.key.toString()) : String(pair.key)
    if (key === keyName && isSeq(pair.value)) return pair.value
  }
  return null
}

/**
 * 在 step 的 Map 节点内找到 children 序列,并返回相对子路径
 * 兼容:
 *  - { commands: [...] } → subPath = ['commands']
 *  - { repeat: { commands: [...] } } → subPath = ['repeat', 'commands']
 */
function locateChildCommands(map: YAMLMap): { subPath: YamlPath; seq: YAMLSeq } | null {
  for (const pair of map.items) {
    if (!isPair(pair)) continue
    const key = isNode(pair.key) ? String(pair.key.toString()) : String(pair.key)
    if (key === 'commands' && isSeq(pair.value)) {
      return { subPath: ['commands'], seq: pair.value }
    }
    if (isMap(pair.value)) {
      const inner = findKeyedSeq(pair.value, 'commands')
      if (inner) return { subPath: [key, 'commands'], seq: inner }
    }
  }
  return null
}
