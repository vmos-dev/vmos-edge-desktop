import { computed, onUnmounted, readonly, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { API_CONFIG, buildApiUrl, getErrorMessage, request } from '@shared/api'

// ---------- Types ----------

export interface TunnelStatusData {
  state: string
  locked: boolean
  server_addr: string
  remote_port: number
  local_addr: string
  connected_at?: string
  expires_at?: string
  last_error?: string
  reconnect_count: number
  uptime_seconds?: number
  username?: string
  session_expires?: string
  enable_count?: number
  last_enable_at?: string
}

export type TunnelPhase =
  | 'idle'
  | 'initializing'
  | 'initFailed'
  | 'ready'
  | 'enabling'
  | 'monitoring'
  | 'cancelling'
  | 'connected'
  | 'disabling'

export type TunnelUiState = 'disconnected' | 'connecting' | 'connected'
export type TunnelViewState = 'loading' | 'error' | 'disconnected' | 'connecting' | 'connected'

// ---------- Constants ----------

const POLL_INTERVAL_MS = 2000
const MAX_CONSECUTIVE_ERRORS = 3
const CONNECTING_TIMEOUT_MS = 30_000

const REMOTE_STATE = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  RECONNECTING: 'reconnecting',
  STOPPED: 'stopped'
} as const

// ---------- Pure helpers ----------

interface TunnelStatusParseResult {
  status: TunnelStatusData | null
  invalid: boolean
}

interface RequestContext {
  sessionId: number
  requestId: number
}

interface HttpErrorLike {
  response?: { status?: number }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const toOptionalString = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined)

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

const isNonNegativeNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0

const hasResponseStatus = (error: unknown, status: number): error is HttpErrorLike =>
  isRecord(error) && isRecord(error.response) && error.response.status === status

const parseTunnelStatus = (value: unknown): TunnelStatusParseResult => {
  if (!isRecord(value)) return { status: null, invalid: true }
  if (!isNonEmptyString(value.state)) return { status: null, invalid: true }

  return {
    invalid: false,
    status: {
      state: value.state,
      locked: typeof value.locked === 'boolean' ? value.locked : false,
      server_addr: typeof value.server_addr === 'string' ? value.server_addr : '',
      remote_port: isNonNegativeNumber(value.remote_port) ? value.remote_port : 0,
      local_addr: typeof value.local_addr === 'string' ? value.local_addr : '',
      connected_at: toOptionalString(value.connected_at),
      expires_at: toOptionalString(value.expires_at),
      last_error: toOptionalString(value.last_error),
      reconnect_count: isNonNegativeNumber(value.reconnect_count) ? value.reconnect_count : 0,
      uptime_seconds:
        typeof value.uptime_seconds === 'number' && Number.isFinite(value.uptime_seconds)
          ? value.uptime_seconds
          : undefined,
      username: toOptionalString(value.username),
      session_expires: toOptionalString(value.session_expires),
      enable_count: isNonNegativeNumber(value.enable_count) ? value.enable_count : undefined,
      last_enable_at: toOptionalString(value.last_enable_at)
    }
  }
}

// ---------- Composable ----------

export function useTunnelConnection() {
  const { t } = useI18n()

  // ── Source state ──

  const phase = shallowRef<TunnelPhase>('idle')
  const hostIp = shallowRef('')
  const observedStatus = ref<TunnelStatusData | null>(null)
  const pollingError = shallowRef<string | null>(null)
  const enablePassword = shallowRef<string | null>(null)
  const enableUsername = shallowRef<string | null>(null)

  // ── Derived state ──

  const state = computed<TunnelUiState>(() => {
    const s = observedStatus.value?.state
    if (s === REMOTE_STATE.CONNECTED) return 'connected'
    if (s === REMOTE_STATE.CONNECTING || s === REMOTE_STATE.RECONNECTING) return 'connecting'
    return 'disconnected'
  })

  const viewState = computed<TunnelViewState>(() => {
    switch (phase.value) {
      case 'initializing':
        return 'loading'
      case 'initFailed':
        return 'error'
      case 'enabling':
      case 'monitoring':
      case 'cancelling':
        return 'connecting'
      case 'connected':
      case 'disabling':
        return 'connected'
      default:
        return 'disconnected'
    }
  })

  const isOperating = computed(() => phase.value === 'enabling' || phase.value === 'disabling')
  const isCancelling = computed(() => phase.value === 'cancelling')
  const canClose = computed(() => !isOperating.value)

  // ── Private state ──

  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let consecutiveErrors = 0
  let connectingStartedAt = 0
  let observationSessionId = 0
  let latestRequestId = 0
  let activeAbortController: AbortController | null = null

  // ── Private helpers ──

  const abortActiveRequests = () => {
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
  }

  const clearPollTimer = () => {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  const resetPollingState = () => {
    clearPollTimer()
    consecutiveErrors = 0
    connectingStartedAt = 0
  }

  const isPollingPhase = () => phase.value === 'enabling' || phase.value === 'monitoring'

  const scheduleNextPoll = () => {
    if (pollTimer || !hostIp.value || !isPollingPhase()) return
    pollTimer = setTimeout(() => {
      pollTimer = null
      void pollConnectionStatus()
    }, POLL_INTERVAL_MS)
  }

  const createRequestContext = (): RequestContext => ({
    sessionId: observationSessionId,
    requestId: ++latestRequestId
  })

  const isActiveRequest = (ctx: RequestContext) =>
    ctx.sessionId === observationSessionId && ctx.requestId === latestRequestId

  const resolveTunnelRequestError = (
    error: unknown,
    defaultMessage = t('common.operationFailed')
  ) => {
    if (hasResponseStatus(error, 401)) return t('host.tunnelLanOnly')
    if (hasResponseStatus(error, 404)) return t('host.tunnelApiUnavailable')
    if (isRecord(error) && typeof error.data === 'string' && error.data.includes('unauthorized'))
      return t('host.tunnelLanOnly')
    return getErrorMessage(error, defaultMessage)
  }

  // ── API calls ──

  const fetchStatusOnce = async (): Promise<TunnelStatusParseResult> => {
    const url = buildApiUrl(hostIp.value, API_CONFIG.PATHS.TUNNEL_STATUS)
    const res = await request.get(url, undefined, { signal: activeAbortController?.signal })
    return parseTunnelStatus(res?.data)
  }

  const postDisableAndUnlock = async () => {
    const url = buildApiUrl(hostIp.value, API_CONFIG.PATHS.TUNNEL_DISABLE)
    await request.post(url, {})
    const unlockUrl = buildApiUrl(hostIp.value, API_CONFIG.PATHS.TUNNEL_UNLOCK)
    await request.post(unlockUrl, {}).catch(() => {})
  }

  // ── State transitions ──

  const applyDisconnectedSnapshot = (overrides: Partial<TunnelStatusData> = {}) => {
    const prev = observedStatus.value
    observedStatus.value = {
      ...prev,
      state: REMOTE_STATE.STOPPED,
      locked: true,
      server_addr: prev?.server_addr || '',
      remote_port: prev?.remote_port || 0,
      local_addr: prev?.local_addr || '',
      reconnect_count: prev?.reconnect_count || 0,
      ...overrides
    }
  }

  const transitionToReady = (error?: string) => {
    resetPollingState()
    applyDisconnectedSnapshot(error ? { last_error: error } : {})
    pollingError.value = error ?? null
    phase.value = 'ready'
  }

  const applyStatusSnapshot = (status: TunnelStatusData) => {
    observedStatus.value = status

    if (status.state === REMOTE_STATE.CONNECTED) {
      resetPollingState()
      pollingError.value = null
      phase.value = 'connected'
      return
    }

    if (status.state === REMOTE_STATE.CONNECTING || status.state === REMOTE_STATE.RECONNECTING) {
      if (phase.value === 'initializing') phase.value = 'monitoring'
      if (!connectingStartedAt) connectingStartedAt = Date.now()
      pollingError.value = null
      scheduleNextPoll()
      return
    }

    resetPollingState()
    pollingError.value = status.last_error || null
    phase.value = 'ready'
  }

  // ── Core async operations ──

  const loadStatusOnce = async () => {
    if (!hostIp.value) return
    const signal = activeAbortController?.signal
    const ctx = createRequestContext()
    try {
      const { status, invalid } = await fetchStatusOnce()
      if (signal?.aborted || !isActiveRequest(ctx)) return

      if (invalid) {
        phase.value = 'initFailed'
        observedStatus.value = null
        pollingError.value = t('host.tunnelStatusInvalid')
        return
      }

      if (!status) {
        phase.value = 'ready'
        return
      }

      applyStatusSnapshot(status)
    } catch (err) {
      if (signal?.aborted || !isActiveRequest(ctx)) return
      phase.value = 'initFailed'
      observedStatus.value = null
      pollingError.value = resolveTunnelRequestError(err, t('host.tunnelStatusLoadFailed'))
    }
  }

  const pollConnectionStatus = async () => {
    if (!hostIp.value || !isPollingPhase()) return
    const signal = activeAbortController?.signal
    const ctx = createRequestContext()
    try {
      const { status, invalid } = await fetchStatusOnce()
      if (signal?.aborted || !isActiveRequest(ctx)) return

      if (invalid) {
        transitionToReady(t('host.tunnelStatusInvalid'))
        return
      }

      if (!status) {
        transitionToReady()
        return
      }

      consecutiveErrors = 0

      if (status.state === REMOTE_STATE.CONNECTING || status.state === REMOTE_STATE.RECONNECTING) {
        observedStatus.value = status
        if (!connectingStartedAt) connectingStartedAt = Date.now()

        if (Date.now() - connectingStartedAt >= CONNECTING_TIMEOUT_MS) {
          transitionToReady(t('host.tunnelTimeout'))
          enablePassword.value = null
          enableUsername.value = null
          postDisableAndUnlock().catch(() => {})
          return
        }

        if (phase.value === 'enabling') phase.value = 'monitoring'
        pollingError.value = null
        scheduleNextPoll()
        return
      }

      applyStatusSnapshot(status)
    } catch (err) {
      if (signal?.aborted || !isActiveRequest(ctx)) return

      const msg = resolveTunnelRequestError(err)
      if (hasResponseStatus(err, 404)) {
        transitionToReady(msg)
        return
      }

      consecutiveErrors++
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        transitionToReady(msg)
        return
      }

      scheduleNextPoll()
    }
  }

  // ── Public API ──

  const observe = (ip: string) => {
    stopObserve()
    hostIp.value = ip
    phase.value = 'initializing'
    pollingError.value = null
    activeAbortController = new AbortController()
    const sessionId = observationSessionId
    void loadStatusOnce().finally(() => {
      if (observationSessionId === sessionId && phase.value === 'initializing') {
        phase.value = 'ready'
      }
    })
  }

  const retryObserve = async () => {
    if (!hostIp.value) return
    abortActiveRequests()
    activeAbortController = new AbortController()
    phase.value = 'initializing'
    pollingError.value = null
    const sessionId = observationSessionId
    await loadStatusOnce()
    if (observationSessionId === sessionId && phase.value === 'initializing') {
      phase.value = 'ready'
    }
  }

  const stopObserve = () => {
    observationSessionId += 1
    latestRequestId = 0
    abortActiveRequests()
    resetPollingState()
    phase.value = 'idle'
    observedStatus.value = null
    pollingError.value = null
    enablePassword.value = null
    enableUsername.value = null
  }

  const enable = async () => {
    if (isOperating.value || !hostIp.value) return

    phase.value = 'enabling'
    pollingError.value = null
    clearPollTimer()
    connectingStartedAt = Date.now()

    abortActiveRequests()
    activeAbortController = new AbortController()
    const { signal } = activeAbortController

    try {
      const snapshot = observedStatus.value
      if (snapshot?.locked) {
        await request.post(
          buildApiUrl(hostIp.value, API_CONFIG.PATHS.TUNNEL_UNLOCK),
          {},
          { signal }
        )
      }

      observedStatus.value = {
        state: REMOTE_STATE.CONNECTING,
        locked: false,
        server_addr: snapshot?.server_addr || '',
        remote_port: 0,
        local_addr: snapshot?.local_addr || '127.0.0.1:22',
        reconnect_count: snapshot?.reconnect_count || 0
      }

      const enableRes = await request.post(
        buildApiUrl(hostIp.value, API_CONFIG.PATHS.TUNNEL_ENABLE),
        {},
        { signal }
      )

      if (signal.aborted) return

      const enableData = enableRes?.data
      if (enableData) {
        enablePassword.value = typeof enableData.password === 'string' ? enableData.password : null
        enableUsername.value = typeof enableData.username === 'string' ? enableData.username : null
      }

      await pollConnectionStatus()
      if (phase.value === 'enabling') phase.value = 'monitoring'
    } catch (err) {
      if (signal.aborted) return
      transitionToReady(resolveTunnelRequestError(err))
      throw err
    }
  }

  const disable = async () => {
    if (isOperating.value || !hostIp.value) return

    phase.value = 'disabling'
    pollingError.value = null

    try {
      await postDisableAndUnlock()
      resetPollingState()
      applyDisconnectedSnapshot({ locked: false, last_error: undefined })
      enablePassword.value = null
      enableUsername.value = null
      phase.value = 'ready'
    } catch (err) {
      pollingError.value = resolveTunnelRequestError(err)
      phase.value = 'connected'
      throw err
    }
  }

  const cancelConnect = async () => {
    if (phase.value === 'cancelling' || !isPollingPhase() || !hostIp.value) return

    abortActiveRequests()
    clearPollTimer()
    phase.value = 'cancelling'

    try {
      await postDisableAndUnlock()
    } catch {}

    resetPollingState()
    applyDisconnectedSnapshot()
    enablePassword.value = null
    enableUsername.value = null
    phase.value = 'ready'
  }

  // ── Lifecycle ──

  onUnmounted(() => {
    stopObserve()
  })

  return {
    hostIp: readonly(hostIp),
    observedStatus: readonly(observedStatus),
    state,
    viewState,
    canClose,
    pollingError: readonly(pollingError),
    isOperating,
    isCancelling,
    enablePassword: readonly(enablePassword),
    enableUsername: readonly(enableUsername),
    retryObserve,
    observe,
    stopObserve,
    enable,
    disable,
    cancelConnect
  }
}
