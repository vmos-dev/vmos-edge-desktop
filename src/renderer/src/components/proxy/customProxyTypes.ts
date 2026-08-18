import type { Proxy } from '@shared/ipc/data.types'

export interface ParsedProxyResult {
  protocol: Proxy['protocol']
  host: string
  port: number
  username?: string
  password?: string
  rawLink: string
  rawConfig: Record<string, any>
}

export interface CustomProxyFormModel {
  name: string
  rawLink: string
  parsed: ParsedProxyResult | null
  parseError: boolean
}

export const createDefaultCustomProxyForm = (): CustomProxyFormModel => ({
  name: '',
  rawLink: '',
  parsed: null,
  parseError: false
})
