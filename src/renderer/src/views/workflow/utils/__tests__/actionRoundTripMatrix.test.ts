/**
 * 全 action round-trip 矩阵测试(架构级 regression guard)
 *
 * 原则:
 *   对每个已知 action 的典型 YAML 写法,parse → serialize → 输出 YAML 必须和输入
 *   的数据结构等价(字段无丢失)。这是 save 往返数据完整性的最后一道防线。
 *
 * 为什么表驱动:
 *   parse / serialize 的逻辑集中在 yamlDocument + stepCodec 两个文件。行为变化
 *   (新增字段、改 key 名、规范化 body 形状)必须被测试看到。表驱动让覆盖面一目了然。
 */

import { describe, expect, it, vi } from 'vitest'
import { parseYamlDocument } from '../yamlDocument'
import { stepsToYaml } from '../stepsToYaml'

function roundTrip(yamlBody: string): { inYaml: string; outYaml: string } {
  const inYaml = `appId: com.example\n---\n${yamlBody}\n`
  // 抑制 warn 噪音(missing-selector 警告不是本测试关心)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const parsed = parseYamlDocument(inYaml)
  const outYaml = stepsToYaml({
    appId: parsed.meta.appId ?? 'com.example',
    name: parsed.meta.name ?? 't',
    steps: [...parsed.steps]
  })
  return { inYaml, outYaml }
}

/** 检查某字段在输出 YAML 中保留 */
function assertPreserves(outYaml: string, ...fragments: Array<string | RegExp>): void {
  for (const f of fragments) {
    if (typeof f === 'string') {
      expect(outYaml).toContain(f)
    } else {
      expect(outYaml).toMatch(f)
    }
  }
}

describe('action round-trip matrix — preserves all schema fields', () => {
  // ───────────────── 选择器类(ATOMIC_WITH_SELECTOR) ─────────────────

  it('tapOn bare string', () => {
    const { outYaml } = roundTrip(`- tapOn: "登录"`)
    assertPreserves(outYaml, /tapOn:\s*"?登录"?/)
  })

  it('tapOn with object selector (text + index + label + optional)', () => {
    const { outYaml } = roundTrip(`- tapOn:
    text: "确认"
    index: 0
    label: "点击确认"
    optional: true`)
    assertPreserves(outYaml, /text:\s*"?确认"?/, /index:\s*0/, /label:/, /optional:\s*true/)
  })

  it('longPressOn with id selector', () => {
    const { outYaml } = roundTrip(`- longPressOn:
    id: "btn_delete"`)
    assertPreserves(outYaml, /longPressOn:/, /id:\s*"?btn_delete"?/)
  })

  it('doubleTapOn with text', () => {
    const { outYaml } = roundTrip(`- doubleTapOn: "放大"`)
    assertPreserves(outYaml, /doubleTapOn:\s*"?放大"?/)
  })

  it('assertVisible with chance', () => {
    const { outYaml } = roundTrip(`- assertVisible:
    text: "欢迎"
    chance: 80`)
    assertPreserves(outYaml, /assertVisible:/, /text:/, /chance:\s*80/)
  })

  it('copyTextFrom with text selector', () => {
    const { outYaml } = roundTrip(`- copyTextFrom:
    id: "username_field"`)
    assertPreserves(outYaml, /copyTextFrom:/, /id:/)
  })

  // ───────────────── 输入类 ─────────────────

  it('inputText bare string', () => {
    const { outYaml } = roundTrip(`- inputText: "hello world"`)
    assertPreserves(outYaml, /inputText:\s*"?hello/)
  })

  it('inputText with object body preserves extra fields', () => {
    // 虽然 Maestro 主要用 string body,但防御性测试
    const { outYaml } = roundTrip(`- inputText:
    text: "abc"
    timeout: 5000`)
    assertPreserves(outYaml, /text:\s*"?abc"?/, /timeout:\s*5000/)
  })

  it('eraseText bare', () => {
    const { outYaml } = roundTrip(`- eraseText`)
    assertPreserves(outYaml, /- eraseText/)
  })

  it('pasteText bare', () => {
    const { outYaml } = roundTrip(`- pasteText`)
    assertPreserves(outYaml, /- pasteText/)
  })

  // ───────────────── 滚动类 ─────────────────

  it('scroll bare', () => {
    const { outYaml } = roundTrip(`- scroll`)
    assertPreserves(outYaml, /- scroll/)
  })

  it('scroll with object body preserves direction', () => {
    const { outYaml } = roundTrip(`- scroll:
    direction: DOWN
    speed: 40`)
    assertPreserves(outYaml, /direction:\s*DOWN/, /speed:\s*40/)
  })

  it('swipe with direction preserves', () => {
    const { outYaml } = roundTrip(`- swipe:
    direction: LEFT
    duration: 300`)
    assertPreserves(outYaml, /direction:\s*LEFT/, /duration:\s*300/)
  })

  it('scrollUntilVisible preserves direction + timeout + speed + element', () => {
    const { outYaml } = roundTrip(`- scrollUntilVisible:
    direction: UP
    timeout: 20000
    speed: 40
    element:
      text: "Hop Mania"`)
    assertPreserves(
      outYaml,
      /direction:\s*UP/,
      /timeout:\s*20000/,
      /speed:\s*40/,
      /text:\s*"?Hop Mania"?/
    )
  })

  // ───────────────── 等待类 ─────────────────

  it('extendedWaitUntil visible preserves timeout', () => {
    const { outYaml } = roundTrip(`- extendedWaitUntil:
    visible:
      text: "加载完成"
    timeout: 10000`)
    assertPreserves(outYaml, /visible:/, /timeout:\s*10000/)
  })

  it('extendedWaitUntil notVisible preserves polarity', () => {
    const { outYaml } = roundTrip(`- extendedWaitUntil:
    notVisible:
      text: "loading"
    timeout: 5000`)
    assertPreserves(outYaml, /notVisible:/, /timeout:\s*5000/)
    expect(outYaml).not.toMatch(/\bvisible:\s*$/m) // 不应该误翻转成 visible
  })

  it('sleep with number', () => {
    const { outYaml } = roundTrip(`- sleep: 500`)
    assertPreserves(outYaml, /sleep:\s*500/)
  })

  it('sleep with [min, max] tuple preserves flow style', () => {
    const { outYaml } = roundTrip(`- sleep: [300, 500]`)
    assertPreserves(outYaml, /sleep:\s*\[300,\s*500\]/)
  })

  it('waitForAnimationToEnd bare', () => {
    const { outYaml } = roundTrip(`- waitForAnimationToEnd`)
    assertPreserves(outYaml, /waitForAnimationToEnd/)
  })

  // ───────────────── App 控制 ─────────────────

  it('launchApp bare', () => {
    const { outYaml } = roundTrip(`- launchApp`)
    assertPreserves(outYaml, /- launchApp/)
  })

  it('launchApp with object body (appId + stopApp)', () => {
    const { outYaml } = roundTrip(`- launchApp:
    appId: com.other.app
    stopApp: true`)
    // commands 段内容字符串默认 QUOTE_DOUBLE;断言验字段保留而非引号风格
    assertPreserves(outYaml, /appId:\s*"?com\.other\.app"?/, /stopApp:\s*true/)
  })

  it('stopApp bare', () => {
    const { outYaml } = roundTrip(`- stopApp`)
    assertPreserves(outYaml, /- stopApp/)
  })

  it('killApp bare', () => {
    const { outYaml } = roundTrip(`- killApp`)
    assertPreserves(outYaml, /- killApp/)
  })

  it('clearState bare', () => {
    const { outYaml } = roundTrip(`- clearState`)
    assertPreserves(outYaml, /- clearState/)
  })

  // ───────────────── 设备/杂项 ─────────────────

  it('pressKey with string', () => {
    const { outYaml } = roundTrip(`- pressKey: Back`)
    assertPreserves(outYaml, /pressKey:\s*"?Back"?/)
  })

  it('pressKey with object body (key + extras)', () => {
    const { outYaml } = roundTrip(`- pressKey:
    key: Home
    times: 2`)
    assertPreserves(outYaml, /key:\s*"?Home"?/, /times:\s*2/)
  })

  it('takeScreenshot with path', () => {
    const { outYaml } = roundTrip(`- takeScreenshot: "out.png"`)
    assertPreserves(outYaml, /takeScreenshot:\s*"?out\.png"?/)
  })

  it('hideKeyboard bare', () => {
    const { outYaml } = roundTrip(`- hideKeyboard`)
    assertPreserves(outYaml, /- hideKeyboard/)
  })

  it('back bare', () => {
    const { outYaml } = roundTrip(`- back`)
    assertPreserves(outYaml, /- back/)
  })

  // ───────────────── 复合容器 ─────────────────

  it('repeat preserves times + children', () => {
    const { outYaml } = roundTrip(`- repeat:
    times: 3
    commands:
      - tapOn: "点我"
      - sleep: 200`)
    assertPreserves(outYaml, /times:\s*3/, /tapOn:\s*"?点我"?/, /sleep:\s*200/)
  })

  it('retry preserves maxRetries + children', () => {
    const { outYaml } = roundTrip(`- retry:
    maxRetries: 3
    commands:
      - tapOn: "提交"`)
    assertPreserves(outYaml, /maxRetries:\s*3/, /tapOn:\s*"?提交"?/)
  })

  it('runFlow preserves file reference', () => {
    const { outYaml } = roundTrip(`- runFlow: "shared/login.yaml"`)
    // runFlow 的 string body 形式被转成 { file: ... }
    assertPreserves(outYaml, /runFlow:/, /login\.yaml/)
  })

  it('branch preserves when + children', () => {
    const { outYaml } = roundTrip(`- branch:
    - when:
        visible: "弹窗"
      commands:
        - tapOn: "关闭"
    - commands:
        - tapOn: "继续"`)
    assertPreserves(outYaml, /branch:/, /when:/, /tapOn:/, /关闭/, /继续/)
  })

  // ───────────────── 未知 action(opaque 透传) ─────────────────

  it('unknown action preserves raw body via opaque channel', () => {
    const { outYaml } = roundTrip(`- customAction:
    foo: 1
    bar: [2, 3]`)
    assertPreserves(outYaml, /customAction:/, /foo:\s*1/, /bar:\s*\[2,\s*3\]/)
  })
})
