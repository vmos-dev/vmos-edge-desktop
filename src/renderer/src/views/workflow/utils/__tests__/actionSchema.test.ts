import { describe, expect, it } from 'vitest'
import { COMMON_FIELDS, getActionFields, PRIMITIVE_BODY_FIELD } from '../actionSchema'

describe('actionSchema.getActionFields', () => {
  it('returns [] for an unknown action', () => {
    expect(getActionFields('completelyMadeUp')).toEqual([])
  })

  it('extracts object-form fields for tapOn', () => {
    const fields = getActionFields('tapOn')
    const names = fields.map((f) => f.name)

    // 至少出现选择器主字段
    expect(names).toContain('text')
    expect(names).toContain('id')
    expect(names).toContain('index')

    // 通用字段不应在结果里(由表单单独渲染)
    for (const common of COMMON_FIELDS) {
      expect(names).not.toContain(common)
    }
  })

  it('marks "text" as kind=string with friendly label', () => {
    const fields = getActionFields('tapOn')
    const text = fields.find((f) => f.name === 'text')
    expect(text).toBeDefined()
    expect(text?.kind).toBe('string')
    expect(text?.label).toBe('workflow.field.text')
  })

  it('marks "index" as kind=integer', () => {
    const fields = getActionFields('tapOn')
    const idx = fields.find((f) => f.name === 'index')
    expect(idx?.kind).toBe('integer')
  })

  it('marks "enabled" as kind=boolean', () => {
    const fields = getActionFields('tapOn')
    const en = fields.find((f) => f.name === 'enabled')
    expect(en?.kind).toBe('boolean')
  })

  it('emits a single $value field for primitive-only actions (inputText)', () => {
    const fields = getActionFields('inputText')
    expect(fields.length).toBe(1)
    expect(fields[0].name).toBe(PRIMITIVE_BODY_FIELD)
    expect(fields[0].kind).toBe('string')
  })

  it('emits a single $value field for pressKey (string|integer oneOf)', () => {
    const fields = getActionFields('pressKey')
    expect(fields.length).toBe(1)
    expect(fields[0].name).toBe(PRIMITIVE_BODY_FIELD)
    // 选 string 分支(更通用)
    expect(fields[0].kind).toBe('string')
  })

  it('extracts duration / min / max for sleep', () => {
    const fields = getActionFields('sleep')
    const names = fields.map((f) => f.name)
    expect(names).toContain('duration')
    expect(names).toContain('min')
    expect(names).toContain('max')
  })

  it('extracts swipe.direction as enum with cleaned options', () => {
    const fields = getActionFields('swipe')
    const dir = fields.find((f) => f.name === 'direction')
    expect(dir?.kind).toBe('enum')
    expect(dir?.options?.map((o) => o.value)).toEqual(['UP', 'DOWN', 'LEFT', 'RIGHT'])
    // option label 由 markdownEnumDescriptions 清洗而来,没 emoji
    const upLabel = dir?.options?.[0].label ?? ''
    expect(upLabel).not.toMatch(/[\u{1F000}-\u{1FFFF}]/u)
  })

  it('returns [] for bare commands with only common props (back, hideKeyboard)', () => {
    // back: oneOf [boolean, object(commonCommandProperties only)]
    // 排除 common 后对象分支为空 → []
    expect(getActionFields('back')).toEqual([])
    expect(getActionFields('hideKeyboard')).toEqual([])
  })

  it('extracts httpRequest core fields including url', () => {
    const fields = getActionFields('httpRequest')
    const names = fields.map((f) => f.name)
    expect(names).toContain('url')
    expect(names).toContain('method')
    expect(names).toContain('outputVariable')
    const method = fields.find((f) => f.name === 'method')
    expect(method?.kind).toBe('enum')
    expect(method?.options?.map((o) => o.value)).toEqual(['GET', 'POST'])
  })

  it('marks required fields when schema declares them', () => {
    const fields = getActionFields('scrollUntilVisible')
    const element = fields.find((f) => f.name === 'element')
    expect(element).toBeDefined()
    expect(element?.required).toBe(true)
  })
})
