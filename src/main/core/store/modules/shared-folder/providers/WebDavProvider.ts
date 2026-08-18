import { createSocket } from 'node:dgram'
import { v2 as WebDAV } from 'webdav-server'
import { logger } from '../../../../logger'
import type { WebDavProvider as IWebDavProvider, WebDavProviderResult } from './types'
import { WEBDAV_PORT } from '../constants'

const TAG = '[WebDav]'

const WRITE_METHODS = new Set([
  'PUT',
  'DELETE',
  'MKCOL',
  'COPY',
  'MOVE',
  'LOCK',
  'UNLOCK',
  'PROPPATCH'
])

/**
 * 通过 UDP socket 探测本机出口 IP。
 * UDP connect 不发送任何数据，OS 仅按路由表选出出口网卡并绑定地址。
 * 全平台通用，不依赖接口名称和系统命令，不受 Windows 编码/虚拟网卡影响。
 */
function getLanIp(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4')
    socket.connect(80, '8.8.8.8', () => {
      const addr = socket.address().address
      socket.close()
      resolve(addr && addr !== '0.0.0.0' ? addr : undefined)
    })
    socket.on('error', () => resolve(undefined))
  })
}

export class WebDavProvider implements IWebDavProvider {
  private server: WebDAV.WebDAVServer | null = null

  async validate(): Promise<void> {
    // webdav-server is a pure Node.js library — no system dependencies
  }

  async start(directory: string): Promise<WebDavProviderResult> {
    this.server = new WebDAV.WebDAVServer({
      port: WEBDAV_PORT
    })

    // Enforce read-only: block all write methods before they reach the DAV handler
    this.server.beforeRequest((ctx, next) => {
      const method = (ctx.request.method ?? '').toUpperCase()
      if (WRITE_METHODS.has(method)) {
        ctx.response.setHeader('Allow', 'OPTIONS, GET, HEAD, PROPFIND')
        ctx.response.writeHead(405)
        ctx.response.end()
        return
      }
      next()
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.setFileSystem('/', new WebDAV.PhysicalFileSystem(directory), (success) => {
        if (!success) {
          reject(new Error('Failed to mount shared directory'))
          return
        }
        this.server!.start(() => {
          logger.info(`${TAG} Server started`, { directory, port: WEBDAV_PORT })
          resolve()
        })
      })
    })

    const lanAddress = await getLanIp()
    const accessUrl = lanAddress ? `http://${lanAddress}:${WEBDAV_PORT}` : undefined
    return { lanAddress, accessUrl }
  }

  async stop(): Promise<void> {
    if (!this.server) return
    await new Promise<void>((resolve) => {
      this.server!.stop(() => {
        logger.info(`${TAG} Server stopped`)
        resolve()
      })
    })
    this.server = null
  }
}
