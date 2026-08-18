export const PROXY_EVENTS = {
  // 获取所有代理
  GET_PROXIES: 'PROXY:GET_PROXIES',
  // 查询代理
  QUERY_PROXIES: 'PROXY:QUERY_PROXIES',
  // 根据ID获取代理
  GET_PROXY_BY_ID: 'PROXY:GET_PROXY_BY_ID',
  // 添加代理
  ADD_PROXY: 'PROXY:ADD_PROXY',
  // 批量添加代理
  BATCH_ADD_PROXY: 'PROXY:BATCH_ADD_PROXY',
  // 更新代理
  UPDATE_PROXY: 'PROXY:UPDATE_PROXY',
  // 删除代理
  DELETE_PROXY: 'PROXY:DELETE_PROXY',
  // 检查代理有效性
  CHECK_PROXY: 'PROXY:CHECK_PROXY',
  // 导出代理为 JSON 文件
  EXPORT_PROXIES: 'PROXY:EXPORT_PROXIES'
}

/** 导出/导入的代理数据格式，不含自动生成字段 */
export interface ProxyExportItem {
  name: string
  protocol: 'http' | 'https' | 'socks5' | 'vmess' | 'ss' | 'ssr' | 'vless'
  host: string
  port: number
  username?: string
  password?: string
  rawLink?: string
  ip?: string
  country?: string
  timezone?: string
  loc?: string
}
