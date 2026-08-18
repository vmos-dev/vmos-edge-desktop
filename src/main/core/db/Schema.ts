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
    { name: 'type', type: 'TEXT', defaultValue: 'host' },
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
    { name: 'hostId', type: 'TEXT' }, // 关联的主机ID (优先使用)
    { name: 'groupId', type: 'TEXT' }, // 设备独立分组ID
    { name: 'adiID', type: 'INTEGER' },
    { name: 'brand', type: 'TEXT' },
    { name: 'model', type: 'TEXT' },
    { name: 'model_name', type: 'TEXT' },
    { name: 'device_type', type: 'TEXT' },
    { name: 'gms_disabled', type: 'TEXT' },
    { name: 'gms_upgrade_enable', type: 'TEXT' },
    // 最后活跃时间
    { name: 'lastActiveTime', type: 'INTEGER' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_devices_host_ip ON devices(host_ip)',
    'CREATE INDEX IF NOT EXISTS idx_devices_hostId ON devices(hostId)',
    'CREATE INDEX IF NOT EXISTS idx_devices_groupId ON devices(groupId)'
  ]
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

// AutomationScripts 自动化脚本表结构
export const AUTOMATION_SCRIPTS_SCHEMA: TableSchema = {
  name: 'automation_scripts',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'description', type: 'TEXT' },
    { name: 'content', type: 'TEXT', notNull: true }, // JSON 字符串化的 WorkflowScript
    { name: 'createTime', type: 'INTEGER', defaultValue: 0 },
    { name: 'updateTime', type: 'INTEGER', defaultValue: 0 }
  ],
  indexes: ['CREATE INDEX IF NOT EXISTS idx_automation_scripts_name ON automation_scripts(name)']
}

// Workflows 工作流表结构
export const WORKFLOWS_SCHEMA: TableSchema = {
  name: 'workflows',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'app_id', type: 'TEXT', notNull: true },
    { name: 'app_name', type: 'TEXT', notNull: true },
    { name: 'app_icon', type: 'TEXT' },
    { name: 'app_version', type: 'TEXT' },
    { name: 'default_device_id', type: 'TEXT' },
    { name: 'steps_json', type: 'TEXT', notNull: true }, // JSON 序列化的 Step[]
    { name: 'env_json', type: 'TEXT' },
    { name: 'tags_json', type: 'TEXT' },
    // 原始 YAML 文本(字节级)。steps_json 是语义等价的结构化数据,而 yaml_text
    // 保留用户编辑时的引号 / flow 风格 / 键顺序 / 注释。加载时前端优先用 yaml_text,
    // 避免从 steps 反向重建 YAML 时丢失格式。老数据 yaml_text 为 null,走兼容路径。
    { name: 'yaml_text', type: 'TEXT' },
    { name: 'createdAt', type: 'INTEGER', notNull: true },
    { name: 'updatedAt', type: 'INTEGER', notNull: true }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_workflows_updatedAt ON workflows(updatedAt DESC)',
    'CREATE INDEX IF NOT EXISTS idx_workflows_app_id ON workflows(app_id)'
  ]
}

// CustomAdis 自定义机型表结构
export const CUSTOM_ADIS_SCHEMA: TableSchema = {
  name: 'custom_adis',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'brand', type: 'TEXT' },
    { name: 'model', type: 'TEXT' },
    { name: 'model_name', type: 'TEXT' },
    { name: 'asopVersion', type: 'TEXT' },
    { name: 'layout', type: 'TEXT' },
    { name: 'name', type: 'TEXT', notNull: true }, // 压缩包文件名
    { name: 'path', type: 'TEXT', notNull: true }, // 压缩包在用户目录的完整路径
    { name: 'updateTime', type: 'TEXT' }
  ],
  indexes: ['CREATE INDEX IF NOT EXISTS idx_custom_adis_name ON custom_adis(name)']
}

export const BATCH_TASKS_SCHEMA: TableSchema = {
  name: 'batch_tasks',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'name', type: 'TEXT', notNull: true },
    { name: 'workflow_id', type: 'TEXT', notNull: true },
    { name: 'workflow_name', type: 'TEXT', notNull: true },
    { name: 'app_id', type: 'TEXT', notNull: true },
    { name: 'app_name', type: 'TEXT', notNull: true },
    { name: 'yaml_text', type: 'TEXT', notNull: true },
    { name: 'total_devices', type: 'INTEGER', notNull: true },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: 'RUNNING' },
    { name: 'created_at', type: 'INTEGER', notNull: true },
    { name: 'completed_at', type: 'INTEGER' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_batch_tasks_status ON batch_tasks(status)',
    'CREATE INDEX IF NOT EXISTS idx_batch_tasks_created ON batch_tasks(created_at DESC)'
  ]
}

export const BATCH_TASK_ITEMS_SCHEMA: TableSchema = {
  name: 'batch_task_items',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'batch_task_id', type: 'TEXT', notNull: true },
    { name: 'device_id', type: 'TEXT', notNull: true },
    { name: 'device_name', type: 'TEXT', notNull: true },
    { name: 'host_ip', type: 'TEXT', notNull: true },
    { name: 'base_url', type: 'TEXT', notNull: true },
    { name: 'env_json', type: 'TEXT', notNull: true, defaultValue: '{}' },
    { name: 'remote_task_id', type: 'TEXT' },
    { name: 'status', type: 'TEXT', notNull: true, defaultValue: 'PENDING' },
    { name: 'progress_total', type: 'INTEGER', notNull: true, defaultValue: 0 },
    { name: 'progress_completed', type: 'INTEGER', notNull: true, defaultValue: 0 },
    { name: 'error', type: 'TEXT' },
    { name: 'duration_ms', type: 'INTEGER' },
    { name: 'created_at', type: 'INTEGER', notNull: true }
  ],
  foreignKeys: ['FOREIGN KEY (batch_task_id) REFERENCES batch_tasks(id) ON DELETE CASCADE'],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_bti_batch_task_id ON batch_task_items(batch_task_id)',
    'CREATE INDEX IF NOT EXISTS idx_bti_status ON batch_task_items(status)'
  ]
}

// FRP Config 表结构（单行记录）
export const FRP_CONFIG_SCHEMA: TableSchema = {
  name: 'frp_config',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'deploy_mode', type: 'TEXT', defaultValue: 'public' },
    { name: 'server_host', type: 'TEXT' },
    { name: 'ssh_port', type: 'INTEGER', defaultValue: 22 },
    { name: 'ssh_user', type: 'TEXT' },
    { name: 'ssh_password', type: 'TEXT' },
    { name: 'frps_port', type: 'INTEGER', defaultValue: 7000 },
    { name: 'frps_token', type: 'TEXT' },
    { name: 'public_host', type: 'TEXT' },
    { name: 'public_frps_port', type: 'INTEGER', defaultValue: 0 },
    { name: 'frps_dashboard_port', type: 'INTEGER', defaultValue: 7500 },
    { name: 'public_frps_dashboard_port', type: 'INTEGER', defaultValue: 0 },
    { name: 'frps_dashboard_user', type: 'TEXT', defaultValue: 'admin' },
    { name: 'frps_dashboard_password', type: 'TEXT' },
    { name: 'port_range_start', type: 'INTEGER', defaultValue: 30000 },
    { name: 'port_range_end', type: 'INTEGER', defaultValue: 40000 },
    { name: 'frpc_admin_port', type: 'INTEGER', defaultValue: 7400 },
    { name: 'map_host_port', type: 'INTEGER', defaultValue: 1 },
    { name: 'map_adb', type: 'INTEGER', defaultValue: 1 },
    { name: 'map_video', type: 'INTEGER', defaultValue: 1 },
    { name: 'map_control', type: 'INTEGER', defaultValue: 1 },
    { name: 'map_audio', type: 'INTEGER', defaultValue: 1 },
    { name: 'status', type: 'TEXT', defaultValue: 'idle' },
    { name: 'deploy_step', type: 'TEXT' },
    { name: 'frps_version', type: 'TEXT' },
    { name: 'proxy_bind_local', type: 'INTEGER', defaultValue: 0 },
    { name: 'screen_enabled', type: 'INTEGER', defaultValue: 0 },
    { name: 'screen_port', type: 'INTEGER', defaultValue: 80 },
    { name: 'screen_public_port', type: 'INTEGER', defaultValue: 0 },
    { name: 'screen_ssl_cert', type: 'TEXT', defaultValue: '' },
    { name: 'screen_ssl_key', type: 'TEXT', defaultValue: '' },
    { name: 'created_at', type: 'INTEGER' },
    { name: 'updated_at', type: 'INTEGER' }
  ]
}

// FRP Hosts 表结构（主机映射开关）
export const FRP_HOSTS_SCHEMA: TableSchema = {
  name: 'frp_hosts',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'enabled', type: 'INTEGER', defaultValue: 0 },
    { name: 'updated_at', type: 'INTEGER' }
  ]
}

// FRP Devices 表结构（设备映射开关）
export const FRP_DEVICES_SCHEMA: TableSchema = {
  name: 'frp_devices',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'host_ip', type: 'TEXT', notNull: true },
    { name: 'enabled', type: 'INTEGER', defaultValue: 0 }
  ],
  indexes: ['CREATE INDEX IF NOT EXISTS idx_frp_devices_host_ip ON frp_devices(host_ip)']
}

// FRP Mappings 表结构（端口映射记录）
export const FRP_MAPPINGS_SCHEMA: TableSchema = {
  name: 'frp_mappings',
  columns: [
    { name: 'id', type: 'TEXT', primaryKey: true },
    { name: 'host_id', type: 'TEXT' },
    { name: 'host_ip', type: 'TEXT' },
    { name: 'device_id', type: 'TEXT' },
    { name: 'port_type', type: 'TEXT' },
    { name: 'local_ip', type: 'TEXT' },
    { name: 'local_port', type: 'INTEGER' },
    { name: 'remote_port', type: 'INTEGER', defaultValue: 0 },
    { name: 'status', type: 'TEXT', defaultValue: 'active' },
    { name: 'created_at', type: 'INTEGER' }
  ],
  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_frp_mappings_host_ip ON frp_mappings(host_ip)',
    'CREATE INDEX IF NOT EXISTS idx_frp_mappings_device_id ON frp_mappings(device_id)'
  ]
}

// 所有表的 Schema 定义
export const ALL_TABLES: TableSchema[] = [
  GROUPS_SCHEMA,
  HOSTS_SCHEMA,
  DEVICES_SCHEMA,
  CONFIGS_SCHEMA,
  IMAGES_SCHEMA,
  PROXIES_SCHEMA,
  AUTOMATION_SCRIPTS_SCHEMA,
  WORKFLOWS_SCHEMA,
  CUSTOM_ADIS_SCHEMA,
  BATCH_TASKS_SCHEMA,
  BATCH_TASK_ITEMS_SCHEMA,
  FRP_CONFIG_SCHEMA,
  FRP_HOSTS_SCHEMA,
  FRP_DEVICES_SCHEMA,
  FRP_MAPPINGS_SCHEMA
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
export const DB_VERSION = 13 // frp_config 增加 proxy_bind_local 字段
export const DB_VERSION_KEY = 'user_version'
