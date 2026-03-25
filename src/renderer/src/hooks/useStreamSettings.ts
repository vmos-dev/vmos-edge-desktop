import { ref, watch } from 'vue'
import store from 'store'
import { ipc } from '@renderer/core/ipc'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { WebRtcPublisher, WebRtcState } from '@renderer/utils/WebRtcPublisher'
import { MEDIAMTX_START, MEDIAMTX_STOP } from '@shared/ipc/channels'
import { ElMessage } from 'element-plus'
import { t } from '@renderer/locales'

/* =========================
 * Storage Keys
 * ========================= */
const STREAM_TYPE_KEY = 'stream_type'
const VIDEO_DEVICE_KEY = 'selected_video_device'
const AUDIO_DEVICE_KEY = 'selected_audio_device'
const IS_STREAMING_SYNC_KEY = 'sync_is_streaming'
const RTSP_URL_KEY = 'rtsp_url'

/* =========================
 * 通用：ref ⇄ store 双向同步
 * ========================= */
function useSyncedRef<T>(key: string, defaultValue: T) {
  const state = ref<T>(store.get(key) ?? defaultValue)

  // ref -> store
  watch(
    state,
    (val) => {
      store.set(key, val)
    },
    { deep: true }
  )

  // store -> ref（跨窗口）
  const onStorage = (e: StorageEvent) => {
    if (e.key === key) {
      const newVal = store.get(key)
      if (newVal !== undefined && newVal !== state.value) {
        state.value = newVal
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }

  return state
}

/* =========================
 * 全局状态（自动跨窗口同步）
 * ========================= */
const streamType = useSyncedRef<'av' | 'video' | 'audio'>(STREAM_TYPE_KEY, 'av')
const selectedVideoDevice = useSyncedRef<string>(VIDEO_DEVICE_KEY, '')
const selectedAudioDevice = useSyncedRef<string>(AUDIO_DEVICE_KEY, '')
const isStreaming = useSyncedRef<boolean>(IS_STREAMING_SYNC_KEY, false)
const rtspUrl = useSyncedRef<string>(RTSP_URL_KEY, '')
const publisherState = ref<WebRtcState>('idle')

/* =========================
 * 设备列表
 * ========================= */
const videoDevices = ref<MediaDeviceInfo[]>([])
const audioDevices = ref<MediaDeviceInfo[]>([])

/* =========================
 * 推流实例
 * ========================= */
let publisherInstance: WebRtcPublisher | null = null

/* =========================
 * 初始化 streaming 状态（主进程 → renderer）
 * ========================= */
const initIsStreaming = async () => {
  try {
    const res = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.IS_STREAMING)
    if (res.success && res.data !== undefined) {
      isStreaming.value = res.data === '1'
    }
  } catch (e) {
    console.error('init isStreaming failed:', e)
  }
}

/* =========================
 * 设备刷新
 * ========================= */
const refreshDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const hasLabels = devices.some((d) => d.label)

    if (!hasLabels) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        stream.getTracks().forEach((t) => t.stop())
      } catch {}
    }

    const updated = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = updated.filter((d) => d.kind === 'videoinput')
    audioDevices.value = updated.filter((d) => d.kind === 'audioinput')

    if (
      videoDevices.value.length &&
      !videoDevices.value.some((d) => d.deviceId === selectedVideoDevice.value)
    ) {
      selectedVideoDevice.value = videoDevices.value[0].deviceId
    }

    if (
      audioDevices.value.length &&
      !audioDevices.value.some((d) => d.deviceId === selectedAudioDevice.value)
    ) {
      selectedAudioDevice.value = audioDevices.value[0].deviceId
    }
  } catch (e) {
    console.error('refreshDevices failed:', e)
  }
}

/* =========================
 * 业务联动规则
 * ========================= */

// 停止推流时，所有窗口自动清 RTSP
watch(isStreaming, (val) => {
  if (!val) {
    rtspUrl.value = ''
  }
})

// 同步推流状态到主进程
watch(isStreaming, async (val) => {
  try {
    await ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
      key: CONFIG_KEYS.IS_STREAMING,
      value: val ? '1' : '0'
    })
  } catch (e) {
    console.error('sync isStreaming to main failed:', e)
  }
})

/* =========================
 * 获取媒体流（健壮版）
 * ========================= */
const getRobustMediaStream = async (
  type: 'av' | 'video' | 'audio' = streamType.value
): Promise<MediaStream> => {
  const tracks: MediaStreamTrack[] = []
  const errors: string[] = []

  if (type !== 'audio' && selectedVideoDevice.value) {
    try {
      const vs = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedVideoDevice.value },
          frameRate: { max: 30 }
        },
        audio: false
      })
      tracks.push(...vs.getVideoTracks())
    } catch (e) {
      errors.push(`${t('settings.camera')}${t('common.failed')}: ${(e as Error).message}`)
    }
  }

  if (type !== 'video' && selectedAudioDevice.value) {
    try {
      const as = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedAudioDevice.value } },
        video: false
      })
      tracks.push(...as.getAudioTracks())
    } catch (e) {
      errors.push(`${t('settings.microphone')}${t('common.failed')}: ${(e as Error).message}`)
    }
  }

  if (!tracks.length) {
    throw new Error(errors.join('; ') || t('settings.cannotGetAnyMediaTrack'))
  }

  if (errors.length) {
    ElMessage.warning(t('settings.partialDeviceFailed', { errors: errors.join('; ') }))
  }

  return new MediaStream(tracks)
}

/* =========================
 * 推流控制
 * ========================= */
const startPublishing = async () => {
  try {
    const res = await ipc.invoke<any>(MEDIAMTX_START, {
      path: 'live',
      exposeRtspToLan: true
    })

    if (!res.success) throw new Error(res.error || 'media server start failed')

    const { webrtcPublishUrl, rtspUrl: serverRtspUrl } = res.data

    rtspUrl.value = serverRtspUrl

    const stream = await getRobustMediaStream()

    if (publisherInstance) {
      await publisherInstance.stop()
    }

    publisherInstance = new WebRtcPublisher(
      {
        publishUrl: webrtcPublishUrl
      },
      {
        onStateChange: (state) => {
          console.log('WebRtcPublisher 状态回调:', state)
          publisherState.value = state
          if (state === 'error') {
            ElMessage.error(t('settings.streamingInterrupted'))
            isStreaming.value = false
          }
        },
        onError: (err) => console.error('Publisher error:', err)
      }
    )

    await publisherInstance.start(stream)
    isStreaming.value = true

    return serverRtspUrl
  } catch (e) {
    console.error('startPublishing failed:', e)
    await stopPublishing()
    throw e
  }
}

const stopPublishing = async () => {
  if (publisherInstance) {
    await publisherInstance.stop()
    publisherInstance = null
  }

  try {
    await ipc.invoke(MEDIAMTX_STOP)
  } catch (e) {
    console.error('stop media server failed:', e)
  }

  publisherState.value = 'idle'
  isStreaming.value = false
}

/* =========================
 * 初始化
 * ========================= */
initIsStreaming()
refreshDevices()

/* =========================
 * 对外暴露
 * ========================= */
export function useStreamSettings() {
  return {
    streamType,
    selectedVideoDevice,
    selectedAudioDevice,
    isStreaming,
    rtspUrl,
    videoDevices,
    audioDevices,
    publisherState,
    refreshDevices,
    startPublishing,
    stopPublishing
  }
}
