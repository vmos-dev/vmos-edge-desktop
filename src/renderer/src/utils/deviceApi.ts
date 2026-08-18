import type { Device } from '@shared/ipc/data.types'

const DEVICE_SERVICE_PORT = 18185
const CONTROL_SERVICE_PORT = 18182

export type DeviceApiNamespace = 'ai' | 'ai_agent' | 'accessibility' | 'package'

export interface DeviceApiTarget {
  cacheKey: string
  mode: 'direct' | 'proxy'
  deviceId?: string
  deviceIp?: string
  hostIp?: string
}

type DeviceApiTargetInput = Device | DeviceApiTarget | null | undefined

interface DeviceApiError extends Error {
  responseCode?: number
  status?: number
}

const resolvedBaseCache = new Map<string, string>()

function isDeviceApiTarget(value: DeviceApiTargetInput): value is DeviceApiTarget {
  return Boolean(value && typeof value === 'object' && 'cacheKey' in value && 'mode' in value)
}

export function createDeviceApiTarget(device: Device | null | undefined): DeviceApiTarget | null {
  if (!device) return null

  const isMacvlan = device.network_mode === 'macvlan' || device.is_macvlan === true

  if (isMacvlan) {
    const deviceIp = device.ip?.trim()
    if (!deviceIp) return null
    return {
      cacheKey: `direct:${device.id}:${deviceIp}`,
      mode: 'direct',
      deviceId: device.id,
      deviceIp
    }
  }

  const hostIp = device.host_ip?.trim()
  const deviceId = device.id?.trim()
  if (!hostIp || !deviceId) return null

  return {
    cacheKey: `proxy:${deviceId}:${hostIp}`,
    mode: 'proxy',
    deviceId,
    hostIp
  }
}

function normalizeTarget(target: DeviceApiTargetInput): DeviceApiTarget | null {
  if (!target) return null
  return isDeviceApiTarget(target) ? target : createDeviceApiTarget(target)
}

function getNamespaceSegment(namespace: DeviceApiNamespace): string {
  switch (namespace) {
    case 'ai':
      return 'ai'
    case 'ai_agent':
      return 'ai_agent'
    case 'accessibility':
      return 'accessibility'
    case 'package':
      return 'package'
  }
}

function buildBaseCandidates(target: DeviceApiTarget, namespace: DeviceApiNamespace): string[] {
  const segment = getNamespaceSegment(namespace)

  if (target.mode === 'direct') {
    return [`http://${target.deviceIp}:${DEVICE_SERVICE_PORT}/api/${segment}`]
  }

  return [
    `http://${target.hostIp}:${CONTROL_SERVICE_PORT}/android_api/v2/${target.deviceId}/${segment}`
  ]
}

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  return `${normalizedBase}/${normalizedPath}`
}

function getCacheKey(target: DeviceApiTarget, namespace: DeviceApiNamespace): string {
  return `${target.cacheKey}:${namespace}`
}

function createError(message: string, extra: Partial<DeviceApiError> = {}): DeviceApiError {
  return Object.assign(new Error(message), extra)
}

export function isLikelyRouteError(error: unknown): boolean {
  const routeError = error as DeviceApiError | undefined
  const message = String(routeError?.message || '').toLowerCase()

  return (
    routeError?.status == null ||
    routeError?.status === 404 ||
    routeError?.status === 405 ||
    routeError?.responseCode === 404 ||
    message.includes('not found')
  )
}

async function fetchJson<T = unknown>(
  url: string,
  options: { method?: string; body?: Record<string, unknown> } = {}
): Promise<T> {
  const { method = 'POST', body } = options
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body)
  }

  const response = await fetch(url, init)

  const contentType = response.headers.get('content-type') || ''
  const raw = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message =
      typeof raw === 'string'
        ? raw || `Request failed (${response.status})`
        : raw?.msg || `Request failed (${response.status})`
    throw createError(message, { status: response.status })
  }

  if (typeof raw === 'string') {
    throw createError(raw || 'Invalid JSON response', { status: response.status })
  }

  if (Number(raw?.code) !== 200) {
    throw createError(raw?.msg || `Request failed (code: ${raw?.code ?? 'unknown'})`, {
      responseCode: Number(raw?.code || 0),
      status: response.status
    })
  }

  return raw.data as T
}

async function postJson<T = unknown>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  return fetchJson<T>(url, { method: 'POST', body })
}

async function getJson<T = unknown>(url: string): Promise<T> {
  return fetchJson<T>(url, { method: 'GET' })
}

export async function postDeviceModuleJson<T = unknown>(
  targetInput: DeviceApiTargetInput,
  namespace: DeviceApiNamespace,
  path: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const target = normalizeTarget(targetInput)
  if (!target) {
    throw createError('Device API target is unavailable')
  }

  const cacheKey = getCacheKey(target, namespace)
  const cachedBase = resolvedBaseCache.get(cacheKey)

  if (cachedBase) {
    try {
      return await postJson<T>(joinUrl(cachedBase, path), body)
    } catch (error) {
      if (!isLikelyRouteError(error)) throw error
      resolvedBaseCache.delete(cacheKey)
    }
  }

  const bases = buildBaseCandidates(target, namespace)
  let lastError: unknown

  for (const base of bases) {
    try {
      const data = await postJson<T>(joinUrl(base, path), body)
      resolvedBaseCache.set(cacheKey, base)
      return data
    } catch (error) {
      lastError = error
      if (!isLikelyRouteError(error)) break
    }
  }

  throw lastError instanceof Error ? lastError : createError('Device API request failed')
}

export async function getDeviceModuleJson<T = unknown>(
  targetInput: DeviceApiTargetInput,
  namespace: DeviceApiNamespace,
  path: string
): Promise<T> {
  const target = normalizeTarget(targetInput)
  if (!target) {
    throw createError('Device API target is unavailable')
  }

  const cacheKey = getCacheKey(target, namespace)
  const cachedBase = resolvedBaseCache.get(cacheKey)

  if (cachedBase) {
    try {
      return await getJson<T>(joinUrl(cachedBase, path))
    } catch (error) {
      if (!isLikelyRouteError(error)) throw error
      resolvedBaseCache.delete(cacheKey)
    }
  }

  const bases = buildBaseCandidates(target, namespace)
  let lastError: unknown

  for (const base of bases) {
    try {
      const data = await getJson<T>(joinUrl(base, path))
      resolvedBaseCache.set(cacheKey, base)
      return data
    } catch (error) {
      lastError = error
      if (!isLikelyRouteError(error)) break
    }
  }

  throw lastError instanceof Error ? lastError : createError('Device API request failed')
}

export function buildDeviceModuleUrl(
  targetInput: DeviceApiTargetInput,
  namespace: DeviceApiNamespace,
  path: string
): string {
  const target = normalizeTarget(targetInput)
  if (!target) {
    throw createError('Device API target is unavailable')
  }

  const cacheKey = getCacheKey(target, namespace)
  const preferredBase = resolvedBaseCache.get(cacheKey) || buildBaseCandidates(target, namespace)[0]

  return joinUrl(preferredBase, path)
}
