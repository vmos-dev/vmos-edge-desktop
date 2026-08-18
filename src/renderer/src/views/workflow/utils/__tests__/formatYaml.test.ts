/**
 * formatYaml 契约测试
 *
 * 核心不变量:
 *   - 只规范缩进,引号 / flow / 注释 / 键顺序 全部原样保留
 *   - idempotent(连续调用两次结果相同)
 *   - 解析错误时返回原文本,不做破坏
 */

import { describe, expect, it } from 'vitest'
import { formatYaml } from '../formatYaml'

describe('formatYaml · 只动缩进,其他原样', () => {
  it('保留双引号', () => {
    const out = formatYaml(`appId: "com.example"
name: "演示"
---
- tapOn: "登录"
- inputText: "hello"
`)
    expect(out).toContain('"com.example"')
    expect(out).toContain('"演示"')
    expect(out).toContain('"登录"')
    expect(out).toContain('"hello"')
  })

  it('单引号统一转为双引号(项目级 canonical 引号风格)', () => {
    // 此前契约是"保留 user quote 风格";现改为"所有发射都用 `"..."`",
    // 避免编辑器里同时看到 `'x'` 和 `"x"` 两种混杂。
    const out = formatYaml(`appId: 'com.example'
---
- tapOn: 'go'
`)
    expect(out).toContain('"com.example"')
    expect(out).toContain('"go"')
    expect(out).not.toContain("'com.example'")
    expect(out).not.toContain("'go'")
  })

  it('保留 flow 风格 seq', () => {
    const out = formatYaml(`appId: com.example
---
- sleep:
    duration: [300, 500]
`)
    expect(out).toMatch(/duration:\s*\[300,\s*500\]/)
    // 不应该被拆成多行 block
    expect(out).not.toMatch(/duration:\n\s+- 300/)
  })

  it('保留 flow 风格 map', () => {
    const out = formatYaml(`appId: com.example
---
- tapOn: { text: "登录", index: 0 }
`)
    // flow map 保留
    expect(out).toMatch(/tapOn:\s*\{[^}]*text:[^}]*index:[^}]*\}/)
  })

  it('保留注释', () => {
    const out = formatYaml(`appId: com.example
# 这是配置
name: demo
---
# 主流程
- launchApp
- tapOn: "登录"
`)
    expect(out).toContain('# 这是配置')
    expect(out).toContain('# 主流程')
  })

  it('保留 map 键顺序', () => {
    const out = formatYaml(`appId: com.example
name: demo
tags: [a, b]
---
- launchApp
`)
    // appId 在 name 前,name 在 tags 前
    const appIdIdx = out.indexOf('appId:')
    const nameIdx = out.indexOf('name:')
    const tagsIdx = out.indexOf('tags:')
    expect(appIdIdx).toBeGreaterThanOrEqual(0)
    expect(appIdIdx).toBeLessThan(nameIdx)
    expect(nameIdx).toBeLessThan(tagsIdx)
  })

  it('缩进不规范的文本会被规范化', () => {
    const messy = `appId: com.example
---
-   tapOn: "登录"
-     sleep:
         duration: 500
`
    const out = formatYaml(messy)
    // 行首 `-` 后保持单空格(yaml 标准)
    expect(out).toMatch(/^- tapOn:/m)
    // duration 不应该 9 空格缩进
    expect(out).not.toMatch(/^ {9}duration:/m)
  })

  it('idempotent:连续格式化结果不再变化', () => {
    const src = `appId: "x"
---
- tapOn: "a"
- sleep: [100, 200]
`
    const once = formatYaml(src)
    const twice = formatYaml(once)
    expect(twice).toBe(once)
  })

  it('解析失败时返回原文本,不破坏用户代码', () => {
    const broken = `appId: com.example
---
- tapOn: [unclosed
`
    expect(formatYaml(broken)).toBe(broken)
  })

  it('单 document(无 ---)也能格式化', () => {
    const out = formatYaml(`foo: "bar"
list: [1, 2, 3]
`)
    expect(out).toContain('"bar"')
    expect(out).toMatch(/\[1,\s*2,\s*3\]/)
  })

  // 明确不做语义修复(和 VSCode / Prettier 一致)
  it('不修 `- action:"value"` 无空格的手误(合法 YAML scalar)', () => {
    const src = `appId: com.demo
---
- launchApp
- assertNotVisible:"121"
`
    const out = formatYaml(src)
    // yaml 库按规范把 `- assertNotVisible:"121"` 解析为字符串 scalar,
    // format 不改语义,原样输出。用户需通过 schema 诊断看到问题并自己修。
    expect(out).toContain('- assertNotVisible:"121"')
  })
})
