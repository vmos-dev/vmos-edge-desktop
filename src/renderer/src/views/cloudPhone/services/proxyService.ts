import { toRaw } from 'vue'
import { ElMessage } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { parseCoordinate } from '@renderer/utils'
import { request, buildApiUrl, API_CONFIG, getErrorMessage } from '@shared/api'
import { CONFIG_KEYS } from '@shared/constant'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { DATA_EVENTS, type Device, type Proxy } from '@shared/ipc/data.types'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import { parseUri } from '@vmosedge/proxy-sdk/parser'
import { languages } from '../data/languages'
import type {
  ParsedProxyResult,
  CustomProxyFormModel
} from '@renderer/components/proxy/customProxyTypes'

export interface ProxyFormModel {
  id: string
  dnsOverProxyDisabled: boolean
  udpDisabled: boolean
  ipSimulatorDisabled: boolean
  isTransferAgent: boolean
  transferAgentId: string
  engineType: number
}

export interface CurrentProxyInfo {
  engineType: number
  proxyType: string
  host: string
  port: string | number
  proxyHash: string
  nodes: Array<Record<string, any>>
}

export interface ApplyProxyResult {
  countryChanged: boolean
  restarted: boolean
  message: string
}

export interface ApplyProxyOptions {
  device: Device
  form: ProxyFormModel
  proxyList: Proxy[]
  parseConfigFailedMessage: string
  successMessage: string
  restartMessage: string
  restartFailedMessage: string
  autoRestartOnCountryChange?: boolean
  ipSimulatorMode?: 'api' | 'custom-params'
  extraDataKey?: string
  isRestart?: boolean
}

export interface BuildProxyPayloadOptions {
  ipSimulatorMode?: 'api' | 'custom-params'
  extraDataKey?: string
  isRestart?: boolean
}

const proxyNameMap: Record<string, string> = {
  vmess: 'vmess',
  ss: 'shadowsocks',
  ssr: 'shadowsocksr',
  vless: 'vless'
}

export const createDefaultProxyForm = (): ProxyFormModel => ({
  id: '',
  dnsOverProxyDisabled: true,
  udpDisabled: true,
  ipSimulatorDisabled: true,
  isTransferAgent: false,
  transferAgentId: '',
  engineType: 0
})

export const createEmptyCurrentProxy = (): CurrentProxyInfo => ({
  engineType: 0,
  proxyType: '',
  host: '',
  port: '',
  proxyHash: '',
  nodes: []
})

const DEFAULT_EXTRA_DATA_KEY = 'extraData'

const getProxyById = (proxyList: Proxy[], id: string) => proxyList.find((item) => item.id === id)

const mergeConfig = (
  params: Record<string, any>,
  rawLink: string | undefined,
  parseConfigFailedMessage: string
) => {
  if (!rawLink) return params

  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(rawLink)) {
    try {
      const config = parseUri(rawLink)
      return { ...params, ...config }
    } catch {
      throw new Error(parseConfigFailedMessage)
    }
  }

  try {
    return {
      ...params,
      ...JSON.parse(rawLink)
    }
  } catch {
    throw new Error(parseConfigFailedMessage)
  }
}

interface ProxyIdentitySource {
  protocol: string
  host: string
  port: string | number
  username?: string
  password?: string
  rawLink?: string
}

/**
 * 代理的稳定身份串，作为 proxyHash 的唯一输入。
 * link 类协议（vmess/ss/ssr/vless）用真实 rawLink；传统协议（http/https/socks5）无 rawLink，
 * 按需合成一个标准 URI（含账号密码，保证同服务器多账号也唯一）。不落库，两端共用保证一致。
 */
export const proxyIdentity = (proxy: ProxyIdentitySource): string =>
  proxy.rawLink ||
  `${proxy.protocol}://${proxy.username || ''}:${proxy.password || ''}@${proxy.host}:${proxy.port}`

/**
 * 对身份串算一个稳定指纹，下发时注入到 payload、回显时反查匹配。
 * FNV-1a 32 位：确定性、跨版本稳定、同步、零依赖。
 */
export const computeProxyHash = (identity: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < identity.length; i++) {
    hash ^= identity.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

const buildProxyConfig = (proxyItem: Proxy, parseConfigFailedMessage: string) => {
  const config: Record<string, any> = {
    ip: proxyItem.host,
    port: proxyItem.port,
    proxyName: proxyItem.protocol
  }
  // 全协议都算指纹，供回显反查代理名
  const proxyHash = computeProxyHash(proxyIdentity(proxyItem))

  if (['http', 'https', 'socks5'].includes(proxyItem.protocol)) {
    config.account = proxyItem.username
    config.password = proxyItem.password
    config.proxyHash = proxyHash
    return config
  }

  const proxyName = proxyNameMap[proxyItem.protocol]
  if (proxyName && proxyItem.rawLink) {
    config.proxyName = proxyName
    Object.assign(config, mergeConfig({}, proxyItem.rawLink, parseConfigFailedMessage))
  }
  // 放在 mergeConfig 之后，避免被解析结果覆盖
  config.proxyHash = proxyHash

  return config
}

export const buildProxyPayload = (
  form: ProxyFormModel,
  proxyList: Proxy[],
  parseConfigFailedMessage: string,
  options: BuildProxyPayloadOptions = {}
) => {
  const proxy = getProxyById(proxyList, form.id)

  if (!proxy) {
    throw new Error(parseConfigFailedMessage)
  }

  const transferAgent = form.transferAgentId
    ? getProxyById(proxyList, form.transferAgentId)
    : undefined

  const params: Record<string, any> = {
    dnsOverProxyDisabled: !form.dnsOverProxyDisabled,
    udpDisabled: !form.udpDisabled,
    engineType: Number(form.engineType || 0),
    ip: proxy.host,
    port: proxy.port,
    proxyType: 'proxy',
    proxyName: proxy.protocol,
    nodes: []
  }

  if (transferAgent) {
    params.nodes.push(buildProxyConfig(transferAgent, parseConfigFailedMessage))
  }

  if (['http', 'https', 'socks5'].includes(proxy.protocol)) {
    params.account = proxy.username
    params.password = proxy.password
  } else {
    const proxyName = proxyNameMap[proxy.protocol]
    if (proxyName && proxy.rawLink) {
      params.proxyName = proxyName
      Object.assign(params, mergeConfig({}, proxy.rawLink, parseConfigFailedMessage))
    }
  }

  // 外层 = 出口代理，注入其指纹（放在 mergeConfig 之后，避免被覆盖）
  params.proxyHash = computeProxyHash(proxyIdentity(proxy))

  params.nodes.push(buildProxyConfig(proxy, parseConfigFailedMessage))

  if (options.ipSimulatorMode === 'custom-params') {
    const isIpSimulatorEnabled = !!form.ipSimulatorDisabled

    if (isIpSimulatorEnabled) {
      const language = proxy.country
        ? languages.find((item) => item.countryCode === proxy.country)?.languageCode
        : undefined
      const coordinate = proxy.loc ? parseCoordinate(proxy.loc, 'latlng') : undefined

      params[options.extraDataKey || DEFAULT_EXTRA_DATA_KEY] = {
        enabled: true,
        country: proxy.country,
        language,
        timezone: proxy.timezone,
        longitude: coordinate?.longitude,
        latitude: coordinate?.latitude,
        isRestart: options.isRestart ?? false
      }
    } else {
      // 关闭 IP 仿真时也要显式下发 enabled:false 通知设备关闭仿真（isRestart 强制 false）
      params[options.extraDataKey || DEFAULT_EXTRA_DATA_KEY] = {
        enabled: false,
        isRestart: false
      }
    }
  }

  return {
    params,
    proxy
  }
}

const syncDeviceLocationAndLocale = async (device: Device, proxy: Proxy) => {
  const countryLanguageTimezoneRes = await request.get(
    buildApiUrl(
      device.host_ip || '',
      `${API_CONFIG.PATHS.GET_DEVICE_COUNTRY_LANGUAGE_TIMEZONE}/${device.db_id || ''}`
    )
  )

  const currentCountry = countryLanguageTimezoneRes?.data?.country
  const currentTimezone = countryLanguageTimezoneRes?.data?.timezone
  const proxyCountry = proxy.country
  const proxyTimezone = proxy.timezone
  const proxyLoc = proxy.loc

  const countryChanged = !!proxyCountry && proxyCountry !== currentCountry

  if (countryChanged) {
    await request.post(
      buildApiUrl(
        device.host_ip || '',
        `${API_CONFIG.PATHS.SET_DEVICE_COUNTRY}/${device.db_id || ''}`
      ),
      {
        country: proxyCountry
      },
      {
        timeout: 20 * 1000
      }
    )
  }

  if (proxyCountry) {
    const language = languages.find((item) => item.countryCode === proxyCountry)
    if (language) {
      await request.post(
        buildApiUrl(
          device.host_ip || '',
          `${API_CONFIG.PATHS.SET_DEVICE_LANGUAGE}/${device.db_id || ''}`
        ),
        {
          country: proxyCountry,
          language: language.languageCode
        },
        {
          timeout: 20 * 1000
        }
      )
    }
  }

  if (proxyTimezone && proxyTimezone !== currentTimezone) {
    await request.post(
      buildApiUrl(
        device.host_ip || '',
        `${API_CONFIG.PATHS.SET_DEVICE_TIMEZONE}/${device.db_id || ''}`
      ),
      {
        timezone: proxyTimezone
      },
      {
        timeout: 20 * 1000
      }
    )
  }

  if (proxyLoc) {
    const { longitude, latitude } = parseCoordinate(proxyLoc, 'latlng')
    await request.post(
      buildApiUrl(
        device.host_ip || '',
        `${API_CONFIG.PATHS.SET_DEVICE_LOCATION}/${device.db_id || ''}`
      ),
      {
        longitude,
        latitude
      },
      {
        timeout: 20 * 1000
      }
    )
  }

  return {
    countryChanged
  }
}

export const restartCloudPhone = async (device: Device, restartFailedMessage: string) => {
  const res = await ipc.invoke<{
    restartedDevices: Device[]
    failedDevices: Device[]
  }>(DATA_EVENTS.DEVICE_RESTARTED, [toRaw(device)])

  if (!res.success) {
    throw new Error(getErrorMessage(res.error) || restartFailedMessage)
  }
}

export const fetchProxyList = async () => {
  const res = await ipc.invoke<Proxy[]>(PROXY_EVENTS.GET_PROXIES)
  if (!res.success) {
    throw new Error(res.error || 'Failed to load proxies')
  }

  return res.data || []
}

export const fetchProxyCheckStrategy = async () => {
  const res = await ipc.invoke<string>(
    CONFIG_EVENTS.GET_CONFIGS,
    CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE
  )
  if (!res.success) {
    throw new Error(res.error || 'Failed to load proxy check strategy')
  }

  return res.data || 'default'
}

export const updateProxyCheckStrategy = async (value: string) => {
  const res = await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
    key: CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE,
    value
  })

  if (!res.success) {
    throw new Error(res.error || 'Failed to update proxy check strategy')
  }
}

export const fetchCloudPhoneProxy = async (device: Device): Promise<CurrentProxyInfo> => {
  const res = await request.get(
    buildApiUrl(
      device.host_ip || '',
      `${API_CONFIG.PATHS.GET_CLOUD_PHONE_PROXY}/${device.db_id || ''}`
    )
  )

  const proxy = res?.data?.proxy_config || {}

  return {
    engineType: Number(res?.data?.engineType ?? 0),
    proxyType: proxy?.proxyType || '',
    host: proxy?.ip ?? '',
    port: proxy?.port ?? '',
    // 外层 = 出口代理指纹，回显时据此反查出口代理名
    proxyHash: proxy?.proxyHash ?? '',
    nodes: proxy?.nodes ?? []
  }
}

export const closeProxyForDevice = async (device: Device, successMessage: string) => {
  await request.get(
    buildApiUrl(device.host_ip || '', `${API_CONFIG.PATHS.CLOSE_PROXY}/${device.db_id || ''}`)
  )

  return {
    message: successMessage
  }
}

export const applyProxyToDevice = async ({
  device,
  form,
  proxyList,
  parseConfigFailedMessage,
  successMessage,
  restartMessage,
  restartFailedMessage,
  autoRestartOnCountryChange = false,
  ipSimulatorMode = 'api',
  extraDataKey = DEFAULT_EXTRA_DATA_KEY,
  isRestart
}: ApplyProxyOptions): Promise<ApplyProxyResult> => {
  const { params, proxy } = buildProxyPayload(form, proxyList, parseConfigFailedMessage, {
    ipSimulatorMode,
    extraDataKey,
    isRestart
  })

  await request.post(
    buildApiUrl(device.host_ip || '', `${API_CONFIG.PATHS.SET_PROXY}/${device.db_id || ''}`),
    params,
    {
      timeout: 2 * 60 * 1000
    }
  )

  let countryChanged = false
  if (ipSimulatorMode === 'api' && form.ipSimulatorDisabled) {
    const syncResult = await syncDeviceLocationAndLocale(device, proxy)
    countryChanged = syncResult.countryChanged
  }

  let restarted = false
  if (countryChanged && autoRestartOnCountryChange) {
    await restartCloudPhone(device, restartFailedMessage)
    restarted = true
  }

  return {
    countryChanged,
    restarted,
    message: restarted ? restartMessage : successMessage
  }
}

export const checkCustomProxy = async (
  parsed: ParsedProxyResult,
  form?: ProxyFormModel,
  proxyList?: Proxy[]
) => {
  const proxies: Array<Record<string, any>> = []

  // 中转代理（如启用，从 proxyList 查找）
  if (form?.isTransferAgent && form.transferAgentId && proxyList) {
    const transferAgent = proxyList.find((item) => item.id === form.transferAgentId)
    if (transferAgent) {
      proxies.push({
        protocol: transferAgent.protocol,
        host: transferAgent.host,
        port: transferAgent.port,
        username: transferAgent.username || undefined,
        password: transferAgent.password || undefined,
        rawLink: transferAgent.rawLink || undefined
      })
    }
  }

  // 主代理（来自解析结果）
  proxies.push({
    protocol: parsed.protocol,
    host: parsed.host,
    port: parsed.port,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    rawLink: parsed.rawLink || undefined
  })

  return ipc.invoke<any>(PROXY_EVENTS.CHECK_PROXY, proxies.length > 1 ? proxies : proxies[0])
}

export interface CustomProxyCheckResult {
  success: boolean
  data?: Record<string, any>
  error?: string
}

export const runCustomProxyCheck = async (
  parsed: ParsedProxyResult,
  form?: ProxyFormModel,
  proxyList?: Proxy[]
): Promise<CustomProxyCheckResult> => {
  const res = await checkCustomProxy(parsed, form, proxyList)
  if (res.success) {
    return { success: true, data: res.data?.data || {} }
  }
  return { success: false, error: res.error || 'check failed' }
}

export const saveCustomProxyWithToast = (
  customForm: CustomProxyFormModel,
  parsed: ParsedProxyResult,
  warningMessage: string
) => {
  saveCustomProxy(customForm, parsed).catch(() => {
    ElMessage.warning(warningMessage)
  })
}

export const saveCustomProxy = async (
  customForm: CustomProxyFormModel,
  parsed: ParsedProxyResult
) => {
  const proxyData = {
    name: customForm.name || `${parsed.protocol}-${parsed.host}-${parsed.port}`,
    protocol: parsed.protocol,
    host: parsed.host,
    port: parsed.port,
    username: parsed.username,
    password: parsed.password,
    rawLink: parsed.rawLink
  }
  return ipc.invoke(PROXY_EVENTS.ADD_PROXY, proxyData)
}

export const buildCustomProxyPayload = (
  parsed: ParsedProxyResult,
  form: ProxyFormModel,
  proxyInfo: Record<string, any> | null,
  options: BuildProxyPayloadOptions = {},
  parseConfigFailedMessage = 'parse config failed',
  proxyList?: Proxy[]
) => {
  const params: Record<string, any> = {
    dnsOverProxyDisabled: !form.dnsOverProxyDisabled,
    udpDisabled: !form.udpDisabled,
    engineType: Number(form.engineType || 0),
    ip: parsed.host,
    port: parsed.port,
    proxyType: 'proxy',
    proxyName: parsed.protocol,
    nodes: []
  }

  if (['http', 'https', 'socks5'].includes(parsed.protocol)) {
    params.account = parsed.username
    params.password = parsed.password
  } else {
    const name = proxyNameMap[parsed.protocol]
    if (name && parsed.rawLink) {
      params.proxyName = name
      Object.assign(params, mergeConfig({}, parsed.rawLink, parseConfigFailedMessage))
    }
  }

  // 外层 = 出口代理，注入其指纹（放在 mergeConfig 之后，避免被覆盖）
  params.proxyHash = computeProxyHash(proxyIdentity(parsed))

  // 中转代理节点（如启用，从 proxyList 查找）
  if (form.isTransferAgent && form.transferAgentId && proxyList) {
    const transferAgent = proxyList.find((item) => item.id === form.transferAgentId)
    if (transferAgent) {
      params.nodes.push(buildProxyConfig(transferAgent, parseConfigFailedMessage))
    }
  }

  // 主代理节点
  params.nodes.push(
    buildProxyConfig(
      {
        id: '',
        name: '',
        protocol: parsed.protocol,
        host: parsed.host,
        port: parsed.port,
        username: parsed.username,
        password: parsed.password,
        rawLink: parsed.rawLink,
        lastCheckStatus: 'success',
        createTime: 0
      } as Proxy,
      parseConfigFailedMessage
    )
  )

  // IP 仿真
  if (options.ipSimulatorMode === 'custom-params' && form.ipSimulatorDisabled && proxyInfo) {
    const language = proxyInfo.country
      ? languages.find((item) => item.countryCode === proxyInfo.country)?.languageCode
      : undefined
    const coordinate = proxyInfo.loc ? parseCoordinate(proxyInfo.loc, 'latlng') : undefined

    params[options.extraDataKey || DEFAULT_EXTRA_DATA_KEY] = {
      enabled: true,
      country: proxyInfo.country,
      language,
      timezone: proxyInfo.timezone,
      longitude: coordinate?.longitude,
      latitude: coordinate?.latitude,
      isRestart: options.isRestart ?? false
    }
  }

  return params
}
