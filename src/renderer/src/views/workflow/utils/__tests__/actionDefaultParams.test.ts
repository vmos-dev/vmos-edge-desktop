/**
 * actionRegistry 的 defaultParams 契约测试
 *
 * 架构不变量(对每个 action 成立):
 *   1. 字段类型层必需(ActionDefinition 里不是可选)
 *   2. 返回值要么 undefined(bare)要么对象
 *   3. recommendation 的 buildStep 透过它注入默认参数 → 输出 YAML 语义完整
 *
 * 新增 action 时会被类型检查强制同时声明 defaultParams,避免"忘记声明 →
 * 跑推荐生成半残 YAML"这类历史 bug 重演。
 */

import { describe, expect, it } from 'vitest'
import { ACTION_REGISTRY, getActionDefinition } from '../actionRegistry'
import { buildStep } from '../recommendation'
import { stepsToYaml } from '../stepsToYaml'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { ActionType } from '@shared/ipc/workflow.types'

const ACTIONS = Object.keys(ACTION_REGISTRY)

function node(): UiNode {
  return {
    id: 1,
    className: 'android.widget.Button',
    depth: 0,
    bounds: [0, 0, 100, 100],
    attrs: { text: '测试', clickable: 'true', enabled: 'true' },
    children: []
  }
}

describe('每个 action 都必须显式声明 defaultParams(类型层不变量)', () => {
  it.each(ACTIONS)('%s 有 defaultParams 函数,调用返回对象或 undefined', (action) => {
    const def = getActionDefinition(action)
    expect(def).toBeDefined()
    expect(typeof def!.defaultParams).toBe('function')
    // 两种调用路径都必须合法
    for (const v of [def!.defaultParams(), def!.defaultParams({ node: node() })]) {
      const isValidReturn =
        v === undefined || (v !== null && typeof v === 'object' && !Array.isArray(v))
      expect(isValidReturn).toBe(true)
    }
  })
})

describe('buildStep 注入 defaultParams 的关键 action(回归用户 bug)', () => {
  function step(action: string): ReturnType<typeof buildStep> {
    return buildStep(node(), action as never)
  }

  // 用户报告的 swipe 裸命令 bug —— node-aware 默认
  it('swipe:竖向节点默认 direction UP(feed 语义)', () => {
    // 普通 Button(非横向容器) → UP
    const s = step('swipe')
    expect(s.params).toEqual({ direction: 'UP' })
  })

  it('swipe:横向 ViewPager 容器默认 LEFT', () => {
    const horizontalPager: UiNode = {
      ...node(),
      className: 'androidx.viewpager.widget.ViewPager',
      attrs: { scrollable: 'true', enabled: 'true' },
      bounds: [0, 0, 1080, 300] // 宽 > 高 * 1.5
    }
    const s = buildStep(horizontalPager, 'swipe' as ActionType)
    expect(s.params).toEqual({ direction: 'LEFT' })
  })

  it('swipe:class 含 horizontal 也判定横向', () => {
    const n: UiNode = {
      ...node(),
      className: 'com.app.HorizontalScrollView',
      attrs: { scrollable: 'true', enabled: 'true' },
      bounds: [0, 0, 500, 400]
    }
    const s = buildStep(n, 'swipe' as ActionType)
    expect(s.params).toEqual({ direction: 'LEFT' })
  })

  it('swipe:无 node 时 fallback DOWN', () => {
    const def = getActionDefinition('swipe')!
    expect(def.defaultParams()).toEqual({ direction: 'DOWN' })
  })

  // 其他关键 scalar-default actions
  it('sleep:推荐生成默认 duration 1000', () => {
    const s = step('sleep')
    expect(s.params).toEqual({ duration: 1000 })
  })
  it('pressKey:普通节点默认 Back(返回导航)', () => {
    const s = step('pressKey')
    expect(s.params).toEqual({ key: 'Back' })
  })

  it('pressKey:EditText 节点默认 Enter(提交输入)', () => {
    const edit: UiNode = {
      ...node(),
      className: 'android.widget.EditText',
      attrs: { enabled: 'true' }
    }
    const s = buildStep(edit, 'pressKey' as ActionType)
    expect(s.params).toEqual({ key: 'Enter' })
  })

  it('pressKey:SearchView 节点也判定为 Enter', () => {
    const n: UiNode = {
      ...node(),
      className: 'android.widget.SearchView',
      attrs: { enabled: 'true' }
    }
    const s = buildStep(n, 'pressKey' as ActionType)
    expect(s.params).toEqual({ key: 'Enter' })
  })
  it('inputText:推荐生成默认 text ""', () => {
    const s = step('inputText')
    expect(s.params).toEqual({ text: '' })
  })

  // eraseText node-aware
  it('eraseText:节点有文本,精确删到字数', () => {
    const filled: UiNode = {
      ...node(),
      className: 'android.widget.EditText',
      attrs: { text: '你好世界', enabled: 'true' }
    }
    const s = buildStep(filled, 'eraseText' as ActionType)
    expect(s.params).toEqual({ charactersToErase: 4 })
  })

  it('eraseText:节点无文本,保守删 50', () => {
    const empty: UiNode = {
      ...node(),
      className: 'android.widget.EditText',
      attrs: { text: '', enabled: 'true' }
    }
    const s = buildStep(empty, 'eraseText' as ActionType)
    expect(s.params).toEqual({ charactersToErase: 50 })
  })

  // scrollUntilVisible node-aware
  it('scrollUntilVisible:横向容器默认 direction LEFT', () => {
    const hPager: UiNode = {
      ...node(),
      className: 'androidx.viewpager.widget.ViewPager',
      attrs: { scrollable: 'true', enabled: 'true' },
      bounds: [0, 0, 1080, 300]
    }
    const s = buildStep(hPager, 'scrollUntilVisible' as ActionType)
    expect(s.params).toEqual({ direction: 'LEFT' })
  })

  it('scrollUntilVisible:非横向节点,保留引擎默认(undefined)', () => {
    const s = step('scrollUntilVisible')
    expect(s.params).toBeUndefined()
  })
  it('takeScreenshot:推荐生成默认 path', () => {
    const s = step('takeScreenshot')
    expect(s.params).toEqual({ path: 'screenshot.png' })
  })

  // selector-required actions 默认不带 params(selector 从节点来)
  it('tapOn:selector 从 node 来,params undefined', () => {
    const s = step('tapOn')
    expect(s.params).toBeUndefined()
  })
  it('assertVisible:selector 从 node,params undefined', () => {
    const s = step('assertVisible')
    expect(s.params).toBeUndefined()
  })

  // bare actions(纯裸命令)
  it('back:params undefined,YAML 为裸命令', () => {
    const s = step('back')
    expect(s.params).toBeUndefined()
  })
})

describe('buildStep + stepsToYaml:推荐链路产出的 YAML 都是语义完整的', () => {
  function roundTrip(action: string): string {
    const s = buildStep(node(), action as never)
    return stepsToYaml({
      appId: 'x',
      name: 't',
      steps: [{ ...s, id: '0' }]
    })
  }

  it('swipe 输出 direction(不是裸 `- swipe`)', () => {
    const y = roundTrip('swipe')
    // 普通节点 → UP(feed 语义);任何情况下都不应该是裸命令
    expect(y).toMatch(/direction:\s*UP/)
    expect(y).not.toMatch(/- swipe\s*\n/)
  })

  it('sleep 输出 duration', () => {
    const y = roundTrip('sleep')
    expect(y).toMatch(/sleep:\s*1000/)
  })

  it('setLocation 输出 latitude/longitude', () => {
    const y = roundTrip('setLocation')
    expect(y).toMatch(/latitude:/)
    expect(y).toMatch(/longitude:/)
  })

  it('httpRequest 输出 url/method', () => {
    const y = roundTrip('httpRequest')
    expect(y).toMatch(/url:/)
    expect(y).toMatch(/method:\s*GET/)
  })
})
