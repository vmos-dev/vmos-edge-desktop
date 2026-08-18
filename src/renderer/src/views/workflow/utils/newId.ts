/**
 * 生成一个 UUID,用作 Step / 其他临时实体的客户端 id
 *
 * - 优先用 crypto.randomUUID(Electron 渲染层支持)
 * - 防御性兜底:非 crypto 环境用伪随机拼接
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
