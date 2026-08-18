import { ref, shallowRef } from 'vue'
import { ipc } from '@renderer/core/ipc'
import type { Proxy } from '@shared/ipc/data.types'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import {
  fetchProxyCheckStrategy,
  fetchProxyList,
  updateProxyCheckStrategy,
  type ProxyFormModel
} from '@renderer/views/cloudPhone/services/proxyService'

interface ProxyCheckResponse {
  success: boolean
  data?: {
    data?: Record<string, any>
  }
  error?: string
}

interface UseCreateProxyDeps {
  fetchProxyList: typeof fetchProxyList
  fetchProxyCheckStrategy: typeof fetchProxyCheckStrategy
  updateProxyCheckStrategy: typeof updateProxyCheckStrategy
  checkProxy: (payload: unknown) => Promise<ProxyCheckResponse>
}

const buildCheckProxyPayload = (proxy: Proxy) => ({
  protocol: proxy.protocol,
  host: proxy.host,
  port: proxy.port,
  username: proxy.username || undefined,
  password: proxy.password || undefined,
  rawLink: proxy.rawLink || undefined
})

export const useCreateProxy = (
  deps: UseCreateProxyDeps = {
    fetchProxyList,
    fetchProxyCheckStrategy,
    updateProxyCheckStrategy,
    checkProxy: (payload: unknown) => ipc.invoke<any>(PROXY_EVENTS.CHECK_PROXY, payload)
  }
) => {
  const proxyList = ref<Proxy[]>([])
  const checkStrategy = shallowRef('default')
  const checking = shallowRef(false)
  const testResult = ref<null | { success: boolean; data?: Record<string, any>; error?: string }>(
    null
  )

  const load = async () => {
    const [list, strategy] = await Promise.all([
      deps.fetchProxyList(),
      deps.fetchProxyCheckStrategy()
    ])

    proxyList.value = list
    checkStrategy.value = strategy
  }

  const clearTestResult = () => {
    testResult.value = null
  }

  const setCheckStrategy = async (value: string) => {
    checkStrategy.value = value
    await deps.updateProxyCheckStrategy(value)
  }

  const updateProxy = (proxyId: string, updates: Partial<Proxy>) => {
    proxyList.value = proxyList.value.map((item) =>
      item.id === proxyId ? ({ ...item, ...updates } as Proxy) : item
    )
  }

  const runCheck = async (form: ProxyFormModel) => {
    if (!form.id) {
      throw new Error('proxy required')
    }

    if (form.isTransferAgent && !form.transferAgentId) {
      throw new Error('transfer agent required')
    }

    const proxies: Array<Record<string, any>> = []

    if (form.isTransferAgent && form.transferAgentId) {
      const transferAgent = proxyList.value.find((item) => item.id === form.transferAgentId)
      if (!transferAgent) {
        throw new Error('transfer agent required')
      }
      proxies.push(buildCheckProxyPayload(transferAgent))
    }

    const proxy = proxyList.value.find((item) => item.id === form.id)
    if (!proxy) {
      throw new Error('proxy required')
    }

    proxies.push(buildCheckProxyPayload(proxy))

    checking.value = true
    testResult.value = null

    try {
      const response = await deps.checkProxy(proxies.length > 1 ? proxies : proxies[0])
      testResult.value = response.success
        ? { success: true, data: response.data?.data || {} }
        : { success: false, error: response.error || 'check failed' }

      return testResult.value
    } finally {
      checking.value = false
    }
  }

  return {
    proxyList,
    checkStrategy,
    checking,
    testResult,
    load,
    clearTestResult,
    setCheckStrategy,
    updateProxy,
    runCheck
  }
}
