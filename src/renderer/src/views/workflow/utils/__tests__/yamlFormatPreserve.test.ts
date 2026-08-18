import { describe, expect, it } from 'vitest'
import {
  patchStep,
  duplicateStep,
  setStepBody,
  appendStepWithBody,
  insertStepAfterWithBody
} from '../yamlOps'
import { stepsToYaml } from '../stepsToYaml'
import type { Step } from '@shared/ipc/workflow.types'

const YAML_WITH_FLOW_DURATION = `appId: com.example
---
- sleep:
    duration: [300, 500]
    label: "开局等一下"
- tapOn: "确认"
`

const YAML_WITH_FLOW_MAP = `appId: com.example
---
- tapOn: { text: "登录", index: 0 }
- eraseText
`

// 工程规范:无内部 padding → `[300, 500]`,不是 `[ 300, 500 ]`
const FLOW_SEQ_G = /duration:\s*\[300,\s*500\]/g
const FLOW_SEQ = /duration:\s*\[300,\s*500\]/
const BLOCK_SEQ = /duration:\n\s+-\s+300\n\s+-\s+500/
const FLOW_MAP = /tapOn:\s*\{[^}]*text:[^}]*index:[^}]*\}/

describe('yamlFormatPreserve (patchStep)', () => {
  it('preserves flow-style seq (duration: [300, 500]) after patching label', () => {
    const next = patchStep(YAML_WITH_FLOW_DURATION, '0', { label: '等两下' })
    expect(next).toMatch(FLOW_SEQ)
    expect(next).not.toMatch(BLOCK_SEQ)
  })

  it('preserves flow-style seq when body is rewritten via setStepBody', () => {
    const next = setStepBody(YAML_WITH_FLOW_DURATION, '0', 'sleep', {
      duration: [300, 500],
      label: '改了别的'
    })
    expect(next).toMatch(FLOW_SEQ)
    expect(next).not.toMatch(BLOCK_SEQ)
  })

  it('preserves flow-style map (tapOn: { text, index }) after patching label', () => {
    const next = patchStep(YAML_WITH_FLOW_MAP, '0', { label: '登录按钮' })
    expect(next).toMatch(FLOW_MAP)
  })

  it('preserves flow/quote style after duplicateStep (both copies flow-style)', () => {
    const next = duplicateStep(YAML_WITH_FLOW_DURATION, '0')
    const occurrences = next.match(FLOW_SEQ_G) ?? []
    expect(occurrences.length).toBe(2)
    expect(next).not.toMatch(BLOCK_SEQ)
  })
})

describe('default flow policy (fresh-created nodes)', () => {
  function makeSleepStep(min: number, max: number): Step {
    return {
      id: '',
      action: 'sleep',
      stability: 'ok',
      params: { duration: [min, max] },
      metadata: { elementType: 'unknown', capturedAt: 0 }
    }
  }

  it('stepsToYaml emits flow style for short numeric tuples (sleep duration tuple)', () => {
    const yaml = stepsToYaml({
      appId: 'com.example',
      name: 't',
      steps: [makeSleepStep(300, 500)]
    })
    // stepToYamlItems 把 sleep 的 duration 放在 body 直接位置:`- sleep: [300, 500]`
    expect(yaml).toMatch(/sleep:\s*\[300,\s*500\]/)
    expect(yaml).not.toMatch(/sleep:\n\s+- 300/)
    // 无内部 padding
    expect(yaml).not.toMatch(/\[ 300, 500 \]/)
  })

  it('appendStepWithBody creates new sleep as flow tuple (no padding)', () => {
    const base = `appId: com.example\n---\n- launchApp\n`
    const next = appendStepWithBody(base, 'sleep', { duration: [400, 600] })
    expect(next).toMatch(/duration:\s*\[400,\s*600\]/)
    expect(next).not.toMatch(/\[ 400, 600 \]/)
    expect(next).not.toMatch(/duration:\n\s+- 400\n\s+- 600/)
  })

  it('insertStepAfterWithBody creates sleep with flow tuple', () => {
    const base = `appId: com.example\n---\n- launchApp\n- back\n`
    const next = insertStepAfterWithBody(base, '0', 'sleep', { duration: [100, 200] })
    expect(next).toMatch(/duration:\s*\[100,\s*200\]/)
  })

  it('does NOT force flow on long arrays or non-numeric arrays', () => {
    const yaml = stepsToYaml({
      appId: 'com.example',
      name: 't',
      steps: [
        {
          id: '',
          action: 'defineVariables',
          stability: 'ok',
          params: { values: ['aaaaaaaaaaaaaaaaaaaaaa', 'b', 'c', 'd', 'e', 'f'] },
          metadata: { elementType: 'unknown', capturedAt: 0 }
        }
      ]
    })
    // 6 项,超 FLOW_TUPLE_MAX_LENGTH(4);也不是数字元组 → 维持 block
    expect(yaml).toMatch(/- aaaa/)
    expect(yaml).not.toMatch(/\[\s*'aaaa/)
  })
})

describe('default quote policy (pair.value 内容字符串自动加双引号)', () => {
  function makeTapStep(text: string): Step {
    return {
      id: '',
      action: 'tapOn',
      stability: 'ok',
      selector: { primary: { type: 'text', value: text, stabilityScore: 80 } },
      metadata: { elementType: 'unknown', capturedAt: 0 }
    }
  }

  it('非 ASCII(中文)选择器值 → 双引号', () => {
    const yaml = stepsToYaml({ appId: 'com.example', name: 't', steps: [makeTapStep('登录')] })
    expect(yaml).toMatch(/tapOn:\s*"登录"/)
  })

  it('含空白的选择器值 → 双引号', () => {
    const yaml = stepsToYaml({
      appId: 'com.example',
      name: 't',
      steps: [makeTapStep('Login here')]
    })
    expect(yaml).toMatch(/tapOn:\s*"Login here"/)
  })

  it('ASCII 标识符(com.example)保持 PLAIN', () => {
    const yaml = stepsToYaml({ appId: 'com.example.myapp', name: 'demo', steps: [] })
    // appId 是纯 ASCII 标识符,不该被强制加引号
    expect(yaml).toMatch(/appId: com\.example\.myapp/)
    expect(yaml).not.toMatch(/appId:\s*"com\.example\.myapp"/)
  })

  it('枚举值(DOWN / UP)保持 PLAIN', () => {
    const step: Step = {
      id: '',
      action: 'scroll',
      stability: 'ok',
      params: { direction: 'DOWN' },
      metadata: { elementType: 'unknown', capturedAt: 0 }
    }
    const yaml = stepsToYaml({ appId: 'com.example', name: 't', steps: [step] })
    expect(yaml).toMatch(/direction: DOWN/)
    expect(yaml).not.toMatch(/direction:\s*"DOWN"/)
  })

  it('commands 段纯 ASCII 内容(hello)也加双引号 —— Maestro 官方风格', () => {
    const step: Step = {
      id: '',
      action: 'inputText',
      stability: 'ok',
      params: { text: 'hello' },
      metadata: { elementType: 'unknown', capturedAt: 0 }
    }
    const yaml = stepsToYaml({ appId: 'com.example', name: 't', steps: [step] })
    expect(yaml).toMatch(/inputText:\s*"hello"/)
  })

  it('commands 段 tapOn 的 ASCII 选择器(Login)也加引号', () => {
    const yaml = stepsToYaml({ appId: 'com.example', name: 't', steps: [makeTapStep('Login')] })
    expect(yaml).toMatch(/tapOn:\s*"Login"/)
  })
})
