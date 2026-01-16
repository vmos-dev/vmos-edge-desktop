import { AndroidKeyCode, AndroidMetaState } from '@vmosedge/web-sdk'

/**
 * 浏览器按键代码 (event.code) 到 Android 键码的映射表
 * 仅包含非规则命名的特殊按键
 */
const SpecialKeyMap: Record<string, number> = {
  // 控制键
  Enter: AndroidKeyCode.Enter,
  Backspace: AndroidKeyCode.Backspace,
  Tab: AndroidKeyCode.Tab,
  Space: AndroidKeyCode.Space,
  Escape: AndroidKeyCode.Escape,
  Delete: AndroidKeyCode.Delete, // Forward Delete

  // 符号键
  Minus: AndroidKeyCode.Minus,
  Equal: AndroidKeyCode.Equal,
  BracketLeft: AndroidKeyCode.BracketLeft,
  BracketRight: AndroidKeyCode.BracketRight,
  Backslash: AndroidKeyCode.Backslash,
  Semicolon: AndroidKeyCode.Semicolon,
  Quote: AndroidKeyCode.Quote,
  Backquote: AndroidKeyCode.Backquote,
  Comma: AndroidKeyCode.Comma,
  Period: AndroidKeyCode.Period,
  Slash: AndroidKeyCode.Slash,

  // 修饰键
  ShiftLeft: AndroidKeyCode.ShiftLeft,
  ShiftRight: AndroidKeyCode.ShiftRight,
  ControlLeft: AndroidKeyCode.ControlLeft,
  ControlRight: AndroidKeyCode.ControlRight,
  AltLeft: AndroidKeyCode.AltLeft,
  AltRight: AndroidKeyCode.AltRight,
  MetaLeft: AndroidKeyCode.MetaLeft,
  MetaRight: AndroidKeyCode.MetaRight,

  // 数字小键盘
  Numpad0: AndroidKeyCode.Numpad0,
  Numpad1: AndroidKeyCode.Numpad1,
  Numpad2: AndroidKeyCode.Numpad2,
  Numpad3: AndroidKeyCode.Numpad3,
  Numpad4: AndroidKeyCode.Numpad4,
  Numpad5: AndroidKeyCode.Numpad5,
  Numpad6: AndroidKeyCode.Numpad6,
  Numpad7: AndroidKeyCode.Numpad7,
  Numpad8: AndroidKeyCode.Numpad8,
  Numpad9: AndroidKeyCode.Numpad9,
  NumpadDivide: AndroidKeyCode.NumpadDivide,
  NumpadMultiply: AndroidKeyCode.NumpadMultiply,
  NumpadSubtract: AndroidKeyCode.NumpadSubtract,
  NumpadAdd: AndroidKeyCode.NumpadAdd,
  NumpadEnter: AndroidKeyCode.NumpadEnter,
  NumpadDecimal: AndroidKeyCode.NumpadDecimal,
  NumpadEqual: AndroidKeyCode.NumpadEquals,

  // 导航键
  Insert: AndroidKeyCode.Insert,
  Home: AndroidKeyCode.Home,
  End: AndroidKeyCode.End,
  PageUp: AndroidKeyCode.PageUp,
  PageDown: AndroidKeyCode.PageDown,

  // 锁键
  CapsLock: AndroidKeyCode.CapsLock,
  NumLock: AndroidKeyCode.NumLock,
  ScrollLock: AndroidKeyCode.ScrollLock,
  PrintScreen: AndroidKeyCode.PrintScreen,
  Pause: AndroidKeyCode.Pause
}

/**
 * 将浏览器键盘事件转换为 Android 键码
 * @param code 浏览器 event.code (e.g. "KeyA", "Digit1", "Enter")
 * @returns 对应的 AndroidKeyCode 或 null
 */
export function getAndroidKeyCode(code: string): number | null {
  // 1. 尝试直接匹配 "KeyX" -> AndroidKeyCode.KeyX
  if (code.startsWith('Key')) {
    // AndroidKeyCode 中也是以 Key 开头，如 KeyA
    const key = code as keyof typeof AndroidKeyCode
    if (AndroidKeyCode[key] !== undefined) {
      return AndroidKeyCode[key]
    }
  }

  // 2. 尝试匹配 "DigitX" -> AndroidKeyCode.DigitX
  if (code.startsWith('Digit')) {
    const key = code as keyof typeof AndroidKeyCode
    if (AndroidKeyCode[key] !== undefined) {
      return AndroidKeyCode[key]
    }
  }

  // 3. 尝试匹配 "FX" -> AndroidKeyCode.FX
  if (code.startsWith('F') && code.length <= 3 && !isNaN(Number(code.slice(1)))) {
    const key = code as keyof typeof AndroidKeyCode
    if (AndroidKeyCode[key] !== undefined) {
      return AndroidKeyCode[key]
    }
  }

  // 4. 尝试匹配方向键 "ArrowX" -> AndroidKeyCode.ArrowX
  if (code.startsWith('Arrow')) {
    const key = code as keyof typeof AndroidKeyCode
    if (AndroidKeyCode[key] !== undefined) {
      return AndroidKeyCode[key]
    }
  }

  // 5. 查表匹配特殊键
  if (SpecialKeyMap[code] !== undefined) {
    return SpecialKeyMap[code]
  }

  return null
}

/**
 * 根据键盘事件构建 Android MetaState
 * @param e 浏览器键盘事件
 */
export function buildMetaState(e: KeyboardEvent): number {
  let metaState = 0

  // 检测是否为 Mac 平台
  // 注意：navigator.platform 在某些现代浏览器中可能不再推荐，但在 Electron 中通常有效
  // 或者使用 navigator.userAgent
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent)

  if (e.shiftKey) metaState |= AndroidMetaState.ShiftOn
  if (e.altKey) metaState |= AndroidMetaState.AltOn

  if (isMac) {
    // Mac 平台特殊处理：
    // 将 Command (Meta) 键映射为 Android 的 Ctrl 键，符合 Mac 用户习惯 (Cmd+C/V)
    if (e.metaKey) metaState |= AndroidMetaState.CtrlOn
    // Mac 的 Control 键也映射为 Android 的 Ctrl 键 (用于终端等场景)
    if (e.ctrlKey) metaState |= AndroidMetaState.CtrlOn
  } else {
    // Windows/Linux 平台：
    // Ctrl -> Ctrl
    if (e.ctrlKey) metaState |= AndroidMetaState.CtrlOn
    // Win 键 -> Meta
    if (e.metaKey) metaState |= AndroidMetaState.MetaOn
  }

  if (e.getModifierState('CapsLock')) metaState |= AndroidMetaState.CapsLockOn
  if (e.getModifierState('NumLock')) metaState |= AndroidMetaState.NumLockOn
  if (e.getModifierState('ScrollLock')) metaState |= AndroidMetaState.ScrollLockOn

  return metaState
}
