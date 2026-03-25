import { ipc } from '@renderer/core/ipc'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'

const IMAGE_VERSION_PREFIX = 'vcloud_android'
const CACHE_TTL_MS = 30 * 60 * 1000

const RELEASE_HISTORY_URL_MAP = {
  zh: 'https://help.vmosedge.com/zh/productupdates/image-release-history.html',
  en: 'https://help.vmosedge.com/en/productupdates/image-release-history.html'
} as const

const MODULE_PATH_MARKER_MAP = {
  zh: '/assets/zh_productupdates_image-release-history.md.',
  en: '/assets/en_productupdates_image-release-history.md.'
} as const

const CLIENT_PLATFORM_ORDER = ['windows', 'mac', 'linux'] as const
type ClientPlatform = (typeof CLIENT_PLATFORM_ORDER)[number]
type ReleaseLocale = keyof typeof RELEASE_HISTORY_URL_MAP

interface ClientReleaseInfo {
  platform: ClientPlatform
  version: string
  sectionTitle: string
  sectionHtml: string
}

interface CbsReleaseInfo {
  platform: string
  version: string
  sectionTitle: string
}

interface ImageReleaseInfo {
  androidVersion: string
  imageVersion: string
  sectionTitle: string
}

interface LatestReleaseInfo {
  clients: ClientReleaseInfo[]
  cbs: CbsReleaseInfo[]
  images: ImageReleaseInfo[]
  updateLogHtml: string
  updateLogSectionTitle: string
}

export interface VersionCheckCache {
  fetchedAt: number
  locale: ReleaseLocale
  sourceUrl: string
  moduleUrl: string
  latest: LatestReleaseInfo
}

export interface DesktopReleaseUpdateInfo {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  sectionHtml: string
  sourceUrl: string
}

export interface VersionCheckSummary {
  fetchedAt: number
  sourceUrl: string
  updateLogSectionTitle: string
  clients: Array<Omit<ClientReleaseInfo, 'sectionHtml'>>
  cbs: CbsReleaseInfo[]
  images: ImageReleaseInfo[]
}

export interface VersionCheckResult extends DesktopReleaseUpdateInfo {
  platform: ClientPlatform | ''
  cacheSource: 'disk' | 'network' | 'fallback-disk'
  summary: VersionCheckSummary
}

interface ReleaseRequestConfig {
  locale: ReleaseLocale
  sourceUrl: string
  modulePathMarker: string
}

const resolveReleaseLocale = (appLocale?: string): ReleaseLocale => {
  const normalized = (appLocale || '').toLowerCase()
  if (normalized.startsWith('en')) {
    return 'en'
  }
  return 'zh'
}

const buildReleaseRequestConfig = (appLocale?: string): ReleaseRequestConfig => {
  const locale = resolveReleaseLocale(appLocale)
  return {
    locale,
    sourceUrl: RELEASE_HISTORY_URL_MAP[locale],
    modulePathMarker: MODULE_PATH_MARKER_MAP[locale]
  }
}

const isDigit = (char: string): boolean => char >= '0' && char <= '9'

const isLowerLetter = (char: string): boolean => char >= 'a' && char <= 'z'

const isAlphaNumUnderscore = (char: string): boolean =>
  isDigit(char) || isLowerLetter(char) || char === '_'

const normalizeText = (text: string): string => text.replaceAll('\u200b', '').trim()

const includesAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword))

const splitByWhitespace = (text: string): string[] => {
  const tokens: string[] = []
  let current = ''

  for (const char of text) {
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += char
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

const extractDottedVersions = (text: string, minParts: number, maxParts: number): string[] => {
  const versions = new Set<string>()
  let index = 0
  const source = text || ''

  while (index < source.length) {
    while (index < source.length && !isDigit(source[index])) {
      index++
    }
    if (index >= source.length) break

    const start = index
    const parts: string[] = []
    let cursor = index

    while (cursor < source.length) {
      let part = ''
      while (cursor < source.length && isDigit(source[cursor])) {
        part += source[cursor]
        cursor++
      }

      if (!part) break
      parts.push(part)

      if (cursor < source.length && source[cursor] === '.') {
        cursor++
        continue
      }
      break
    }

    if (parts.length >= minParts && parts.length <= maxParts) {
      versions.add(parts.join('.'))
    }

    index = start + 1
  }

  return Array.from(versions)
}

const compareDottedVersion = (left: string, right: string): number => {
  const leftParts = left.split('.').map((item) => Number.parseInt(item, 10) || 0)
  const rightParts = right.split('.').map((item) => Number.parseInt(item, 10) || 0)
  const maxLength = leftParts.length > rightParts.length ? leftParts.length : rightParts.length

  for (let i = 0; i < maxLength; i++) {
    const leftValue = leftParts[i] || 0
    const rightValue = rightParts[i] || 0
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1
    }
  }

  return 0
}

const extractMaxVersionFromText = (text: string, minParts: number, maxParts: number): string => {
  let maxVersion = ''
  for (const version of extractDottedVersions(text, minParts, maxParts)) {
    if (compareDottedVersion(version, maxVersion) > 0) {
      maxVersion = version
    }
  }
  return maxVersion
}

const extractImageVersionTokens = (text: string): string[] => {
  const tokens = new Set<string>()
  const source = text || ''
  const lower = source.toLowerCase()
  let index = 0

  while (index < lower.length) {
    const foundIndex = lower.indexOf(IMAGE_VERSION_PREFIX, index)
    if (foundIndex < 0) break

    let end = foundIndex + IMAGE_VERSION_PREFIX.length
    while (end < lower.length && isAlphaNumUnderscore(lower[end])) {
      end++
    }

    const token = source.slice(foundIndex, end)
    if (token) {
      tokens.add(token)
    }

    index = end
  }

  return Array.from(tokens)
}

const extractAndroidVersionFromText = (text: string): string => {
  const source = (text || '').toLowerCase()
  const labelIndex = source.indexOf('android')
  if (labelIndex < 0) return ''

  let index = labelIndex + 'android'.length
  while (index < source.length && !isDigit(source[index])) {
    index++
  }

  let version = ''
  while (index < source.length && isDigit(source[index])) {
    version += source[index]
    index++
  }

  return version
}

const extractAndroidVersionFromImageToken = (imageVersion: string): string => {
  const source = imageVersion.toLowerCase()
  const labelIndex = source.indexOf(IMAGE_VERSION_PREFIX)
  if (labelIndex < 0) return ''

  let index = labelIndex + IMAGE_VERSION_PREFIX.length
  let version = ''

  while (index < source.length && isDigit(source[index])) {
    version += source[index]
    index++
  }

  return version
}

const sanitizeHtml = (rawHtml: string): string => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${rawHtml}</div>`, 'text/html')
  const wrapper = doc.body.firstElementChild as HTMLElement | null
  if (!wrapper) return ''

  wrapper
    .querySelectorAll('script,style,iframe,object,embed,link,meta,base')
    .forEach((element) => element.remove())

  wrapper.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
        continue
      }

      if ((name === 'href' || name === 'src') && value.toLowerCase().startsWith('javascript:')) {
        element.removeAttribute(attribute.name)
      }
    }

    if (element.tagName.toLowerCase() === 'a') {
      element.setAttribute('target', '_blank')
      const rel = element.getAttribute('rel') || ''
      const relTokens = new Set(splitByWhitespace(rel))
      relTokens.add('noopener')
      relTokens.add('noreferrer')
      element.setAttribute('rel', Array.from(relTokens).join(' '))
    }
  })

  return wrapper.innerHTML
}

const extractCellTexts = (row: Element): string[] =>
  Array.from(row.querySelectorAll('th,td')).map((cell) => normalizeText(cell.textContent || ''))

const findColumnIndex = (headers: string[], keywords: string[]): number => {
  for (let index = 0; index < headers.length; index++) {
    const text = headers[index].toLowerCase()
    if (includesAny(text, keywords)) {
      return index
    }
  }
  return -1
}

const detectClientPlatform = (text: string): ClientPlatform | '' => {
  const lower = text.toLowerCase()
  if (includesAny(lower, ['windows', 'win'])) {
    return 'windows'
  }
  if (includesAny(lower, ['mac', 'apple', '苹果'])) {
    return 'mac'
  }
  if (includesAny(lower, ['linux'])) {
    return 'linux'
  }
  return ''
}

const isClientRow = (moduleText: string, rowText: string): boolean => {
  const lower = `${moduleText} ${rowText}`.toLowerCase()
  const hasClientKeyword = includesAny(lower, ['客户端', 'pc客户端', 'desktop'])
  const hasPlatformKeyword = includesAny(lower, ['windows', 'mac', 'linux'])
  const hasExcludedKeyword = includesAny(lower, ['cbs', '镜像', '内核', 'kernel'])
  return !hasExcludedKeyword && (hasClientKeyword || hasPlatformKeyword)
}

const isCbsRow = (moduleText: string, rowText: string): boolean => {
  const lower = `${moduleText} ${rowText}`.toLowerCase()
  return includesAny(lower, ['cbs'])
}

const createSectionNode = (heading: Element): HTMLElement => {
  const doc = heading.ownerDocument
  const sectionRoot = doc.createElement('div')
  let current: Element | null = heading

  while (current) {
    const tagName = current.tagName.toLowerCase()
    if (current !== heading && (tagName === 'h3' || tagName === 'h2')) {
      break
    }
    sectionRoot.appendChild(current.cloneNode(true))
    current = current.nextElementSibling
  }

  return sectionRoot
}

const extractModuleUrlFromPage = (
  pageHtml: string,
  modulePathMarker: string,
  sourceUrl: string
): string => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(pageHtml, 'text/html')
  const nodes = Array.from(doc.querySelectorAll('script[src],link[href]'))

  let leanUrl = ''
  let directUrl = ''

  for (const node of nodes) {
    const rawUrl = node.getAttribute('src') || node.getAttribute('href') || ''
    const lowerUrl = rawUrl.toLowerCase()

    if (!lowerUrl.includes(modulePathMarker)) continue
    if (!lowerUrl.endsWith('.js')) continue

    const absolute = new URL(rawUrl, sourceUrl).toString()
    if (lowerUrl.endsWith('.lean.js')) {
      leanUrl = absolute
      continue
    }
    directUrl = absolute
  }

  if (leanUrl) {
    return leanUrl.replace('.lean.js', '.js')
  }

  return directUrl
}

const extractStaticHtmlFromModuleCode = (moduleCode: string): string => {
  const marker = "a('"
  const startIndex = moduleCode.indexOf(marker)
  if (startIndex < 0) return ''

  let index = startIndex + marker.length
  let html = ''

  while (index < moduleCode.length) {
    const char = moduleCode[index]

    if (char === '\\') {
      const next = moduleCode[index + 1]
      if (!next) break

      if (next === 'n') {
        html += '\n'
        index += 2
        continue
      }
      if (next === 'r') {
        html += '\r'
        index += 2
        continue
      }
      if (next === 't') {
        html += '\t'
        index += 2
        continue
      }
      if (next === 'b') {
        html += '\b'
        index += 2
        continue
      }
      if (next === 'f') {
        html += '\f'
        index += 2
        continue
      }
      if (next === 'u') {
        const hex = moduleCode.slice(index + 2, index + 6)
        if (hex.length === 4 && !Number.isNaN(Number.parseInt(hex, 16))) {
          html += String.fromCharCode(Number.parseInt(hex, 16))
          index += 6
          continue
        }
      }

      html += next
      index += 2
      continue
    }

    if (char === "'") break

    html += char
    index++
  }

  return html
}

const parseLatestReleaseInfo = (fullHtml: string): LatestReleaseInfo => {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${fullHtml}</div>`, 'text/html')
  const root = doc.body.firstElementChild

  const clientMap = new Map<ClientPlatform, ClientReleaseInfo>()
  const cbsList: CbsReleaseInfo[] = []
  const imageMap = new Map<string, ImageReleaseInfo>()
  let updateLogHtml = ''
  let updateLogSectionTitle = ''

  if (!root) {
    return {
      clients: [],
      cbs: [],
      images: [],
      updateLogHtml,
      updateLogSectionTitle
    }
  }

  const headings = Array.from(root.querySelectorAll('h3'))
  for (const heading of headings) {
    const sectionTitle = normalizeText(heading.textContent || '')
    if (!sectionTitle) continue

    const sectionNode = createSectionNode(heading)
    const sectionHtml = sanitizeHtml(sectionNode.innerHTML)
    let sectionHasInfo = false

    const tables = Array.from(sectionNode.querySelectorAll('table'))
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'))
      if (rows.length <= 1) continue

      const headers = extractCellTexts(rows[0])
      const moduleIndex = findColumnIndex(headers, ['更新模块', '模块', 'module'])
      const platformIndex = findColumnIndex(headers, ['平台', '架构', 'platform'])
      const versionIndex = findColumnIndex(headers, ['更新版本', '版本', 'version'])
      const androidIndex = findColumnIndex(headers, ['android 版本', 'android版本', 'android'])
      const imageVersionIndex = findColumnIndex(headers, ['镜像版本', 'image'])

      for (const row of rows.slice(1)) {
        const cells = extractCellTexts(row)
        if (!cells.length) continue

        const moduleText = moduleIndex >= 0 ? cells[moduleIndex] || '' : cells[0] || ''
        const platformText = platformIndex >= 0 ? cells[platformIndex] || '' : ''
        const rowText = normalizeText(cells.join(' '))
        const linksText = Array.from(row.querySelectorAll('a[href]'))
          .map((anchor) => anchor.getAttribute('href') || '')
          .join(' ')

        if (isClientRow(moduleText, rowText)) {
          const platform = detectClientPlatform(`${moduleText} ${platformText} ${rowText}`)
          if (!platform || clientMap.has(platform)) {
            continue
          }

          const versionCell = versionIndex >= 0 ? cells[versionIndex] || '' : ''
          let version = extractMaxVersionFromText(versionCell, 3, 3)
          if (!version) {
            version = extractMaxVersionFromText(linksText, 3, 3)
          }
          if (!version) {
            version = extractMaxVersionFromText(rowText, 3, 3)
          }
          if (!version) {
            continue
          }

          clientMap.set(platform, {
            platform,
            version,
            sectionTitle,
            sectionHtml
          })
          sectionHasInfo = true
          continue
        }

        if (isCbsRow(moduleText, rowText)) {
          const versionCell = versionIndex >= 0 ? cells[versionIndex] || '' : ''
          let version = extractMaxVersionFromText(versionCell, 3, 8)
          if (!version) {
            version = extractMaxVersionFromText(linksText, 3, 8)
          }
          if (!version) {
            version = extractMaxVersionFromText(rowText, 3, 8)
          }
          if (!version) {
            continue
          }

          const cbsPlatformRaw = normalizeText(platformText || moduleText) || 'general'
          const cbsPlatform = cbsPlatformRaw.toLowerCase()
          const duplicate = cbsList.some(
            (item) => item.platform === cbsPlatform && item.version === version
          )
          if (!duplicate) {
            cbsList.push({
              platform: cbsPlatform,
              version,
              sectionTitle
            })
          }
          sectionHasInfo = true
          continue
        }

        const imageSource =
          imageVersionIndex >= 0 ? cells[imageVersionIndex] || rowText : `${rowText} ${linksText}`
        const imageVersions = extractImageVersionTokens(imageSource)
        if (!imageVersions.length) {
          continue
        }

        const androidText = androidIndex >= 0 ? cells[androidIndex] || '' : cells[0] || ''
        const androidFromText = extractAndroidVersionFromText(androidText)

        for (const imageVersion of imageVersions) {
          if (imageMap.has(imageVersion)) continue
          const androidVersion =
            androidFromText || extractAndroidVersionFromImageToken(imageVersion) || 'unknown'
          imageMap.set(imageVersion, {
            androidVersion,
            imageVersion,
            sectionTitle
          })
        }
        sectionHasInfo = true
      }
    }

    if (sectionHasInfo && !updateLogHtml) {
      updateLogHtml = sectionHtml
      updateLogSectionTitle = sectionTitle
    }

    if (
      clientMap.size === CLIENT_PLATFORM_ORDER.length &&
      cbsList.length > 0 &&
      imageMap.size > 0
    ) {
      break
    }
  }

  const clients = CLIENT_PLATFORM_ORDER.map((platform) => clientMap.get(platform)).filter(
    Boolean
  ) as ClientReleaseInfo[]

  return {
    clients,
    cbs: cbsList,
    images: Array.from(imageMap.values()),
    updateLogHtml,
    updateLogSectionTitle
  }
}

const fetchReleaseModuleHtml = async (
  requestConfig: ReleaseRequestConfig
): Promise<{ moduleUrl: string; staticHtml: string }> => {
  const pageHtml = await fetch(requestConfig.sourceUrl, { cache: 'no-store' }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch release history page: ${response.status}`)
    }
    return response.text()
  })

  const moduleUrl = extractModuleUrlFromPage(
    pageHtml,
    requestConfig.modulePathMarker,
    requestConfig.sourceUrl
  )
  if (!moduleUrl) {
    throw new Error('Failed to locate release module URL')
  }

  const moduleCode = await fetch(moduleUrl, { cache: 'no-store' }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch release module: ${response.status}`)
    }
    return response.text()
  })

  const staticHtml = extractStaticHtmlFromModuleCode(moduleCode)
  if (!staticHtml) {
    throw new Error('Failed to extract release static HTML')
  }

  return { moduleUrl, staticHtml }
}

const buildFreshCache = async (requestConfig: ReleaseRequestConfig): Promise<VersionCheckCache> => {
  const { moduleUrl, staticHtml } = await fetchReleaseModuleHtml(requestConfig)
  const latest = parseLatestReleaseInfo(staticHtml)

  return {
    fetchedAt: Date.now(),
    locale: requestConfig.locale,
    sourceUrl: requestConfig.sourceUrl,
    moduleUrl,
    latest
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object'

const isClientPlatform = (value: string): value is ClientPlatform =>
  CLIENT_PLATFORM_ORDER.includes(value as ClientPlatform)

const isValidCache = (cache: unknown): cache is VersionCheckCache => {
  if (!isObject(cache)) return false
  if (typeof cache.fetchedAt !== 'number') return false
  if (typeof cache.locale !== 'string') return false
  if (!(cache.locale in RELEASE_HISTORY_URL_MAP)) return false
  if (typeof cache.sourceUrl !== 'string') return false
  if (typeof cache.moduleUrl !== 'string') return false
  if (!isObject(cache.latest)) return false
  if (!Array.isArray(cache.latest.clients)) return false
  if (!Array.isArray(cache.latest.cbs)) return false
  if (!Array.isArray(cache.latest.images)) return false
  if (typeof cache.latest.updateLogHtml !== 'string') return false
  if (typeof cache.latest.updateLogSectionTitle !== 'string') return false

  for (const client of cache.latest.clients) {
    if (!isObject(client)) return false
    if (typeof client.platform !== 'string' || !isClientPlatform(client.platform)) return false
    if (typeof client.version !== 'string') return false
    if (typeof client.sectionTitle !== 'string') return false
    if (typeof client.sectionHtml !== 'string') return false
  }

  for (const cbs of cache.latest.cbs) {
    if (!isObject(cbs)) return false
    if (typeof cbs.platform !== 'string') return false
    if (typeof cbs.version !== 'string') return false
    if (typeof cbs.sectionTitle !== 'string') return false
  }

  for (const image of cache.latest.images) {
    if (!isObject(image)) return false
    if (typeof image.androidVersion !== 'string') return false
    if (typeof image.imageVersion !== 'string') return false
    if (typeof image.sectionTitle !== 'string') return false
  }

  return true
}

const readCacheFromDisk = async (): Promise<VersionCheckCache | null> => {
  const response = await ipc.invoke<string>(
    CONFIG_EVENTS.GET_CONFIGS,
    CONFIG_KEYS.CLIENT_UPDATE_CACHE
  )
  if (!response.success || !response.data) {
    return null
  }

  try {
    const parsed = JSON.parse(response.data)
    return isValidCache(parsed) ? parsed : null
  } catch {
    return null
  }
}

const writeCacheToDisk = async (cache: VersionCheckCache): Promise<void> => {
  await ipc.invoke<void>(CONFIG_EVENTS.SET_CONFIG, {
    key: CONFIG_KEYS.CLIENT_UPDATE_CACHE,
    value: JSON.stringify(cache)
  })
}

export const resolveCurrentClientPlatform = (): ClientPlatform | '' => {
  const userAgent = navigator.userAgent.toLowerCase()
  if (includesAny(userAgent, ['windows', 'win32', 'win64'])) return 'windows'
  if (includesAny(userAgent, ['macintosh', 'mac os'])) return 'mac'
  if (includesAny(userAgent, ['linux'])) return 'linux'
  return ''
}

const pickClientRelease = (
  clients: ClientReleaseInfo[],
  platform: ClientPlatform | ''
): ClientReleaseInfo | null => {
  if (!clients.length) return null

  if (platform) {
    const matched = clients.find((item) => item.platform === platform)
    if (matched) return matched
  }

  let latest = clients[0]
  for (let i = 1; i < clients.length; i++) {
    if (compareDottedVersion(clients[i].version, latest.version) > 0) {
      latest = clients[i]
    }
  }

  return latest
}

const buildSummary = (cache: VersionCheckCache): VersionCheckSummary => ({
  fetchedAt: cache.fetchedAt,
  sourceUrl: cache.sourceUrl,
  updateLogSectionTitle: cache.latest.updateLogSectionTitle,
  clients: cache.latest.clients.map((item) => ({
    platform: item.platform,
    version: item.version,
    sectionTitle: item.sectionTitle
  })),
  cbs: cache.latest.cbs.map((item) => ({
    platform: item.platform,
    version: item.version,
    sectionTitle: item.sectionTitle
  })),
  images: cache.latest.images.map((item) => ({
    androidVersion: item.androidVersion,
    imageVersion: item.imageVersion,
    sectionTitle: item.sectionTitle
  }))
})

const resolveCache = async (
  appLocale?: string
): Promise<{
  cache: VersionCheckCache | null
  source: 'disk' | 'network' | 'fallback-disk'
}> => {
  const requestConfig = buildReleaseRequestConfig(appLocale)
  const diskCache = await readCacheFromDisk()
  const localeMatchedDiskCache = diskCache?.locale === requestConfig.locale ? diskCache : null
  const isFresh =
    !!localeMatchedDiskCache && Date.now() - localeMatchedDiskCache.fetchedAt <= CACHE_TTL_MS
  if (isFresh) {
    return { cache: localeMatchedDiskCache, source: 'disk' }
  }

  try {
    const freshCache = await buildFreshCache(requestConfig)
    await writeCacheToDisk(freshCache)
    return { cache: freshCache, source: 'network' }
  } catch (error) {
    if (localeMatchedDiskCache) {
      console.warn('[VersionChecker] Failed to refresh cache, fallback to disk cache', error)
      return { cache: localeMatchedDiskCache, source: 'fallback-disk' }
    }
    throw error
  }
}

export const runVersionChecker = async (
  currentVersion: string,
  appLocale?: string
): Promise<VersionCheckResult | null> => {
  const { cache, source } = await resolveCache(appLocale)
  if (!cache) {
    return null
  }

  const platform = resolveCurrentClientPlatform()
  const latestClient = pickClientRelease(cache.latest.clients, platform)
  const latestVersion = latestClient?.version || ''
  const hasUpdate = !!latestVersion && compareDottedVersion(latestVersion, currentVersion) > 0
  const sectionHtml = hasUpdate ? latestClient?.sectionHtml || cache.latest.updateLogHtml || '' : ''

  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    sectionHtml,
    sourceUrl: cache.sourceUrl,
    platform,
    cacheSource: source,
    summary: buildSummary(cache)
  }
}
