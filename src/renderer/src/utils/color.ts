/**
 * Mix two colors by weight (HEX only for precision)
 */
export function mixColor(color1: string, color2: string, weight: number) {
  // If color1 is not a hex string, we can't do math on it
  if (!color1.startsWith('#')) return color1

  weight = Math.max(0, Math.min(1, weight))
  try {
    const r1 = parseInt(color1.substring(1, 3), 16)
    const g1 = parseInt(color1.substring(3, 5), 16)
    const b1 = parseInt(color1.substring(5, 7), 16)

    const r2 = parseInt(color2.substring(1, 3), 16)
    const g2 = parseInt(color2.substring(3, 5), 16)
    const b2 = parseInt(color2.substring(5, 7), 16)

    const r = Math.round(r1 * (1 - weight) + r2 * weight)
    const g = Math.round(g1 * (1 - weight) + g2 * weight)
    const b = Math.round(b1 * (1 - weight) + b2 * weight)

    const rStr = r.toString(16).padStart(2, '0')
    const gStr = g.toString(16).padStart(2, '0')
    const bStr = b.toString(16).padStart(2, '0')

    return `#${rStr}${gStr}${bStr}`
  } catch (e) {
    return color1
  }
}

/**
 * Hex to RGBA
 */
export function hexToRgba(hex: string, alpha: number) {
  if (!hex.startsWith('#')) return hex

  try {
    const r = parseInt(hex.substring(1, 3), 16)
    const g = parseInt(hex.substring(3, 5), 16)
    const b = parseInt(hex.substring(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  } catch (e) {
    return hex
  }
}

/**
 * Generate Element Plus theme colors
 * isDark 为 true 时，light 系列改为与暗色背景混合，避免暗黑模式出现白底
 */
export function generateThemeColors(primary: string, isDark = false) {
  const colors: Record<string, string> = {
    primary: primary
  }

  // 暗黑模式：与 Element Plus 官方 dark 背景 #141414 混合
  // 亮色模式：与 #ffffff 混合（Element Plus 默认行为）
  const mixBase = isDark ? '#141414' : '#ffffff'

  for (let i = 1; i <= 9; i++) {
    colors[`primary-light-${i}`] = mixColor(primary, mixBase, i / 10)
  }

  colors['primary-dark-2'] = mixColor(primary, '#000000', 0.2)

  return colors
}
