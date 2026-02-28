export interface StartMediaServerOptions {
  path?: string
  exposeRtspToLan?: boolean
  preferredPorts?: {
    webrtc?: number
    rtsp?: number
  }
}

export interface StartMediaServerResult {
  webrtcPublishUrl: string
  rtspUrl: string
  ports: {
    webrtc: number
    rtsp: number
  }
}

export interface MediaServerStatus {
  running: boolean
  ports?: {
    webrtc: number
    rtsp: number
  }
  pid?: number
  lastError?: string
}
