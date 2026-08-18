import { describe, expect, it } from 'vitest'
import {
  ACTION_REGISTRY,
  actionLabel,
  actionSummary,
  actionsByCategory,
  CATEGORY_IDS,
  getActionDefinition
} from '../actionRegistry'

describe('actionRegistry · ACTION_REGISTRY 数据完整性', () => {
  it('每条 entry 的 id 与 key 一致', () => {
    for (const [key, def] of Object.entries(ACTION_REGISTRY)) {
      expect(def.id).toBe(key)
    }
  })

  it('每条 entry 都有非空 label / description', () => {
    for (const def of Object.values(ACTION_REGISTRY)) {
      expect(def.label).toBeTruthy()
      expect(def.description).toBeTruthy()
    }
  })

  it('每条 entry 的 category 都在已声明的 CATEGORY_IDS 里', () => {
    const validCategories = new Set(CATEGORY_IDS)
    for (const def of Object.values(ACTION_REGISTRY)) {
      expect(validCategories.has(def.category)).toBe(true)
    }
  })

  it('每条 entry 的 defaultBody / summary 都是函数', () => {
    for (const def of Object.values(ACTION_REGISTRY)) {
      expect(typeof def.defaultBody).toBe('function')
      expect(typeof def.summary).toBe('function')
    }
  })
})

describe('actionRegistry · 默认 body 形态', () => {
  it('bare commands 默认 body 为 undefined(YAML 写成裸字符串)', () => {
    expect(getActionDefinition('back')?.defaultBody()).toBeUndefined()
    expect(getActionDefinition('hideKeyboard')?.defaultBody()).toBeUndefined()
    expect(getActionDefinition('scroll')?.defaultBody()).toBeUndefined()
    expect(getActionDefinition('pasteText')?.defaultBody()).toBeUndefined()
  })

  it('选择器类默认 body 是带 text 的对象', () => {
    expect(getActionDefinition('tapOn')?.defaultBody()).toEqual({ text: '' })
    expect(getActionDefinition('longPressOn')?.defaultBody()).toEqual({ text: '' })
    expect(getActionDefinition('assertVisible')?.defaultBody()).toEqual({ text: '' })
  })

  it('原始值类默认 body 是基础类型', () => {
    expect(getActionDefinition('inputText')?.defaultBody()).toBe('')
    expect(getActionDefinition('sleep')?.defaultBody()).toBe(1000)
    expect(getActionDefinition('eraseText')?.defaultBody()).toBe(50)
    expect(getActionDefinition('pressKey')?.defaultBody()).toBe('Back')
    expect(getActionDefinition('swipe')?.defaultBody()).toBe('DOWN')
  })

  it('复合容器默认带空 commands', () => {
    expect(getActionDefinition('repeat')?.defaultBody()).toEqual({ times: 3, commands: [] })
    expect(getActionDefinition('retry')?.defaultBody()).toEqual({ maxRetries: 1, commands: [] })
    expect(getActionDefinition('branch')?.defaultBody()).toEqual([{ commands: [] }])
    expect(getActionDefinition('runFlow')?.defaultBody()).toEqual({ commands: [] })
  })
})

describe('actionRegistry · summary 派生', () => {
  it('选择器:string body → "value"', () => {
    expect(actionSummary('tapOn', '登录')).toBe('"登录"')
  })

  it('选择器:object body 优先 text', () => {
    expect(actionSummary('tapOn', { text: '确认', id: 'btn' })).toBe('"确认"')
    expect(actionSummary('tapOn', { id: 'login_btn' })).toBe('"login_btn"')
  })

  it('选择器:body 为空 → i18n toFill', () => {
    expect(actionSummary('tapOn', { text: '' })).toBe('workflow.actionSummary.toFill')
    expect(actionSummary('tapOn', '')).toBe('workflow.actionSummary.toFill')
    expect(actionSummary('tapOn', null)).toBe('workflow.actionSummary.toFill')
  })

  it('inputText:有内容 → quoted; 空 → i18n empty', () => {
    expect(actionSummary('inputText', 'hello')).toBe('"hello"')
    expect(actionSummary('inputText', '')).toBe('workflow.actionSummary.empty')
  })

  it('sleep:数字 → "Nms",对象/数组形式都覆盖', () => {
    expect(actionSummary('sleep', 1500)).toBe('1500ms')
    expect(actionSummary('sleep', [500, 1000])).toBe('500~1000ms')
    expect(actionSummary('sleep', { duration: 800 })).toBe('800ms')
    expect(actionSummary('sleep', { min: 100, max: 500 })).toBe('100~500ms')
  })

  it('launchApp:string → 包名;对象有 appId → 包名;否则 i18n useConfigAppId', () => {
    expect(actionSummary('launchApp', 'com.foo')).toBe('com.foo')
    expect(actionSummary('launchApp', { appId: 'com.bar' })).toBe('com.bar')
    expect(actionSummary('launchApp', undefined)).toBe('workflow.actionSummary.useConfigAppId')
  })

  it('repeat:有 times → "× N"', () => {
    expect(actionSummary('repeat', { times: 3, commands: [] })).toBe('× 3')
    expect(actionSummary('repeat', { duration: 5000, commands: [] })).toBe('5000ms')
  })

  it('branch:body 数组长度 → i18n branchCount', () => {
    expect(actionSummary('branch', [{ commands: [] }, { commands: [] }])).toBe(
      'workflow.actionSummary.branchCount'
    )
  })

  it('裸命令(back / scroll)summary 总是空字符串', () => {
    expect(actionSummary('back', undefined)).toBe('')
    expect(actionSummary('scroll', undefined)).toBe('')
    expect(actionSummary('pasteText', undefined)).toBe('')
  })

  it('未注册的 action,summary 返回空字符串', () => {
    expect(actionSummary('totallyUnknown', { foo: 'bar' })).toBe('')
  })
})

describe('actionRegistry · 派生查询', () => {
  it('actionLabel 对未注册 action 退化到原 id', () => {
    expect(actionLabel('totallyUnknown')).toBe('totallyUnknown')
    expect(actionLabel('tapOn')).toBe('tapOn')
  })

  it('actionsByCategory 把每条 action 归入声明的类目', () => {
    const map = actionsByCategory()
    for (const catId of CATEGORY_IDS) {
      expect(map.has(catId)).toBe(true)
    }
    let total = 0
    for (const list of map.values()) total += list.length
    expect(total).toBe(Object.keys(ACTION_REGISTRY).length)
  })

  it('每个类目至少有一个 action(避免出现空 tab)', () => {
    const map = actionsByCategory()
    for (const catId of CATEGORY_IDS) {
      expect(map.get(catId)?.length ?? 0).toBeGreaterThan(0)
    }
  })
})
