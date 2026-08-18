/**
 * round-trip 数据完整性回归
 *
 * 验证 save 链路 (parse → Step[] → stepsToYaml → YAML) 不会静默丢步骤。
 * 这是用户提过的 bug:ctrl+s 后多个步骤消失。
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { parseYamlDocument } from '../yamlDocument'
import { stepsToYaml } from '../stepsToYaml'
import type { Step } from '@shared/ipc/workflow.types'

function roundTrip(yaml: string): { inSteps: Step[]; outYaml: string; outSteps: Step[] } {
  const parsed = parseYamlDocument(yaml)
  const inSteps = [...parsed.steps]
  const outYaml = stepsToYaml({
    appId: parsed.meta.appId ?? 'test.app',
    name: parsed.meta.name ?? 'test',
    steps: inSteps
  })
  const reparsed = parseYamlDocument(outYaml)
  return { inSteps, outYaml, outSteps: [...reparsed.steps] }
}

describe('save round-trip data integrity', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preserves step count for well-formed YAML', () => {
    const yaml = `appId: com.example
name: t
---
- launchApp
- tapOn: "登录"
- inputText: "hello"
- sleep: 500
- scroll
- assertVisible: "欢迎"
`
    const { inSteps, outSteps } = roundTrip(yaml)
    expect(inSteps.length).toBe(6)
    expect(outSteps.length).toBe(6)
  })

  it('preserves bare selector-action (previously silently dropped)', () => {
    // 用户手写 `- tapOn` 裸命令(缺 selector)—— 保留为裸命令,不丢
    const yaml = `appId: com.example
---
- launchApp
- tapOn
- sleep: 500
`
    // 抑制 warn 噪音
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { inSteps, outSteps, outYaml } = roundTrip(yaml)
    expect(inSteps.length).toBe(3)
    expect(outSteps.length).toBe(3)
    // tapOn 被保留成裸命令
    expect(outYaml).toMatch(/- tapOn\b/)
  })

  it('preserves scrollUntilVisible without selector (previously silently dropped)', () => {
    const yaml = `appId: com.example
---
- launchApp
- scrollUntilVisible
- sleep: 500
`
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { inSteps, outSteps } = roundTrip(yaml)
    expect(inSteps.length).toBe(3)
    expect(outSteps.length).toBe(3)
  })

  it('emits console.warn for missing-selector action instead of dropping', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const synthetic: Step = {
      id: '0',
      action: 'tapOn',
      stability: 'ok',
      metadata: { elementType: 'unknown', capturedAt: 0 }
      // 注意:故意不设 selector
    }
    const yaml = stepsToYaml({ appId: 'x', name: 't', steps: [synthetic] })
    expect(warnSpy).toHaveBeenCalled()
    expect(yaml).toMatch(/- tapOn\b/)
  })

  it('preserves opaque steps with raw payload (手写 YAML 未知字段)', () => {
    const yaml = `appId: com.example
---
- launchApp
- customAction:
    foo: 1
    bar: 2
- sleep: 500
`
    const { inSteps, outSteps } = roundTrip(yaml)
    expect(inSteps.length).toBe(3)
    expect(outSteps.length).toBe(3)
    // opaque 步骤的 raw 被保留
    expect(inSteps[1].opaque).toBe(true)
  })

  it('preserves all steps when disabled=true is set at runtime (not a drop signal)', () => {
    // 模拟:用户 toggle 一个步骤 disabled;save 不应丢
    const yaml = `appId: com.example
---
- launchApp
- tapOn: "确认"
- sleep: 500
`
    const parsed = parseYamlDocument(yaml)
    const stepsWithOneDisabled = parsed.steps.map((s, i) =>
      i === 1 ? { ...s, disabled: true } : s
    )
    const outYaml = stepsToYaml({
      appId: 'x',
      name: 't',
      steps: stepsWithOneDisabled
    })
    const reparsed = parseYamlDocument(outYaml)
    expect(reparsed.steps.length).toBe(3)
  })

  it('reproduces user bug scenario: real Play Games workflow survives save', () => {
    // 模拟用户给的上下文:一堆步骤,其中若干 selector 缺失
    const yaml = `appId: com.google.android.play.games
name: Google Play 游戏 自动化
---
- launchApp
- tapOn: "搜索"
- inputText: "Hop Mania"
- tapOn
- sleep: [300, 500]
- scrollUntilVisible:
    direction: UP
    element:
      text: Hop Mania
- tapOn: "开始游戏"
`
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { inSteps, outSteps } = roundTrip(yaml)
    expect(inSteps.length).toBe(7)
    expect(outSteps.length).toBe(7) // 之前会丢到只剩 2 个
  })
})

describe('field-level round-trip (step body params must survive)', () => {
  it('scrollUntilVisible preserves direction / timeout / speed alongside element', () => {
    const yaml = `appId: com.example
---
- scrollUntilVisible:
    direction: UP
    timeout: 20000
    speed: 40
    element:
      text: Hop Mania
`
    const { outYaml, outSteps } = roundTrip(yaml)

    // out YAML 必须仍然包含所有 3 个 params
    expect(outYaml).toMatch(/direction:\s*UP/)
    expect(outYaml).toMatch(/timeout:\s*20000/)
    expect(outYaml).toMatch(/speed:\s*40/)
    // 引号风格由默认政策决定(含空白的字符串会被 QUOTE_DOUBLE);断言只验值存在
    expect(outYaml).toMatch(/text:\s*"?Hop Mania"?/)

    // reparse 后 step 也带全量 params
    const reparsedStep = outSteps[0]
    expect(reparsedStep.action).toBe('scrollUntilVisible')
    expect(reparsedStep.params?.direction).toBe('UP')
    expect(reparsedStep.params?.timeout).toBe(20000)
    expect(reparsedStep.params?.speed).toBe(40)
  })

  it('extendedWaitUntil preserves visible polarity + timeout', () => {
    const yaml = `appId: com.example
---
- extendedWaitUntil:
    visible:
      text: "加载完成"
    timeout: 10000
`
    const { outYaml, outSteps } = roundTrip(yaml)
    expect(outYaml).toMatch(/visible:/)
    expect(outYaml).not.toMatch(/notVisible:/)
    expect(outYaml).toMatch(/timeout:\s*10000/)
    expect(outSteps[0].params?.timeout).toBe(10000)
  })

  it('extendedWaitUntil preserves notVisible polarity', () => {
    const yaml = `appId: com.example
---
- extendedWaitUntil:
    notVisible:
      text: "loading"
    timeout: 5000
`
    const { outYaml } = roundTrip(yaml)
    expect(outYaml).toMatch(/notVisible:/)
    expect(outYaml).not.toMatch(/\bvisible:/)
    expect(outYaml).toMatch(/timeout:\s*5000/)
  })

  it('tapOn preserves label + optional + extra selector keys', () => {
    // tapOn 通过 ATOMIC_WITH_SELECTOR 分支处理,验证没被破坏
    const yaml = `appId: com.example
---
- tapOn:
    text: "登录"
    index: 0
    label: "点击登录按钮"
    optional: true
`
    const { outYaml } = roundTrip(yaml)
    expect(outYaml).toMatch(/text:\s*"?登录"?/)
    expect(outYaml).toMatch(/index:\s*0/)
    expect(outYaml).toMatch(/label:\s*/)
    expect(outYaml).toMatch(/optional:\s*true/)
  })
})
