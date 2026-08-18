import { ref } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { generateThemeColors, hexToRgba } from '@renderer/utils/color'

export type ThemeMode = 'light' | 'dark' | 'system'

const themeMode = ref<ThemeMode>('light')
const themeColor = ref('#409eff')

export const useTheme = () => {
  const applyThemeColor = (color: string) => {
    const el = document.documentElement
    const isDark = el.classList.contains('dark')
    const colors = generateThemeColors(color, isDark)

    // Apply to CSS variables
    Object.entries(colors).forEach(([key, value]) => {
      el.style.setProperty(`--el-color-${key}`, value)
    })

    // 确保基础状态色也有定义 (如果用户使用的是默认值，则使用 Element Plus 默认)
    // 这里的逻辑是为了确保在某些环境下变量不丢失
    const statusColors = {
      success: '#67c23a',
      warning: '#e6a23c',
      danger: '#f56c6c',
      info: '#909399'
    }

    Object.entries(statusColors).forEach(([key, val]) => {
      if (!el.style.getPropertyValue(`--el-color-${key}`)) {
        el.style.setProperty(`--el-color-${key}`, val)
      }
    })

    // Add alpha versions for components that use rgba
    el.style.setProperty('--el-color-primary-alpha-1', hexToRgba(color, 0.1))
    el.style.setProperty('--el-color-primary-alpha-2', hexToRgba(color, 0.2))
    el.style.setProperty('--el-color-primary-alpha-3', hexToRgba(color, 0.35))
  }

  const applyThemeMode = (mode: ThemeMode) => {
    const html = document.documentElement
    if (mode === 'dark') {
      html.classList.add('dark')
    } else if (mode === 'light') {
      html.classList.remove('dark')
    } else {
      // system
      updateSystemTheme()
    }
    // 主题模式变更后重新生成颜色，确保 light 系列与当前模式匹配
    applyThemeColor(themeColor.value)
  }

  const updateSystemTheme = () => {
    if (themeMode.value !== 'system') return
    const html = document.documentElement
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themeMode.value === 'system') {
      updateSystemTheme()
      applyThemeColor(themeColor.value)
    }
  })

  const setThemeMode = async (mode: ThemeMode) => {
    themeMode.value = mode
    applyThemeMode(mode)
    applyThemeColor(themeColor.value)
    await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, { key: CONFIG_KEYS.THEME_MODE, value: mode })
  }

  const setThemeColor = async (color: string) => {
    themeColor.value = color
    applyThemeColor(color)
    await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, { key: CONFIG_KEYS.THEME_COLOR, value: color })
  }

  const resetTheme = async () => {
    await setThemeMode('light')
    await setThemeColor('#409eff')
  }

  const initTheme = async () => {
    const modeRes = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.THEME_MODE)
    if (modeRes.success && modeRes.data) {
      themeMode.value = modeRes.data as ThemeMode
    }

    const colorRes = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.THEME_COLOR)
    if (colorRes.success && colorRes.data) {
      themeColor.value = colorRes.data
    }

    applyThemeMode(themeMode.value)
    applyThemeColor(themeColor.value)
  }

  /**
   * 监听配置更新事件，保持多窗口同步
   */
  const setupThemeListener = () => {
    const cleanup = ipc.on(CONFIG_EVENTS.CONFIG_UPDATED, (payload: any) => {
      if (!payload) return
      const { key, value } = payload

      if (key === CONFIG_KEYS.THEME_MODE) {
        const mode = value as ThemeMode
        if (themeMode.value !== mode) {
          themeMode.value = mode
          applyThemeMode(mode)
          applyThemeColor(themeColor.value)
        }
      } else if (key === CONFIG_KEYS.THEME_COLOR) {
        if (themeColor.value !== value) {
          themeColor.value = value
          applyThemeColor(value)
        }
      }
    })

    return cleanup
  }

  return {
    themeMode,
    themeColor,
    setThemeMode,
    setThemeColor,
    resetTheme,
    initTheme,
    setupThemeListener
  }
}
