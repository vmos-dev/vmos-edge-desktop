/**
 * AST 格式保留(yaml 库)
 *
 * 设计动机:
 *   yaml 库的 parseDocument→toString 往返会保留所有未被替换节点的格式(flow、quote、注释)。
 *   但 setIn(path, newValue) 会把该 path 上的整棵子树替换成 createNode 新建的节点,
 *   新节点默认是 block 风格,导致用户手写的 `duration: [300, 500]` 被重排成多行。
 *
 *   这是架构级问题,不是个别字段 bug:只要任何 mutator 调用 setIn,子树上所有 flow 风格
 *   的 seq/map、所有带引号的 scalar、map 键顺序都会丢。
 *
 * 修复原则:
 *   任何时候用新 JS 值替换一个 AST 节点,都应该先按"结构对应位置"把旧节点的格式元数据
 *   (Collection.flow, Scalar.type, Map item 顺序)拷到新节点上。形状变化处保持默认格式。
 *
 * 提供两个 API(都供 yamlOps.ts 使用):
 *   - preserveFormat(oldNode, newNode) —— 原地改写 newNode,递归对齐格式
 *   - replaceAtPath(doc, path, newJsValue) —— setIn 的格式保留包装;callers 不再直接用 doc.setIn
 */

import {
  isMap,
  isNode,
  isPair,
  isScalar,
  isSeq,
  Scalar,
  visit,
  type Document,
  type Node,
  type ToStringOptions,
  type YAMLMap,
  type YAMLSeq,
  type Pair
} from 'yaml'

// ═══════════════ 工程规范的 YAML 发射选项(单一真相) ═══════════════
//
// 所有从 Document 产出 YAML 字符串的地方都通过这个选项,保证风格一致:
//   - lineWidth 0          :不对长行做软换行,由用户/格式化器控制
//   - defaultStringType    :PLAIN 字符串优先无引号,歧义时自动加
//   - flowCollectionPadding:false → `[300, 500]` 而不是 `[ 300, 500 ]`
//   - singleQuote false    :yaml 库自动加引号时一律用 "..." —— 和 Maestro 官方
//                             风格统一,避免混着出现 '...' 和 "..." 两种
//
// 新增选项集中改这里,不在每个发射点重复。

export const CANONICAL_STRINGIFY_OPTIONS: ToStringOptions = {
  lineWidth: 0,
  defaultKeyType: 'PLAIN',
  defaultStringType: 'PLAIN',
  flowCollectionPadding: false,
  singleQuote: false
}

/** 用工程规范选项把 Document 转成字符串(替代 String(doc)) */
export function stringifyWithCanonical(doc: Document): string {
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS)
}

/**
 * 把 oldNode 的格式元数据拷到 newNode 上。
 * - Seq↔Seq:copy .flow,递归按 index 对齐;超出部分保持默认
 * - Map↔Map:copy .flow,按 key 匹配递归;按 oldNode 中的 pair 出现顺序重排 newNode.items
 * - Scalar↔Scalar:copy .type(保持 PLAIN / QUOTE_DOUBLE / QUOTE_SINGLE / BLOCK_*)
 * - 形状不同(seq vs scalar 等):不做任何事,保持 newNode 默认
 */
export function preserveFormat(oldNode: unknown, newNode: unknown): void {
  if (!oldNode || !newNode) return

  if (isSeq(oldNode) && isSeq(newNode)) {
    preserveSeq(oldNode, newNode)
    return
  }
  if (isMap(oldNode) && isMap(newNode)) {
    preserveMap(oldNode, newNode)
    return
  }
  if (isScalar(oldNode) && isScalar(newNode)) {
    preserveScalar(oldNode, newNode)
    return
  }
  // 形状不同,放任 newNode 用默认格式
}

function preserveSeq(oldSeq: YAMLSeq, newSeq: YAMLSeq): void {
  if (oldSeq.flow) newSeq.flow = true
  const len = Math.min(oldSeq.items.length, newSeq.items.length)
  for (let i = 0; i < len; i++) {
    preserveFormat(oldSeq.items[i], newSeq.items[i])
  }
}

function preserveMap(oldMap: YAMLMap, newMap: YAMLMap): void {
  if (oldMap.flow) newMap.flow = true

  // 1) 逐 pair 对齐格式(按 key 匹配)
  for (const oldPair of oldMap.items) {
    if (!isPair(oldPair)) continue
    const key = pairKeyString(oldPair)
    const newPair = findPairByKey(newMap, key)
    if (!newPair) continue
    if (isNode(oldPair.key) && isNode(newPair.key)) {
      preserveFormat(oldPair.key, newPair.key)
    }
    preserveFormat(oldPair.value, newPair.value)
  }

  // 2) 保留 key 出现顺序(基于 oldMap 中存在的 key;新增 key 按 newMap 原顺序排在后面)
  const oldOrder = oldMap.items
    .map((p) => (isPair(p) ? pairKeyString(p) : null))
    .filter((k): k is string => k !== null)
  newMap.items.sort((a, b) => {
    if (!isPair(a) || !isPair(b)) return 0
    const ai = oldOrder.indexOf(pairKeyString(a))
    const bi = oldOrder.indexOf(pairKeyString(b))
    // 都在旧 order 里:按旧顺序;一个在一个不在:在旧的排前面;都不在:保持原相对顺序
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

function preserveScalar(oldScalar: Scalar, newScalar: Scalar): void {
  if (oldScalar.type && oldScalar.value === newScalar.value) {
    newScalar.type = oldScalar.type
  }
}

function pairKeyString(pair: Pair): string {
  return isNode(pair.key) ? String(pair.key.toString()) : String(pair.key)
}

function findPairByKey(map: YAMLMap, key: string): Pair | null {
  for (const p of map.items) {
    if (isPair(p) && pairKeyString(p) === key) return p
  }
  return null
}

/**
 * 带格式保留的 setIn 包装。
 * - 先读取 oldNode
 * - 用 doc.createNode 构造 newNode
 * - 调 preserveFormat(oldNode, newNode)
 * - 再 setIn
 *
 * 所有 yamlOps.ts 中用 doc.setIn(path, plainJs) 改写已有节点的地方都应该改用这个。
 * 对于 create/insert(没有 oldNode),直接用 doc.createNode 即可。
 */
export function replaceAtPath(
  doc: Document,
  path: ReadonlyArray<string | number>,
  newJsValue: unknown,
  mode: FormatMode = 'commands'
): void {
  const oldNode = navigate(doc.contents, path)
  const newNode = doc.createNode(newJsValue) as Node
  if (oldNode) preserveFormat(oldNode, newNode)
  applyFormatPolicy(newNode, mode)
  doc.setIn(path, newNode)
}

/**
 * fresh-created 节点的统一入口(没有旧节点可保留格式)。
 * 所有 insert/append 路径必须经过这个,确保默认 flow/quote 政策被应用。
 */
export function createFreshNode(
  doc: Document,
  jsValue: unknown,
  mode: FormatMode = 'commands'
): Node {
  const node = doc.createNode(jsValue) as Node
  applyFormatPolicy(node, mode)
  return node
}

// ═══════════════ 默认格式政策(fresh-created 节点无旧格式可参考时使用) ═══════════════
//
// 架构背景:
//   preserveFormat 只能保住"旧节点里本来就是 flow"的风格;对新 step(insertStepAfter)、
//   刚从 Step[] 重建的整个 workflow(stepsToYaml),根本没有"旧节点"可参考。
//   没有政策兜底的话,库默认一律用 block,短数字元组被拆成多行丑得不行:
//
//     duration:
//       - 300
//       - 500
//
//   用户的预期是 `duration: [300, 500]`,这是行业惯例 —— 2 元素数字元组用 inline。
//
// 政策:
//   对 flow=true 没被设置的节点,若结构符合"短标量同类"特征,自动提升为 flow。
//   已经是 flow 的节点不动。preserveFormat 先跑,政策再兜底,不覆盖用户意图。

/** 认定应该自动 inline 的短标量 seq:≤ 4 项,全标量,数值类 */
const FLOW_TUPLE_MAX_LENGTH = 4

function isShortScalarTuple(seq: YAMLSeq): boolean {
  if (seq.items.length === 0 || seq.items.length > FLOW_TUPLE_MAX_LENGTH) return false
  let hasNumber = false
  for (const it of seq.items) {
    if (!isScalar(it)) return false
    const v = it.value
    if (typeof v === 'number') {
      hasNumber = true
      continue
    }
    if (typeof v === 'boolean' || v === null) continue
    // 短字符串也允许(如 ['up', 'down'])
    if (typeof v === 'string' && v.length <= 12) continue
    return false
  }
  // 至少要有一个数值,避免误伤长文本列表
  return hasNumber
}

// ═══════════════ 默认引号政策:按文档段决定激进度 ═══════════════
//
// Maestro 官方 YAML 示例里的引号惯例:
//   config 段(`appId: com.example`, `name: Demo`)—— 标识符/包名 PLAIN
//   commands 段(`- tapOn: "登录"`, `- inputText: "hello"`)—— 内容字符串全部引号,
//     但 enum 风格的大写字面量(DOWN/UP/LEFT_TO_RIGHT)保持 PLAIN
//
// 两段用同一套规则会两边都不对,所以政策按 mode 切换:
//   - 'config'   → 只在"歧义"时加引号(非 ASCII / 空白 / 特殊字符)
//   - 'commands' → 激进:Pair.value 上的字符串默认 QUOTE_DOUBLE,enum 除外
//
// preserveFormat 先跑保住用户已有的 .type;政策只填充未设 .type 的新节点。

export type FormatMode = 'config' | 'commands'

/** 含非 ASCII / 空白 / YAML 歧义字符 → 必须加引号以消歧 */
function needsExplicitQuoting(value: string): boolean {
  if (!value) return false
  if (/[^\x00-\x7F]/.test(value)) return true
  if (/\s/.test(value)) return true
  if (/[:#@&*!|>'"`%]/.test(value)) return true
  return false
}

/** 全大写标识符(DOWN / UP / LEFT_TO_RIGHT)→ 视为 enum,保持 PLAIN */
function isEnumLikeLiteral(value: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(value)
}

function shouldQuoteInCommands(value: string): boolean {
  if (!value) return false
  if (isEnumLikeLiteral(value)) return false
  return true
}

/**
 * 遍历子树,应用默认格式政策:
 *  1) 短标量 seq(数字元组类)→ flow
 *  2) Pair.value 上未设类型的字符串 → 按 mode 决定 QUOTE_DOUBLE
 *
 * 调用时机:任何 fresh-created 节点进入 doc 前(replaceAtPath / insert / stepsToYaml)。
 * mode 默认 'commands':yamlOps 的 surgical 操作都在 commands 段,safe default。
 * 只有 stepsToYaml 做 config 段时显式传 'config'。
 */
export function applyFormatPolicy(
  node: Node | null | undefined,
  mode: FormatMode = 'commands'
): void {
  if (!node) return
  visit(node, (key, n) => {
    if (isSeq(n) && n.flow !== true && isShortScalarTuple(n)) {
      n.flow = true
    }
    if (isScalar(n) && key === 'value' && !n.type && typeof n.value === 'string') {
      const needsQuote =
        mode === 'commands' ? shouldQuoteInCommands(n.value) : needsExplicitQuoting(n.value)
      if (needsQuote) {
        n.type = Scalar.QUOTE_DOUBLE
      }
    }
  })
}

function navigate(root: unknown, path: ReadonlyArray<string | number>): unknown {
  let node: unknown = root
  for (const seg of path) {
    if (typeof seg === 'number') {
      if (!isSeq(node)) return null
      node = node.items[seg]
    } else {
      if (!isMap(node)) return null
      let found: unknown = null
      for (const p of node.items) {
        if (isPair(p) && pairKeyString(p) === seg) {
          found = p.value
          break
        }
      }
      if (found === null) return null
      node = found
    }
  }
  return node
}
