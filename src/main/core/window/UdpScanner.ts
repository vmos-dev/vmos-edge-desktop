import dgram from 'dgram'
import os from 'os'
import ip from 'ip'
import { logger } from '../logger'

export class UDPScanner {
  private isScanning = false
  private shouldStop = false
  /** 本轮扫描各类 socket 错误的计数（按错误码聚合，用于诊断网络拥塞，如 ENETUNREACH/ENOBUFS） */
  private errorCounts = new Map<string, number>()

  constructor() {
    logger.info('💡 UDP Scanner Initialized')
  }

  /** 聚合记录一次 socket 错误（按错误码计数，避免逐 IP 刷屏） */
  private bumpError(e: unknown): void {
    const code = (e as { code?: string })?.code || (e as { message?: string })?.message || 'UNKNOWN'
    this.errorCounts.set(code, (this.errorCounts.get(code) ?? 0) + 1)
  }

  /** 选用本机第一个非内部 IPv4 网卡 */
  private getLocalInterface(): { name: string; address: string; netmask: string } | null {
    try {
      const ifaces = os.networkInterfaces()
      for (const [name, iface] of Object.entries(ifaces)) {
        if (!iface) continue
        for (const conf of iface) {
          if (conf.family === 'IPv4' && !conf.internal) {
            return { name, address: conf.address, netmask: conf.netmask }
          }
        }
      }
    } catch (err) {
      logger.error('[UDPScanner] Failed to get local interface:', err)
    }
    return null
  }

  /** 扫描单个 IP 的 UDP 服务 */
  scanSingleIP(
    ipAddr: string,
    timeout = 100
  ): Promise<{ ip: string; id: string; name: string } | null> {
    return new Promise((resolve) => {
      let socket: dgram.Socket | null = null
      let timer: NodeJS.Timeout | null = null
      let isClosed = false

      const cleanup = () => {
        if (isClosed) return
        isClosed = true
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        if (socket) {
          try {
            socket.close()
          } catch {
            // 忽略关闭异常
          }
          socket = null
        }
      }

      try {
        socket = dgram.createSocket('udp4')

        socket.on('error', (e) => {
          this.bumpError(e)
          cleanup()
          resolve(null)
        })

        socket.on('message', (data) => {
          cleanup()
          try {
            const response = data.toString().trim()
            if (response.startsWith('CBS:')) {
              const parts = response.split(':')
              const id = parts[1] || ''
              const name = parts[2] || ''
              resolve({ ip: ipAddr, id, name })
              return
            }
          } catch (err) {
            logger.error(`[UDPScanner] Error parsing response from ${ipAddr}:`, err)
          }
          resolve(null)
        })

        timer = setTimeout(() => {
          cleanup()
          resolve(null)
        }, timeout)

        socket.send(Buffer.from('lgcloud'), 7678, ipAddr, (err) => {
          if (err) {
            this.bumpError(err)
            cleanup()
            resolve(null)
          }
        })
      } catch (e) {
        this.bumpError(e)
        cleanup()
        resolve(null)
      }
    })
  }

  /** 取消当前扫描 */
  public cancel() {
    this.shouldStop = true
    logger.info('[UDPScanner] Scan cancelled')
  }

  /** 并发扫描整个网段，onFound 回调实时通知每个发现的设备 */
  async discoverUdpDevices(
    onFound: (device: { ip: string; id: string; name: string }) => void
  ): Promise<void> {
    if (this.isScanning) {
      logger.warn('[UDPScanner] Already scanning, ignoring new request')
      return
    }

    this.isScanning = true
    this.shouldStop = false
    this.errorCounts.clear()
    const startTime = Date.now()

    try {
      logger.info('[UDPScanner] Starting UDP discovery...')

      // 单次逐 IP 扫描的硬上限：枚举出的 IP 数绝不允许超过此值，杜绝 ARP 广播风暴打爆局域网
      const MAX_SCAN_HOSTS = 1024

      // ① 单次取网卡：networkStr 与收敛用的本机 IP 都来自同一来源，避免两次查询不一致
      const iface = this.getLocalInterface()
      let networkStr: string
      if (iface) {
        const full = ip.subnet(iface.address, iface.netmask)
        networkStr = `${full.networkAddress}/${full.subnetMaskLength}`
        logger.info(
          `[UDPScanner] 选用网卡 ${iface.name}: 本机IP=${iface.address}, 掩码=${iface.netmask}, 网段=${networkStr}, 可扫描主机数=${full.length}`
        )
      } else {
        networkStr = '192.168.10.0/24'
        logger.warn('[UDPScanner] 未找到可用网卡，使用默认网段 192.168.10.0/24')
      }
      let subnet = ip.cidrSubnet(networkStr)

      // ② 安全边界：网段过大（如 /16 = 65534 个 IP）时绝不逐 IP 扫全网段，
      //   收敛到本机所在的 /22（≤1024 个 IP，约 2.4s，不会造成广播风暴）；更远的跨网段设备请手动添加。
      if (subnet.length > MAX_SCAN_HOSTS) {
        // 用本机真实 IP 定位它所在的 /22：网段 networkAddress（如 192.168.0.0）通常不含本机所在子网
        const localIp = iface?.address ?? subnet.firstAddress
        const safeCidr = `${ip.subnet(localIp, '255.255.252.0').networkAddress}/22`
        logger.warn(
          `[UDPScanner] ⚠️ 网段 ${networkStr}（${subnet.length} 个 IP）过大，已自动收敛为 ${safeCidr}（仅扫描本机所在 /22），更远的跨网段设备请手动添加`
        )
        networkStr = safeCidr
        subnet = ip.cidrSubnet(networkStr)
      }

      const first = ip.toLong(subnet.firstAddress)
      const last = ip.toLong(subnet.lastAddress)

      const ips: string[] = []
      for (let n = first; n <= last; n++) {
        ips.push(ip.fromLong(n))
      }

      // ③ 最终硬保险：无论掩码多异常、收敛逻辑是否被改动，只要枚举数超过上限就放弃扫描，
      //   从机制上彻底杜绝逐 IP 扫描打爆局域网（宁可不扫，也绝不冒险）。
      if (ips.length > MAX_SCAN_HOSTS) {
        logger.error(
          `[UDPScanner] 枚举出 ${ips.length} 个 IP 超过硬上限 ${MAX_SCAN_HOSTS}，为避免冲击局域网已取消本次扫描，请手动添加设备`
        )
        return
      }

      const concurrency = 64
      logger.info(
        `[UDPScanner] 开始扫描: 网段=${networkStr}, IP总数=${ips.length}, 并发=${concurrency}, 单IP超时=150ms`
      )

      let scannedCount = 0
      let foundCount = 0
      const activePromises = new Set<Promise<void>>()

      for (const ipAddr of ips) {
        if (this.shouldStop) break

        const promise = this.scanSingleIP(ipAddr, 150)
          .then((dev) => {
            if (dev && !this.shouldStop) {
              foundCount++
              logger.info(`[UDPScanner] 发现设备: ip=${dev.ip}, id=${dev.id}, name=${dev.name}`)
              try {
                onFound(dev)
              } catch (err) {
                logger.error('[UDPScanner] onFound callback error:', err)
              }
            }
          })
          .catch((err) => {
            logger.error(`[UDPScanner] scanSingleIP error for ${ipAddr}:`, err)
          })
          .finally(() => {
            scannedCount++
          })

        activePromises.add(promise)
        promise.finally(() => activePromises.delete(promise))

        if (activePromises.size >= concurrency) {
          await Promise.race(activePromises)
        }
      }

      await Promise.all(activePromises)

      const errorSummary =
        this.errorCounts.size > 0 ? JSON.stringify(Object.fromEntries(this.errorCounts)) : '无'
      logger.info(
        `[UDPScanner] 扫描结束: 网段=${networkStr}, 已扫=${scannedCount}/${ips.length}, 发现设备=${foundCount}, socket错误=${errorSummary}, 耗时=${Date.now() - startTime}ms, 被取消=${this.shouldStop}`
      )
    } catch (err) {
      logger.error('[UDPScanner] Discovery failed:', err)
    } finally {
      this.isScanning = false
    }
  }
}
