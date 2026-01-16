import dgram from 'dgram'
import os from 'os'
import ip from 'ip'
import { hostManager } from '../store/managers'
import { TaskQueue } from '../utils/TaskQueue'
import { logger } from '../logger'

export interface UDPDevice {
  ip: string
  type: string
  id: string
  name: string
  method: string
  response: string
  last_seen: string
}

export class UDPScanner {
  private scanTimer: NodeJS.Timeout | null = null
  private isScanning = false
  private taskQueue: TaskQueue
  constructor() {
    logger.info('💡 UDP Scanner Initialized')
    this.taskQueue = new TaskQueue(5)
  }

  /** 获取本机网段，例如：192.168.10.0/24 */
  getLocalNetwork(): string {
    try {
      const ifaces = os.networkInterfaces()

      for (const iface of Object.values(ifaces)) {
        if (!iface) continue

        for (const conf of iface) {
          if (conf.family === 'IPv4' && !conf.internal) {
            const subnet = ip.subnet(conf.address, conf.netmask)
            return `${subnet.networkAddress}/${subnet.subnetMaskLength}`
          }
        }
      }
    } catch {}

    return '192.168.10.0/24' // 默认
  }

  /** 扫描单个 IP 的 UDP 服务 */
  scanSingleIP(ipAddr: string, timeout = 100): Promise<UDPDevice | null> {
    return new Promise((resolve) => {
      let socket: dgram.Socket | null = null
      let timer: NodeJS.Timeout | null = null
      let isClosed = false

      // 清理函数：确保资源只释放一次
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
          } catch (e) {
            // 忽略关闭时的错误
          }
          socket = null
        }
      }

      try {
        socket = dgram.createSocket('udp4')

        // 绑定错误处理，防止未捕获异常导致 crash
        socket.on('error', (err) => {
          logger.debug(`[UDPScanner] Socket error for ${ipAddr}:`, err)
          cleanup()
          resolve(null)
        })

        // 接收响应
        socket.on('message', (data) => {
          cleanup()

          try {
            const response = data.toString().trim()
            if (response.startsWith('CBS:')) {
              const parts = response.split(':')
              const id = parts[1] || ''
              const name = parts[2] || ''

              // --- 集成 HostManager (通过任务队列限流) ---
              this.taskQueue.add(() => hostManager.handleHostDiscovery(ipAddr, id, name))
              // -----------------------

              resolve({
                ip: ipAddr,
                type: 'CBS',
                id,
                name,
                method: 'UDP扫描',
                response,
                last_seen: new Date().toISOString()
              })
              return
            }
          } catch (err) {
            logger.error(`[UDPScanner] Error parsing response from ${ipAddr}:`, err)
          }

          resolve(null)
        })

        // 设置超时
        timer = setTimeout(() => {
          cleanup()
          resolve(null)
        }, timeout)

        // 发送 UDP 包
        socket.send(Buffer.from('lgcloud'), 7678, ipAddr, (err) => {
          if (err) {
            cleanup()
            resolve(null)
          }
        })
      } catch (err) {
        // 创建 socket 失败等同步错误
        cleanup()
        resolve(null)
      }
    })
  }

  /** 启动自动扫描 */
  public async startAutoScan(intervalSec = 30) {
    if (this.scanTimer) return

    try {
      logger.info(`[UDPScanner] ✅ 自动扫描已启动 (间隔: ${intervalSec}秒)`)

      this.scanTimer = setInterval(() => {
        if (!this.isScanning) {
          this.discoverUdpDevices(2)
        }
      }, intervalSec * 1000)

      this.discoverUdpDevices(2)
    } catch (error) {
      logger.error('[UDPScanner] 自动扫描启动失败:', error)
    }
  }

  /** 停止自动扫描 */
  public stopAutoScan() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer)
      this.scanTimer = null
    }
  }

  /** 并发扫描整个网段 */
  async discoverUdpDevices(_timeoutSec = 5): Promise<UDPDevice[]> {
    if (this.isScanning) return []
    this.isScanning = true

    logger.debug('[UDPScanner] Starting UDP discovery...')

    const allHosts = hostManager.getHosts()
    const existingIps = new Set(allHosts.map((h) => h.ip))

    const networkStr = this.getLocalNetwork()
    const subnet = ip.cidrSubnet(networkStr)
    const first = ip.toLong(subnet.firstAddress)
    const last = ip.toLong(subnet.lastAddress)

    const ips: string[] = []
    for (let n = first; n <= last; n++) {
      const ipAddr = ip.fromLong(n)
      // 跳过已存在的 Host
      if (!existingIps.has(ipAddr)) {
        ips.push(ipAddr)
      }
    }

    const devices: UDPDevice[] = []

    // 使用更稳健的并发控制
    // 将 IPs 分块处理，避免一次性创建过多 Promise
    // 适当增加并发数以提高扫描速度，UDP 握手很快
    const concurrency = 64

    // --- 基于 Set 的并发池实现 ---
    const activePromises = new Set<Promise<void>>()

    for (const ipAddr of ips) {
      // 创建任务
      const promise = this.scanSingleIP(ipAddr, 150).then((dev) => {
        if (dev) devices.push(dev)
      })

      // 将任务加入集合
      activePromises.add(promise)

      // 任务完成后从集合移除
      promise.then(() => activePromises.delete(promise))

      // 如果达到并发限制，等待任意一个任务完成
      if (activePromises.size >= concurrency) {
        await Promise.race(activePromises)
      }
    }

    // 等待剩余任务全部完成
    await Promise.all(activePromises)

    this.isScanning = false
    return devices
  }
}
