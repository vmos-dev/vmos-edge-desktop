import type { SQLiteDB } from '../db/SQLiteDB'
import { BaseDao } from './BaseDao'
import type { FrpConfig } from '@shared/ipc/frp.types'

const DEFAULT_ID = 'default'

export class FrpConfigDao extends BaseDao<FrpConfig> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'frp_config')
  }

  public getConfig(): FrpConfig | undefined {
    return this.getById(DEFAULT_ID)
  }

  public saveConfig(config: Partial<FrpConfig>): void {
    const existing = this.getById(DEFAULT_ID)
    const now = Date.now()
    if (existing) {
      this.update(DEFAULT_ID, { ...config, updated_at: now })
    } else {
      this.insert({
        id: DEFAULT_ID,
        deploy_mode: 'public',
        server_host: '',
        ssh_port: 22,
        ssh_user: '',
        ssh_password: '',
        frps_port: 7000,
        frps_token: '',
        port_range_start: 30000,
        port_range_end: 40000,
        frpc_admin_port: 7400,
        status: 'idle',
        deploy_step: '',
        frps_version: '',
        map_host_port: 1,
        map_adb: 1,
        map_video: 1,
        map_control: 1,
        map_audio: 1,
        proxy_bind_local: 0,
        screen_enabled: 0,
        screen_port: 80,
        screen_public_port: 0,
        screen_ssl_cert: '',
        screen_ssl_key: '',
        created_at: now,
        updated_at: now,
        ...config
      } as FrpConfig)
    }
  }

  public updateStatus(status: FrpConfig['status']): void {
    this.update(DEFAULT_ID, { status, updated_at: Date.now() } as Partial<FrpConfig>)
  }

  public updateDeployStep(step: string): void {
    this.update(DEFAULT_ID, { deploy_step: step, updated_at: Date.now() } as Partial<FrpConfig>)
  }
}
