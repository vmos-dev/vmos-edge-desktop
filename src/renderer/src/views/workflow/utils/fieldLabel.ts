/**
 * 字段名 / schema 描述的"大白话化"
 *
 * 只做两件事:
 *  - friendlyFieldLabel(name): YAML 字段技术名 → i18n label
 *      没列的字段直接用原名(罕见字段保留英文,新手能在 hint 里看到说明)
 *  - cleanDescription(markdownDescription): 把 schema 的 markdownDescription
 *    第一行清洗成纯文本(去 emoji / 反引号 / 粗体 / markdown 链接)
 */

import { t } from '@renderer/locales'

const KNOWN_FIELDS = new Set([
  'text',
  'id',
  'index',
  'enabled',
  'selected',
  'checked',
  'focused',
  'width',
  'height',
  'tolerance',
  'point',
  'traits',
  'delay',
  'repeat',
  'waitToSettleTimeoutMs',
  'retryTapIfNoChange',
  'waitUntilVisible',
  'duration',
  'timeout',
  'min',
  'max',
  'visible',
  'notVisible',
  'direction',
  'start',
  'end',
  'from',
  'appId',
  'clearState',
  'stopApp',
  'clearKeychain',
  'permissions',
  'arguments',
  'charactersToErase',
  'length',
  'speed',
  'visibilityPercentage',
  'centerElement',
  'element',
  'url',
  'method',
  'headers',
  'body',
  'outputVariable',
  'jsonPath',
  'latitude',
  'longitude',
  'link',
  'autoVerify',
  'browser',
  'times',
  'while',
  'commands',
  'maxRetries',
  'file',
  'env',
  'script',
  'true',
  'label',
  'optional',
  'chance',
  'when',
  '$value'
])

/** 技术名 → i18n label;没匹配的保留原名 */
export function friendlyFieldLabel(name: string): string {
  if (!KNOWN_FIELDS.has(name)) return name
  return t(`workflow.field.${name}`)
}

// emoji 区段(覆盖大多数:Misc Symbols / Dingbats / Misc Technical / Emoticons / 各 Symbol blocks)
const LEADING_EMOJI = /^(?:[\u{1F000}-\u{1FFFF}\u{2300}-\u{27BF}\u{1F300}-\u{1F9FF}]\uFE0F?\s*)+/u

/**
 * 清洗 schema 的 markdownDescription:
 *  - 只取首行(hint 一行就够,完整说明留给 tooltip)
 *  - 去开头 emoji
 *  - 去 `code` 反引号
 *  - 去 **bold**
 *  - 去 [link](url) 留 link 文本
 */
export function cleanDescription(md: string | undefined): string {
  if (!md) return ''
  return md
    .split('\n')[0]
    .replace(LEADING_EMOJI, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}
