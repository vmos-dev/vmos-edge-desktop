/**
 * actionRegistry · 中心 action 元数据字典
 *
 * 单一职责:把"每个 action 的所有 UI 概念"集中到一处定义。
 * 任何用 action 的地方(picker / item 显示 / 表单加载默认值 / 摘要展示)都从这里读。
 *
 * 新增 action:加一个 entry 即可,picker / 卡片 / 表单全部自动获得。
 *
 * 不在这里管的事(避免职责膨胀):
 *  - 字段定义 → utils/actionSchema.ts(从 yamlFlowSchema 提取)
 *  - 字段标签 → utils/fieldLabel.ts
 *  - 元素拾取的"哪个动作适合这个元素" → constants.ts 的 ACTION_RULES(评分函数)
 *  - 表单组件 → components/edit/step-form/(默认 AutoForm,定制按需在 form? 字段挂)
 */

import type { Component } from 'vue'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { NodeTreeContext } from '../types'
import { t } from '@renderer/locales'

// ═══════════════ 类型 ═══════════════

export type ActionCategory =
  | 'tap'
  | 'input'
  | 'scroll'
  | 'wait'
  | 'app'
  | 'assert'
  | 'flow'
  | 'device'
  | 'http'
  | 'script'

/**
 * defaultParams 的调用上下文。
 *
 * 设计目的:让每个 action 的"默认参数"成为节点特征的函数 —— 同一个 action
 * 在不同元素上可以给出最合理的初值,而不是全局静态值。
 *
 * 例:
 *   - swipe 在横向 ViewPager (w > h * 1.5 + scrollable) → direction LEFT
 *   - swipe 在竖向 feed (HorizontalScrollView ∉ 类名)  → direction UP
 *   - scrollUntilVisible 在水平 RecyclerView          → direction RIGHT
 */
export interface DefaultParamsContext {
  /** 源节点(recommendation 流必传) */
  node?: UiNode
  /** 整棵树上下文,祖先查询/effective target 用(可选) */
  tree?: NodeTreeContext
}

export interface ActionDefinition {
  /** YAML 中的命令名,与 ActionType 对齐 */
  id: string
  /** 大白话标签(picker 卡片 / StepItem 上显示) */
  label: string
  /** 一句话说明(picker 卡片副标题) */
  description: string
  /** 分类 → picker 的 tab 分组 */
  category: ActionCategory
  /** 是否需要先选元素(用于决定 picker 流程:从设备拾取 vs 直接添加) */
  requiresSelector: boolean
  /**
   * 手动添加时的初始 body
   *  - undefined → YAML 写成 bare 形式(如 `- back`)
   *  - string / number / boolean → 写成 `- action: value`
   *  - 对象 → 写成 `- action:\n    key: value`
   */
  defaultBody: () => unknown
  /**
   * recommendation 流程给 step 注入的默认 params(Step.params 形态)。
   *
   * 架构约束(类型层强制):
   *   - 每个 action 必须显式声明(不能漏)
   *   - 接收 ctx(可空):具备节点信息时,可据此推断**节点感知默认**
   *     例如 swipe 在横向 ViewPager 默认 LEFT、在竖向 feed 默认 UP
   *
   * 两类实现:
   *   - 静态默认:忽略 ctx,返回固定对象。如 sleep `() => ({ duration: 1000 })`
   *   - 节点感知:读 ctx.node 的 className / bounds / 祖先关系推断。
   *     如 swipe `(ctx) => ({ direction: inferSwipeDirection(ctx?.node) })`
   *
   * 为什么单独一个字段而不是从 defaultBody 推导:
   *   - defaultBody 是"YAML body 形态"(可能是 string/number/object),给 manual-add 流
   *   - defaultParams 是"Step.params 形态"(始终是对象/undefined),给 recommendation 流
   *   shape 不同、信号不同(defaultBody 无 ctx);强制分离避免隐式转换 bug
   *
   * 调用方约定:
   *   - recommendation 流 → 传 { node, tree? }
   *   - manual-add 流     → 不传或传 undefined → 走静态 fallback
   */
  defaultParams: (ctx?: DefaultParamsContext) => Record<string, unknown> | undefined
  /**
   * StepItem 上的一行摘要(从当前 body 派生)
   * 返回空字符串表示"无摘要,只显示 action label"
   */
  summary: (body: unknown) => string
  /**
   * 主要字段(默认展开);其它字段折叠到「更多」
   * 没列的 action → 由 AutoForm 的启发式决定
   */
  primaryFields?: readonly string[]
  /** 可选定制表单组件(契约和 AutoForm 一致);不传走 AutoForm */
  form?: Component
}

// ═══════════════ 摘要派生器(复用) ═══════════════

const TRUNCATE = 24

function truncate(s: string, max = TRUNCATE): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** 选择器类(tapOn/longPressOn/...): "登录" / "btn_login" / (待填) */
function selectorSummary(body: unknown): string {
  if (typeof body === 'string')
    return body ? `"${truncate(body)}"` : t('workflow.actionSummary.toFill')
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    const pick =
      (typeof obj.text === 'string' && obj.text) ||
      (typeof obj.id === 'string' && obj.id) ||
      (typeof obj.point === 'string' && obj.point)
    return pick ? `"${truncate(String(pick))}"` : t('workflow.actionSummary.toFill')
  }
  return t('workflow.actionSummary.toFill')
}

/** 输入类(inputText/setClipboard/...): "文本" / (空) */
function primitiveStringSummary(body: unknown, emptyHint?: string): string {
  const hint = emptyHint ?? t('workflow.actionSummary.empty')
  if (typeof body === 'string') return body ? `"${truncate(body)}"` : hint
  if (body == null) return hint
  return String(body)
}

/** sleep / 时长类: 1000ms / 500~2000ms */
function durationSummary(body: unknown): string {
  if (typeof body === 'number') return `${body}ms`
  if (Array.isArray(body) && body.length === 2 && body.every((n) => typeof n === 'number')) {
    return `${body[0]}~${body[1]}ms`
  }
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    if (typeof obj.duration === 'number') return `${obj.duration}ms`
    if (typeof obj.min === 'number' && typeof obj.max === 'number') return `${obj.min}~${obj.max}ms`
    if (typeof obj.timeout === 'number') return `${obj.timeout}ms`
  }
  return ''
}

/** appId 类(launchApp/stopApp/...): "com.x" / (使用配置) */
function appIdSummary(body: unknown): string {
  if (typeof body === 'string' && body) return body
  if (body && typeof body === 'object') {
    const id = (body as Record<string, unknown>).appId
    if (typeof id === 'string' && id) return id
  }
  return t('workflow.actionSummary.useConfigAppId')
}

/** 复合容器(repeat/retry/...): "× 3" / "失败重试 1 次" */
function repeatSummary(body: unknown): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    if (typeof obj.times === 'number' || typeof obj.times === 'string') return `× ${obj.times}`
    if (typeof obj.duration === 'number') return durationSummary(obj.duration)
    if (obj.while) return 'while …'
  }
  return ''
}

function noSummary(): string {
  return ''
}

// ═══════════════ 注册表 ═══════════════

export const ACTION_REGISTRY: Record<string, ActionDefinition> = {
  // ─── 点击 ───────────────────────────────────────────────
  tapOn: {
    id: 'tapOn',
    label: '点击',
    description: '点一个按钮 / 文字',
    category: 'tap',
    requiresSelector: true,
    defaultBody: () => ({ text: '' }),
    defaultParams: () => undefined,
    summary: selectorSummary,
    primaryFields: ['text', 'id', 'index']
  },
  longPressOn: {
    id: 'longPressOn',
    label: '长按',
    description: '长按某个元素',
    category: 'tap',
    requiresSelector: true,
    defaultBody: () => ({ text: '' }),
    defaultParams: () => undefined,
    summary: selectorSummary,
    primaryFields: ['text', 'id', 'index']
  },
  doubleTapOn: {
    id: 'doubleTapOn',
    label: '双击',
    description: '双击某个元素',
    category: 'tap',
    requiresSelector: true,
    defaultBody: () => ({ text: '' }),
    defaultParams: () => undefined,
    summary: selectorSummary,
    primaryFields: ['text', 'id', 'index']
  },
  pressKey: {
    id: 'pressKey',
    label: '按按键',
    description: '模拟按设备按键(返回 / Home / Enter ...)',
    category: 'tap',
    requiresSelector: false,
    defaultBody: () => 'Back',
    // 节点感知:EditText 系节点 → Enter(提交);其他 → Back(返回导航)
    defaultParams: (ctx) => ({ key: inferPressKey(ctx?.node) }),
    summary: (body) => primitiveStringSummary(body, t('workflow.actionSummary.unfilled')),
    primaryFields: ['$value']
  },
  back: {
    id: 'back',
    label: '按返回键',
    description: '等同于按设备返回键',
    category: 'tap',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: noSummary
  },
  hideKeyboard: {
    id: 'hideKeyboard',
    label: '收起键盘',
    description: '把虚拟键盘收回去',
    category: 'tap',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: noSummary
  },

  // ─── 输入 ───────────────────────────────────────────────
  inputText: {
    id: 'inputText',
    label: '输入文字',
    description: '在当前输入框输入内容,支持 ${变量}',
    category: 'input',
    requiresSelector: false,
    defaultBody: () => '',
    defaultParams: () => ({ text: '' }),
    summary: (body) => primitiveStringSummary(body),
    primaryFields: ['$value']
  },
  eraseText: {
    id: 'eraseText',
    label: '清空输入框',
    description: '删除输入框里的字符',
    category: 'input',
    requiresSelector: false,
    defaultBody: () => 50,
    // 节点感知:若当前文本非空,精确删完(避免多按触发副作用);否则保守 50
    defaultParams: (ctx) => ({ charactersToErase: inferEraseCharCount(ctx?.node) }),
    summary: (body) => {
      if (typeof body === 'number') return t('workflow.actionSummary.charCount', { count: body })
      if (body && typeof body === 'object') {
        const n = (body as Record<string, unknown>).charactersToErase
        if (typeof n === 'number') return t('workflow.actionSummary.charCount', { count: n })
      }
      return ''
    },
    primaryFields: ['charactersToErase']
  },
  pasteText: {
    id: 'pasteText',
    label: '粘贴',
    description: '把剪贴板内容粘贴到当前输入框',
    category: 'input',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: noSummary
  },
  setClipboard: {
    id: 'setClipboard',
    label: '写入剪贴板',
    description: '设置剪贴板内容(可用 ${变量})',
    category: 'input',
    requiresSelector: false,
    defaultBody: () => '',
    defaultParams: () => ({ text: '' }),
    summary: (body) => primitiveStringSummary(body),
    primaryFields: ['$value']
  },
  copyTextFrom: {
    id: 'copyTextFrom',
    label: '复制元素文字',
    description: '从指定元素把文字复制到剪贴板',
    category: 'input',
    requiresSelector: true,
    defaultBody: () => ({ text: '' }),
    defaultParams: () => undefined,
    summary: selectorSummary,
    primaryFields: ['text', 'id']
  },
  inputRandomText: {
    id: 'inputRandomText',
    label: '随机字母',
    description: '输入指定长度的随机字母',
    category: 'input',
    requiresSelector: false,
    defaultBody: () => 8,
    defaultParams: () => ({ length: 8 }),
    summary: (body) =>
      typeof body === 'number' ? t('workflow.actionSummary.digitCount', { count: body }) : '',
    primaryFields: ['length']
  },
  inputRandomNumber: {
    id: 'inputRandomNumber',
    label: '随机数字',
    description: '输入指定位数的随机数字',
    category: 'input',
    requiresSelector: false,
    defaultBody: () => 6,
    defaultParams: () => ({ length: 6 }),
    summary: (body) =>
      typeof body === 'number' ? t('workflow.actionSummary.digitCount', { count: body }) : '',
    primaryFields: ['length']
  },
  inputRandomEmail: {
    id: 'inputRandomEmail',
    label: '随机邮箱',
    description: '输入一个随机邮箱地址',
    category: 'input',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: noSummary
  },
  inputRandomPersonName: {
    id: 'inputRandomPersonName',
    label: '随机姓名',
    description: '输入一个随机姓名',
    category: 'input',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: noSummary
  },

  // ─── 滚动 / 滑动 ─────────────────────────────────────────
  scroll: {
    id: 'scroll',
    label: '向下滚一次',
    description: '屏幕向下滚动一屏',
    category: 'scroll',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: noSummary
  },
  scrollUntilVisible: {
    id: 'scrollUntilVisible',
    label: '滚到看见',
    description: '一直滚动直到目标元素出现',
    category: 'scroll',
    requiresSelector: true,
    defaultBody: () => ({ element: { text: '' } }),
    // 节点感知:横向容器自身 → direction LEFT;其他交给引擎默认(DOWN),保持 YAML 精简
    defaultParams: (ctx) => {
      const dir = inferScrollDirection(ctx?.node)
      return dir ? { direction: dir } : undefined
    },
    summary: (body) => {
      if (body && typeof body === 'object') {
        const el = (body as Record<string, unknown>).element
        return selectorSummary(el)
      }
      return t('workflow.actionSummary.toFill')
    },
    primaryFields: ['element', 'direction', 'timeout']
  },
  swipe: {
    id: 'swipe',
    label: '滑动屏幕',
    description: '上 / 下 / 左 / 右 滑动',
    category: 'scroll',
    requiresSelector: false,
    defaultBody: () => 'DOWN',
    // 节点感知:横向容器(ViewPager/HorizontalScrollView/宽>高*1.5 的 scrollable)→ LEFT
    // 否则 UP(feed 类常见,向上推进)。不传 node 时 fallback DOWN(最保守)
    defaultParams: (ctx) => ({ direction: inferSwipeDirection(ctx?.node) }),
    summary: (body) => {
      if (typeof body === 'string') return body
      if (body && typeof body === 'object') {
        const dir = (body as Record<string, unknown>).direction
        if (typeof dir === 'string') return dir
      }
      return ''
    },
    primaryFields: ['direction', 'duration']
  },

  // ─── 等待 ───────────────────────────────────────────────
  sleep: {
    id: 'sleep',
    label: '等待时间',
    description: '暂停一段时间(毫秒)',
    category: 'wait',
    requiresSelector: false,
    defaultBody: () => 1000,
    defaultParams: () => ({ duration: 1000 }),
    summary: durationSummary,
    primaryFields: ['duration', 'min', 'max']
  },
  waitForAnimationToEnd: {
    id: 'waitForAnimationToEnd',
    label: '等动画结束',
    description: '等界面动画播完、不再变化',
    category: 'wait',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: durationSummary,
    primaryFields: ['timeout']
  },
  extendedWaitUntil: {
    id: 'extendedWaitUntil',
    label: '等条件成立',
    description: '一直等到某个元素出现 / 消失',
    category: 'wait',
    requiresSelector: false,
    defaultBody: () => ({ visible: { text: '' } }),
    defaultParams: () => ({ waitForVisible: true }),
    summary: (body) => {
      if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>
        if (obj.visible)
          return t('workflow.actionSummary.waitVisible', { target: selectorSummary(obj.visible) })
        if (obj.notVisible)
          return t('workflow.actionSummary.waitInvisible', {
            target: selectorSummary(obj.notVisible)
          })
      }
      return t('workflow.actionSummary.toFill')
    },
    primaryFields: ['visible', 'notVisible', 'timeout']
  },

  // ─── App 控制 ────────────────────────────────────────────
  launchApp: {
    id: 'launchApp',
    label: '启动应用',
    description: '启动配置中的应用,可设权限 / 清数据',
    category: 'app',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: appIdSummary,
    primaryFields: ['appId', 'clearState', 'stopApp']
  },
  stopApp: {
    id: 'stopApp',
    label: '关闭应用',
    description: '正常关闭应用',
    category: 'app',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: appIdSummary
  },
  killApp: {
    id: 'killApp',
    label: '强制结束',
    description: '强制结束应用进程',
    category: 'app',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: appIdSummary
  },
  clearState: {
    id: 'clearState',
    label: '清空应用数据',
    description: '清除应用的数据和缓存(相当于重装)',
    category: 'app',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: appIdSummary
  },
  clearKeychain: {
    id: 'clearKeychain',
    label: '清账号缓存',
    description: '清除应用保存的账号密码',
    category: 'app',
    requiresSelector: false,
    defaultBody: () => undefined,
    defaultParams: () => undefined,
    summary: appIdSummary
  },

  // ─── 检查 ───────────────────────────────────────────────
  assertVisible: {
    id: 'assertVisible',
    label: '检查必须可见',
    description: '找不到目标元素就报错',
    category: 'assert',
    requiresSelector: true,
    defaultBody: () => ({ text: '' }),
    defaultParams: () => undefined,
    summary: selectorSummary,
    primaryFields: ['text', 'id', 'index']
  },
  assertNotVisible: {
    id: 'assertNotVisible',
    label: '检查必须不可见',
    description: '看到指定元素就报错',
    category: 'assert',
    requiresSelector: true,
    defaultBody: () => ({ text: '' }),
    defaultParams: () => undefined,
    summary: selectorSummary,
    primaryFields: ['text', 'id', 'index']
  },
  assertTrue: {
    id: 'assertTrue',
    label: '检查表达式',
    description: 'JS 表达式必须为 true,否则报错',
    category: 'assert',
    requiresSelector: false,
    defaultBody: () => '',
    defaultParams: () => ({ expression: '' }),
    summary: (body) => primitiveStringSummary(body),
    primaryFields: ['$value']
  },

  // ─── 流程控制 ────────────────────────────────────────────
  repeat: {
    id: 'repeat',
    label: '循环执行',
    description: '反复执行一批命令',
    category: 'flow',
    requiresSelector: false,
    defaultBody: () => ({ times: 3, commands: [] }),
    defaultParams: () => ({ times: 3 }),
    summary: repeatSummary,
    primaryFields: ['times', 'duration', 'while']
  },
  retry: {
    id: 'retry',
    label: '失败重试',
    description: '失败时自动再试几次',
    category: 'flow',
    requiresSelector: false,
    defaultBody: () => ({ maxRetries: 1, commands: [] }),
    defaultParams: () => ({ maxRetries: 1 }),
    summary: (body) => {
      if (body && typeof body === 'object') {
        const n = (body as Record<string, unknown>).maxRetries
        if (typeof n === 'number' || typeof n === 'string')
          return t('workflow.actionSummary.retryCount', { count: n })
      }
      return ''
    },
    primaryFields: ['maxRetries']
  },
  branch: {
    id: 'branch',
    label: '条件分支',
    description: 'if / else if / else 多分支',
    category: 'flow',
    requiresSelector: false,
    defaultBody: () => [{ commands: [] }],
    defaultParams: () => undefined,
    summary: (body) =>
      Array.isArray(body) ? t('workflow.actionSummary.branchCount', { count: body.length }) : ''
  },
  runFlow: {
    id: 'runFlow',
    label: '调用子流程',
    description: '执行另一个流程文件 / 子命令组',
    category: 'flow',
    requiresSelector: false,
    defaultBody: () => ({ commands: [] }),
    defaultParams: () => undefined,
    summary: (body) => {
      if (typeof body === 'string') return truncate(body)
      if (body && typeof body === 'object') {
        const file = (body as Record<string, unknown>).file
        if (typeof file === 'string') return truncate(file)
      }
      return ''
    },
    primaryFields: ['file']
  },

  // ─── 设备 ───────────────────────────────────────────────
  takeScreenshot: {
    id: 'takeScreenshot',
    label: '截图',
    description: '把当前屏幕保存到指定路径',
    category: 'device',
    requiresSelector: false,
    defaultBody: () => 'screenshot.png',
    defaultParams: () => ({ path: 'screenshot.png' }),
    summary: (body) => primitiveStringSummary(body, t('workflow.actionSummary.defaultVal')),
    primaryFields: ['$value']
  },
  setLocation: {
    id: 'setLocation',
    label: '模拟位置',
    description: '模拟 GPS 定位',
    category: 'device',
    requiresSelector: false,
    defaultBody: () => ({ latitude: '0.0', longitude: '0.0' }),
    defaultParams: () => ({ latitude: '0.0', longitude: '0.0' }),
    summary: (body) => {
      if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>
        if (obj.latitude && obj.longitude) return `${obj.latitude}, ${obj.longitude}`
      }
      return t('workflow.actionSummary.toFill')
    },
    primaryFields: ['latitude', 'longitude']
  },
  openLink: {
    id: 'openLink',
    label: '打开链接',
    description: '打开网页 URL 或应用深度链接',
    category: 'device',
    requiresSelector: false,
    defaultBody: () => '',
    defaultParams: () => ({ link: '' }),
    summary: (body) => {
      const hint = t('workflow.actionSummary.toFill')
      if (typeof body === 'string') return primitiveStringSummary(body, hint)
      if (body && typeof body === 'object') {
        const link = (body as Record<string, unknown>).link
        return primitiveStringSummary(link, hint)
      }
      return hint
    },
    primaryFields: ['$value']
  },
  setPermissions: {
    id: 'setPermissions',
    label: '批量设权限',
    description: '一次性允许 / 拒绝多个权限',
    category: 'device',
    requiresSelector: false,
    defaultBody: () => ({ permissions: {} }),
    defaultParams: () => ({ permissions: {} }),
    summary: (body) => {
      if (body && typeof body === 'object') {
        const perms = (body as Record<string, unknown>).permissions
        if (perms && typeof perms === 'object') {
          return t('workflow.actionSummary.permCount', { count: Object.keys(perms).length })
        }
      }
      return ''
    }
  },
  shell: {
    id: 'shell',
    label: '跑表达式(简写)',
    description: 'evalScript 的简写，执行一段 JS 表达式',
    category: 'script',
    requiresSelector: false,
    defaultBody: () => '',
    defaultParams: () => ({ cmd: '' }),
    summary: (body) => primitiveStringSummary(body),
    primaryFields: ['$value']
  },
  setAirplaneMode: {
    id: 'setAirplaneMode',
    label: '飞行模式',
    description: '开 / 关飞行模式',
    category: 'device',
    requiresSelector: false,
    defaultBody: () => true,
    defaultParams: () => ({ enabled: true }),
    summary: (body) => {
      if (typeof body === 'boolean')
        return body ? t('workflow.actionSummary.on') : t('workflow.actionSummary.off')
      if (body && typeof body === 'object') {
        const en = (body as Record<string, unknown>).enabled
        if (typeof en === 'boolean')
          return en ? t('workflow.actionSummary.on') : t('workflow.actionSummary.off')
      }
      return ''
    }
  },

  // ─── 网络 ───────────────────────────────────────────────
  httpRequest: {
    id: 'httpRequest',
    label: '发 HTTP 请求',
    description: 'GET / POST,可把返回存进变量',
    category: 'http',
    requiresSelector: false,
    defaultBody: () => ({ url: '', method: 'GET' }),
    defaultParams: () => ({ url: '', method: 'GET' }),
    summary: (body) => {
      if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>
        const m = typeof obj.method === 'string' ? obj.method : 'GET'
        const u = typeof obj.url === 'string' ? obj.url : ''
        return u ? `${m} ${truncate(u, 32)}` : t('workflow.actionSummary.toFill')
      }
      return t('workflow.actionSummary.toFill')
    },
    primaryFields: ['url', 'method', 'outputVariable']
  },

  // ─── 脚本 / 变量 ─────────────────────────────────────────
  defineVariables: {
    id: 'defineVariables',
    label: '定义变量',
    description: '定义可在后续命令里 ${变量名} 引用',
    category: 'script',
    requiresSelector: false,
    defaultBody: () => ({}),
    defaultParams: () => ({}),
    summary: (body) => {
      if (body && typeof body === 'object') {
        const keys = Object.keys(body).filter((k) => !['when', 'chance'].includes(k))
        return keys.length > 0 ? t('workflow.actionSummary.varCount', { count: keys.length }) : ''
      }
      return ''
    }
  },
  evalScript: {
    id: 'evalScript',
    label: '跑表达式',
    description: '执行一段 JS 表达式(常用于改变量)',
    category: 'script',
    requiresSelector: false,
    defaultBody: () => '',
    defaultParams: () => ({ expression: '' }),
    summary: (body) => primitiveStringSummary(body),
    primaryFields: ['$value']
  },
  runScript: {
    id: 'runScript',
    label: '跑脚本',
    description: '执行多行 JS 代码或外部 JS 文件',
    category: 'script',
    requiresSelector: false,
    defaultBody: () => ({ script: '' }),
    defaultParams: () => ({ script: '' }),
    summary: (body) => {
      if (typeof body === 'string') return truncate(body)
      if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>
        if (typeof obj.file === 'string') return truncate(obj.file)
        if (typeof obj.script === 'string') return truncate(obj.script)
      }
      return ''
    }
  }
}

// ═══════════════ 派生查询 ═══════════════

/** 类目顺序(picker tab 显示,标签通过 i18n 解析) */
export const CATEGORY_IDS: ReadonlyArray<ActionCategory> = [
  'tap',
  'input',
  'scroll',
  'wait',
  'app',
  'assert',
  'flow',
  'device',
  'http',
  'script'
]

export function categoryLabel(id: ActionCategory): string {
  return t(`workflow.actionCategory.${id}`)
}

/** 按类目分组的 action 列表(顺序按 ACTION_REGISTRY 声明顺序) */
export function actionsByCategory(): Map<ActionCategory, ActionDefinition[]> {
  const map = new Map<ActionCategory, ActionDefinition[]>()
  for (const catId of CATEGORY_IDS) {
    map.set(catId, [])
  }
  for (const def of Object.values(ACTION_REGISTRY)) {
    const list = map.get(def.category)
    if (list) list.push(def)
  }
  return map
}

/** 取一个 action 的元数据;不存在返回 undefined */
export function getActionDefinition(id: string): ActionDefinition | undefined {
  return ACTION_REGISTRY[id]
}

// ═══════════════ 节点感知默认的推断器(架构层复用工具) ═══════════════
//
// 这些函数从节点几何 / className / 交互特征推断"最合理的默认"。
// 全部是纯函数,不依赖任何 App 特定关键字,对任意 dump 通用。
// 用于 defaultParams 的节点感知实现。

const HORIZONTAL_CLASS_HINTS = [
  'horizontal',
  'viewpager',
  'horizontalscroll',
  'tabbar',
  'tablayout'
]

/**
 * 判断节点是不是"水平滚动容器"(横向 ViewPager / 横滑 RecyclerView / Tab 条等)
 *
 * 启发式(按优先级):
 *   1. className 含 horizontal/viewpager/tabbar 等关键字
 *   2. 节点有 scrollable 特征 且 bounds 宽显著大于高(w > h * 1.5)
 */
export function isHorizontalContainer(node: UiNode | undefined): boolean {
  if (!node) return false
  const cls = (node.className || '').toLowerCase()
  if (HORIZONTAL_CLASS_HINTS.some((kw) => cls.includes(kw))) return true
  const scrollable = node.attrs['scrollable'] === 'true' || node.attrs['scrollable'] === '1'
  if (!scrollable) return false
  const [x1, y1, x2, y2] = node.bounds
  const w = x2 - x1
  const h = y2 - y1
  return w > 0 && h > 0 && w > h * 1.5
}

/**
 * 推断 swipe 动作的默认方向。
 *
 * 规则:
 *   - 横向容器 → LEFT(通常下一项/下一页)
 *   - 其他     → UP(feed/视频流常见"往上推进"语义)
 *   - 无 node  → DOWN(最保守的 fallback,让用户修改)
 *
 * 通用性:不依赖具体 App,只看 Android 视图系统标志。
 */
export function inferSwipeDirection(node: UiNode | undefined): string {
  if (!node) return 'DOWN'
  if (isHorizontalContainer(node)) return 'LEFT'
  return 'UP'
}

const EDITABLE_CLASS_HINTS = ['edittext', 'textinput', 'searchview', 'autocompletetextview']

/**
 * 判断节点是不是输入控件(EditText 系)。
 *
 * 只看 Android 视图类名,不依赖 App 特定 id / 业务关键词。任意 dump 通用。
 */
export function isEditable(node: UiNode | undefined): boolean {
  if (!node) return false
  const cls = (node.className || '').toLowerCase()
  return EDITABLE_CLASS_HINTS.some((kw) => cls.includes(kw))
}

/**
 * 推断 pressKey 的默认键。
 *
 * 规则:
 *   - EditText 系节点 → Enter(提交输入 / 搜索)
 *   - 其他          → Back(返回上一页,Android 最常见自动化步骤)
 *
 * 设计:键名跟 Maestro 命令集对齐(Back / Enter / Home / Volume_*)
 */
export function inferPressKey(node: UiNode | undefined): string {
  if (isEditable(node)) return 'Enter'
  return 'Back'
}

/**
 * 推断 eraseText 的默认字符数。
 *
 * 规则:
 *   - 节点已有 text → 用 text 长度(精确删干净,不多不少)
 *   - 节点为空     → 50(安全默认,Maestro 社区习惯)
 *
 * 为什么比静态 50 强:
 *   用户针对特定 EditText 做清除时,基本都是"先清干净再输入"。
 *   知道当前文本长度就能精确删,避免多按几次 BACKSPACE 触发其他副作用。
 */
export function inferEraseCharCount(node: UiNode | undefined): number {
  const txt = node?.attrs['text']
  if (typeof txt === 'string' && txt.length > 0) return txt.length
  return 50
}

/**
 * 推断 scrollUntilVisible 的默认方向。
 *
 * 规则:
 *   - 节点本身是横向容器 → LEFT(横向滚动场景)
 *   - 否则 undefined   → 让 Maestro 引擎默认(通常 DOWN)
 *
 * 为什么不强制 DOWN:Maestro 的 scrollUntilVisible 原生默认就是 DOWN,
 * 重复声明无意义。只在"非默认方向"下输出 direction,YAML 更干净。
 */
export function inferScrollDirection(node: UiNode | undefined): string | undefined {
  if (node && isHorizontalContainer(node)) return 'LEFT'
  return undefined
}

/** 取展示标签(i18n);未注册的 action 退化用原 id */
export function actionLabel(id: string): string {
  if (!ACTION_REGISTRY[id]) return id
  const key = `workflow.actionLabel.${id}`
  const resolved = t(key)
  return resolved !== key ? resolved : id
}

/** 取展示描述(i18n);未注册的 action 返回空串 */
export function actionDescription(id: string): string {
  if (!ACTION_REGISTRY[id]) return ''
  const key = `workflow.actionDesc.${id}`
  const resolved = t(key)
  return resolved !== key ? resolved : ''
}

/** 用 action + body 生成 StepItem 的一行摘要 */
export function actionSummary(id: string, body: unknown): string {
  const def = ACTION_REGISTRY[id]
  return def ? def.summary(body) : ''
}
