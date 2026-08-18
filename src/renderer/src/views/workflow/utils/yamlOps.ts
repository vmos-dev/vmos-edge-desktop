/**
 * YAML 文本外科手术工具
 *
 * 输入:文本 + step.id(路径编码)+ 操作参数
 * 输出:新文本(整段重新 toString,但 yaml 库会尽力保留未改动节点的注释/缩进/quote 风格)
 *
 * 不依赖 Vue,纯函数,方便测试
 *
 * 关键约束:输入文本必须 YAML 合法。invalid 时这些函数会拒绝(返回原文本)
 * 上层 useWorkflowDocument 会用 hasYamlError 提前 gate
 */

import { isMap, isScalar, isSeq, isPair, isNode, parseDocument, type Document } from 'yaml'
import type { Step } from '@shared/ipc/workflow.types'
import { parseYamlDocument, resolveStep, resolveParentSeq } from './yamlDocument'
import {
  createFreshNode,
  preserveFormat,
  replaceAtPath,
  stringifyWithCanonical
} from './yamlFormatPreserve'
import { serializeActionBody } from './stepCodec'

/**
 * Step → YAML item 的 plain JS 形态(对象或字符串),作为 setIn / addIn 的 value
 *
 * 架构:序列化逻辑单一真相源在 stepCodec.serializeActionBody —— 与 stepsToYaml 共享。
 * disabled 步骤返回 null(由上层判断要不要 skip)
 * 选择器缺失等导致 codec 返回 null 时,也返回 null(yamlOps 的语义是拒绝 mutation)
 */
export function stepToYamlValue(step: Step): unknown {
  if (step.disabled) return null
  return serializeActionBody(step)
}

// ═══════════════ 双段文档定位:config + commands ═══════════════
//
// 文本是 `<config map>\n---\n<commands seq>` 双 doc 结构。
// yaml 库的 parseDocument 只读单 doc,我们要按 `---` 切开然后各自 parse、
// 改完再拼回去。这样单 doc 改动不会破坏另一段的格式。

interface SplitText {
  configRaw: string
  separator: string
  commandsRaw: string
  /** true = 文本里没有 --- 分隔,只有 commands 段 */
  commandsOnly: boolean
}

const DOC_SEPARATOR = /(^---\s*\n)/m

function splitDocs(text: string): SplitText {
  const m = text.match(DOC_SEPARATOR)
  if (!m || m.index === undefined) {
    return { configRaw: '', separator: '', commandsRaw: text, commandsOnly: true }
  }
  const sepIdx = m.index
  return {
    configRaw: text.slice(0, sepIdx),
    separator: m[1],
    commandsRaw: text.slice(sepIdx + m[1].length),
    commandsOnly: false
  }
}

function joinDocs(split: SplitText, configText: string, commandsText: string): string {
  if (split.commandsOnly) return commandsText
  // toString 已经带了末尾换行,确保格式干净
  const cfg = configText.endsWith('\n') ? configText : `${configText}\n`
  return `${cfg}${split.separator}${commandsText}`
}

// ═══════════════ 单文档 mutate helper ═══════════════

/**
 * 在 commands 文本上跑 mutator,然后拼回完整文本
 * 失败(YAML 非法)返回 null
 */
function mutateCommandsDoc(text: string, mutator: (doc: Document) => boolean): string | null {
  const split = splitDocs(text)
  let cmdDoc: Document
  try {
    cmdDoc = parseDocument(split.commandsRaw)
  } catch {
    return null
  }
  if (cmdDoc.errors.length > 0) return null

  const ok = mutator(cmdDoc)
  if (!ok) return null

  const newCommandsText = stringifyWithCanonical(cmdDoc)
  return joinDocs(split, split.configRaw, newCommandsText)
}

function mutateConfigDoc(text: string, mutator: (doc: Document) => boolean): string | null {
  const split = splitDocs(text)
  if (split.commandsOnly) {
    // 没有 config 段,创建一个
    const newDoc = parseDocument('{}\n')
    const ok = mutator(newDoc)
    if (!ok) return null
    return `${stringifyWithCanonical(newDoc).trimEnd()}\n---\n${split.commandsRaw.startsWith('\n') ? split.commandsRaw.slice(1) : split.commandsRaw}`
  }
  let cfgDoc: Document
  try {
    cfgDoc = parseDocument(split.configRaw)
  } catch {
    return null
  }
  if (cfgDoc.errors.length > 0) return null

  const ok = mutator(cfgDoc)
  if (!ok) return null

  return joinDocs(split, stringifyWithCanonical(cfgDoc), split.commandsRaw)
}

// ═══════════════ 公开 op:Step 操作 ═══════════════

/** 删除 stepId 对应的步骤 */
export function deleteStep(text: string, stepId: string): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const located = resolveStep(parsed, stepId)
      if (!located) return false
      doc.deleteIn(located.yamlPath)
      return true
    }) ?? text
  )
}

/**
 * 字段级 patch
 * 只支持影响 YAML 的字段:label/optional/chance/when/disabled/params/selector/action
 * - action 改变会重写整条(新 action 可能改变 body 结构)
 * - 其它字段尽量精准 setIn 单字段
 */
export function patchStep(text: string, stepId: string, patch: Partial<Omit<Step, 'id'>>): string {
  if (!Object.keys(patch).length) return text
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const located = resolveStep(parsed, stepId)
      if (!located) return false

      // 当前 step 的解析视图(用来组合 patch)
      const currentStep = findStepById(parsed.steps, stepId)
      if (!currentStep) return false

      const merged: Step = { ...currentStep, ...patch }
      const newValue = stepToYamlValue(merged)
      if (newValue === null) {
        // disabled 的 step 不写回(仍然占位以保留 raw)——但删除会丢上下文,这里保守不动
        return false
      }
      replaceAtPath(doc, located.yamlPath, newValue)
      return true
    }) ?? text
  )
}

/** 替换为完整新 step(保留 id 隐含的位置) */
export function replaceStep(text: string, stepId: string, newStep: Step): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const located = resolveStep(parsed, stepId)
      if (!located) return false
      const value = stepToYamlValue(newStep)
      if (value === null) return false
      replaceAtPath(doc, located.yamlPath, value)
      return true
    }) ?? text
  )
}

/** 在 stepId 之后插入(同级);返回新文本 */
export function insertStepAfter(text: string, stepId: string, step: Omit<Step, 'id'>): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const located = resolveStep(parsed, stepId)
      if (!located) return false

      // 找到承载兄弟的 seq(以及它的 yaml path)
      const parsedAfter = parsed
      const targetIdx = (located.yamlPath[located.yamlPath.length - 1] as number) + 1
      const parentPath = located.yamlPath.slice(0, -1)

      const containerSeq = getNodeAt(parsedAfter, parentPath)
      if (!containerSeq || !isSeq(containerSeq)) return false

      const value = stepToYamlValue({ ...step, id: '' } as Step)
      if (value === null) return false
      // yaml lib 没有 insertAt(seq, idx),用 items 直接 splice
      const seqInDoc = navigateInDoc(doc, parentPath)
      if (!seqInDoc || !isSeq(seqInDoc)) return false
      seqInDoc.items.splice(targetIdx, 0, createFreshNode(doc, value))
      return true
    }) ?? text
  )
}

/** 在根 commands 末尾追加 */
export function appendStep(text: string, step: Omit<Step, 'id'>): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const root = doc.contents
      if (!root || !isSeq(root)) {
        // 空文档:把 contents 设成新 seq
        doc.contents = createFreshNode(doc, [stepToYamlValue({ ...step, id: '' } as Step)])
        return true
      }
      const value = stepToYamlValue({ ...step, id: '' } as Step)
      if (value === null) return false
      root.items.push(createFreshNode(doc, value))
      return true
    }) ?? text
  )
}

/** 复制 stepId 紧跟其后(保留源节点的 flow/quote 格式) */
export function duplicateStep(text: string, stepId: string): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const located = resolveStep(parsed, stepId)
      if (!located) return false
      const sourceNode = located.node
      if (!sourceNode) return false

      const seqInDoc = navigateInDoc(doc, located.yamlPath.slice(0, -1))
      if (!seqInDoc || !isSeq(seqInDoc)) return false

      const targetIdx = (located.yamlPath[located.yamlPath.length - 1] as number) + 1
      const cloneValue =
        typeof (sourceNode as { toJSON?: () => unknown }).toJSON === 'function'
          ? (sourceNode as { toJSON: () => unknown }).toJSON()
          : null
      if (cloneValue === null) return false
      // 克隆优先保留源节点的 flow/quote;新增节点(若有)走默认政策
      const cloned = createFreshNode(doc, cloneValue)
      preserveFormat(sourceNode, cloned)
      seqInDoc.items.splice(targetIdx, 0, cloned)
      return true
    }) ?? text
  )
}

/**
 * 在 parentId(null = 根)的兄弟数组里 from→to 移位
 */
export function reorderSteps(
  text: string,
  parentId: string | null,
  from: number,
  to: number
): string {
  if (from === to) return text
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const parent = resolveParentSeq(parsed, parentId)
      if (!parent) return false
      const seq = navigateInDoc(doc, parent.yamlPath)
      if (!seq || !isSeq(seq)) return false
      if (from < 0 || from >= seq.items.length) return false
      if (to < 0 || to > seq.items.length) return false
      const [moved] = seq.items.splice(from, 1)
      seq.items.splice(to, 0, moved)
      return true
    }) ?? text
  )
}

// ═══════════════ 公开 op:config(meta)操作 ═══════════════

export function setConfigField(text: string, key: string, value: unknown): string {
  return (
    mutateConfigDoc(text, (doc) => {
      if (value === undefined || value === null || value === '') {
        doc.delete(key)
      } else {
        doc.set(key, value)
      }
      return true
    }) ?? text
  )
}

// ═══════════════ 内部:在 Document 内部按路径定位节点 ═══════════════

function getNodeAt(parsed: ReturnType<typeof parseYamlDocument>, path: Array<number | string>) {
  let node: unknown = parsed.commandsDoc?.contents
  for (const seg of path) {
    if (typeof seg === 'number') {
      if (!isSeq(node)) return null
      node = node.items[seg]
    } else {
      if (!isMap(node)) return null
      const pair = node.items.find(
        (p) => isPair(p) && (isNode(p.key) ? String(p.key.toString()) : String(p.key)) === seg
      )
      if (!pair || !isPair(pair)) return null
      node = pair.value
    }
  }
  return node
}

function navigateInDoc(doc: Document, path: Array<number | string>): unknown {
  let node: unknown = doc.contents
  for (const seg of path) {
    if (typeof seg === 'number') {
      if (!isSeq(node)) return null
      node = node.items[seg]
    } else {
      if (!isMap(node)) return null
      const pair = node.items.find(
        (p) => isPair(p) && (isNode(p.key) ? String(p.key.toString()) : String(p.key)) === seg
      )
      if (!pair || !isPair(pair)) return null
      node = pair.value
    }
  }
  return node
}

// ═══════════════ 工具:从 step 树按 id 查找 ═══════════════

function findStepById(steps: readonly Step[], id: string): Step | null {
  for (const s of steps) {
    if (s.id === id) return s
    if (s.children) {
      const inChildren = findStepById(s.children, id)
      if (inChildren) return inChildren
    }
    if (s.branches) {
      for (const arm of s.branches) {
        const inArm = findStepById(arm.children, id)
        if (inArm) return inArm
      }
    }
  }
  return null
}

// ═══════════════ Body 级操作(schema-driven 表单用) ═══════════════
//
// 这些函数绕开 Step.selector / Step.params 拆分模型,直接读写 YAML 命令体。
// 命令在 YAML 里有两种形态:
//   1. bare    `- back`               body = undefined
//   2. valued  `- tapOn: { text: x }` body = "x" 后面的整个值(string/number/boolean/object/array)
// schema-driven 表单只关心 body 形状,不关心 Step 抽象。

/** 把 (action, body) 组装成 YAML 节点值 */
function buildStepValue(action: string, body: unknown): unknown {
  return body === undefined ? action : { [action]: body }
}

/** 读 step 在 YAML 中的命令 body;bare 命令返回 undefined;非法 step / 多键 map 返回 undefined */
export function getStepBody(text: string, stepId: string): unknown {
  const parsed = parseYamlDocument(text)
  if (parsed.errors.length > 0) return undefined
  const located = resolveStep(parsed, stepId)
  if (!located) return undefined
  const node = located.node

  // bare: scalar string("back" 这种)
  if (isScalar(node)) {
    return undefined
  }
  // single-key map: { action: body }
  if (isMap(node) && node.items.length === 1) {
    const pair = node.items[0]
    if (isPair(pair) && isNode(pair.value)) {
      return (pair.value as { toJSON: () => unknown }).toJSON()
    }
    if (isPair(pair) && pair.value !== undefined) {
      // 标量值(非 Node)直接取
      return pair.value as unknown
    }
  }
  return undefined
}

/** 替换某 step 的 body(整体替换,不合并);需要传 action 名以便重建 wrapping */
export function setStepBody(text: string, stepId: string, action: string, body: unknown): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const located = resolveStep(parsed, stepId)
      if (!located) return false
      const value = buildStepValue(action, body)
      replaceAtPath(doc, located.yamlPath, value)
      return true
    }) ?? text
  )
}

/** 在 root commands 末尾追加一个 (action, body) 步骤 */
export function appendStepWithBody(text: string, action: string, body: unknown): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const value = buildStepValue(action, body)
      const root = doc.contents
      if (!root || !isSeq(root)) {
        doc.contents = createFreshNode(doc, [value])
        return true
      }
      root.items.push(createFreshNode(doc, value))
      return true
    }) ?? text
  )
}

/** 在 afterStepId 同级序列中、afterStepId 之后插入新步骤 */
export function insertStepAfterWithBody(
  text: string,
  afterStepId: string,
  action: string,
  body: unknown
): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const located = resolveStep(parsed, afterStepId)
      if (!located) return false

      const targetIdx = (located.yamlPath[located.yamlPath.length - 1] as number) + 1
      const parentPath = located.yamlPath.slice(0, -1)
      const seqInDoc = navigateInDoc(doc, parentPath)
      if (!seqInDoc || !isSeq(seqInDoc)) return false

      const value = buildStepValue(action, body)
      seqInDoc.items.splice(targetIdx, 0, createFreshNode(doc, value))
      return true
    }) ?? text
  )
}

/** 在容器步骤(repeat/retry/runFlow)的 commands 末尾追加新步骤 */
export function appendStepInContainerWithBody(
  text: string,
  parentStepId: string,
  action: string,
  body: unknown
): string {
  return (
    mutateCommandsDoc(text, (doc) => {
      const parsed = parseYamlDocument(text)
      const parent = resolveParentSeq(parsed, parentStepId)
      if (!parent) return false
      const seqInDoc = navigateInDoc(doc, parent.yamlPath)
      if (!seqInDoc || !isSeq(seqInDoc)) return false

      const value = buildStepValue(action, body)
      seqInDoc.items.push(createFreshNode(doc, value))
      return true
    }) ?? text
  )
}
