/**
 * YAML AST 导航工具(共享)
 *
 * - useFlowRunner:从 YAML 抽取命令行范围 → 运行进度 line 高亮
 * - useStepYamlMapping:把 stepId 对应到 YAML 行范围 → `{ }` 跳转
 *
 * 两个场景都要做"在命令 Map 里找 commands 子序列 / 找 branch 分支列表",
 * 抽到这里避免各写一份
 */

import { isMap, isNode, isPair, isSeq, type YAMLMap, type YAMLSeq } from 'yaml'

/**
 * 从 composite step 的 Map 节点找到 `commands` 子序列
 * 兼容两种写法:
 *   - `{ commands: [...] }` 顶层 key
 *   - `{ repeat: { commands: [...] } }` 嵌套一层
 */
export function findChildCommands(mapNode: YAMLMap): YAMLSeq | null {
  for (const pair of mapNode.items) {
    if (!isPair(pair)) continue
    const value = pair.value
    if (isMap(value)) {
      for (const inner of value.items) {
        if (!isPair(inner)) continue
        const k = isNode(inner.key) ? String(inner.key.toString()) : String(inner.key)
        if (k === 'commands' && isSeq(inner.value)) return inner.value
      }
    }
    const k = isNode(pair.key) ? String(pair.key.toString()) : String(pair.key)
    if (k === 'commands' && isSeq(value)) return value
  }
  return null
}

/** 从 branch step 的 Map 节点找到分支数组(`{ branch: [ ... ] }`) */
export function findBranchArms(mapNode: YAMLMap): YAMLSeq | null {
  for (const pair of mapNode.items) {
    if (!isPair(pair)) continue
    const k = isNode(pair.key) ? String(pair.key.toString()) : String(pair.key)
    if (k === 'branch' && isSeq(pair.value)) return pair.value
  }
  return null
}
