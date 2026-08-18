import { describe, expect, it } from 'vitest'
import {
  appendStepInContainerWithBody,
  appendStepWithBody,
  getStepBody,
  insertStepAfterWithBody,
  setStepBody
} from '../yamlOps'
import { parseYamlDocument } from '../yamlDocument'

const HEADER = `appId: "com.demo"
---
`

function build(commandsYaml: string): string {
  return `${HEADER}${commandsYaml}`
}

function steps(text: string) {
  return parseYamlDocument(text).steps
}

describe('yamlOps · getStepBody', () => {
  it('returns string body for "tapOn: 登录"', () => {
    const text = build(`- tapOn: "登录"\n`)
    expect(getStepBody(text, '0')).toBe('登录')
  })

  it('returns object body for "tapOn:\\n  text: 登录\\n  id: btn"', () => {
    const text = build(`- tapOn:\n    text: "登录"\n    id: "btn_login"\n`)
    expect(getStepBody(text, '0')).toEqual({ text: '登录', id: 'btn_login' })
  })

  it('returns number body for "sleep: 1500"', () => {
    const text = build(`- sleep: 1500\n`)
    expect(getStepBody(text, '0')).toBe(1500)
  })

  it('returns boolean body for "setAirplaneMode: true"', () => {
    const text = build(`- setAirplaneMode: true\n`)
    expect(getStepBody(text, '0')).toBe(true)
  })

  it('returns undefined for bare command "back"', () => {
    const text = build(`- back\n`)
    expect(getStepBody(text, '0')).toBeUndefined()
  })

  it('returns array body for branch', () => {
    const text = build(`- branch:\n    - commands:\n        - back\n`)
    const body = getStepBody(text, '0')
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns undefined for non-existent stepId', () => {
    const text = build(`- back\n`)
    expect(getStepBody(text, '99')).toBeUndefined()
  })

  it('returns undefined when YAML has parse error', () => {
    expect(getStepBody('not valid: [', '0')).toBeUndefined()
  })
})

describe('yamlOps · setStepBody', () => {
  it('replaces object body entirely', () => {
    const text = build(`- tapOn: "old"\n`)
    const next = setStepBody(text, '0', 'tapOn', { text: 'new', index: 1 })
    expect(getStepBody(next, '0')).toEqual({ text: 'new', index: 1 })
  })

  it('escalates primitive body to object body', () => {
    const text = build(`- tapOn: "登录"\n`)
    const next = setStepBody(text, '0', 'tapOn', { text: '登录', index: 0 })
    const body = getStepBody(next, '0')
    expect(body).toEqual({ text: '登录', index: 0 })
  })

  it('downgrades object body to primitive', () => {
    const text = build(`- inputText:\n    text: "hello"\n`)
    const next = setStepBody(text, '0', 'inputText', 'world')
    expect(getStepBody(next, '0')).toBe('world')
  })

  it('downgrades to bare command when body is undefined', () => {
    const text = build(`- back: true\n`)
    const next = setStepBody(text, '0', 'back', undefined)
    expect(next).toContain('- back\n')
    expect(getStepBody(next, '0')).toBeUndefined()
  })

  it('returns original text on invalid stepId', () => {
    const text = build(`- back\n`)
    expect(setStepBody(text, '99', 'tapOn', { text: 'x' })).toBe(text)
  })
})

describe('yamlOps · appendStepWithBody', () => {
  it('appends to root commands', () => {
    const text = build(`- back\n`)
    const next = appendStepWithBody(text, 'tapOn', { text: '登录' })
    const list = steps(next)
    expect(list).toHaveLength(2)
    expect(list[1].action).toBe('tapOn')
  })

  it('writes bare form when body is undefined', () => {
    const text = build(`- tapOn: "x"\n`)
    const next = appendStepWithBody(text, 'back', undefined)
    expect(next).toMatch(/- back\s*\n?$/)
  })

  it('writes primitive form when body is string', () => {
    const text = build(`- back\n`)
    const next = appendStepWithBody(text, 'inputText', 'hello')
    expect(getStepBody(next, '1')).toBe('hello')
  })

  it('creates the seq when commands doc is empty', () => {
    const text = build('')
    const next = appendStepWithBody(text, 'back', undefined)
    expect(steps(next)).toHaveLength(1)
  })
})

describe('yamlOps · insertStepAfterWithBody', () => {
  it('inserts immediately after the given step', () => {
    const text = build(`- tapOn: "A"\n- tapOn: "C"\n`)
    const next = insertStepAfterWithBody(text, '0', 'tapOn', 'B')
    const list = steps(next)
    expect(list.map((s) => getStepBody(next, s.id))).toEqual(['A', 'B', 'C'])
  })

  it('returns original text when afterStepId is missing', () => {
    const text = build(`- back\n`)
    expect(insertStepAfterWithBody(text, '99', 'tapOn', { text: 'x' })).toBe(text)
  })
})

describe('yamlOps · appendStepInContainerWithBody', () => {
  it('appends inside repeat container', () => {
    const text = build(`- repeat:\n    times: 2\n    commands:\n      - back\n`)
    const next = appendStepInContainerWithBody(text, '0', 'tapOn', { text: '登录' })
    const list = steps(next)
    expect(list).toHaveLength(1)
    expect(list[0].children).toHaveLength(2)
    expect(list[0].children?.[1].action).toBe('tapOn')
  })

  it('returns original text when parent is not a container', () => {
    const text = build(`- tapOn: "x"\n`)
    expect(appendStepInContainerWithBody(text, '0', 'back', undefined)).toBe(text)
  })
})
