import type { SQLiteDB } from '../db/SQLiteDB'
import { BaseDao } from './BaseDao'
import type { FrpHost } from '@shared/ipc/frp.types'

export class FrpHostDao extends BaseDao<FrpHost> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'frp_hosts')
  }

  public getByHostIp(hostIp: string): FrpHost | undefined {
    return this.getById(hostIp)
  }

  public getAllEnabled(): FrpHost[] {
    const rows = this.dbInstance.db.prepare('SELECT * FROM frp_hosts WHERE enabled = 1').all()
    return rows.map((row) => this.deserialize(row))
  }

  public setEnabled(hostIp: string, enabled: boolean): void {
    const now = Date.now()
    const existing = this.getById(hostIp)
    if (existing) {
      this.update(hostIp, { enabled: enabled ? 1 : 0, updated_at: now } as Partial<FrpHost>)
    } else {
      this.insert({ id: hostIp, enabled: enabled ? 1 : 0, updated_at: now } as FrpHost)
    }
  }

  public isEnabled(hostIp: string): boolean {
    const host = this.getById(hostIp)
    return host?.enabled === 1
  }
}
