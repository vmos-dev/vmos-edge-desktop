import type { SQLiteDB } from '../db/SQLiteDB'
import type { Group } from '@shared/ipc/data.types'
import { BaseDao } from './BaseDao'

export class GroupDao extends BaseDao<Group> {
  constructor(dbInstance: SQLiteDB) {
    super(dbInstance, 'groups')
  }

  // Groups 表不需要额外的查询方法
  // 所有通用方法都在 BaseDao 中实现
}
