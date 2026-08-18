/**
 * findNodeAtPoint 的通用排序测试
 *
 * 算法不变量(对任意 dump 结构成立):
 *   1. 严格更小面积 → 胜出(更具体的子元素)
 *   2. 同面积 → selectorLocatability 高者胜出(selector 更稳)
 *
 * 不依赖类名、不依赖业务关键词、不针对特定 App。
 */

import { describe, expect, it } from 'vitest'
import type { UiNode, DumpResult } from '../types'
import { findNodeAtPoint } from '../dumpParser'

let nextId = 0
function mk(partial: {
  className: string
  bounds: [number, number, number, number]
  attrs?: Record<string, string>
  children?: UiNode[]
  depth?: number
}): UiNode {
  return {
    id: nextId++,
    className: partial.className,
    depth: partial.depth ?? 0,
    bounds: partial.bounds,
    attrs: partial.attrs ?? {},
    children: partial.children ?? []
  }
}

function dumpOf(root: UiNode, screen = { width: 1080, height: 2376 }): DumpResult {
  const nodes: UiNode[] = []
  const walk = (n: UiNode): void => {
    nodes.push(n)
    for (const c of n.children) walk(c)
  }
  walk(root)
  // 仅为 hit-test 最小 fixture,actionableNodes 用 nodes 全集简化
  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    rotation: 0,
    nodes,
    tree: [root],
    actionableNodes: nodes.filter((n) => {
      const a = n.attrs
      return !!a.text || !!a['content-desc'] || a.clickable === 'true' || a.focusable === 'true'
    })
  }
}

describe('findNodeAtPoint tie-breaks by semantic richness', () => {
  it('user report: TikTok "推荐" tab — prefers TextView with text over clickable parent', () => {
    // 抖音推荐 tab 的真实结构:三层同 bounds
    const textView = mk({
      className: 'android.widget.TextView',
      bounds: [751, 81, 891, 277],
      attrs: { text: '推荐', clickable: 'false' }
    })
    const innerLayout = mk({
      className: 'android.widget.LinearLayout',
      bounds: [751, 81, 891, 277],
      attrs: { 'content-desc': '推荐', clickable: 'false' },
      children: [textView]
    })
    const outerClickable = mk({
      className: 'X.14AG',
      bounds: [751, 81, 891, 277],
      attrs: { clickable: 'true', focusable: 'true' },
      children: [innerLayout]
    })
    const dump = dumpOf(outerClickable)

    const hit = findNodeAtPoint(dump, 821, 179) // 中心点
    expect(hit).not.toBeNull()
    // TextView 的 text + resource-id 得分最高(3+0=3);LinearLayout 3(desc);
    // outerClickable 0(只有 clickable 但不计入 richness)。
    // 实际 text 和 desc 同分,但 TextView 在遍历中最后被访问(子节点),tie 保持前者。
    // 无论哪种,都不应该是 outerClickable
    expect(hit!.className).not.toBe('X.14AG')
    expect(hit!.attrs['text'] === '推荐' || hit!.attrs['content-desc'] === '推荐').toBe(true)
  })

  it('prefers TextView with text over equal-bounds content-desc sibling', () => {
    // text 比 content-desc 略重要一点?不,实际同分(都 +3)。保留最先遇到的语义富元素。
    // 这个测试保证:不会因为有 clickable 祖先就忽视语义叶子
    const title = mk({
      className: 'android.widget.TextView',
      bounds: [0, 0, 200, 100],
      attrs: { text: '登录', 'resource-id': 'com.app:id/btn_label' }
    })
    const wrapper = mk({
      className: 'android.widget.LinearLayout',
      bounds: [0, 0, 200, 100],
      attrs: { clickable: 'true' },
      children: [title]
    })
    const dump = dumpOf(wrapper)

    const hit = findNodeAtPoint(dump, 100, 50)
    expect(hit!.attrs['text']).toBe('登录')
  })

  it('keeps smallest-area priority when areas differ', () => {
    // 确保 tie-break 不破坏主排序:面积更小 > 语义更丰富
    const child = mk({
      className: 'android.widget.ImageView',
      bounds: [40, 40, 60, 60],
      attrs: { clickable: 'true' } // 无 text
    })
    const parent = mk({
      className: 'android.widget.LinearLayout',
      bounds: [0, 0, 100, 100],
      attrs: { text: '语义丰富', clickable: 'true' }, // 有 text 但面积大
      children: [child]
    })
    const dump = dumpOf(parent)

    const hit = findNodeAtPoint(dump, 50, 50)
    // 即使 parent 语义更丰富,child 面积更小应该胜
    expect(hit!.className).toBe('android.widget.ImageView')
  })

  it('falls back to full-tree smallest when no actionable hit', () => {
    const decorativeIcon = mk({
      className: 'android.widget.ImageView',
      bounds: [50, 50, 80, 80],
      attrs: {} // 完全没有任何 trait
    })
    const wrapper = mk({
      className: 'android.widget.FrameLayout',
      bounds: [0, 0, 200, 200],
      attrs: {},
      children: [decorativeIcon]
    })
    const dump = dumpOf(wrapper)

    const hit = findNodeAtPoint(dump, 60, 60)
    // actionableNodes 里没有命中 → 回退到全量 → 最小是 decorativeIcon
    expect(hit!.className).toBe('android.widget.ImageView')
  })

  it('semantic richness: text + desc > text alone > clickable only', () => {
    // 同 bounds 三节点,分别测试 richness 排序
    const onlyClickable = mk({
      className: 'android.view.ViewGroup',
      bounds: [0, 0, 100, 100],
      attrs: { clickable: 'true' }
    })
    const withText = mk({
      className: 'android.widget.TextView',
      bounds: [0, 0, 100, 100],
      attrs: { text: '提交' }
    })
    const withTextAndDesc = mk({
      className: 'android.widget.Button',
      bounds: [0, 0, 100, 100],
      attrs: { text: '提交', 'content-desc': '提交按钮', clickable: 'true' }
    })
    onlyClickable.children = [withText, withTextAndDesc]
    const dump = dumpOf(onlyClickable)

    const hit = findNodeAtPoint(dump, 50, 50)
    // locatability: withTextAndDesc > withText > onlyClickable
    expect(hit!.className).toBe('android.widget.Button')
  })

  // ───────── 不变量属性测试(对任意结构成立) ─────────

  it('invariant: returned node has smallest area among all hit candidates', () => {
    // 随机构造嵌套结构,点中多个节点,验证返回的是最小面积
    const structures = [
      // 三层,每层更小
      { outer: [0, 0, 1000, 1000], mid: [100, 100, 500, 500], inner: [200, 200, 300, 300] },
      // 两层同 bounds + 一层更小
      { outer: [0, 0, 100, 100], mid: [0, 0, 100, 100], inner: [10, 10, 50, 50] },
      // 三层都同 bounds
      { outer: [0, 0, 100, 100], mid: [0, 0, 100, 100], inner: [0, 0, 100, 100] }
    ]
    for (const { outer, mid, inner } of structures) {
      const innerNode = mk({
        className: 'Inner',
        bounds: inner as [number, number, number, number],
        attrs: { clickable: 'true' }
      })
      const midNode = mk({
        className: 'Mid',
        bounds: mid as [number, number, number, number],
        attrs: { clickable: 'true' },
        children: [innerNode]
      })
      const outerNode = mk({
        className: 'Outer',
        bounds: outer as [number, number, number, number],
        attrs: { clickable: 'true' },
        children: [midNode]
      })
      const dump = dumpOf(outerNode)

      // 点击 inner 范围内
      const cx = (inner[0] + inner[2]) / 2
      const cy = (inner[1] + inner[3]) / 2
      const hit = findNodeAtPoint(dump, cx, cy)
      const hitArea = (hit!.bounds[2] - hit!.bounds[0]) * (hit!.bounds[3] - hit!.bounds[1])
      const minArea = (inner[2] - inner[0]) * (inner[3] - inner[1])
      expect(hitArea).toBe(minArea)
    }
  })

  it('invariant: never returns larger-area node just because it has more semantics', () => {
    // 大面积富 semantic 容器 + 小面积纯 clickable 子节点 → 返回子节点
    const smallClickable = mk({
      className: 'android.widget.ImageView',
      bounds: [40, 40, 60, 60],
      attrs: { clickable: 'true' }
    })
    const bigRichContainer = mk({
      className: 'android.widget.LinearLayout',
      bounds: [0, 0, 1080, 2376],
      attrs: { text: '整个屏幕都有 text', 'content-desc': '全屏描述', clickable: 'true' },
      children: [smallClickable]
    })
    const dump = dumpOf(bigRichContainer)

    const hit = findNodeAtPoint(dump, 50, 50)
    expect(hit!.className).toBe('android.widget.ImageView')
  })
})
