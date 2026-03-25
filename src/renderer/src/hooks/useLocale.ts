import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import en from 'element-plus/es/locale/lang/en'
import { ipc } from '@renderer/core/ipc'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'

// 定义语言列表，方便后续扩展
export const languageList = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'English', value: 'en-US' }
]

// Element Plus 语言包映射
const elLocaleMap = {
  'zh-CN': zhCn,
  'zh-TW': zhTw,
  'en-US': en
}

export const useLocale = () => {
  const { locale } = useI18n()

  // 当前 Element Plus 语言包
  const currentElLocale = computed(() => {
    return elLocaleMap[locale.value] || en
  })

  // 切换语言
  const changeLocale = (lang: string) => {
    // 如果传入的语言不在支持列表中，不做处理或降级处理
    if (!elLocaleMap[lang]) {
      console.warn(`Language ${lang} is not supported yet.`)
      return
    }

    locale.value = lang
    localStorage.setItem('app-language', lang)
    // 同步保存到后端数据库
    ipc.invoke(CONFIG_EVENTS.SET_CONFIG, { key: CONFIG_KEYS.APP_LANGUAGE, value: lang })
  }

  // 当前显示语言名称 (用于 UI 显示)
  const currentLanguageLabel = computed(() => {
    const lang = languageList.find(item => item.value === locale.value)
    return lang ? lang.label : 'English'
  })

  // 判断是否为中文
  const isZhCN = computed(() => locale.value === 'zh-CN')


  // 监听 storage 和 IPC 事件同步多窗口语言状态
  const setupStorageListener = () => {
    // 监听 localStorage (同源窗口)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'app-language' && e.newValue && e.newValue !== locale.value) {
        if (elLocaleMap[e.newValue]) {
          locale.value = e.newValue
        }
      }
    }

    // 监听 IPC (跨进程/窗口广播)
    const cleanupIpc = ipc.on(CONFIG_EVENTS.CONFIG_UPDATED, (payload: any) => {
      if (!payload) return
      const { key, value } = payload
      if (key === CONFIG_KEYS.APP_LANGUAGE && value && value !== locale.value) {
        if (elLocaleMap[value]) {
          locale.value = value
        }
      }
    })

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      cleanupIpc()
    }
  }

  return {
    currentElLocale,
    changeLocale,
    currentLanguageLabel,
    languageList,
    locale,
    isZhCN,
    setupStorageListener
  }
}
