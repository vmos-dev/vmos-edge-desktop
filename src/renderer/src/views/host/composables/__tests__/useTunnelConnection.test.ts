import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn()
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')

  return {
    ...actual,
    onUnmounted: vi.fn()
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@shared/api', () => ({
  API_CONFIG: {
    PATHS: {
      TUNNEL_STATUS: '/tunnel/status',
      TUNNEL_ENABLE: '/tunnel/enable',
      TUNNEL_DISABLE: '/tunnel/disable',
      TUNNEL_UNLOCK: '/tunnel/unlock'
    }
  },
  buildApiUrl: (ip: string, path: string) => `http://${ip}${path}`,
  getErrorMessage: (error: Error | { message?: string } | undefined, defaultMsg: string) =>
    error?.message || defaultMsg,
  request: {
    get: getMock,
    post: postMock
  }
}))

import { useTunnelConnection } from '../useTunnelConnection'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

const createTunnelStatus = (overrides: Partial<ReturnType<typeof baseTunnelStatus>> = {}) => ({
  ...baseTunnelStatus(),
  ...overrides
})

function baseTunnelStatus() {
  return {
    state: 'disconnected',
    locked: false,
    server_addr: 'tunnel.vmosedge.com:22',
    remote_port: 10022,
    local_addr: '127.0.0.1:22',
    reconnect_count: 0
  }
}

const createEnableResponse = (overrides: Record<string, unknown> = {}) => ({
  data: {
    state: 'connecting',
    server_addr: 'tunnel.vmosedge.com:22',
    remote_port: 0,
    username: 'cbs_debug',
    password: 'test-random-password-24ch',
    expires_at: '2026-04-22T12:00:00Z',
    ssh_command: 'ssh -p 0 cbs_debug@tunnel.vmosedge.com',
    local_addr: '127.0.0.1:22',
    ...overrides
  }
})

describe('useTunnelConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'))
    getMock.mockReset()
    postMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to disconnected state after connecting timeout', async () => {
    getMock.mockResolvedValue({
      data: createTunnelStatus({
        state: 'connecting'
      })
    })
    postMock.mockResolvedValue({})

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.state.value).toBe('connecting')

    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(postMock).toHaveBeenCalledWith('http://1.1.1.1/tunnel/disable', {})
    expect(composable.pollingError.value).toBe('host.tunnelTimeout')
    expect(composable.state.value).toBe('disconnected')
    expect(composable.enablePassword.value).toBeNull()
  })

  it('shows an error view and allows retry when init status request fails', async () => {
    getMock.mockRejectedValueOnce(new Error('network failed')).mockResolvedValueOnce({
      data: createTunnelStatus({
        state: 'stopped',
        locked: true
      })
    })

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.viewState.value).toBe('error')
    expect(composable.canClose.value).toBe(true)
    expect(composable.pollingError.value).toBe('network failed')

    await composable.retryObserve()
    await flushPromises()

    expect(composable.viewState.value).toBe('disconnected')
    expect(composable.canClose.value).toBe(true)
    expect(composable.observedStatus.value).toMatchObject({
      state: 'stopped',
      locked: true
    })
    expect(composable.pollingError.value).toBeNull()
  })

  it('shows unsupported-api error when init status request returns 404', async () => {
    const notFoundError = Object.assign(new Error('Request failed with status code 404'), {
      response: { status: 404 }
    })

    getMock.mockRejectedValueOnce(notFoundError)

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.viewState.value).toBe('error')
    expect(composable.canClose.value).toBe(true)
    expect(composable.pollingError.value).toBe('host.tunnelApiUnavailable')
  })

  it('stops polling after loading a stopped tunnel snapshot', async () => {
    getMock.mockResolvedValue({
      data: createTunnelStatus({
        state: 'stopped',
        locked: true,
        remote_port: 29061
      })
    })

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.viewState.value).toBe('disconnected')
    expect(composable.canClose.value).toBe(true)
    expect(composable.state.value).toBe('disconnected')
    expect(composable.observedStatus.value).toMatchObject({
      state: 'stopped',
      locked: true,
      remote_port: 29061
    })
    expect(getMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(6_000)
    await flushPromises()

    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('shows initial connected snapshot without continuing to poll', async () => {
    getMock.mockResolvedValue({
      data: createTunnelStatus({
        state: 'connected',
        remote_port: 20022
      })
    })

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.viewState.value).toBe('connected')
    expect(composable.canClose.value).toBe(true)
    expect(composable.state.value).toBe('connected')
    expect(getMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(4_000)
    await flushPromises()

    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('keeps polling when initial snapshot is connecting and allows close', async () => {
    getMock
      .mockResolvedValueOnce({
        data: createTunnelStatus({
          state: 'connecting',
          remote_port: 0
        })
      })
      .mockResolvedValueOnce({
        data: createTunnelStatus({
          state: 'connected',
          remote_port: 20022
        })
      })

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.viewState.value).toBe('connecting')
    expect(composable.canClose.value).toBe(true)
    expect(getMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(composable.viewState.value).toBe('connected')
    expect(composable.canClose.value).toBe(true)
    expect(composable.observedStatus.value?.remote_port).toBe(20022)
  })

  it('unlocks, enables with auth and saves password from response', async () => {
    getMock
      .mockResolvedValueOnce({
        data: createTunnelStatus({
          state: 'stopped',
          locked: true,
          remote_port: 29061
        })
      })
      .mockResolvedValueOnce({
        data: createTunnelStatus({
          state: 'connecting',
          locked: false,
          remote_port: 0
        })
      })
      .mockResolvedValueOnce({
        data: createTunnelStatus({
          state: 'connected',
          locked: false,
          remote_port: 30022
        })
      })
    postMock.mockResolvedValueOnce({}).mockResolvedValueOnce(createEnableResponse())

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.viewState.value).toBe('disconnected')
    expect(composable.canClose.value).toBe(true)

    await composable.enable()
    await flushPromises()

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      'http://1.1.1.1/tunnel/unlock',
      {},
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      'http://1.1.1.1/tunnel/enable',
      {},
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(composable.enablePassword.value).toBe('test-random-password-24ch')
    expect(composable.enableUsername.value).toBe('cbs_debug')
    expect(composable.viewState.value).toBe('connecting')
    expect(composable.canClose.value).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(composable.viewState.value).toBe('connected')
    expect(composable.canClose.value).toBe(true)
    expect(composable.observedStatus.value?.remote_port).toBe(30022)
    expect(composable.enablePassword.value).toBe('test-random-password-24ch')
  })

  it('returns to disconnected state when enable request fails', async () => {
    const enableError = Object.assign(new Error('Request failed with status code 404'), {
      response: { status: 404 }
    })

    getMock.mockResolvedValueOnce({
      data: createTunnelStatus({
        state: 'stopped',
        locked: true,
        remote_port: 29061
      })
    })
    postMock.mockResolvedValueOnce({}).mockRejectedValueOnce(enableError)

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    await expect(composable.enable()).rejects.toBe(enableError)
    await flushPromises()

    expect(composable.viewState.value).toBe('disconnected')
    expect(composable.canClose.value).toBe(true)
    expect(composable.state.value).toBe('disconnected')
    expect(composable.pollingError.value).toBe('host.tunnelApiUnavailable')
    expect(composable.observedStatus.value).toMatchObject({
      state: 'stopped',
      locked: true
    })
  })

  it('stops monitoring immediately when polled status request returns 404', async () => {
    const notFoundError = Object.assign(new Error('Request failed with status code 404'), {
      response: { status: 404 }
    })

    getMock
      .mockResolvedValueOnce({
        data: createTunnelStatus({
          state: 'connecting',
          remote_port: 0
        })
      })
      .mockRejectedValueOnce(notFoundError)

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.viewState.value).toBe('connecting')
    expect(composable.canClose.value).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(composable.viewState.value).toBe('disconnected')
    expect(composable.canClose.value).toBe(true)
    expect(composable.pollingError.value).toBe('host.tunnelApiUnavailable')
    expect(composable.observedStatus.value).toMatchObject({
      state: 'stopped',
      locked: true
    })
  })

  it('ignores stale polling results from a previous observed host', async () => {
    const staleRequest = createDeferred<{ data: ReturnType<typeof createTunnelStatus> }>()

    getMock.mockImplementation((url: string) => {
      if (url.includes('1.1.1.1')) {
        return staleRequest.promise
      }

      return Promise.resolve({
        data: createTunnelStatus({
          state: 'connected',
          server_addr: 'relay-b.vmosedge.com:22',
          remote_port: 20022
        })
      })
    })

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    composable.observe('2.2.2.2')
    await flushPromises()

    expect(composable.hostIp.value).toBe('2.2.2.2')
    expect(composable.state.value).toBe('connected')
    expect(composable.observedStatus.value?.server_addr).toBe('relay-b.vmosedge.com:22')

    staleRequest.resolve({
      data: createTunnelStatus({
        state: 'connected',
        server_addr: 'relay-a.vmosedge.com:22',
        remote_port: 10022
      })
    })
    await flushPromises()

    expect(composable.hostIp.value).toBe('2.2.2.2')
    expect(composable.observedStatus.value?.server_addr).toBe('relay-b.vmosedge.com:22')
    expect(composable.observedStatus.value?.remote_port).toBe(20022)
  })

  it('treats empty polled status payload as failure after connection monitoring starts', async () => {
    getMock
      .mockResolvedValueOnce({
        data: createTunnelStatus({
          state: 'connecting',
          remote_port: 0
        })
      })
      .mockResolvedValueOnce({
        data: {}
      })

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.state.value).toBe('connecting')
    expect(composable.canClose.value).toBe(true)

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    expect(composable.state.value).toBe('disconnected')
    expect(composable.canClose.value).toBe(true)
    expect(composable.observedStatus.value).toMatchObject({
      state: 'stopped',
      locked: true
    })
    expect(composable.pollingError.value).toBe('host.tunnelStatusInvalid')
  })

  it('accepts connecting status even when remote port is zero', async () => {
    getMock.mockResolvedValue({
      data: createTunnelStatus({
        state: 'connecting',
        remote_port: 0
      })
    })

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.state.value).toBe('connecting')
    expect(composable.viewState.value).toBe('connecting')
    expect(composable.canClose.value).toBe(true)
    expect(composable.observedStatus.value).toMatchObject({
      state: 'connecting',
      remote_port: 0
    })
    expect(composable.pollingError.value).toBeNull()
  })

  it('treats missing state as failure', async () => {
    getMock.mockResolvedValue({
      data: {
        locked: false,
        server_addr: 'tunnel.vmosedge.com:22',
        remote_port: 0,
        local_addr: '127.0.0.1:22',
        reconnect_count: 0
      }
    })

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    expect(composable.state.value).toBe('disconnected')
    expect(composable.observedStatus.value).toBeNull()
    expect(composable.pollingError.value).toBe('host.tunnelStatusInvalid')
  })

  it('clears password and username on disable', async () => {
    getMock
      .mockResolvedValueOnce({
        data: createTunnelStatus({ state: 'stopped', locked: false })
      })
      .mockResolvedValueOnce({
        data: createTunnelStatus({ state: 'connected', remote_port: 20022 })
      })
    postMock.mockResolvedValue(createEnableResponse())

    const composable = useTunnelConnection()

    composable.observe('1.1.1.1')
    await flushPromises()

    await composable.enable()
    await flushPromises()

    expect(composable.enablePassword.value).toBe('test-random-password-24ch')

    await vi.advanceTimersByTimeAsync(2_000)
    await flushPromises()

    postMock.mockResolvedValueOnce({})
    await composable.disable()
    await flushPromises()

    expect(composable.enablePassword.value).toBeNull()
    expect(composable.enableUsername.value).toBeNull()
  })
})
