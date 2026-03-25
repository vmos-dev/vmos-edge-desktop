import type { SQLiteDB } from '../db/SQLiteDB'
import type { CustomAdi } from '@shared/ipc/adi.types'
import { BaseDao } from './BaseDao'

export class CustomAdiDao extends BaseDao<CustomAdi> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'custom_adis')
  }
}
