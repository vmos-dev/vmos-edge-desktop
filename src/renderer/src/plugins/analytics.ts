/**
 * Analytics 插件
 *
 * 职责：创建实例、注册到 Vue、挂载自动追踪
 * 实例在模块加载时即创建，无需 nullable 判断
 */
import type { App } from 'vue'
import type { Router } from 'vue-router'
import { createAnalytics } from '@vmosedge/analytics-sdk'
import { setupTracker } from './analytics-tracker'

/** 全局开关：设为 false 可关闭所有统计上报 */
const ANALYTICS_ENABLED = true

/** 全局唯一实例，模块加载时即创建 */
export const analytics = createAnalytics({
  measurementId: __GA_MEASUREMENT_ID__,
  appVersion: __APP_VERSION__ ?? '0.0.0',
  debug: false
})

if (!ANALYTICS_ENABLED) {
  analytics.setEnabled(false)
}

/**
 * 注册 Analytics 到 Vue 应用
 */
export function setupAnalytics(app: App, router: Router) {
  // Vue 组件内可通过 inject('analytics') 使用
  app.provide('analytics', analytics)

  // 路由切换自动上报 page_view，使用路由 name 作为标题（稳定、不随语言变化）
  router.afterEach((to) => {
    analytics.pageView(to.path, to.name?.toString())
  })

  // 挂载 IPC / HTTP 拦截器
  setupTracker(analytics)

  // 上报应用启动
  trackAppLaunch()
}

function trackAppLaunch() {
  analytics.rawTrack('app_launch', {
    version: __APP_VERSION__ ?? '0.0.0',
    os: navigator.platform || '',
    arch: navigator.userAgent.includes('arm') ? 'arm64' : 'x64',
    locale: navigator.language || 'zh-CN'
  })

  analytics.setUserProperties({
    app_version: __APP_VERSION__ ?? '0.0.0',
    os: navigator.platform || '',
    locale: navigator.language || 'zh-CN'
  })
}
