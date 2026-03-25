import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import zhTW from './zh-TW'
import enUS from './en-US'

// 获取浏览器/系统语言
const getSystemLanguage = () => {
  const lang = navigator.language
  if (lang && lang.toLowerCase().startsWith('zh')) {
    return 'zh-CN'
  }
  // 默认使用英文
  return 'en-US'
}

// 优先级：本地缓存 > 系统语言 > 英文
const defaultLocale = localStorage.getItem('app-language') || getSystemLanguage()

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: defaultLocale,
  fallbackLocale: 'en-US', // 缺省语言设为英文
  globalInjection: true, // 允许在模板中直接使用 $t
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    'en-US': enUS
  }
})

// 导出封装的 t 函数，用于非组件环境
export const t = (key: string, ...args: any[]) => {
  // @ts-ignore: 忽略类型检查以支持灵活调用
  return i18n.global.t(key, ...args)
}

export default i18n
