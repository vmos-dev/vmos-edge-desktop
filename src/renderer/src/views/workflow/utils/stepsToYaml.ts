/**
 * steps[] → YAML 字符串(支持嵌套 + opaque 透传)
 *
 * 架构:
 *  - 逐 step 的 YAML body 形状由 stepCodec.serializeActionBody(step) 决定 —— 单一真相源
 *  - 本模块只负责:文档级组装(config + commands)、flow 风格政策、守卫(不丢步骤)
 */

import { Document } from 'yaml'
import type { Workflow, Step } from '../types'
import { applyFormatPolicy, stringifyWithCanonical } from './yamlFormatPreserve'
import { serializeActionBody } from './stepCodec'

/**
 * Step → YAML item 数组
 *
 * 架构守卫:永远不静默丢 enabled 步骤
 *   stepCodec.serializeActionBody 可以返回 null("放弃序列化"),本守卫统一用裸命令兜底 + warn。
 *   未来新增 action case 只要 codec return null 就自动被守卫接住,不可能意外丢数据。
 */
function stepToYamlItems(step: Step): Array<Record<string, unknown> | string> {
  const body = serializeActionBody(step)
  if (body === null) {
    // eslint-disable-next-line no-console
    console.warn(
      `[stepsToYaml] cannot fully serialize step "${step.action}" (id=${step.id}); ` +
        `emitting bare command to preserve user data. ` +
        `The engine may reject execution until the step is completed.`
    )
    return [step.action]
  }
  return [body as Record<string, unknown> | string]
}

/**
 * 工作流 → 完整 YAML(config --- commands)
 */
export function stepsToYaml(
  workflow: Pick<Workflow, 'appId' | 'name' | 'env' | 'tags' | 'steps'>
): string {
  const configSection: Record<string, unknown> = {
    appId: workflow.appId
  }
  if (workflow.name) configSection.name = workflow.name
  if (workflow.tags && workflow.tags.length > 0) configSection.tags = workflow.tags
  if (workflow.env && Object.keys(workflow.env).length > 0) configSection.env = workflow.env

  const commandsSection = workflow.steps.flatMap(stepToYamlItems)

  // 架构:保存后从 Step[] 重建 YAML 会走这里。必须应用默认 flow 政策,否则
  // `duration: [300, 500]` 会变成多行 block。policy 只影响短数字元组,其他仍按
  // yaml 库默认(block)。stringify 选项来自 CANONICAL_STRINGIFY_OPTIONS,
  // 所有发射点共享这一政策(无空格 flow、单引号、无软换行)。
  // 两段用不同引号政策:config 段保守(标识符/包名 PLAIN),commands 段激进
  // (pair.value 字符串默认 QUOTE_DOUBLE,和 Maestro 官方示例对齐)
  const configDoc = new Document(configSection)
  applyFormatPolicy(configDoc.contents as Parameters<typeof applyFormatPolicy>[0], 'config')
  const commandsDoc = new Document(commandsSection)
  applyFormatPolicy(commandsDoc.contents as Parameters<typeof applyFormatPolicy>[0], 'commands')

  const configYaml = stringifyWithCanonical(configDoc).trimEnd()
  const commandsYaml = stringifyWithCanonical(commandsDoc).trimEnd()

  return `${configYaml}\n---\n${commandsYaml}\n`
}
