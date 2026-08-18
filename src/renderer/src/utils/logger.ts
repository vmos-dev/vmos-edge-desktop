import { ipc } from '@renderer/core/ipc'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { request } from '@shared/api/request'
import type { App } from 'vue'

type LogLevel = 'info' | 'warn' | 'error'

interface LogPayload {
  level: LogLevel
  message: string
  [key: string]: any
}

const safeStringify = (value: any) => {
  try {
    return JSON.stringify(value)
  } catch {
    return '[Unserializable]'
  }
}

/**
 * 格式化请求数据，安全地处理 FormData 和大对象
 */
const formatRequestData = (data: any) => {
  try {
    if (!data) return data

    // 处理 FormData
    // 注意：在某些环境或构建配置下，data 可能被推断为非 object，这里强制断言
    if ((data as any) instanceof FormData) {
      return '[FormData] (Content Omitted)'
    }

    // 处理 Blob/File
    if ((data as any) instanceof Blob || (data as any) instanceof File) {
      return `[${(data as any).constructor.name}] (Content Omitted)`
    }

    // 处理字符串
    if (typeof data === 'string') {
      if (data.length > 3000) {
        return data.slice(0, 3000) + '... [Truncated]'
      }
      return data
    }

    // 其他对象直接返回（日志发送时会序列化）
    return data
  } catch (err) {
    // 确保格式化过程不会报错导致 crash
    return '[Format Failed]'
  }
}

/**
 * 解析错误对象，提取详细信息（包括 Axios 请求错误）
 */
const parseError = (error: any) => {
  if (!error) return {}

  const result: any = {
    stack: error.stack,
    originalMessage: error.message || safeStringify(error)
  }

  // 处理 Axios 错误
  // 判断依据：通常 axios 错误会有 config 和 response 或 request 属性
  if (error.config || error.isAxiosError) {
    result.isAxiosError = true
    result.reqUrl = error.config?.url
    result.reqMethod = error.config?.method
    result.reqData = formatRequestData(error.config?.data)
    result.reqParams = error.config?.params

    if (error.response) {
      result.resStatus = error.response.status
      result.resData = error.response.data
    } else if (error.request) {
      result.resStatus = 0 // Network Error or No Response
      result.resMessage = 'No response received'
    }
  }

  return result
}

const isIgnorableUnhandledRejection = (reason: any) => {
  const rawMessage =
    typeof reason === 'string' ? reason : reason?.message || reason?.originalMessage || ''
  const normalizedMessage = rawMessage
    .trim()
    .replace(/^"+|"+$/g, '')
    .toLowerCase()
  return normalizedMessage === 'cancel' || normalizedMessage === 'canceled'
}

/**
 * 发送日志到主进程
 */
const sendLog = (level: LogLevel, message: string, meta: any = {}) => {
  const payload: LogPayload = {
    level,
    message,
    ...meta,
    pageUrl: window.location.href,
    timestamp: Date.now()
  }

  // 开发环境下也打印到控制台，方便调试
  if (import.meta.env.DEV) {
    const style =
      level === 'error' ? 'color: red' : level === 'warn' ? 'color: orange' : 'color: blue'
    console.groupCollapsed(`%c[LogToMain:${level}] ${message}`, style)
    console.log('Payload:', payload)
    console.groupEnd()
  }

  try {
    ipc.send(SHARED_EVENTS.RENDERER_LOG, payload)
  } catch (err) {
    console.error('Failed to send log to main process:', err)
  }
}

/**
 * 外部可用的日志工具
 */
export const logger = {
  info: (message: string, meta?: any) => sendLog('info', message, meta),

  warn: (message: string, meta?: any) => sendLog('warn', message, meta),

  error: (message: string, error?: any, meta?: any) => {
    const errorMeta = parseError(error)
    sendLog('error', message, { ...errorMeta, ...meta })
  }
}

/**
 * 初始化全局错误捕获
 */
export const initErrorCapture = (app: App) => {
  // 1. Vue 组件错误
  app.config.errorHandler = (err: any, _instance, info) => {
    logger.error(`Vue Error: ${err?.message || 'Unknown'}`, err, { componentInfo: info })
    console.error('Vue Error:', err)
  }

  // 2. 全局脚本错误 (Window Error)
  window.onerror = (message, source, lineno, colno, error) => {
    logger.error(`Global Script Error: ${message}`, error, {
      source,
      lineno,
      colno
    })
    return false // 不阻止默认控制台输出
  }

  // 3. 未处理的 Promise 拒绝 (包括 Axios 请求失败但未 catch 的情况)
  window.onunhandledrejection = (event) => {
    // event.reason 可能是 Error 对象，也可能是其他值
    if (isIgnorableUnhandledRejection(event.reason)) {
      event.preventDefault()
      return
    }
    logger.error(`Unhandled Rejection`, event.reason)
  }

  // 4. 资源加载错误 (img, script, link 等)
  // 注意：资源错误不会冒泡，必须在捕获阶段处理 (useCapture = true)
  window.addEventListener(
    'error',
    (event: Event) => {
      const target = event.target
      // 过滤掉 window 自身的 error (已被 window.onerror 处理)
      if (target && target !== window && target instanceof HTMLElement) {
        const tagName = target.tagName || 'UNKNOWN'
        const src = (target as any).src || (target as any).href || ''

        logger.error(`Resource Load Failed: <${tagName}>`, null, {
          tagName,
          src,
          outerHTML: target.outerHTML
        })
      }
    },
    true
  )

  // 5. 拦截共享请求库的错误 (Axios)
  // 这能捕获业务状态码错误 (code !== 200) 以及网络错误
  request.setErrorHandler((msg, error) => {
    logger.error(`API Request Failed: ${msg}`, error)
  })

  // 6. 拦截共享请求库的成功响应
  request.setSuccessHandler((msg, response) => {
    logger.info(`API Request Success: ${msg}`, { response })
  })
}
