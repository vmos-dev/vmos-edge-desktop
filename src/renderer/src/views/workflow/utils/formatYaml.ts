/**
 * formatYaml · 纯语法规范化器,只动空白,不改语义
 *
 * 和 VSCode / Prettier / yaml-language-server 同级:
 *   - 规范缩进 / 换行
 *   - 保留 Scalar.type(引号风格)
 *   - 保留 Collection.flow(flow vs block)
 *   - 保留 map 键顺序、注释
 *   - **不修 `key:value` 无空格** —— 这是合法 YAML scalar,不是 mapping,
 *     业界工具一致不做语义级容错。用户应通过 schema diagnostic 看到提示
 *     并自己修正。
 *
 * 实现:
 *   parseDocument(text).toString():yaml 库对未修改节点自动保留源信息,
 *   toString 时只重新排布空白。
 *
 * 与其他 YAML 输出路径的区别:
 *   stepsToYaml              从 Step[] 重建(必然规范化,无源信息可保)
 *   rebaselineFromPersisted  save 后不重建(保留字节级文本)
 *   formatYaml               用户/保存触发的排版规范,保留所有风格
 *
 * 错误处理:
 *   若解析失败,直接返回原文本,不做破坏性 fallback。
 */

import { parseDocument } from 'yaml'
import { stringifyWithCanonical } from './yamlFormatPreserve'

const DOC_SEPARATOR = /(^---\s*\n)/m

/**
 * 格式化 YAML 文本。返回格式化后的新文本;若解析失败返回原文本。
 *
 * 保证:
 *   formatYaml(formatYaml(text)) === formatYaml(text)  (idempotent)
 *   用户的 quote / flow / 键顺序 / 注释 都保持;只有缩进 / 空白被规范
 */
export function formatYaml(text: string): string {
  const m = text.match(DOC_SEPARATOR)
  // 无 config/commands 分隔符的单文档
  if (!m || m.index === undefined) {
    return formatSingleDoc(text) ?? text
  }
  const sepIdx = m.index
  const configRaw = text.slice(0, sepIdx)
  const separator = m[1]
  const commandsRaw = text.slice(sepIdx + m[1].length)

  const cfgOut = formatSingleDoc(configRaw)
  const cmdOut = formatSingleDoc(commandsRaw)
  if (cfgOut === null || cmdOut === null) return text // 有解析错误,保守不改

  return `${cfgOut.trimEnd()}\n${separator}${cmdOut}`
}

function formatSingleDoc(source: string): string | null {
  if (source.trim().length === 0) return source
  const doc = parseDocument(source)
  if (doc.errors.length > 0) return null
  // yaml 库默认 2 空格缩进;节点的 .type / .flow / source 信息在未修改时自动保留
  return stringifyWithCanonical(doc)
}
