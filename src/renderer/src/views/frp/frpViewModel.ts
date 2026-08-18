import type { FrpConfig } from '@shared/ipc/frp.types'

const SERVER_RECONFIGURE_FIELDS: (keyof FrpConfig)[] = [
  'frps_port',
  'frps_dashboard_port',
  'frps_dashboard_password',
  'frps_token',
  'port_range_start',
  'port_range_end',
  'public_frps_dashboard_port',
  'proxy_bind_local'
]

const CLIENT_RESTART_FIELDS: (keyof FrpConfig)[] = [
  'frpc_admin_port',
  'public_host',
  'public_frps_port'
]

export function hasFrpConfiguration(config: FrpConfig | null | undefined): boolean {
  if (!config) return false
  return Boolean(
    config.server_host && config.frps_token && config.status !== 'error' && config.status !== 'deploying'
  )
}

export function hasChanged(
  config: FrpConfig | null | undefined,
  fields: (keyof FrpConfig)[],
  updates: Partial<FrpConfig>
): boolean {
  if (!config) return false
  return fields.some((key) => key in updates && updates[key] !== config[key])
}

export function isFrpServerRestartRequired(
  config: FrpConfig | null | undefined,
  updates: Partial<FrpConfig>
): boolean {
  return hasChanged(config, SERVER_RECONFIGURE_FIELDS, updates)
}

export function isFrpClientRestartRequired(
  config: FrpConfig | null | undefined,
  updates: Partial<FrpConfig>
): boolean {
  return hasChanged(config, CLIENT_RESTART_FIELDS, updates)
}
