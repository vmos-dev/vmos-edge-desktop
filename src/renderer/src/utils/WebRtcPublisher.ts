/**
 * WebRtcPublisher.ts
 * 生产级 WebRTC WHIP 推流控制器
 */

// ==========================================
// 1. 类型定义
// ==========================================

export type WebRtcState = 'idle' | 'connecting' | 'streaming' | 'error' | 'reconnecting'

export interface WebRtcPublisherEvents {
  onStateChange?: (state: WebRtcState) => void
  onError?: (error: Error) => void
  onStats?: (bitrate: number, packetLoss: number) => void // 可选：用于抛出统计数据
}

/** 支持的视频编码器类型 */
export type VideoCodec = 'H264' | 'VP8' | 'VP9' | 'AV1' | 'auto'

export interface WebRtcConfig {
  /** 视频最大码率 (kbps)。如果不填，代码会根据分辨率自动估算 */
  videoMaxBitrate?: number
  /** WHIP 推流地址 */
  publishUrl: string
  /** 连接超时时间 (ms), 默认 10000 */
  timeout?: number
  /** 最大重试次数, 默认 5 */
  maxRetries?: number
  /** ICE 收集超时 (ms), 默认 2000 */
  iceGatheringTimeout?: number
  /** 视频编码器, 默认 'H264' */
  videoCodec?: VideoCodec
}

// ==========================================
// 2. 核心类
// ==========================================

export class WebRtcPublisher {
  private pc: RTCPeerConnection | null = null
  private stream: MediaStream | null = null
  private _state: WebRtcState = 'idle'

  private retryCount = 0
  private config: Required<Omit<WebRtcConfig, 'videoMaxBitrate' | 'videoCodec'>> & {
    videoMaxBitrate?: number
    videoCodec: VideoCodec
  }

  // 计时器引用 (使用 number 以兼容浏览器环境)
  private retryTimer: number | null = null
  private disconnectTimer: number | null = null
  private iceTimeoutTimer: number | null = null

  private events: WebRtcPublisherEvents

  constructor(config: WebRtcConfig, events: WebRtcPublisherEvents = {}) {
    this.events = events
    // 参数默认值合并
    this.config = {
      timeout: 10000,
      maxRetries: config.maxRetries ?? 5,
      iceGatheringTimeout: config.iceGatheringTimeout ?? 2000,
      publishUrl: config.publishUrl,
      videoCodec: config.videoCodec ?? 'H264'
    }
  }

  public get state() {
    return this._state
  }

  private setState(newState: WebRtcState) {
    if (this._state !== newState) {
      this._state = newState
      console.log(`[WebRTC] State changed: ${newState}`)
      this.events.onStateChange?.(newState)
    }
  }

  /**
   * 开始推流
   * @param stream 媒体流 (建议通过 helper 获取以满足分辨率约束)
   */
  public async start(stream: MediaStream): Promise<void> {
    if (this._state === 'connecting' || this._state === 'streaming') {
      console.warn('[WebRTC] Instance is already running')
      return
    }

    this.stream = stream
    this.retryCount = 0

    // 如果没有手动配置码率，尝试根据分辨率自动计算推荐码率
    if (!this.config.videoMaxBitrate) {
      this.autoConfigureBitrate(stream)
    }

    await this.connect()
  }

  /**
   * 停止推流并清理资源
   */
  public async stop(): Promise<void> {
    this.cleanup()
    this.setState('idle')
  }

  /**
   * 内部连接逻辑
   */
  private async connect(): Promise<void> {
    try {
      this.setState(this.retryCount > 0 ? 'reconnecting' : 'connecting')
      if (!this.stream) throw new Error('No media stream provided')

      // 1. 初始化 PeerConnection
      this.pc = new RTCPeerConnection({
        iceServers: [], // 局域网/WHIP 通常不需要公共 STUN
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle'
      })

      // 2. 添加轨道 & 设置码率
      this.stream.getTracks().forEach((track) => {
        if (!this.pc || !this.stream) return

        const transceiver = this.pc.addTransceiver(track, {
          direction: 'sendonly',
          streams: [this.stream]
        })

        // 视频轨道：设置编码器 & 码率
        if (track.kind === 'video') {
          // 设置编码器偏好
          this.applyVideoCodecPreference(transceiver)

          // 应用码率限制
          if (this.config.videoMaxBitrate) {
            this.applyVideoBitrate(transceiver.sender, this.config.videoMaxBitrate)
          }
        }
      })

      // 3. 设置事件监听
      this.setupPcListeners()

      // 4. 创建 Offer
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)

      // 5. 等待 ICE 收集 (带超时熔断)
      await this.waitForIceGathering()

      const localSdp = this.pc.localDescription?.sdp
      if (!localSdp) throw new Error('Failed to generate SDP')

      // 6. WHIP 请求 (信令交换)
      const answerSdp = await this.sendWhipRequest(localSdp)

      // 7. 设置 Remote Description
      if (this.pc.signalingState !== 'closed') {
        await this.pc.setRemoteDescription(
          new RTCSessionDescription({
            type: 'answer',
            sdp: answerSdp
          })
        )
      }
    } catch (error) {
      this.handleConnectionFailure(error as Error)
    }
  }

  /**
   * 设置视频编码器偏好
   */
  private applyVideoCodecPreference(transceiver: RTCRtpTransceiver) {
    if (this.config.videoCodec === 'auto') {
      return // 使用浏览器默认协商
    }

    try {
      const capabilities = RTCRtpSender.getCapabilities('video')
      if (!capabilities?.codecs) {
        console.warn('[WebRTC] Unable to get video codec capabilities')
        return
      }

      // 构建目标 MIME 类型
      const targetMimeType = `video/${this.config.videoCodec}`

      // 筛选匹配的编码器
      let preferredCodecs = capabilities.codecs.filter(
        (codec) => codec.mimeType.toLowerCase() === targetMimeType.toLowerCase()
      )

      if (preferredCodecs.length === 0) {
        console.warn(`[WebRTC] Codec ${this.config.videoCodec} not supported by browser`)
        return
      }

      // 如果是 H264，优先选择 Constrained Baseline Profile (profile-level-id=42e01f)
      // 这种 profile 对 RTSP/FFmpeg 的兼容性最好，能解决 "unspecified size" 问题
      if (this.config.videoCodec === 'H264') {
        const baselineCodec = preferredCodecs.find(
          (c) => c.sdpFmtpLine && c.sdpFmtpLine.includes('profile-level-id=42e01f')
        )
        if (baselineCodec) {
          // 将 Baseline 放在首位
          preferredCodecs = [baselineCodec, ...preferredCodecs.filter((c) => c !== baselineCodec)]
          console.log('[WebRTC] Preferred H264 Constrained Baseline Profile')
        }
      }

      // 将其他编码器放在后面作为备选
      const otherCodecs = capabilities.codecs.filter(
        (codec) => codec.mimeType.toLowerCase() !== targetMimeType.toLowerCase()
      )

      // 设置编码器优先级：优先使用指定编码器，其他作为 fallback
      transceiver.setCodecPreferences([...preferredCodecs, ...otherCodecs])
      console.log(`[WebRTC] Video codec preference set to ${this.config.videoCodec}`)
    } catch (e) {
      console.warn('[WebRTC] Failed to set codec preferences:', e)
    }
  }

  /**
   * 设置视频编码参数 (关键优化：清晰度控制)
   */
  private async applyVideoBitrate(sender: RTCRtpSender, bitrateKbps: number) {
    try {
      const params = sender.getParameters()
      if (!params.encodings) params.encodings = [{}]

      // maxBitrate 单位是 bps
      params.encodings[0].maxBitrate = bitrateKbps * 1000
      // 保持原有分辨率，不让浏览器自动缩放
      params.encodings[0].scaleResolutionDownBy = 1.0

      await sender.setParameters(params)
      console.log(`[WebRTC] Video bitrate limited to ${bitrateKbps} kbps`)
    } catch (e) {
      console.warn('[WebRTC] Failed to set bitrate params:', e)
    }
  }

  private setupPcListeners() {
    if (!this.pc) return

    // ICE 连接状态监控
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState
      console.log(`[WebRTC] ICE State: ${state}`)

      if (state === 'connected' || state === 'completed') {
        this.clearTimer('disconnectTimer')
        this.setState('streaming')
        this.retryCount = 0 // 重置重试计数
      } else if (state === 'disconnected') {
        console.warn('[WebRTC] ICE disconnected, waiting for recovery...')
        // 设置 5 秒容错时间，如果还没恢复则报错
        if (!this.disconnectTimer) {
          this.disconnectTimer = window.setTimeout(() => {
            if (this.pc?.iceConnectionState === 'disconnected') {
              this.handleConnectionFailure(new Error('ICE connection timeout (network lost)'))
            }
          }, 5000)
        }
      } else if (state === 'failed') {
        this.handleConnectionFailure(new Error('ICE connection failed'))
      }
    }

    // 整体连接状态监控
    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'failed') {
        this.handleConnectionFailure(new Error('DTLS Connection failed'))
      }
    }
  }

  private async sendWhipRequest(localSdp: string): Promise<string> {
    let lastError: Error | null = null

    // 简单的 Fetch 重试逻辑 (3次)
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(this.config.publishUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp'
          },
          body: localSdp
        })

        if (!response.ok) {
          throw new Error(`WHIP Server Error: ${response.status} ${response.statusText}`)
        }
        return await response.text()
      } catch (e) {
        lastError = e as Error
        console.warn(`[WebRTC] WHIP request attempt ${i + 1} failed:`, e)
        if (i < 2) await new Promise((r) => setTimeout(r, 1000))
      }
    }
    throw lastError || new Error('WHIP request failed after retries')
  }

  private async handleConnectionFailure(error: Error) {
    console.error('[WebRTC] Connection Error:', error)
    this.clearTimer('disconnectTimer')

    // 允许重试且非空闲状态
    if (this._state !== 'idle' && this.retryCount < this.config.maxRetries) {
      this.events.onError?.(error) // 通知上层发生了错误，但正在重试

      this.retryCount++
      // 指数退避：1s, 2s, 4s, 8s, 10s...
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000)

      console.log(
        `[WebRTC] Retrying in ${delay}ms (${this.retryCount}/${this.config.maxRetries})...`
      )
      this.setState('reconnecting')

      // 关闭旧连接，准备重连
      if (this.pc) {
        this.pc.close()
        this.pc = null
      }

      this.retryTimer = window.setTimeout(() => {
        this.connect()
      }, delay)
    } else {
      // 彻底失败
      this.setState('error')
      this.events.onError?.(
        new Error(
          `Fatal: Connection failed after ${this.config.maxRetries} attempts. Reason: ${error.message}`
        )
      )
      this.cleanup()
    }
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc || this.pc.iceGatheringState === 'complete') {
        resolve()
        return
      }

      const checkState = () => {
        if (!this.pc || this.pc.iceGatheringState === 'complete') {
          this.pc?.removeEventListener('icegatheringstatechange', checkState)
          this.clearTimer('iceTimeoutTimer')
          resolve()
        }
      }

      this.pc.addEventListener('icegatheringstatechange', checkState)

      // 强制超时：如果 ICE 收集太久（例如没有公网 IP），强制继续，不阻塞流程
      this.iceTimeoutTimer = window.setTimeout(() => {
        this.pc?.removeEventListener('icegatheringstatechange', checkState)
        console.warn('[WebRTC] ICE gathering timed out, proceeding with gathered candidates')
        resolve()
      }, this.config.iceGatheringTimeout)
    })
  }

  private cleanup() {
    this.clearTimer('retryTimer')
    this.clearTimer('disconnectTimer')
    this.clearTimer('iceTimeoutTimer')

    if (this.pc) {
      this.pc.oniceconnectionstatechange = null
      this.pc.onconnectionstatechange = null
      this.pc.onicegatheringstatechange = null
      this.pc.close()
      this.pc = null
    }

    // 注意：推流器停止不应该自动关闭外部传入的 Stream，除非业务要求。
    // 这里只把引用置空。
    this.stream = null
  }

  private clearTimer(timerName: 'retryTimer' | 'disconnectTimer' | 'iceTimeoutTimer') {
    if (this[timerName] !== null) {
      clearTimeout(this[timerName]!)
      this[timerName] = null
    }
  }

  // 辅助：根据分辨率估算合理码率
  private autoConfigureBitrate(stream: MediaStream) {
    const videoTrack = stream.getVideoTracks().find((track) => track.kind === 'video')
    if (!videoTrack) return

    const settings = videoTrack.getSettings()
    const height = settings.height || 360 // 默认防守值

    // 简单的码率阶梯策略
    if (height <= 360)
      this.config.videoMaxBitrate = 800 // 360p: 800kbps
    else if (height <= 480)
      this.config.videoMaxBitrate = 1200 // 480p: 1.2Mbps
    else if (height <= 720)
      this.config.videoMaxBitrate = 2000 // 720p: 2.0Mbps
    else this.config.videoMaxBitrate = 3500 // 1080p+: 3.5Mbps

    console.log(
      `[WebRTC] Auto-configured bitrate: ${this.config.videoMaxBitrate}kbps for ${height}p`
    )
  }
}
