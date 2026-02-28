import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { API_CONFIG } from './config'

export interface RequestConfig extends AxiosRequestConfig {
  /** 错误处理回调 */
  onError?: (message: string, error?: any) => void
  /** 成功处理回调 */
  onSuccess?: (message: string, response?: any) => void
}

export const isCancel = axios.isCancel
export { isAxiosError } from 'axios'

export class Request {
  private instance: AxiosInstance
  private options: RequestConfig

  // 静态语言获取器，允许外部自定义（例如在主进程中从数据库获取）
  public static languageGetter: () => string = () => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('app-language') || 'zh-CN'
    }
    return 'zh-CN'
  }

  constructor(options: RequestConfig = {}) {
    this.options = options
    this.instance = axios.create({
      timeout: 10000,
      proxy: false,
      ...options
    })

    this.setupInterceptors()
  }

  /**
   * 设置自定义错误处理函数
   */
  public setErrorHandler(handler: (message: string, error?: any) => void) {
    this.options.onError = handler
  }

  /**
   * 设置自定义成功处理函数
   */
  public setSuccessHandler(handler: (message: string, response?: any) => void) {
    this.options.onSuccess = handler
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      (config) => {
        // 设置固定请求头
        config.headers['X-Client-Type'] = 'vmos-edge-desktop'

        // 设置语言头
        config.headers['Accept-Language'] = Request.languageGetter()
        return config
      },
      (error) => {
        console.error('[Request] Request Error:', error)
        return Promise.reject(error)
      }
    )

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const data = response.data

        // 如果 data 是图片，则直接返回
        if (
          response.config.responseType === 'blob' ||
          response.config.responseType === 'arraybuffer'
        ) {
          return data
        }

        const code = Number(data?.code || 0)
        if (code !== API_CONFIG.SUCCESS_CODE) {
          const msg = data.msg
          // 构造一个包含请求上下文的错误对象
          const errorObj: any = new Error(msg)
          errorObj.config = response.config
          errorObj.response = response
          errorObj.code = code
          errorObj.data = data

          this.options.onError?.(msg, errorObj)
          return Promise.reject(data)
        }

        // 请求成功
        this.options.onSuccess?.(`Request to ${response.config.url} succeeded`, {
          url: response.config.url,
          method: response.config.method,
          params: response.config.params,
          data: response.config.data,
          response: data
        })

        return data
      },
      (error) => {
        const msg = error.response?.data?.message || error.message || 'Request Error'
        console.warn('[Request] API Error:', msg)
        this.options.onError?.(msg, error)
        return Promise.reject(error.response?.data || error)
      }
    )
  }

  get<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.get(url, { params, ...config }) as any
  }

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.post(url, data, config) as any
  }

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.put(url, data, config) as any
  }

  delete<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.instance.delete(url, { params, ...config }) as any
  }
}

// 导出默认实例
export const request = new Request({
  onError: (msg) => console.error(msg)
})
