import type { Device } from '@shared/ipc/data.types'
import { getTableColumns } from '../../db/Schema'

const SKIP_KEYS = new Set<string>(['id', 'lastActiveTime', 'groupId'])

const COMPARE_KEYS = (() => {
  const cols = getTableColumns('devices')
  SKIP_KEYS.forEach((k) => cols.delete(k))
  return Array.from(cols)
})()

// 归一化：确保所有对比字段存在且类型一致，消除 DB 路径与 API 路径的类型差异
function normalize(device: Device): Device {
  const out = { ...device }
  for (const key of COMPARE_KEYS) {
    const v = (out as any)[key]
    if (v === undefined) {
      ;(out as any)[key] = null
    }
  }
  return out
}

function deviceChanged(prev: Device, next: Device): boolean {
  for (const key of COMPARE_KEYS) {
    const a = (prev as any)[key]
    const b = (next as any)[key]
    if (a === b) continue
    if (Array.isArray(a) && Array.isArray(b)) {
      if (JSON.stringify(a) === JSON.stringify(b)) continue
    }
    return true
  }
  return false
}

export class DeviceStateCache {
  private cache = new Map<string, Map<string, Device>>()

  set(hostIp: string, devices: Device[]): void {
    const map = new Map<string, Device>()
    for (const d of devices) {
      map.set(d.id, normalize(d))
    }
    this.cache.set(hostIp, map)
  }

  get(hostIp: string, deviceId: string): Device | undefined {
    return this.cache.get(hostIp)?.get(deviceId)
  }

  update(hostIp: string, device: Device): void {
    let map = this.cache.get(hostIp)
    if (!map) {
      map = new Map()
      this.cache.set(hostIp, map)
    }
    map.set(device.id, normalize(device))
  }

  remove(hostIp: string, deviceId: string): void {
    this.cache.get(hostIp)?.delete(deviceId)
  }

  hasChanged(hostIp: string, device: Device): boolean {
    const prev = this.cache.get(hostIp)?.get(device.id)
    if (!prev) return true
    return deviceChanged(prev, normalize(device))
  }

  clearHost(hostIp: string): void {
    this.cache.delete(hostIp)
  }

  clear(): void {
    this.cache.clear()
  }
}
