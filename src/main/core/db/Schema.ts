/**
 * 数据库 Schema 定义
 * 集中管理所有表结构，便于维护和版本控制
 */

export interface ColumnDefinition {
  name: string
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB'
  primaryKey?: boolean
  notNull?: boolean
  defaultValue?: string | number
  unique?: boolean
  autoIncrement?: boolean
}

export interface TableSchema {
  name: string
  columns: ColumnDefinition[]
  indexes?: string[]
  foreignKeys?: string[]
}

// Groups 表结构
export const GROUPS_SCHEMA: TableSchema = {
  name: 'groups',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'sortIndex', type: 'INTEGER', defaultValue: 0 },
    { name: 'createTime', type: 'INTEGER' }
  ],
  indexes: []
}

// Hosts 表结构
export const HOSTS_SCHEMA: TableSchema = {
  name: 'hosts',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'groupId', type: 'TEXT' },
    { name: 'name', type: 'TEXT' },
    { name: 'ip', type: 'TEXT' },
    { name: 'status', type: 'TEXT' },
    // 最后活跃时间
    { name: 'lastActiveTime', type: 'INTEGER' }
  ],
  indexes: ['CREATE INDEX IF NOT EXISTS idx_hosts_groupId ON hosts(groupId)'],
  foreignKeys: ['FOREIGN KEY (groupId) REFERENCES groups(id)']
}

// Devices 表结构
export const DEVICES_SCHEMA: TableSchema = {
  name: 'devices',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT' },
    { name: 'status', type: 'TEXT' },
    { name: 'type', type: 'TEXT' },
    { name: 'adb', type: 'INTEGER' },
    { name: 'adb_index', type: 'INTEGER' },
    { name: 'adi_name', type: 'TEXT' },
    { name: 'adi_pass', type: 'TEXT' },
    { name: 'aosp_version', type: 'TEXT' },
    { name: 'country', type: 'TEXT' },
    { name: 'cpus', type: 'INTEGER' },
    { name: 'created', type: 'TEXT' },
    { name: 'data', type: 'TEXT' },
    { name: 'data_size', type: 'INTEGER' },
    { name: 'db_id', type: 'TEXT' },
    { name: 'db_version', type: 'INTEGER' },
    { name: 'dns', type: 'TEXT' },
    { name: 'dpi', type: 'TEXT' },
    { name: 'exit_code', type: 'INTEGER' },
    { name: 'fps', type: 'TEXT' },
    { name: 'gateway', type: 'TEXT' },
    { name: 'height', type: 'TEXT' },
    { name: 'image', type: 'TEXT' },
    { name: 'image_id', type: 'TEXT' },
    { name: 'ip', type: 'TEXT' },
    { name: 'is_macvlan', type: 'INTEGER' },
    { name: 'is_symlink', type: 'INTEGER' },
    { name: 'locale', type: 'TEXT' },
    { name: 'mac', type: 'TEXT' },
    { name: 'macvlan_ip', type: 'TEXT' },
    { name: 'macvlan_network', type: 'TEXT' },
    { name: 'memory', type: 'INTEGER' },
    { name: 'network_mode', type: 'TEXT' },
    { name: 'real_data_path', type: 'TEXT' },
    { name: 's5_status', type: 'INTEGER' },
    { name: 's5_text', type: 'TEXT' },
    { name: 'short_id', type: 'TEXT' },
    { name: 'state', type: 'TEXT' },
    { name: 'tcp_audio_port', type: 'INTEGER' },
    { name: 'tcp_control_port', type: 'INTEGER' },
    { name: 'tcp_port', type: 'INTEGER' },
    { name: 'timezone', type: 'TEXT' },
    { name: 'updated_at', type: 'TEXT' },
    { name: 'user_name', type: 'TEXT' },
    { name: 'width', type: 'TEXT' },
    { name: 'host_ip', type: 'TEXT' },
    { name: 'adiID', type: 'INTEGER' },
    { name: 'brand', type: 'TEXT' },
    { name: 'model', type: 'TEXT' },
    { name: 'model_name', type: 'TEXT' },
    { name: 'device_type', type: 'TEXT' },
    // 最后活跃时间
    { name: 'lastActiveTime', type: 'INTEGER' }
  ],
  indexes: ['CREATE INDEX IF NOT EXISTS idx_devices_host_ip ON devices(host_ip)']
}

// Configs 配置字典表结构
export const CONFIGS_SCHEMA: TableSchema = {
  name: 'configs',
  columns: [
    { name: 'key', type: 'TEXT', primaryKey: true, notNull: true },
    { name: 'value', type: 'TEXT' }
  ],
  indexes: []
}

// Images 镜像表结构
export const IMAGES_SCHEMA: TableSchema = {
  name: 'images',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'version', type: 'TEXT', notNull: true },
    { name: 'androidVersion', type: 'TEXT', notNull: true },
    { name: 'size', type: 'INTEGER', defaultValue: 0 },
    { name: 'storagePath', type: 'TEXT' },
    { name: 'importTime', type: 'INTEGER', defaultValue: 0 },
    { name: 'connectionMode', type: 'TEXT' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_images_name ON images(name)',
    'CREATE INDEX IF NOT EXISTS idx_images_version ON images(version)'
  ]
}

// Proxies 代理表结构
export const PROXIES_SCHEMA: TableSchema = {
  name: 'proxies',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'protocol', type: 'TEXT', notNull: true },
    { name: 'host', type: 'TEXT', notNull: true },
    { name: 'port', type: 'INTEGER', notNull: true },
    { name: 'lastCheckStatus', type: 'TEXT' },
    { name: 'username', type: 'TEXT' },
    { name: 'password', type: 'TEXT' },
    { name: 'rawLink', type: 'TEXT' },
    { name: 'ip', type: 'TEXT' },
    { name: 'country', type: 'TEXT' },
    { name: 'city', type: 'TEXT' },
    { name: 'timezone', type: 'TEXT' },
    { name: 'loc', type: 'TEXT' },
    { name: 'createTime', type: 'INTEGER', defaultValue: 0 }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_proxies_name ON proxies(name)',
    'CREATE INDEX IF NOT EXISTS idx_proxies_host ON proxies(host)'
  ]
}

// 所有表的 Schema 定义
export const ALL_TABLES: TableSchema[] = [
  GROUPS_SCHEMA,
  HOSTS_SCHEMA,
  DEVICES_SCHEMA,
  CONFIGS_SCHEMA,
  IMAGES_SCHEMA,
  PROXIES_SCHEMA
]

// 获取表的所有列名（用于字段过滤）
export function getTableColumns(tableName: string): Set<string> {
  const schema = ALL_TABLES.find((t) => t.name === tableName)
  if (!schema) {
    throw new Error(`Table schema not found: ${tableName}`)
  }
  return new Set(schema.columns.map((col) => col.name))
}

// 生成建表 SQL
export function generateCreateTableSQL(schema: TableSchema): string {
  const columnDefs = schema.columns.map((col) => {
    let def = `${col.name} ${col.type}`
    if (col.primaryKey) def += ' PRIMARY KEY'
    if (col.autoIncrement) def += ' AUTOINCREMENT'
    if (col.notNull) def += ' NOT NULL'
    if (col.unique) def += ' UNIQUE'
    if (col.defaultValue !== undefined) {
      def += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`
    }
    return def
  })

  const foreignKeys = schema.foreignKeys || []
  const allConstraints = [...columnDefs, ...foreignKeys]

  return `CREATE TABLE IF NOT EXISTS ${schema.name} (\n  ${allConstraints.join(',\n  ')}\n)`
}

// 数据库版本配置
export const DB_VERSION = 5 // 当前数据库版本（新增 proxies 表）
export const DB_VERSION_KEY = 'user_version'
