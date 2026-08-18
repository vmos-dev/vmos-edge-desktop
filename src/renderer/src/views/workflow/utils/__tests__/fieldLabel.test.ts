import { describe, expect, it } from 'vitest'
import { cleanDescription, friendlyFieldLabel } from '../fieldLabel'

describe('friendlyFieldLabel', () => {
  it('translates common technical names via i18n', () => {
    expect(friendlyFieldLabel('text')).toBe('workflow.field.text')
    expect(friendlyFieldLabel('duration')).toBe('workflow.field.duration')
    expect(friendlyFieldLabel('appId')).toBe('workflow.field.appId')
    expect(friendlyFieldLabel('direction')).toBe('workflow.field.direction')
  })

  it('falls back to the raw name for unknown keys', () => {
    expect(friendlyFieldLabel('completelyUnknown')).toBe('completelyUnknown')
  })
})

describe('cleanDescription', () => {
  it('returns empty string for nullish input', () => {
    expect(cleanDescription(undefined)).toBe('')
    expect(cleanDescription('')).toBe('')
  })

  it('only keeps the first line', () => {
    expect(cleanDescription('点击元素\n\n更多说明会被截断')).toBe('点击元素')
  })

  it('strips leading emoji prefix', () => {
    expect(cleanDescription('🚀 启动应用')).toBe('启动应用')
    expect(cleanDescription('👆 点击')).toBe('点击')
    expect(cleanDescription('⏱️ 等待')).toBe('等待')
  })

  it('strips inline backticks', () => {
    expect(cleanDescription('默认 `false`')).toBe('默认 false')
    expect(cleanDescription('`integer` 类型')).toBe('integer 类型')
  })

  it('strips bold markdown', () => {
    expect(cleanDescription('**重要** 字段')).toBe('重要 字段')
  })

  it('strips link markdown but keeps text', () => {
    expect(cleanDescription('看 [文档](https://example.com)')).toBe('看 文档')
  })

  it('handles plain Chinese text without modification', () => {
    expect(cleanDescription('普通描述,没有特殊字符')).toBe('普通描述,没有特殊字符')
  })
})
