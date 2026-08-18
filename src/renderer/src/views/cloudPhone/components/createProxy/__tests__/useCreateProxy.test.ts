import { describe, expect, it, vi } from 'vitest'
import { createDefaultProxyForm } from '@renderer/views/cloudPhone/services/proxyService'
import { useCreateProxy } from '../composables/useCreateProxy'

describe('useCreateProxy', () => {
  it('loads proxy list and check strategy from injected dependencies', async () => {
    const proxyList = [
      { id: 'proxy-1', name: 'Proxy 1', protocol: 'http', host: '1.1.1.1', port: 8080 }
    ]
    const composable = useCreateProxy({
      fetchProxyList: vi.fn().mockResolvedValue(proxyList),
      fetchProxyCheckStrategy: vi.fn().mockResolvedValue('default'),
      updateProxyCheckStrategy: vi.fn(),
      checkProxy: vi.fn()
    })

    await composable.load()

    expect(composable.proxyList.value).toEqual(proxyList)
    expect(composable.checkStrategy.value).toBe('default')
  })

  it('requires transfer agent before running a chained proxy check', async () => {
    const composable = useCreateProxy({
      fetchProxyList: vi.fn().mockResolvedValue([]),
      fetchProxyCheckStrategy: vi.fn().mockResolvedValue('default'),
      updateProxyCheckStrategy: vi.fn(),
      checkProxy: vi.fn()
    })

    await expect(
      composable.runCheck({
        ...createDefaultProxyForm(),
        id: 'proxy-1',
        isTransferAgent: true,
        transferAgentId: ''
      })
    ).rejects.toThrow('transfer agent required')
  })

  it('builds proxy-check payload in transfer-then-current order and stores success result', async () => {
    const checkProxy = vi.fn().mockResolvedValue({
      success: true,
      data: {
        data: {
          ip: '9.9.9.9'
        }
      }
    })

    const composable = useCreateProxy({
      fetchProxyList: vi.fn().mockResolvedValue([
        {
          id: 'transfer-1',
          name: 'Transfer Proxy',
          protocol: 'http',
          host: '2.2.2.2',
          port: 9000
        },
        {
          id: 'proxy-1',
          name: 'Proxy 1',
          protocol: 'socks5',
          host: '1.1.1.1',
          port: 8080,
          username: 'alice',
          password: 'secret'
        }
      ]),
      fetchProxyCheckStrategy: vi.fn().mockResolvedValue('default'),
      updateProxyCheckStrategy: vi.fn(),
      checkProxy
    })

    await composable.load()
    await composable.runCheck({
      ...createDefaultProxyForm(),
      id: 'proxy-1',
      isTransferAgent: true,
      transferAgentId: 'transfer-1'
    })

    expect(checkProxy).toHaveBeenCalledWith([
      {
        protocol: 'http',
        host: '2.2.2.2',
        port: 9000,
        username: undefined,
        password: undefined,
        rawLink: undefined
      },
      {
        protocol: 'socks5',
        host: '1.1.1.1',
        port: 8080,
        username: 'alice',
        password: 'secret',
        rawLink: undefined
      }
    ])
    expect(composable.testResult.value).toEqual({
      success: true,
      data: {
        ip: '9.9.9.9'
      }
    })
  })

  it('stores failure results from manual proxy checks', async () => {
    const composable = useCreateProxy({
      fetchProxyList: vi.fn().mockResolvedValue([
        {
          id: 'proxy-1',
          name: 'Proxy 1',
          protocol: 'http',
          host: '1.1.1.1',
          port: 8080
        }
      ]),
      fetchProxyCheckStrategy: vi.fn().mockResolvedValue('default'),
      updateProxyCheckStrategy: vi.fn(),
      checkProxy: vi.fn().mockResolvedValue({
        success: false,
        error: 'network failed'
      })
    })

    await composable.load()
    await composable.runCheck({
      ...createDefaultProxyForm(),
      id: 'proxy-1'
    })

    expect(composable.testResult.value).toEqual({
      success: false,
      error: 'network failed'
    })
  })
})
