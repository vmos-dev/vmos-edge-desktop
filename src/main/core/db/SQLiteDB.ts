import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import {
  ALL_TABLES,
  generateCreateTableSQL,
  DB_VERSION,
  DB_VERSION_KEY,
  type TableSchema
} from './Schema'
import { logger } from '../logger'

export class SQLiteDB {
  private static instance: SQLiteDB
  public db: Database.Database

  private constructor() {
    const USER_DATA_DIR = app.getPath('userData')

    logger.info('[SQLiteDB] USER_DATA_DIR:', USER_DATA_DIR)

    // 确保目录存在
    if (!fs.existsSync(USER_DATA_DIR)) {
      try {
        fs.mkdirSync(USER_DATA_DIR, { recursive: true })
      } catch (error) {
        logger.error('[SQLiteDB] Failed to create data directory:', error)
        throw error
      }
    }

    const DB_PATH = path.join(USER_DATA_DIR, 'database.sqlite')

    try {
      // 增加 timeout 设置，避免 SQLITE_BUSY
      this.db = new Database(DB_PATH, { timeout: 10000 })

      // 初始化数据库
      this.initialize()

      // 生产环境优化：延迟执行查询规划分析，避免拖慢启动速度
      if (app.isPackaged) {
        setTimeout(() => this.runOptimizer(), 5000)
      }
    } catch (error) {
      logger.error('[SQLiteDB] Initialization failed:', error)
      throw error
    }
  }

  static getInstance(): SQLiteDB {
    try {
      if (!SQLiteDB.instance) {
        SQLiteDB.instance = new SQLiteDB()
      }
      return SQLiteDB.instance
    } catch (error) {
      logger.error('[SQLiteDB] Failed to get instance:', error)
      throw error
    }
  }

  /**
   * 数据库初始化流程
   */
  private initialize() {
    // 1. 设置 Pragmas
    this.initPragmas()

    // 2. 检查数据库完整性
    this.checkIntegrity()

    // 3. 获取当前版本
    const currentVersion = this.getCurrentVersion()

    // 4. 创建或修复表结构
    this.ensureTablesExist()

    // 5. 执行版本迁移
    if (currentVersion < DB_VERSION) {
      this.migrate(currentVersion, DB_VERSION)
    }

    // 6. 自动修复缺失字段
    this.syncAllTableSchemas()

    // 7. 初始化默认数据
    this.initDefaults()
  }

  /**
   * 设置 SQLite Pragmas (生产环境优化版)
   */
  private initPragmas() {
    logger.debug(`[SQLiteDB] initPragmas called (PID: ${process.pid})`)
    try {
      // --- 基础性能与并发控制 ---
      this.db.pragma('journal_mode = WAL') // Write-Ahead Logging: 读写分离，大幅提升并发
      this.db.pragma('synchronous = NORMAL') // 在 WAL 模式下足够安全，且比 FULL 快得多

      // --- 内存与缓存优化 ---
      this.db.pragma('temp_store = MEMORY') // 临时表/索引完全在内存中操作
      // 设置缓存大小: 负数表示 KiB。-64000 ≈ 64MB。
      // 对于现代桌面应用，64MB-128MB 是合理的，避免频繁磁盘 I/O
      this.db.pragma('cache_size = -64000')

      // --- 读取性能优化 (Memory-Mapped I/O) ---
      // 设置 mmap 限制为 256MB。
      // 这允许 SQLite 将数据库文件直接映射到内存地址空间，减少系统调用和数据拷贝。
      // 只有在文件大小小于此值时才完全生效，读取速度最快。
      this.db.pragma('mmap_size = 268435456')

      // --- 约束 ---
      this.db.pragma('foreign_keys = ON')
    } catch (error: any) {
      if (error.code === 'SQLITE_BUSY') {
        logger.warn('[SQLiteDB] Database is busy during initPragmas, retrying...')
      }
      throw error
    }
  }

  /**
   * 运行数据库优化器
   * 建议在应用空闲时或定期调用
   */
  public runOptimizer() {
    try {
      logger.debug('[SQLiteDB] Running optimizer...')
      // optimize pragma 会自动分析表数据，更新统计信息供查询规划器使用
      // 它通常很快，因为它只分析自上次分析以来发生变化的表
      this.db.pragma('optimize')
    } catch (error) {
      logger.warn('[SQLiteDB] Optimizer failed:', error)
    }
  }

  /**
   * 安全关闭数据库
   */
  public close() {
    if (this.db && this.db.open) {
      try {
        logger.info('[SQLiteDB] Closing connection...')

        // 尝试执行 checkpoint，减少 WAL 文件残留导致的锁死风险
        try {
          this.db.pragma('wal_checkpoint(TRUNCATE)')
        } catch (ckptError) {
          logger.warn('[SQLiteDB] WAL Checkpoint failed:', ckptError)
        }

        // 仅关闭连接以释放文件锁，不强制执行 checkpoint
        this.db.close()
        logger.info('[SQLiteDB] Connection closed.')
      } catch (error) {
        logger.error('[SQLiteDB] Error closing database:', error)
      }
    }
  }

  /**
   * 检查数据库完整性
   */
  private checkIntegrity(): boolean {
    logger.debug('[SQLiteDB] checkIntegrity called')
    try {
      const result = this.db.pragma('integrity_check') as any[]
      if (result.length === 1 && result[0].integrity_check === 'ok') {
        return true
      } else {
        logger.error('[SQLiteDB] ❌ Integrity check failed:', result)
        // 可以选择在这里重建数据库或备份
        return false
      }
    } catch (error) {
      logger.error('[SQLiteDB] Integrity check error:', error)
      return false
    }
  }

  /**
   * 获取当前数据库版本
   */
  private getCurrentVersion(): number {
    try {
      return (this.db.pragma(DB_VERSION_KEY, { simple: true }) as number) || 0
    } catch {
      return 0
    }
  }

  /**
   * 设置数据库版本
   */
  private setVersion(version: number) {
    this.db.pragma(`${DB_VERSION_KEY} = ${version}`)
  }

  /**
   * 确保所有表存在（Self-Healing）
   */
  private ensureTablesExist() {
    for (const schema of ALL_TABLES) {
      if (!this.tableExists(schema.name)) {
        this.createTable(schema)
      }
    }
  }

  /**
   * 检查表是否存在
   */
  private tableExists(tableName: string): boolean {
    const result = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName)
    return !!result
  }

  /**
   * 创建表
   */
  private createTable(schema: TableSchema) {
    try {
      // 创建表
      const createSQL = generateCreateTableSQL(schema)
      this.db.exec(createSQL)

      // 创建索引
      if (schema.indexes) {
        schema.indexes.forEach((indexSQL) => {
          this.db.exec(indexSQL)
        })
      }
    } catch (error) {
      logger.error(`[SQLiteDB] Failed to create table ${schema.name}:`, error)
      throw error
    }
  }

  /**
   * 检查列是否存在（大小写不敏感）
   */
  private columnExists(tableName: string, columnName: string): boolean {
    try {
      const currentColumns = this.db.pragma(`table_info(${tableName})`) as any[]
      // 使用大小写不敏感的比较，因为 SQLite 列名存储时保留大小写但比较时不区分大小写
      return currentColumns.some((c) => c.name.toLowerCase() === columnName.toLowerCase())
    } catch (error) {
      logger.error(
        `[SQLiteDB] Failed to check column existence for ${tableName}.${columnName}:`,
        error
      )
      return false
    }
  }

  /**
   * 同步所有表的字段（添加缺失字段）
   */
  private syncAllTableSchemas() {
    for (const schema of ALL_TABLES) {
      if (!this.tableExists(schema.name)) continue

      try {
        const currentColumns = this.db.pragma(`table_info(${schema.name})`) as any[]
        // 使用大小写不敏感的比较
        const currentColumnNames = new Set(currentColumns.map((c) => c.name.toLowerCase()))

        for (const col of schema.columns) {
          // 检查列是否存在（大小写不敏感）
          if (!currentColumnNames.has(col.name.toLowerCase())) {
            // 添加缺失字段
            this.addColumn(schema.name, col)
          }
        }
      } catch (error) {
        logger.error(`[SQLiteDB] Failed to sync schema for ${schema.name}:`, error)
      }
    }
  }

  /**
   * 添加字段
   */
  private addColumn(tableName: string, col: any) {
    // 再次检查列是否已存在（防止并发或检查逻辑问题）
    if (this.columnExists(tableName, col.name)) {
      logger.debug(
        `[SQLiteDB] Column ${tableName}.${col.name} already exists, skipping add operation`
      )
      return
    }

    try {
      let colDef = `${col.name} ${col.type}`
      if (col.defaultValue !== undefined) {
        colDef += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`
      }

      this.db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${colDef}`).run()
      logger.debug(`[SQLiteDB] Successfully added column ${tableName}.${col.name}`)
    } catch (error: any) {
      // 如果是重复列错误，只记录 debug 日志（可能是并发或检查时机问题）
      if (error?.code === 'SQLITE_ERROR' && error?.message?.includes('duplicate column')) {
        logger.debug(
          `[SQLiteDB] Column ${tableName}.${col.name} already exists (caught during add):`,
          error.message
        )
      } else {
        logger.error(`[SQLiteDB] Failed to add column ${tableName}.${col.name}:`, error)
      }
    }
  }

  /**
   * 版本迁移
   */
  private migrate(fromVersion: number, toVersion: number) {
    logger.info(`[SQLiteDB] Migrating database from v${fromVersion} to v${toVersion}`)

    const migrations: Record<number, () => void> = {
      // v1: 初始版本（可以留空）
      1: () => {
        // 初始版本无需操作
      },

      // v2: 添加 remark 和 location 字段
      2: () => {
        // syncAllTableSchemas 会自动添加缺失字段，这里可以放一些特殊的数据迁移逻辑
      }
    }

    // 按顺序执行迁移
    for (let v = fromVersion + 1; v <= toVersion; v++) {
      if (migrations[v]) {
        try {
          const runMigration = this.db.transaction(() => {
            migrations[v]()
            this.setVersion(v)
          })
          runMigration()
        } catch (error) {
          logger.error(`[SQLiteDB] ❌ Migration v${v} failed:`, error)
          throw error
        }
      }
    }
  }

  /**
   * 初始化默认数据
   */
  private initDefaults() {
    try {
      const stmt = this.db.prepare('SELECT count(*) as count FROM groups WHERE id = ?')
      const result = stmt.get('default') as { count: number }
      // 获取系统语言，如果语言为英文，则默认分组名称为 Default Group
      const language = app.getLocale()
      const defaultGroupName = language.indexOf('zh') !== -1 ? '默认分组' : 'Default Group'
      if (result.count === 0) {

        this.db
          .prepare(
            'INSERT INTO groups (id, name, type, sortIndex, createTime) VALUES (?, ?, ?, ?, ?)'
          )
          .run('default', defaultGroupName, 'host', 0, Date.now())

      }

      const stmt2 = this.db.prepare('SELECT count(*) as count FROM groups WHERE id = ?')
      const result2 = stmt2.get('device_default') as { count: number }

      if (result2.count === 0) {
        this.db
          .prepare(
            'INSERT INTO groups (id, name, type, sortIndex, createTime) VALUES (?, ?, ?, ?, ?)'
          )
          .run('device_default', defaultGroupName, 'device', 0, Date.now())
      }

      // 强制修正默认分组类型（确保旧数据迁移后类型正确）
      this.db.prepare("UPDATE groups SET type = 'host' WHERE id = 'default'").run()
      this.db.prepare("UPDATE groups SET type = 'device' WHERE id = 'device_default'").run()
    } catch (error) {
      logger.error('[SQLiteDB] initDefaults failed:', error)
    }
  }

  /**
   * 数据库健康检查
   */
  public healthCheck(): {
    healthy: boolean
    issues: string[]
  } {
    const issues: string[] = []

    // 1. 检查完整性
    if (!this.checkIntegrity()) {
      issues.push('Database integrity check failed')
    }

    // 2. 检查所有表是否存在
    for (const schema of ALL_TABLES) {
      if (!this.tableExists(schema.name)) {
        issues.push(`Table ${schema.name} is missing`)
      }
    }

    // 3. 检查版本
    const currentVersion = this.getCurrentVersion()
    if (currentVersion !== DB_VERSION) {
      issues.push(`Database version mismatch: ${currentVersion} vs ${DB_VERSION}`)
    }

    return {
      healthy: issues.length === 0,
      issues
    }
  }

  /**
   * 修复数据库（重新初始化）
   */
  public repair() {
    this.ensureTablesExist()
    this.syncAllTableSchemas()
  }

  /**
   * 创建事务
   */
  public transaction<T>(fn: () => T): T {
    const transactionFn = this.db.transaction(fn)
    return transactionFn()
  }
}
