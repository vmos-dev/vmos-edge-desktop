/**
 * 命令建议生成器 — 最小唯一稳定策略
 *
 * 三级优先级（单个唯一 > 组合消歧 > 坐标）：
 *
 *   Level 1 - 单个唯一（最简洁）:
 *     text 唯一  → "text"
 *     desc 唯一  → "desc"
 *     id 唯一    → { id }
 *
 *   Level 2 - 组合消歧（有重复才加 index）:
 *     text+index → { text, index }
 *     desc+index → { text: desc值, index }
 *     id+index   → { id, index }
 *
 *   Level 3 - 兜底:
 *     坐标       → { point: "x,y" }
 */
import { stringify } from 'yaml'
import type { UiNode, DumpResult } from './types'

// ── 类型 ──

export interface CommandSuggestion {
  status: 'available'
  title: string
  content: string
  group: 'Tap' | 'Assert' | 'Conditional'
}

interface ResolvedSelector {
  label: string
  definition: any
}

// ── YAML 序列化 ──

const yamlStringify = (value: any): string => {
  return stringify(value, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_DOUBLE'
  }).trim()
}

// ── 辅助 ──

function getShortId(rid: string): string {
  const idx = rid.lastIndexOf('/')
  return idx >= 0 ? rid.substring(idx + 1) : rid
}

// ── 核心：最小唯一稳定选择器 ──

/**
 * 按三级优先级收集选择器（最少 1 个，最多 2 个）
 *
 * 沿级联链命中即收集，收满 2 个停止：
 *   L1 单个唯一: text → desc → id
 *   L2 组合消歧: text+index → desc+index → id+index
 *   L3 坐标兜底
 */
function resolveSelectors(node: UiNode): ResolvedSelector[] {
  const text = node.attrs['text']
  const desc = node.attrs['content-desc']
  const rid = node.attrs['resource-id']
  const results: ResolvedSelector[] = []

  const collect = (sel: ResolvedSelector): boolean => {
    results.push(sel)
    return results.length >= 2
  }

  // ── Level 1: 单个唯一 ──

  if (text && typeof node.textIndex !== 'number') {
    if (collect({ label: 'Text', definition: text })) return results
  }

  if (desc && desc !== text && typeof node.contentDescIndex !== 'number') {
    if (collect({ label: 'Desc', definition: desc })) return results
  }

  if (rid && typeof node.resourceIdIndex !== 'number') {
    if (collect({ label: 'ID', definition: { id: getShortId(rid) } })) return results
  }

  // ── Level 2: 组合消歧 ──

  if (text && typeof node.textIndex === 'number') {
    if (collect({ label: 'Text', definition: { text, index: node.textIndex } })) return results
  }

  if (desc && desc !== text && typeof node.contentDescIndex === 'number') {
    if (collect({ label: 'Desc', definition: { text: desc, index: node.contentDescIndex } }))
      return results
  }

  if (rid && typeof node.resourceIdIndex === 'number') {
    if (collect({ label: 'ID', definition: { id: getShortId(rid), index: node.resourceIdIndex } }))
      return results
  }

  // ── Level 3: 坐标兜底 ──

  if (results.length < 2) {
    const [x1, y1, x2, y2] = node.bounds
    collect({
      label: '坐标',
      definition: { point: `${Math.round((x1 + x2) / 2)},${Math.round((y1 + y2) / 2)}` }
    })
  }

  return results
}

// ── 命令模板 ──

function toSuggestion(
  selector: ResolvedSelector,
  group: 'Tap' | 'Assert' | 'Conditional'
): CommandSuggestion {
  let content: string
  switch (group) {
    case 'Tap':
      content = yamlStringify([{ tapOn: selector.definition }])
      break
    case 'Assert':
      content = yamlStringify([{ assertVisible: selector.definition }])
      break
    case 'Conditional':
      content = yamlStringify([
        {
          runFlow: {
            when: { visible: selector.definition },
            commands: ['# 在此添加命令']
          }
        }
      ])
      break
  }

  return { status: 'available', title: `${group} > ${selector.label}`, content, group }
}

// ── 主函数 ──

/**
 * 每个 Tab 生成 1-2 个 cmd-item（沿级联链取前 2 个命中）
 */
export function getCommandSuggestions(
  node: UiNode | null,
  dump: DumpResult | null
): CommandSuggestion[] {
  if (!node || !dump) return []

  const selectors = resolveSelectors(node)
  const groups: Array<'Tap' | 'Assert' | 'Conditional'> = ['Tap', 'Assert', 'Conditional']
  const suggestions: CommandSuggestion[] = []

  for (const group of groups) {
    for (const sel of selectors) {
      suggestions.push(toSuggestion(sel, group))
    }
  }

  return suggestions
}
