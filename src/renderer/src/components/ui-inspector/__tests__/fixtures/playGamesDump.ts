/**
 * Google Play Games 首页真实 dump 的精选节点(用作 nodeCriteria 回归 fixture)
 *
 * 为什么不直接 parseDumpXml 原始 XML:
 *   parseDumpXml 依赖 DOMParser(浏览器原生),node 测试环境没有。
 *   为避免引入 jsdom 依赖,直接以 UiNode 对象形式提供关键节点,断言更精准。
 *
 * 覆盖的典型场景:
 *   INCLUDE  — clickable 无 text(CardView/action_target/nav items)
 *              scrollable(ScrollView/RecyclerView)
 *              focusable-only(promo CardView)
 *              content-desc 锚点(ImageButton/nav FrameLayout)
 *              text 锚点(TextView)
 *   EXCLUDE  — 纯布局容器(root/app_bar_layout/icon_container/carousel item outer)
 *              装饰 ImageView(static_icon/backgroundimage,由 clickable 祖先承担)
 */

import type { UiNode } from '../../types'

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

// ──────────────── INCLUDE 样本 ────────────────

export const SEARCH_IMAGE_BUTTON = mk({
  className: 'android.widget.ImageButton',
  bounds: [0, 81, 189, 270],
  attrs: { 'content-desc': '搜索', clickable: 'true', focusable: 'true' }
})

export const TOOLBAR_TITLE_TEXT = mk({
  className: 'android.widget.TextView',
  bounds: [540, 127, 662, 224],
  attrs: {
    text: '游戏',
    'resource-id': 'com.google.android.play.games:id/toolbar_title',
    clickable: 'false',
    focusable: 'false'
  }
})

export const MORE_OPTIONS_IMAGE = mk({
  className: 'android.widget.ImageView',
  bounds: [945, 94, 1080, 256],
  attrs: {
    'content-desc': '更多选项',
    clickable: 'true',
    'long-clickable': 'true',
    focusable: 'true'
  }
})

export const OUTER_SCROLL_VIEW = mk({
  className: 'android.widget.ScrollView',
  bounds: [0, 0, 1080, 2187],
  attrs: { scrollable: 'true', clickable: 'false', focusable: 'false' }
})

export const HERO_CARD_VIEW = mk({
  className: 'androidx.cardview.widget.CardView',
  bounds: [81, 327, 999, 844],
  attrs: {
    'resource-id':
      'com.google.android.play.games:id/games__home__instanthome__herovideo__container',
    clickable: 'true',
    focusable: 'true'
  }
})

export const HERO_VIDEO_PREVIEW_CONTAINER = mk({
  className: 'android.widget.FrameLayout',
  bounds: [81, 327, 999, 844],
  attrs: {
    'content-desc': '本周精选游戏《Finger Football》',
    clickable: 'false',
    focusable: 'false'
  }
})

export const HERO_PLAY_BUTTON = mk({
  className: 'android.widget.FrameLayout',
  bounds: [769, 614, 958, 803],
  attrs: {
    'resource-id': 'com.google.android.play.games:id/hero_video_play_button',
    'content-desc': '开始玩"Finger Football"',
    clickable: 'true',
    focusable: 'true'
  }
})

export const GAMES_RECYCLER_VIEW = mk({
  className: 'android.support.v7.widget.RecyclerView',
  bounds: [0, 1172, 1080, 2010],
  attrs: { scrollable: 'true', focusable: 'true' }
})

/** 清单项外层 action_target(clickable=true + long-clickable=true,无 text/desc) */
export const CAROUSEL_ACTION_TARGET = mk({
  className: 'android.widget.LinearLayout',
  bounds: [0, 1172, 405, 1848],
  attrs: {
    'resource-id': 'com.google.android.play.games:id/action_target',
    clickable: 'true',
    'long-clickable': 'true',
    focusable: 'true'
  }
})

export const GAME_TITLE_TEXT = mk({
  className: 'android.widget.TextView',
  bounds: [0, 1766, 162, 1841],
  attrs: { text: '吃豆人', clickable: 'false' }
})

export const START_GAME_BUTTON = mk({
  className: 'android.widget.Button',
  bounds: [0, 1848, 405, 2010],
  attrs: {
    text: '开始游戏',
    'content-desc': '开始玩"吃豆人"',
    clickable: 'true',
    focusable: 'true'
  }
})

/** promo CardView:focusable=true,但 clickable=false,没有 text/desc —— 之前被漏 */
export const PROMO_CARD_VIEW = mk({
  className: 'androidx.cardview.widget.CardView',
  bounds: [81, 2118, 999, 2187],
  attrs: { clickable: 'false', focusable: 'true' }
})

export const NAV_HOME_FRAME = mk({
  className: 'android.widget.FrameLayout',
  bounds: [0, 2187, 360, 2376],
  attrs: { 'content-desc': '首页', clickable: 'false', focusable: 'true', selected: 'true' }
})

export const NAV_LIBRARY_FRAME = mk({
  className: 'android.widget.FrameLayout',
  bounds: [360, 2187, 720, 2376],
  attrs: { 'content-desc': '游戏库', clickable: 'true', focusable: 'true' }
})

// ──────────────── EXCLUDE 样本 ────────────────

export const ROOT_FRAME = mk({
  className: 'android.widget.FrameLayout',
  bounds: [0, 0, 1080, 2376],
  attrs: {
    clickable: 'false',
    focusable: 'false',
    scrollable: 'false',
    'long-clickable': 'false'
  }
})

export const APP_BAR_LAYOUT = mk({
  className: 'android.widget.LinearLayout',
  bounds: [0, 0, 1080, 273],
  attrs: {
    'resource-id': 'com.google.android.play.games:id/games__instanthome__app_bar_layout',
    clickable: 'false',
    focusable: 'false',
    scrollable: 'false'
  }
})

export const ICON_CONTAINER = mk({
  className: 'android.widget.FrameLayout',
  bounds: [0, 1172, 405, 1739],
  attrs: {
    'resource-id': 'com.google.android.play.games:id/icon_container',
    clickable: 'false',
    focusable: 'false'
  }
})

/** 用户贴的"画不出边框"LinearLayout:clickable=false,no traits,no text */
export const USER_PURE_LAYOUT_LINEAR = mk({
  className: 'android.widget.LinearLayout',
  bounds: [0, 594, 1080, 1652],
  attrs: {
    clickable: 'false',
    'long-clickable': 'false',
    focusable: 'false',
    checkable: 'false',
    scrollable: 'false',
    enabled: 'true'
  }
})

export const DECORATIVE_STATIC_ICON = mk({
  className: 'android.widget.ImageView',
  bounds: [0, 1172, 405, 1739],
  attrs: {
    'resource-id': 'com.google.android.play.games:id/static_icon',
    clickable: 'false',
    focusable: 'false'
  }
})

export const DECORATIVE_BACKGROUND = mk({
  className: 'android.widget.ImageView',
  bounds: [81, 2118, 999, 2187],
  attrs: { clickable: 'false', focusable: 'false' }
})

// ──────────────── 集合导出 ────────────────

export const PLAY_GAMES_INCLUDE_CASES: ReadonlyArray<{ name: string; node: UiNode }> = [
  { name: 'search ImageButton (desc + click)', node: SEARCH_IMAGE_BUTTON },
  { name: 'toolbar title TextView (text)', node: TOOLBAR_TITLE_TEXT },
  { name: 'more-options ImageView (desc + click + long-click)', node: MORE_OPTIONS_IMAGE },
  { name: 'outer ScrollView (scrollable)', node: OUTER_SCROLL_VIEW },
  { name: 'hero CardView (click, no text/desc)', node: HERO_CARD_VIEW },
  { name: 'hero preview container (desc-only)', node: HERO_VIDEO_PREVIEW_CONTAINER },
  { name: 'hero play button (desc + click)', node: HERO_PLAY_BUTTON },
  { name: 'games RecyclerView (scrollable + focusable)', node: GAMES_RECYCLER_VIEW },
  { name: 'carousel action_target (click + long-click, no text)', node: CAROUSEL_ACTION_TARGET },
  { name: 'game title TextView (text)', node: GAME_TITLE_TEXT },
  { name: 'start-game Button (text + desc + click)', node: START_GAME_BUTTON },
  { name: 'promo CardView (focusable only)', node: PROMO_CARD_VIEW },
  { name: 'nav Home (desc, focusable, not click)', node: NAV_HOME_FRAME },
  { name: 'nav Library (desc + click)', node: NAV_LIBRARY_FRAME }
]

export const PLAY_GAMES_EXCLUDE_CASES: ReadonlyArray<{ name: string; node: UiNode }> = [
  { name: 'root FrameLayout (full screen wrapper)', node: ROOT_FRAME },
  { name: 'app_bar_layout LinearLayout (pure container with id)', node: APP_BAR_LAYOUT },
  { name: 'icon_container FrameLayout (wraps icons)', node: ICON_CONTAINER },
  { name: "user's LinearLayout (no traits, not a leaf candidate)", node: USER_PURE_LAYOUT_LINEAR },
  { name: 'decorative static_icon ImageView (has id but no trait)', node: DECORATIVE_STATIC_ICON },
  { name: 'decorative background ImageView', node: DECORATIVE_BACKGROUND }
]
