import { describe, expect, test, beforeEach } from 'vitest'
import { DeviceStateCache } from '../DeviceStateCache'
import type { Device } from '@shared/ipc/data.types'

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 'dev-1',
    state: 'running' as any,
    host_ip: '192.168.1.1',
    hostId: 'host-1',
    lastActiveTime: Date.now(),
    ip: '10.0.0.1',
    cpus: 4,
    memory: 2048,
    width: '720',
    height: '1280',
    dpi: '320',
    dns: ['8.8.8.8', '8.8.4.4'],
    is_macvlan: false,
    ...overrides
  }
}

describe('DeviceStateCache', () => {
  let cache: DeviceStateCache

  beforeEach(() => {
    cache = new DeviceStateCache()
  })

  // ── 基础 CRUD ──

  test('新设备判定为 changed', () => {
    const d = makeDevice()
    expect(cache.hasChanged('192.168.1.1', d)).toBe(true)
  })

  test('set 后相同数据判定为未变化', () => {
    const d = makeDevice()
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d })).toBe(false)
  })

  test('update 后相同数据判定为未变化', () => {
    const d = makeDevice()
    cache.update('192.168.1.1', d)
    expect(cache.hasChanged('192.168.1.1', { ...d })).toBe(false)
  })

  test('remove 后判定为 changed', () => {
    const d = makeDevice()
    cache.set('192.168.1.1', [d])
    cache.remove('192.168.1.1', d.id)
    expect(cache.hasChanged('192.168.1.1', d)).toBe(true)
  })

  test('clearHost 后判定为 changed', () => {
    const d = makeDevice()
    cache.set('192.168.1.1', [d])
    cache.clearHost('192.168.1.1')
    expect(cache.hasChanged('192.168.1.1', d)).toBe(true)
  })

  test('get 返回缓存的设备', () => {
    const d = makeDevice()
    cache.set('192.168.1.1', [d])
    expect(cache.get('192.168.1.1', d.id)).toEqual(d)
  })

  test('get 不存在的设备返回 undefined', () => {
    expect(cache.get('192.168.1.1', 'nonexistent')).toBeUndefined()
  })

  // ── lastActiveTime 不参与比较 ──

  test('仅 lastActiveTime 变化不算 changed', () => {
    const d = makeDevice({ lastActiveTime: 1000 })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, lastActiveTime: 9999 })).toBe(false)
  })

  // ── 业务字段变化检测 ──

  test('state 变化判定为 changed', () => {
    const d = makeDevice({ state: 'running' as any })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, state: 'stopped' as any })).toBe(true)
  })

  test('数值字段变化判定为 changed', () => {
    const d = makeDevice({ cpus: 4 })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, cpus: 8 })).toBe(true)
  })

  test('布尔字段变化判定为 changed', () => {
    const d = makeDevice({ is_macvlan: false })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, is_macvlan: true })).toBe(true)
  })

  test('字符串字段变化判定为 changed', () => {
    const d = makeDevice({ ip: '10.0.0.1' })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, ip: '10.0.0.2' })).toBe(true)
  })

  // ── 数组字段（dns）比较 ──

  test('dns 数组内容相同（新引用）不算 changed', () => {
    const d = makeDevice({ dns: ['8.8.8.8', '8.8.4.4'] })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, dns: ['8.8.8.8', '8.8.4.4'] })).toBe(false)
  })

  test('dns 数组内容变化判定为 changed', () => {
    const d = makeDevice({ dns: ['8.8.8.8'] })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, dns: ['1.1.1.1'] })).toBe(true)
  })

  test('dns 数组长度变化判定为 changed', () => {
    const d = makeDevice({ dns: ['8.8.8.8'] })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, dns: ['8.8.8.8', '1.1.1.1'] })).toBe(true)
  })

  // ── 非 Schema 字段不参与比较 ──

  test('API 额外字段（非 Schema 列）不影响比较', () => {
    const d = makeDevice()
    cache.set('192.168.1.1', [d])
    const next = { ...d, http_api_port: 35001, remark: 'test', last_sync_at: '2026-01-01' } as any
    expect(cache.hasChanged('192.168.1.1', next)).toBe(false)
  })

  test('Schema 列新增值判定为 changed', () => {
    const d = makeDevice({ brand: undefined } as any)
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, brand: 'Redmi' } as any)).toBe(true)
  })

  // ── 多主机隔离 ──

  test('不同主机的设备互相隔离', () => {
    const d = makeDevice({ id: 'dev-1' })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d })).toBe(false)
    expect(cache.hasChanged('192.168.1.2', { ...d })).toBe(true)
  })

  test('clearHost 不影响其他主机', () => {
    const d1 = makeDevice({ id: 'dev-1' })
    const d2 = makeDevice({ id: 'dev-2' })
    cache.set('192.168.1.1', [d1])
    cache.set('192.168.1.2', [d2])
    cache.clearHost('192.168.1.1')
    expect(cache.hasChanged('192.168.1.1', d1)).toBe(true)
    expect(cache.hasChanged('192.168.1.2', d2)).toBe(false)
  })

  // ── undefined/null 边界 ──

  test('字段从 undefined 变为有值判定为 changed', () => {
    const d = makeDevice({ gateway: undefined })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, gateway: '10.0.0.1' })).toBe(true)
  })

  test('字段从有值变为 undefined 判定为 changed', () => {
    const d = makeDevice({ gateway: '10.0.0.1' })
    cache.set('192.168.1.1', [d])
    expect(cache.hasChanged('192.168.1.1', { ...d, gateway: undefined })).toBe(true)
  })

  // ── clear 全局清理 ──

  test('clear 清空所有主机缓存', () => {
    cache.set('192.168.1.1', [makeDevice({ id: 'a' })])
    cache.set('192.168.1.2', [makeDevice({ id: 'b' })])
    cache.clear()
    expect(cache.get('192.168.1.1', 'a')).toBeUndefined()
    expect(cache.get('192.168.1.2', 'b')).toBeUndefined()
  })
})

// ── 压测：模拟真实生产环境 ──

describe('DeviceStateCache 压测', () => {
  const HOST_COUNT = 8
  const DEVICES_PER_HOST = 1500
  const SYNC_CYCLES = 20

  function makeFullDevice(hostIp: string, index: number): Device {
    return {
      id: `EDGE${hostIp.replace(/\./g, '')}D${String(index).padStart(4, '0')}`,
      state: index % 5 === 0 ? ('running' as any) : ('stopped' as any),
      host_ip: hostIp,
      hostId: `host-${hostIp}`,
      lastActiveTime: Date.now(),
      ip: `172.17.0.${(index % 254) + 1}`,
      cpus: 8,
      memory: 4096,
      width: '720',
      height: '1280',
      dpi: '320',
      fps: '30',
      dns: ['223.5.5.5', ''],
      is_macvlan: index % 3 === 0,
      is_symlink: false,
      adb: 31000 + index,
      adb_index: 0,
      adi_name: `${index.toString(16).padStart(32, '0')}.zip`,
      adi_pass: 'testpass',
      aosp_version: '15',
      country: 'US',
      created: '2026-04-10 13:59:48',
      data: `/container_nswc_lv/dev${index}/data`,
      data_size: 0,
      db_id: `EDGEDEV${index}`,
      db_version: 14,
      device_type: 'real',
      exit_code: 0,
      gateway: '',
      image: 'vcloud_android15_edge:latest',
      image_id: '',
      locale: 'en',
      mac: `02:42:ac:11:00:${(index % 256).toString(16).padStart(2, '0')}`,
      macvlan_ip: '',
      macvlan_network: '',
      network_mode: 'bridge',
      real_data_path: `/container_nswc_lv/dev${index}/data`,
      s5_status: 0,
      s5_text: '',
      short_id: `abcdef${index.toString(16).padStart(6, '0')}`,
      tcp_audio_port: 27000 + index,
      tcp_control_port: 29000 + index,
      tcp_port: 25000 + index,
      timezone: 'America/Los_Angeles',
      updated_at: '2026-04-20 13:54:15',
      user_name: `user-${index}`,
      groupId: ''
    } as Device
  }

  function buildHostDevices(hostIp: string): Device[] {
    const devices: Device[] = []
    for (let i = 0; i < DEVICES_PER_HOST; i++) {
      devices.push(makeFullDevice(hostIp, i))
    }
    return devices
  }

  test(`初始化 ${HOST_COUNT} 主机 × ${DEVICES_PER_HOST} 设备`, () => {
    const cache = new DeviceStateCache()
    const start = performance.now()

    for (let h = 0; h < HOST_COUNT; h++) {
      const ip = `192.168.10.${h + 1}`
      cache.set(ip, buildHostDevices(ip))
    }

    const elapsed = performance.now() - start
    console.log(`  初始化 ${HOST_COUNT * DEVICES_PER_HOST} 台设备: ${elapsed.toFixed(1)}ms`)
    expect(elapsed).toBeLessThan(500)
  })

  test(`稳态 sync：${SYNC_CYCLES} 轮 × ${HOST_COUNT} 主机 × ${DEVICES_PER_HOST} 设备（无变化）`, () => {
    const cache = new DeviceStateCache()
    const hosts: { ip: string; devices: Device[] }[] = []

    for (let h = 0; h < HOST_COUNT; h++) {
      const ip = `192.168.10.${h + 1}`
      const devices = buildHostDevices(ip)
      cache.set(ip, devices)
      hosts.push({ ip, devices })
    }

    let totalChanged = 0
    const start = performance.now()

    for (let cycle = 0; cycle < SYNC_CYCLES; cycle++) {
      for (const { ip, devices } of hosts) {
        for (const d of devices) {
          const incoming = { ...d, lastActiveTime: Date.now() }
          if (cache.hasChanged(ip, incoming)) totalChanged++
        }
      }
    }

    const elapsed = performance.now() - start
    const perCycle = elapsed / SYNC_CYCLES
    const totalChecks = SYNC_CYCLES * HOST_COUNT * DEVICES_PER_HOST
    console.log(
      `  ${totalChecks} 次比较: ${elapsed.toFixed(1)}ms (${perCycle.toFixed(1)}ms/轮, ${((elapsed / totalChecks) * 1000).toFixed(1)}μs/设备)`
    )
    console.log(`  检测到变化: ${totalChanged}`)

    expect(totalChanged).toBe(0)
    expect(perCycle).toBeLessThan(100)
  })

  test(`变化检测：每轮 2% 设备变化`, () => {
    const cache = new DeviceStateCache()
    const ip = '192.168.10.1'
    const devices = buildHostDevices(ip)
    cache.set(ip, devices)

    const changeRate = 0.02
    const changePer = Math.floor(DEVICES_PER_HOST * changeRate)
    let totalChanged = 0

    const start = performance.now()

    for (let cycle = 0; cycle < SYNC_CYCLES; cycle++) {
      let cycleChanged = 0
      for (let i = 0; i < DEVICES_PER_HOST; i++) {
        const d = devices[i]
        const incoming: Device = { ...d, lastActiveTime: Date.now() }
        if (i < changePer) {
          ;(incoming as any).s5_status = cycle + 100
        }
        if (cache.hasChanged(ip, incoming)) {
          cache.update(ip, incoming)
          cycleChanged++
        }
      }
      totalChanged += cycleChanged
    }

    const elapsed = performance.now() - start
    console.log(
      `  ${SYNC_CYCLES} 轮, 每轮 ${changePer} 变化: ${elapsed.toFixed(1)}ms, 总检测变化=${totalChanged}`
    )

    expect(totalChanged).toBe(changePer * SYNC_CYCLES)
    expect(elapsed).toBeLessThan(2000)
  })

  test('内存占用估算', () => {
    const cache = new DeviceStateCache()
    const before = process.memoryUsage().heapUsed

    for (let h = 0; h < HOST_COUNT; h++) {
      cache.set(`192.168.10.${h + 1}`, buildHostDevices(`192.168.10.${h + 1}`))
    }

    // 强制 GC（如果可用）
    if (global.gc) global.gc()
    const after = process.memoryUsage().heapUsed
    const usedMB = (after - before) / 1024 / 1024

    console.log(`  ${HOST_COUNT * DEVICES_PER_HOST} 台设备缓存内存: ~${usedMB.toFixed(1)}MB`)
    expect(usedMB).toBeLessThan(200)
  })
})
