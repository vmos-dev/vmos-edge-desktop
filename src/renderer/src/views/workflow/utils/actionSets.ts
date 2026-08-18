/**
 * 动作语义分组 · 唯一真相源
 *
 * 同时被 parse 侧(yamlDocument)和 serialize 侧(stepCodec)引用。
 * 新增 action 时只改这里一处,两端自动对齐,避免往返丢字段。
 */

/** 带选择器的原子动作:YAML body 首字段是选择器,其余为参数/meta */
export const ATOMIC_WITH_SELECTOR: ReadonlySet<string> = new Set([
  'tapOn',
  'longPressOn',
  'doubleTapOn',
  'assertVisible',
  'assertNotVisible',
  'copyTextFrom'
])

/**
 * 无选择器的原子动作。YAML 形式可以是:
 *   - 裸命令:`- scroll`
 *   - 对象 body:`- scroll: { direction: DOWN, ... }`
 *
 * 两端都走结构化 parse/serialize,避免掉进 opaque 无法编辑。
 */
export const BARE_OR_OBJECT: ReadonlySet<string> = new Set([
  'eraseText',
  'pasteText',
  'waitForAnimationToEnd',
  'scroll',
  'swipe',
  'launchApp',
  'stopApp',
  'killApp',
  'back',
  'hideKeyboard',
  'clearState',
  'clearKeychain'
])

/** 复合动作:body 里有 commands 子步骤列表 */
export const COMPOSITE_WITH_CHILDREN: ReadonlySet<string> = new Set(['repeat', 'retry', 'runFlow'])
