<template>
  <div class="window-page">
    <div class="window-header">
      <div class="window-header-left">
        <div style="display: flex; align-items: center; width: 100%">
          <p
            class="device-name"
            style="flex: 1; width: auto"
            @click="handleCopy(phoneDevice?.user_name || '')"
            :title="phoneDevice?.user_name || '-'"
          >
            {{ phoneDevice?.user_name ?? '-' }}
          </p>
          <el-tag
            v-if="isMaster"
            size="small"
            type="danger"
            effect="dark"
            style="margin-left: 4px; transform: scale(0.8); flex-shrink: 0"
          >
            {{ t('phone.master') }}
          </el-tag>
        </div>
        <p
          class="device-ip"
          :title="
            phoneDevice?.network_mode === 'macvlan'
              ? `${phoneDevice?.ip}:${MacvlanPortMap.adb}`
              : `${phoneDevice?.host_ip}:${phoneDevice?.adb}`
          "
          @click="
            handleCopy(
              phoneDevice?.network_mode === 'macvlan'
                ? `${phoneDevice?.ip}:${MacvlanPortMap.adb}`
                : `${phoneDevice?.host_ip}:${phoneDevice?.adb}`
            )
          "
        >
          {{
            phoneDevice?.network_mode === 'macvlan'
              ? `${phoneDevice?.ip}:${MacvlanPortMap.adb}`
              : `${phoneDevice?.host_ip}:${phoneDevice?.adb}`
          }}
        </p>
      </div>
      <div class="window-header-right">
        <SvgIcon
          name="pinToTop"
          :size="14"
          @click="handleTop"
          :color="isTop ? 'var(--el-color-primary)' : ''"
        />
        <el-icon :size="14" @click="ipc.minimize()">
          <Minus />
        </el-icon>
        <el-icon :size="14" @click="ipc.maximize()">
          <CopyDocument />
        </el-icon>
        <el-icon :size="16" @click="handleClose">
          <Close />
        </el-icon>
      </div>
    </div>

    <div class="window-content">
      <!-- 状态遮罩层 - 移至此处以覆盖整个内容区域(包括侧边栏) -->
      <transition name="fade">
        <div v-if="stateConfig" class="device-state-mask">
          <div class="state-content">
            <div class="icon-wrapper" :style="{ background: stateConfig.bgColor }">
              <el-icon
                class="state-icon"
                :class="{ 'is-loading': stateConfig.spin }"
                :style="{ color: stateConfig.color }"
              >
                <component :is="stateConfig.icon" />
              </el-icon>
            </div>
            <div class="state-info">
              <div class="state-text">{{ stateConfig.label }}</div>
              <div class="state-desc" v-if="stateConfig.desc">{{ stateConfig.desc }}</div>
              <div
                class="state-action"
                v-if="(stateConfig as any).showStartButton"
                style="margin-top: 20px"
              >
                <el-button type="primary" :icon="VideoPlay" @click="handleStartDevice" round>
                  {{ t('phone.powerOnNow') }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <div class="window-phone">
        <div class="window-phone-content">
          <div
            id="canvas-container"
            class="window-phone-container"
            tabindex="0"
            style="outline: none"
          >
            <!-- 屏幕区域 -->
          </div>

          <div class="window-phone-controls">
            <div
              v-for="item in displayToolbarItems"
              :key="item.action"
              class="window-phone-controls-item"
              :class="{
                active: activeTool === item.action,
                disabled: item.disabled || !isClientReady || isActionPending(item.action)
              }"
              @click="handleToolClick(item.action)"
            >
              <el-icon :size="14">
                <component :is="item.icon" v-if="item.icon" />
                <SvgIcon :name="item.svgIcon" :width="19" :height="19" v-else />
              </el-icon>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </div>

        <div class="window-phone-bottom">
          <div
            class="window-phone-bottom-item"
            :class="{ disabled: !isClientReady || isActionPending('back') }"
            @click="handleToolClick('back')"
          >
            <el-icon>
              <ArrowLeft />
            </el-icon>
          </div>
          <div
            class="window-phone-bottom-item"
            :class="{ disabled: !isClientReady || isActionPending('home') }"
            @click="handleToolClick('home')"
          >
            <el-icon>
              <HomeFilled />
            </el-icon>
          </div>
          <div
            class="window-phone-bottom-item"
            :class="{ disabled: !isClientReady || isActionPending('menu') }"
            @click="handleToolClick('menu')"
          >
            <el-icon>
              <MenuIcon />
            </el-icon>
          </div>
        </div>
      </div>

      <!-- 右侧 Panel -->
      <div
        v-if="activeTool"
        class="window-panel"
        :style="{ width: getPanelWidth(activeTool) + 'px' }"
      >
        <upload-file
          v-show="activeTool === 'install'"
          :host="phoneDevice?.host_ip || ''"
          :device-id="deviceId"
          :title="t('phone.appUpload')"
          :url="buildApiUrl(phoneDevice?.host_ip || '', API_CONFIG.PATHS.UPLOAD_BATCH)"
          :allowed-extensions="['apk', 'xapk']"
        />

        <file-transfer
          v-show="activeTool === 'import'"
          :host="phoneDevice?.host_ip || ''"
          :device-id="deviceId"
          :device="phoneDevice"
          :upload-url="buildApiUrl(phoneDevice?.host_ip || '', API_CONFIG.PATHS.UPLOAD_SINGLE)"
        />

        <!-- 群控日志面板 -->
        <div v-show="activeTool === 'groupLog'" class="log-panel-content">
          <div class="log-header">
            <div class="title-area">
              <span class="title">{{ t('phone.groupRoom') }}</span>
              <el-tag effect="plain" type="primary" round size="small" class="count-tag">
                {{ t('phone.online') }}: {{ activeGroupDevices.size }}
              </el-tag>
            </div>
            <el-button link type="primary" size="small" @click="groupLogs = []">{{
              t('phone.clear')
            }}</el-button>
          </div>
          <div class="log-list">
            <div v-for="(log, idx) in groupLogs" :key="idx" class="log-item">
              <div class="log-row">
                <span class="log-time">{{ log.time }}</span>
                <div class="log-device-info" :title="`${log.deviceName}\n${log.deviceId}`">
                  <span class="device-name">{{ log.deviceName }}</span>
                  <span class="device-id">{{ log.deviceId }}</span>
                </div>
                <el-tag
                  size="small"
                  :type="log.type === 'join' ? 'success' : 'info'"
                  effect="light"
                  class="log-tag"
                >
                  {{ log.type === 'join' ? t('phone.join') : t('phone.leave') }}
                </el-tag>
              </div>
              <div v-if="log.type === 'leave' && log.reason" class="log-reason">
                {{ log.reason }}
              </div>
            </div>
            <div v-if="groupLogs.length === 0" class="empty-tip">{{ t('phone.noActivity') }}</div>
          </div>
        </div>
        <simulation v-if="activeTool === 'simulation'"></simulation>
      </div>
    </div>

    <new-machine ref="newMachineRef" />
  </div>
</template>
<script setup lang="ts">
import { WINDOW_RESIZE, WINDOW_TOP } from '@renderer/core/ipc'
import {
  onMounted,
  ref,
  reactive,
  onUnmounted,
  watch,
  computed,
  toRaw,
  nextTick,
  provide
} from 'vue'
import { ElMessage, ElTag } from 'element-plus'
import { MacvlanPortMap } from '@renderer/utils/constant'
import { useRoute } from 'vue-router'
import { buildDeviceApiUrl, API_CONTROL_CONFIG } from '@shared/api/controlConfig'

import { request } from '@shared/api'
import {
  Download,
  Document,
  Plus,
  Minus,
  RefreshRight,
  Picture,
  Refresh,
  SwitchButton,
  ArrowLeft,
  HomeFilled,
  Menu as MenuIcon,
  Close,
  Iphone,
  Loading,
  Warning,
  CircleClose,
  VideoPause,
  Connection,
  VideoPlay,
  Notebook
} from '@element-plus/icons-vue'

import {
  VmosEdgeClient,
  VmosEdgeClientEvents,
  VmosEdgeErrorType,
  AndroidKeyCode,
  AndroidMetaState
} from '@vmosedge/web-sdk'

import { ipc } from '@renderer/core/ipc'
import { API_CONFIG, buildApiUrl } from '@shared/api'
import { ElMessageBox } from 'element-plus'
import uploadFile from './modules/uploadFile.vue'
import fileTransfer from './modules/fileTransfer.vue'
import { DATA_EVENTS, Device, DeviceState, Host } from '@shared/ipc/data.types'
import { copyToClipboard, getAndroidKeyCode, buildMetaState, formatTime } from '@renderer/utils'
import { getErrorMessage } from '@shared/api'
import newMachine from '@renderer/views/cloudPhone/modules/newMachine.vue'
import simulation from './modules/simulation.vue'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { logVmosEdgeClientInternalError } from '@renderer/utils/vmosEdgeClientLogger'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/** SCD 配置查询接口返回结构 */
interface ScdConfigResponse {
  code?: number
  data?: {
    config?: { audio?: string; [k: string]: string | undefined }
    db_id?: string
    host_ip?: string
  }
  msg?: string
}

/** 查询 SCD 配置（含 config.audio 等） */
async function getScdConfig(hostIp: string, dbId: string): Promise<ScdConfigResponse | null> {
  const url = buildApiUrl(hostIp, `${API_CONFIG.PATHS.GET_SCD_CONFIG}/${dbId}`)
  try {
    return await request.get<ScdConfigResponse>(url)
  } catch (e) {
    console.warn('[Phone] GET scd_config failed:', e)
    return null
  }
}

/** 设置 SCD 配置（只传 config 对象） */
async function setScdConfig(
  hostIp: string,
  dbId: string,
  config: Record<string, string>
): Promise<void> {
  const url = buildApiUrl(hostIp, `${API_CONFIG.PATHS.POST_SCD_CONFIG}/${dbId}`)
  await request.post(url, config)
}

/** 重启 SCD 推流服务 */
async function restartScd(hostIp: string, dbId: string): Promise<void> {
  const url = buildApiUrl(hostIp, `${API_CONFIG.PATHS.POST_SCD_RESTART}/${dbId}`)
  await request.post(url)
}

const getDeviceStateLabel = (s?: string) => {
  if (!s) return ''
  // 尝试获取翻译，如果 key 不存在会直接返回 key，这里我们假设 key 是英文状态名
  const label = t(`common.deviceStates.${s}`)
  // 如果翻译结果包含了 'common.deviceStates' 说明没翻译到 (vue-i18n 的默认行为是返回 key path)
  // 不过通常配置可能是返回 key。为了安全起见：
  return label.includes('common.deviceStates') ? s : label
}

/* ---------------------
   基础参数
   ---------------------- */
const route = useRoute()
const deviceId = route.query.deviceId as string
// const isMaster = route.query.isMaster as string
const isMaster = ref(route.query.isMaster === '1')

interface GroupLog {
  time: string
  type: 'join' | 'leave'
  deviceName: string
  deviceId: string
  reason?: string
}
const groupLogs = ref<GroupLog[]>([])
// 记录当前活跃的群控设备 ID -> Name
const activeGroupDevices = ref<Map<string, string>>(new Map())

/* ---------------------
   状态管理
   ---------------------- */
const deviceState = ref<DeviceState>()
const isTop = ref(false)
const rotationType = ref(0)
const isClientReady = ref(false)
const clientError = ref<string | null>(null)
const phoneDevice = ref<Device>()
const newMachineRef = ref<InstanceType<typeof newMachine>>()
const isFirstSizeChange = ref(true)
const isAudioEnabled = ref(false)
const pendingActions = reactive(new Set<string>())
let client: VmosEdgeClient | null = null

// 提供设备信息给子组件
provide('phoneDevice', phoneDevice)
provide('deviceId', ref(deviceId))

// 状态 UI 配置
const stateConfig = computed(() => {
  const s = deviceState.value

  // 初始加载状态
  if (!s) {
    return {
      icon: Loading,
      label: t('phone.connecting'),
      desc: t('phone.connectingDesc'),
      spin: true,
      color: 'var(--el-color-primary)',
      bgColor: 'var(--el-color-primary-light-9)'
    }
  }

  // 客户端连接错误
  if (clientError.value) {
    return {
      icon: CircleClose,
      label: t('phone.videoConnectFailed'),
      desc: clientError.value,
      spin: false,
      color: 'var(--el-color-danger)',
      bgColor: 'var(--el-color-danger-light-9)'
    }
  }

  // 运行中状态处理
  if (s === DeviceState.StateRunning) {
    // 如果设备运行中但画面未连接，显示连接画面状态
    if (!isClientReady.value) {
      return {
        icon: Loading,
        label: t('phone.connectingVideo'),
        desc: t('phone.connectingVideoDesc'),
        spin: true,
        color: 'var(--el-color-primary)',
        bgColor: 'var(--el-color-primary-light-9)'
      }
    }
    return null
  }

  const label = getDeviceStateLabel(s) || s

  // 根据不同状态返回不同的 UI 配置
  switch (s) {
    // 加载/处理类状态
    case DeviceState.StateCreating:
    case DeviceState.StateStarting:
    case DeviceState.StatePendingBackup:
    case DeviceState.StateBackingUp:
    case DeviceState.StateDownloading:
    case DeviceState.StateRebooting:
    case DeviceState.StateRebuilding:
    case DeviceState.StateRenewing:
    case DeviceState.StateUpgrading:
      return {
        icon: Loading,
        label,
        desc: t('common.processing'),
        spin: true,
        color: 'var(--el-color-primary)',
        bgColor: 'var(--el-color-primary-light-9)'
      }

    // 停止/删除类状态
    case DeviceState.StateStopping:
    case DeviceState.StateDeleting:
      return {
        icon: Loading, // 或者使用 Delete/SwitchButton 但带旋转
        label,
        desc: t('phone.stopping'),
        spin: true,
        color: 'var(--el-color-danger)',
        bgColor: 'var(--el-color-danger-light-9)'
      }

    // 静态状态 - 已停止
    case DeviceState.StateStopped:
    case DeviceState.StateExited:
      return {
        icon: SwitchButton,
        label: t('phone.stopped'),
        desc: t('phone.stoppedDesc'),
        spin: false,
        color: 'var(--el-text-color-secondary)',
        bgColor: 'var(--el-fill-color-light)',
        showStartButton: true
      }

    // 静态状态 - 已暂停
    case DeviceState.StatePaused:
      return {
        icon: VideoPause,
        label: t('phone.paused'),
        desc: t('phone.pausedDesc'),
        spin: false,
        color: 'var(--el-color-warning)',
        bgColor: 'var(--el-color-warning-light-9)'
      }

    // 静态状态 - 离线
    case DeviceState.StateOffline:
      return {
        icon: Connection,
        label: t('phone.offline'),
        desc: t('phone.offlineDesc'),
        spin: false,
        color: 'var(--el-text-color-secondary)',
        bgColor: 'var(--el-fill-color-light)'
      }

    // 错误状态
    case DeviceState.StateFailed:
      return {
        icon: CircleClose,
        label: t('phone.startFailed'),
        desc: t('phone.startFailedDesc'),
        spin: false,
        color: 'var(--el-color-danger)',
        bgColor: 'var(--el-color-danger-light-9)'
      }

    default:
      return {
        icon: Warning,
        label,
        desc: t('phone.statusUnknown'),
        spin: false,
        color: 'var(--el-color-warning)',
        bgColor: 'var(--el-color-warning-light-9)'
      }
  }
})

const handleCopy = (text: string) => {
  if (!text) return
  copyToClipboard(text, () => ElMessage.success(t('phone.copySuccess')))
}
// 群控设备监听
let groupControlListener: (() => void) | null = null

// 首次主动获取群控设备然后监听群控设备变化
const getGroupControlDevices = (client: VmosEdgeClient) => {
  if (groupControlListener) {
    groupControlListener()
    groupControlListener = null
  }

  let previousTargets: Device[] = []

  ipc.send(DATA_EVENTS.GET_GROUP_CONTROL_DEVICES)

  groupControlListener = ipc.on(DATA_EVENTS.GROUP_CONTROL_DEVICES, (res: any) => {
    if (res) {
      let { isGroupControl, targets, masterId } = res
      isMaster.value = masterId === deviceId

      // 确保受控列表不包含自己
      if (targets && Array.isArray(targets)) {
        targets = targets.filter((t: Device) => t.id !== deviceId)
      }

      if (isGroupControl && isMaster.value) {
        // 找出在上一次 targets 中但不在本次 targets 中的设备
        const currentTargetIds = new Set((targets || []).map((t: Device) => t.id))
        const removedTargets = previousTargets.filter((t) => !currentTargetIds.has(t.id))

        // 更新 previousTargets
        previousTargets = targets || []

        const { running, stopped } = (targets || []).reduce(
          (acc: { running: Device[]; stopped: Device[] }, item: Device) => {
            if (item.state === DeviceState.StateRunning) {
              acc.running.push(item)
            } else {
              acc.stopped.push(item)
            }
            return acc
          },
          {
            running: [],
            stopped: []
          }
        )

        // --- 日志记录逻辑 Start ---
        const currentRunningIds = new Set(running.map((t) => t.id))

        // 1. 检查新加入的 (在 running 中但不在 activeGroupDevices)
        running.forEach((device) => {
          if (!activeGroupDevices.value.has(device.id)) {
            activeGroupDevices.value.set(device.id, device.user_name || device.id)
            groupLogs.value.unshift({
              time: formatTime(Date.now(), 'HH:mm:ss'),
              type: 'join',
              deviceName: device.user_name || device.id,
              deviceId: device.id
            })
          }
        })

        // 2. 检查离开的 (在 activeGroupDevices 中但不在 running)
        // copy keys to avoid modification during iteration
        const activeIds = Array.from(activeGroupDevices.value.keys())
        const leavingIds = activeIds.filter((id) => !currentRunningIds.has(id))

        if (leavingIds.length > 0) {
          // 保存需要使用的名称，因为 activeGroupDevices 即将被清理
          const leavingNames = new Map<string, string>()
          leavingIds.forEach((id) => {
            leavingNames.set(id, activeGroupDevices.value.get(id) || t('phone.unknownDevice'))
            activeGroupDevices.value.delete(id)
          })

          // 批量检查状态
          // 1. 先检查是否在 stopped 列表中（已知的停止状态）
          const knownStoppedDevices = new Map<string, Device>()
          const unknownStatusIds: string[] = []

          leavingIds.forEach((id) => {
            const deviceInStopped = stopped.find((t) => t.id === id)
            if (deviceInStopped) {
              knownStoppedDevices.set(id, deviceInStopped)
            } else {
              unknownStatusIds.push(id)
            }
          })

          // 2. 对于未知状态的设备，批量查询一次
          ;(async () => {
            let remoteDevicesMap = new Map<string, Device>()
            if (unknownStatusIds.length > 0) {
              try {
                const res = await ipc.invoke<Device[]>(
                  DATA_EVENTS.GET_DEVICES_BY_IDS,
                  unknownStatusIds
                )
                if (res.success && res.data) {
                  res.data.forEach((d: Device) => {
                    remoteDevicesMap.set(d.id, d)
                  })
                }
              } catch (e) {
                console.error('Failed to batch check device status', e)
              }
            }

            // 3. 生成日志 (在数据准备好后统一生成)
            leavingIds.forEach((id) => {
              const name = leavingNames.get(id) || t('phone.unknownDevice')
              let reason = t('phone.deviceRemoved')

              // 优先使用已知状态
              if (knownStoppedDevices.has(id)) {
                const dev = knownStoppedDevices.get(id)!
                reason = `${t('phone.deviceStopped')} (${getDeviceStateLabel(dev.state) || dev.state})`
              }
              // 其次使用远程查询到的状态
              else if (remoteDevicesMap.has(id)) {
                const dev = remoteDevicesMap.get(id)!
                if (dev.state !== DeviceState.StateRunning) {
                  reason = `${t('phone.deviceStopped')} (${getDeviceStateLabel(dev.state) || dev.state})`
                }
              }

              groupLogs.value.unshift({
                time: formatTime(Date.now(), 'HH:mm:ss'),
                type: 'leave',
                deviceName: name,
                deviceId: id,
                reason
              })
            })
          })()
        }
        // --- 日志记录逻辑 End ---

        client?.joinGroupControl(
          running.map((item) => ({
            deviceId: item.id,
            ip: item.network_mode === 'macvlan' ? item.ip || '' : item.host_ip || '',
            ports: {
              touch:
                item.network_mode === 'macvlan'
                  ? MacvlanPortMap.touch
                  : Number(item.tcp_control_port)
            }
          }))
        )

        // 合并已停止的设备和已移除的设备
        const targetsToLeave = [...stopped, ...removedTargets]

        client?.leaveGroupControl(
          targetsToLeave.map((item) => ({
            deviceId: item.id,
            ip: item.host_ip || '',
            ports: {
              touch: Number(item.tcp_control_port)
            }
          }))
        )
      } else {
        activeGroupDevices.value.clear()
        groupLogs.value = []
        previousTargets = []
        activeTool.value = null
        client?.setGroupControlMode(false)
      }
    }
  })
}

/* ---------------------
   VmosEdge 客户端控制
   ---------------------- */
const startClient = () => {
  if (!phoneDevice.value?.id || !phoneDevice.value?.host_ip) return

  // 防止重复启动
  if (client) return

  // 重置就绪状态
  isClientReady.value = false
  clientError.value = null
  isFirstSizeChange.value = true

  const container = document.getElementById('canvas-container') as HTMLElement
  if (!container) return

  console.log('[Phone] Starting VmosEdge client...')

  console.log({
    deviceId: phoneDevice.value?.id || '',
    ip:
      phoneDevice.value?.network_mode === 'macvlan'
        ? phoneDevice.value?.ip || ''
        : phoneDevice.value?.host_ip || '',
    ports: {
      video:
        phoneDevice.value?.network_mode === 'macvlan'
          ? MacvlanPortMap.video
          : phoneDevice.value?.tcp_port || 0,
      audio:
        phoneDevice.value?.network_mode === 'macvlan'
          ? MacvlanPortMap.audio
          : phoneDevice.value?.tcp_audio_port || 0,
      touch:
        phoneDevice.value?.network_mode === 'macvlan'
          ? MacvlanPortMap.touch
          : phoneDevice.value?.tcp_control_port || 0
    }
  })

  if (VmosEdgeClient.isWebCodecsSupported()) {
    console.log('startClient isWebCodecsSupported')
  } else {
    console.log('startClient is not WebCodecsSupported')
  }
  client = new VmosEdgeClient({
    config: {
      ip:
        phoneDevice.value?.network_mode === 'macvlan'
          ? phoneDevice.value?.ip || ''
          : phoneDevice.value?.host_ip || '',
      deviceId: phoneDevice.value?.id || '',
      ports: {
        video:
          phoneDevice.value?.network_mode === 'macvlan'
            ? MacvlanPortMap.video
            : phoneDevice.value?.tcp_port || 0,
        audio:
          phoneDevice.value?.network_mode === 'macvlan'
            ? MacvlanPortMap.audio
            : phoneDevice.value?.tcp_audio_port || 0,
        touch:
          phoneDevice.value?.network_mode === 'macvlan'
            ? MacvlanPortMap.touch
            : phoneDevice.value?.tcp_control_port || 0
      }
    },
    container,
    mediaType: isAudioEnabled.value ? 2 : 1,
    // 开启群控
    isGroupControl: isMaster.value,
    retryCount: 10,
    retryInterval: 5000,
    // videoCodecPreference: videoCodecPreference.value,
    // renderPreference: renderPreference.value,
    scrollSpeedRatio: wheelSpeed.value,
    hoverMoveKeep: keepHoverMove.value,
    onInternalError: (error, info: any) => {
      logVmosEdgeClientInternalError('Phone', error, info)
    }
  })

  client.on(VmosEdgeClientEvents.STARTED, () => {
    console.log('[Phone] VmosEdge client started')
    isClientReady.value = true
    if (!isAudioEnabled.value) {
      client?.disableAudio()
    }
  })

  client.on(VmosEdgeClientEvents.VIDEO_DECODER_STATS, (stats) => {
    globalThis.isDebug && console.log('[Phone] VmosEdge video decoder stats:', stats)
  })

  // 监听通道连接成功事件（SDK 新增功能）
  client.on(VmosEdgeClientEvents.CHANNEL_CONNECTED, (data) => {
    if (data.allChannelsStatus) {
      console.log('[Phone] All channels status:', data.allChannelsStatus)

      if (
        data.allChannelsStatus.touch === 'connected' &&
        data.allChannelsStatus.video === 'connected'
      ) {
        getGroupControlDevices(client as VmosEdgeClient)
      }
    }
  })

  // 统一的错误处理（按类型单独触发）
  client.on(VmosEdgeClientEvents.ERROR, (error) => {
    console.error('[Phone] VmosEdge error:', error)

    // 直接使用错误消息（SDK 已经提取好了）
    const errorMessage = error.message || ''

    // 根据错误类型进行不同的处理
    if (error.type === VmosEdgeErrorType.VIDEO) {
      // 视频通道错误，停止客户端
      clientError.value = `[${VmosEdgeErrorType.VIDEO}]${errorMessage || t('phone.videoChannelFailed')}`
      isClientReady.value = false
    } else if (error.type === VmosEdgeErrorType.TOUCH) {
      // 触控通道错误，不影响视频显示，只记录错误
      clientError.value = `[${VmosEdgeErrorType.TOUCH}]${errorMessage || t('phone.touchChannelFailed')}`
      isClientReady.value = false
    }
  })

  client.on(VmosEdgeClientEvents.CLIPBOARD_CHANGED, (content) => {
    console.log('[Phone] VmosEdge clipboard changed:', content)
    copyToClipboard(content)
  })

  client.on(VmosEdgeClientEvents.SIZE_CHANGED, ({ rotation, idealWidth, idealHeight }) => {
    rotationType.value = rotation

    let displayWidth = idealWidth
    let displayHeight = idealHeight

    if (isFirstSizeChange.value) {
      // 计算缩放比例，使最长边为 MAX_DISPLAY_SIDE
      const maxSide = Math.max(idealWidth, idealHeight)
      const scale = MAX_DISPLAY_SIDE.value / maxSide

      displayWidth = Math.round(idealWidth * scale)
      displayHeight = Math.round(idealHeight * scale)
      isFirstSizeChange.value = false
    }

    // 更新 canvas 容器大小
    const baseWidth = displayWidth + controlsWidth
    const baseHeight = displayHeight + headerHeight + bottomHeight
    setPhoneContainerSize(baseWidth, baseHeight)
    // 加上侧边 panel 宽度
    const panelWidth = getPanelWidth(activeTool.value)
    setWindowSize(baseWidth + panelWidth, baseHeight)
  })

  client.start()
}

const stopClient = () => {
  isClientReady.value = false
  clientError.value = null
  groupControlListener?.()
  groupControlListener = null
  if (client) {
    console.log('[Phone] Stopping VmosEdge client...')
    client.stop()
    client = null
  }
}

// 监听状态变化，控制 client 启停
watch(
  () => deviceState.value,
  (newState) => {
    console.log('[Phone] Device state changed:', newState)
    if (newState === DeviceState.StateRunning) {
      startClient()
    } else {
      stopClient()
    }
  }
)

let listenerOffs: (() => void)[] = []

const initListener = () => {
  listenerOffs = [
    // 监听设备更新
    ipc.on(DATA_EVENTS.DEVICE_UPDATED, (device: Device) => {
      deviceState.value = device.state
    }),
    // 监听设备删除
    ipc.on(DATA_EVENTS.DEVICE_DELETED, () => {
      console.log('[Phone] Device deleted, closing window')
      ipc.close()
    })
  ]
}

/* ---------------------
   工具栏配置
---------------------- */
const toolbarItems = computed(() => [
  { icon: Download, label: t('phone.app'), action: 'install', panelWidth: 550, disabled: false },
  { icon: Document, label: t('phone.file'), action: 'import', panelWidth: 550, disabled: false },
  { icon: Plus, label: t('phone.volumeUp'), action: 'volumeUp', panelWidth: 0, disabled: false },
  {
    icon: Minus,
    label: t('phone.volumeDown'),
    action: 'volumeDown',
    panelWidth: 0,
    disabled: false
  },
  {
    svgIcon: isAudioEnabled.value ? 'noplay' : 'play',
    label: isAudioEnabled.value ? t('phone.disableSound') : t('phone.enableSound'),
    action: 'toggleAudio',
    panelWidth: 0,
    disabled: false
  },
  {
    icon: RefreshRight,
    label: t('phone.rotate'),
    action: 'rotate',
    panelWidth: 0,
    disabled: false
  },
  {
    icon: SwitchButton,
    label: t('phone.shutdown'),
    action: 'shutDown',
    panelWidth: 0,
    disabled: false
  },
  {
    icon: Picture,
    label: t('phone.screenshot'),
    action: 'screenshot',
    panelWidth: 0,
    disabled: false
  },
  // { icon: FolderOpened, label: '截图目录', action: 'screenshotFolder', panelWidth: 300 },
  { icon: Refresh, label: t('phone.restart'), action: 'restart', panelWidth: 0, disabled: false },
  {
    icon: Iphone,
    label: t('phone.resetDevice'),
    action: 'resetDevice',
    panelWidth: 300,
    disabled: false
  },
  {
    icon: Notebook,
    label: t('phone.groupRoom'),
    action: 'groupLog',
    panelWidth: 300,
    disabled: false
  },
  {
    svgIcon: 'simulation',
    label: t('phone.simulator'),
    action: 'simulation',
    panelWidth: 700,
    disabled: false
  }
])

const displayToolbarItems = computed(() => {
  return toolbarItems.value.filter((item) => {
    if (item.action === 'groupLog') return isMaster.value
    return true
  })
})

/* ---------------------
   面板状态管理（核心）
---------------------- */
const activeTool = ref<string | null>(null)

const toggleTool = (action: string) => {
  activeTool.value = activeTool.value === action ? null : action
}

const getPanelWidth = (action: string | null) => {
  if (!action) return 0
  const item = toolbarItems.value.find((i) => i.action === action)
  return item?.panelWidth ?? 0
}

/* ---------------------
   手机屏幕容器记录
---------------------- */
const controlsWidth = 42
const headerHeight = 38
const bottomHeight = 45

const MAX_DISPLAY_SIDE = ref(600)
const videoCodecPreference = ref<any>('no-preference')
const renderPreference = ref<any>('low-power')
const wheelSpeed = ref(200)
const keepHoverMove = ref(false)
const phoneContainerSize = ref({ width: 400, height: 712 })

const setPhoneContainerSize = (width: number, height: number) => {
  phoneContainerSize.value = { width, height }
}

const setWindowSize = (width: number, height: number) => {
  ipc.send(WINDOW_RESIZE, { width, height })
}

const ACTION_LOCK_DELAY = 300

const isActionPending = (action: string) => pendingActions.has(action)

const runWithActionLock = async (
  action: string,
  handler: () => void | Promise<void>,
  delay = ACTION_LOCK_DELAY
) => {
  if (pendingActions.has(action)) return

  pendingActions.add(action)

  try {
    await handler()
  } finally {
    window.setTimeout(() => {
      pendingActions.delete(action)
    }, delay)
  }
}

/* ---------------------
   工具栏点击行为
---------------------- */

const handleToggleAudio = async () => {
  if (!client) return

  const hostIp = phoneDevice.value?.host_ip || ''
  const dbId = phoneDevice.value?.db_id || phoneDevice.value?.id || ''

  try {
    // 开启/关闭都先获取一次 config，再按需设置
    let res: ScdConfigResponse | null = null
    if (hostIp && dbId) {
      res = await getScdConfig(hostIp, dbId)
      if (res == null) {
        ElMessage.warning(t('phone.audioQueryFailed'))
        return
      }
    }

    const config = res?.data?.config || {}

    if (isAudioEnabled.value) {
      // 关闭音频：覆盖 audio 后只传 config 给设置接口，再调 SDK 关闭
      if (hostIp && dbId) {
        try {
          await setScdConfig(hostIp, dbId, {
            scdArgs: JSON.stringify({ ...config, audio: 'false' })
          })
        } catch (e) {
          ElMessage.warning(t('phone.audioSetFailed'))
          return
        }
      }
      client.disableAudio()
      isAudioEnabled.value = false
      return
    }

    // 开启音频：配置里未开启则覆盖 audio、只传 config 给设置接口、重启推流，再调 SDK
    if (hostIp && dbId && config.audio !== 'true') {
      try {
        await setScdConfig(hostIp, dbId, { scdArgs: JSON.stringify({ ...config, audio: 'true' }) })
      } catch (e) {
        ElMessage.warning(t('phone.audioSetFailed'))
        return
      }
      try {
        await restartScd(hostIp, dbId)
      } catch (e) {
        ElMessage.warning(t('phone.audioRestartScdTip'))
        return
      }
    }

    await client.enableAudio()
    isAudioEnabled.value = true
  } catch (error) {
    console.error('[Phone] Toggle audio failed:', error)
    ElMessage.error(t('phone.enableSoundFailed'))
  }
}

const handleToolClick = async (action: string) => {
  if (!client || !isClientReady.value || isActionPending(action)) return

  const currentClient = client
  console.log('Tool clicked:', action)
  const item = toolbarItems.value.find((i) => i.action === action)
  if (item?.disabled) return

  await runWithActionLock(action, async () => {
    switch (action) {
      case 'install':
        toggleTool(action)
        currentClient.clickKey(AndroidKeyCode.ControlLeft)
        break
      case 'import':
        toggleTool(action)
        break
      case 'groupLog':
        toggleTool(action)
        break
      case 'rotate':
        currentClient.setRotation(rotationType.value === 0 ? 1 : 0)
        break
      case 'shutDown':
        await handleShutDownDevice()
        break
      case 'volumeUp':
        currentClient.volumeUp()
        break
      case 'volumeDown':
        currentClient.volumeDown()
        break
      case 'toggleAudio':
        await handleToggleAudio()
        break
      case 'screenshot':
        await handleScreenshotDevice(item)
        break
      case 'screenshotFolder':
        break
      case 'restart':
        await handleRestartDevice()
        break
      case 'resetDevice':
        await handleResetDevice()
        break
      case 'home':
        currentClient.home()
        break
      case 'menu':
        currentClient.menu()
        break
      case 'back':
        currentClient.back()
        break
      case 'simulation':
        await handleSimulation(action)
        break
    }
  })
}

const handleSimulation = async (action: string) => {
  const url = buildDeviceApiUrl(
    phoneDevice.value?.host_ip || '',
    phoneDevice.value?.id || '',
    API_CONTROL_CONFIG.PATHS.GET_API_VERSION
  )
  try {
    const res = await request.get(url)
    if (res?.data?.version_code >= 10400) {
      toggleTool(action)
    } else {
      ElMessage.error(t('phone.simulatorNotSupported'))
    }
  } catch (error: any) {
    if (error?.code == 404) {
      ElMessage.error(t('phone.simulatorNotSupported'))
    } else {
      ElMessage.error(getErrorMessage(error))
    }
  }
}

const handleRestartDevice = async () => {
  try {
    await ElMessageBox.confirm(t('phone.restartConfirm'), t('common.tips'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  const res = await ipc.invoke(DATA_EVENTS.DEVICE_RESTARTED, [toRaw(phoneDevice.value)])
  if (res.success) {
    ElMessage.success(t('common.operationSuccess'))
  } else {
    ElMessage.error(getErrorMessage(res.error) || t('phone.restartFailed'))
  }
}
const handleResetDevice = async () => {
  const host = await ipc.invoke<Host>(DATA_EVENTS.GET_HOST_BY_IP, phoneDevice.value?.host_ip || '')
  const hostMap = new Map<string, Host>()
  if (host.success) {
    hostMap.set(host.data?.ip || '', host.data as Host)
    newMachineRef.value?.init([phoneDevice.value as Device], hostMap)
  } else {
    ElMessage.error(getErrorMessage(host.error) || t('phone.getHostInfoFailed'))
  }
}
const handleShutDownDevice = async () => {
  try {
    await ElMessageBox.confirm(t('phone.shutdownConfirm'), t('common.tips'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  const res = await ipc.invoke(DATA_EVENTS.DEVICE_SHUTDOWNED, [toRaw(phoneDevice.value)])
  if (res.success) {
    ElMessage.success(t('common.operationSuccess'))
  } else {
    ElMessage.error(getErrorMessage(res.error) || t('phone.shutdownFailed'))
  }
}

const handleStartDevice = async () => {
  if (!phoneDevice.value) return
  ipc.invoke(DATA_EVENTS.DEVICE_STARTED, [toRaw(phoneDevice.value)]).then((res) => {
    if (res.success) {
      ElMessage.success(t('phone.powerOnSent'))
    } else {
      ElMessage.error(getErrorMessage(res.error) || t('phone.powerOnFailed'))
    }
  })
}

const handleScreenshotDevice = async (item: any) => {
  try {
    item.disabled = true
    const res = await ipc.invoke(DATA_EVENTS.DEVICE_SCREENSHOT, toRaw(phoneDevice.value))

    if (res.success) {
      ElMessage.success(t('common.operationSuccess'))
    } else {
      ElMessage.error(getErrorMessage(res.error) || t('common.operationFailed'))
    }
  } finally {
    item.disabled = false
  }
}
const handleTop = () => {
  isTop.value = !isTop.value
  ipc.send(WINDOW_TOP, isTop.value)
}

const handleClose = async () => {
  if (isMaster.value) {
    try {
      await ElMessageBox.confirm(t('phone.closeMasterConfirm'), t('common.tips'), {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      })

      ipc.close()
    } catch {
      // 用户取消关闭，不做任何操作
    }
  } else {
    // 非主控窗口直接关闭
    ipc.close()
  }
}

/* ---------------------
   面板开关影响窗口大小
---------------------- */
watch(
  () => activeTool.value,
  () => {
    const panelWidth = getPanelWidth(activeTool.value)
    setWindowSize(phoneContainerSize.value.width + panelWidth, phoneContainerSize.value.height)
  }
)

const getDevice = async () => {
  const res = await ipc.invoke(DATA_EVENTS.GET_DEVICE_BY_ID, deviceId)
  if (res.success) {
    phoneDevice.value = res.data as Device
    deviceState.value = phoneDevice.value?.state
    nextTick(() => {
      document.title = phoneDevice.value?.user_name
        ? isMaster.value
          ? t('phone.windowTitleMaster', { name: phoneDevice.value?.user_name })
          : t('phone.windowTitle', { name: phoneDevice.value?.user_name })
        : t('phone.appName')
    })
  }
}

/* ---------------------
   生命周期
---------------------- */
onMounted(async () => {
  // 获取配置
  try {
    const res = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.MAX_DISPLAY_SIDE)
    if (res.success && res.data) {
      const side = parseInt(res.data)
      if (!isNaN(side) && side >= 300) {
        MAX_DISPLAY_SIDE.value = side
      }
    }
    // const videoCodecRes = await ipc.invoke<string>(
    //   CONFIG_EVENTS.GET_CONFIGS,
    //   CONFIG_KEYS.VIDEO_CODEC_PREFERENCE
    // )
    // if (videoCodecRes.success && videoCodecRes.data) {
    //   videoCodecPreference.value = videoCodecRes.data
    // }
    // const renderRes = await ipc.invoke<string>(
    //   CONFIG_EVENTS.GET_CONFIGS,
    //   CONFIG_KEYS.RENDER_PREFERENCE
    // )
    // if (renderRes.success && renderRes.data) {
    //   renderPreference.value = renderRes.data
    // }

    const wheelSpeedRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.WHEEL_SPEED
    )
    if (wheelSpeedRes.success && wheelSpeedRes.data) {
      const val = parseFloat(wheelSpeedRes.data)
      if (!isNaN(val)) wheelSpeed.value = val
    }

    const keepHoverMoveRes = await ipc.invoke<string>(
      CONFIG_EVENTS.GET_CONFIGS,
      CONFIG_KEYS.KEEP_HOVER_MOVE
    )
    if (keepHoverMoveRes.success && keepHoverMoveRes.data) {
      keepHoverMove.value = keepHoverMoveRes.data === '1'
    }

    console.log('videoCodecPreference', videoCodecPreference.value)
    console.log('renderPreference', renderPreference.value)
    console.log('MAX_DISPLAY_SIDE', MAX_DISPLAY_SIDE.value)
    console.log('wheelSpeed', wheelSpeed.value)
    console.log('keepHoverMove', keepHoverMove.value)
    console.log('isWebCodecsSupported', VmosEdgeClient.isWebCodecsSupported())
  } catch (e) {
    console.error('Failed to load display config', e)
  }

  // 默认开启群控日志面板
  if (isMaster.value) {
    activeTool.value = 'groupLog'
  }
  getDevice()
  initListener()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  stopClient()
  listenerOffs.forEach((off) => off?.())
  listenerOffs = []
  window.removeEventListener('keydown', handleGlobalKeydown)
})

/* ---------------------
   全局键盘事件监听
---------------------- */
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (!client) return

  // 🚀 核心逻辑：只有当焦点在云机容器（或其内部）时，才拦截并发送快捷键给安卓
  const canvasContainer = document.getElementById('canvas-container')
  const activeElement = document.activeElement
  const isCanvasFocused =
    canvasContainer &&
    (activeElement === canvasContainer || canvasContainer.contains(activeElement))

  if (!isCanvasFocused) {
    return // 焦点在别处（如输入框），不拦截，走浏览器默认行为
  }

  // 只支持 Ctrl+A、Ctrl+C、Ctrl+Z、Ctrl+Y
  const isCtrlA = (e.ctrlKey || e.metaKey) && e.code === 'KeyA'
  const isCtrlC = (e.ctrlKey || e.metaKey) && e.code === 'KeyC'
  const isCtrlZ = (e.ctrlKey || e.metaKey) && e.code === 'KeyZ'
  const isCtrlY = (e.ctrlKey || e.metaKey) && e.code === 'KeyY'

  if (isCtrlA || isCtrlC || isCtrlZ || isCtrlY) {
    // 使用通用映射工具获取 Android 键码
    const keyCode = getAndroidKeyCode(e.code) as AndroidKeyCode

    if (keyCode) {
      // 构建完整的 MetaState
      const metaState = buildMetaState(e) as AndroidMetaState

      console.log('Shortcut triggered:', e.code, '->', keyCode, 'Meta:', metaState)
      // 阻止浏览器默认行为
      e.preventDefault()
      // 发送带有 Meta 状态的按键组合
      client.clickKey(keyCode, metaState)
    }
  }
}
</script>

<style scoped lang="scss">
// 定义 底部高度
$bottom-height: 45px;
// 定义 头部高度
$header-height: 38px;
// 定义 控制栏高度
$controls-width: 42px;

.window-page {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color-page);
}

.window-header {
  height: $header-height;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  width: 100%;

  @media (max-width: 200px) {
    justify-content: flex-end;
  }

  background: var(--el-bg-color);
  padding: 0 16px;
  border-bottom: 1px solid var(--el-border-color);
  z-index: 200;
  /* 确保 header 在遮罩层之上(如果想要操作窗口) 或者之下(如果想要完全封锁)
                   通常 Header 保留操作以便关闭窗口，所以 Z-index 要高 */
  position: relative;

  &-left {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-regular);
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: center;
    padding-right: 5px;
    min-width: 0; // 关键：允许 flex item 收缩到小于内容宽度，触发内部的 text-overflow

    @media (max-width: 200px) {
      display: none;
    }

    -webkit-app-region: drag;

    .device-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--el-text-color-regular);
      // 超出三个点
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
      width: 100%; // 确保占满容器宽度
      -webkit-app-region: drag;
    }

    .device-ip {
      font-size: 10px;
      color: var(--el-text-color-placeholder);
      width: fit-content;
      -webkit-app-region: no-drag;
      cursor: pointer;
    }
  }

  &-right {
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    color: var(--el-text-color-regular);
    gap: 15px;
    -webkit-app-region: no-drag;

    .el-icon {
      cursor: pointer;
      transition: all 0.2s ease;
      color: var(--el-text-color-regular);

      &:hover {
        opacity: 0.8;
        color: var(--el-color-primary);
      }
    }
  }
}

.window-content {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
  /* 关键：作为绝对定位遮罩的容器 */

  .window-phone {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    &-content {
      flex: 1;
      min-height: 0;
      display: flex;
      background: var(--el-bg-color-page);
    }

    &-container {
      background-color: var(--el-bg-color);
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    &-controls {
      position: relative;
      flex-shrink: 0;
      width: $controls-width;
      background: var(--el-bg-color);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 0;
      overflow-y: auto;
      overflow-x: hidden;

      &-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        margin-bottom: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        padding: 4px 0px;
        border-radius: 6px;
        width: 40px;
        user-select: none;

        &:hover {
          background: var(--el-color-primary-light-9);

          .el-icon {
            color: var(--el-color-primary);
          }

          span {
            color: var(--el-color-primary);
          }
        }

        &:active {
          transform: scale(0.96);
          background: var(--el-color-primary-light-8);
        }

        &.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
          pointer-events: none;
        }

        .el-icon {
          color: var(--el-text-color-regular);
          transition: color 0.2s ease;
        }

        span {
          font-size: 10px;
          color: var(--el-text-color-regular);
          text-align: center;

          white-space: normal;
          /* ✅ 允许换行（或直接删掉这一行） */
          word-break: break-word;
          /* ✅ 英文/长单词强制换行 */
          overflow-wrap: anywhere;
          /* ✅ 超长字符串也能断 */

          transition: color 0.2s ease;
          transform: scale(0.92);
        }
      }

      &-item.active {
        background: var(--el-color-primary-light-8);
        border-radius: 6px;

        .el-icon,
        span {
          color: var(--el-color-primary) !important;
        }
      }
    }

    &-bottom {
      box-sizing: border-box;
      flex-shrink: 0;
      height: $bottom-height;
      background: var(--el-bg-color);
      display: flex;
      align-items: center;
      justify-content: space-around;
      padding: 0 16px;
      border-top: 1px solid var(--el-border-color);

      &-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        padding: 4px 16px;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s ease;
        user-select: none;
        flex: 1;
        max-width: 100px;

        &:hover {
          background: var(--el-color-primary-light-9);

          .el-icon {
            color: var(--el-color-primary);
          }

          span {
            color: var(--el-color-primary);
          }
        }

        &:active {
          transform: scale(0.96);
        }

        &.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
          pointer-events: none;
        }

        .el-icon {
          color: var(--el-text-color-regular);
          transition: color 0.2s ease;
        }

        span {
          font-size: 11px;
          color: var(--el-text-color-regular);
          transition: color 0.2s ease;
        }
      }
    }
  }

  .window-panel {
    flex-shrink: 0;
    min-width: 0px;
    background: var(--el-bg-color);
    border-left: 1px solid var(--el-border-color);
    overflow-y: auto;
    height: 100%;
  }

  /* 群控日志样式 */
  .log-panel-content {
    display: flex;
    flex-direction: column;
    height: 100%;

    .log-header {
      padding: 8px 12px;
      border-bottom: 1px solid var(--el-border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;

      .title-area {
        display: flex;
        align-items: center;
        gap: 8px;

        .title {
          font-size: 13px;
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .count-tag {
          font-weight: normal;
          height: 20px;
          line-height: 18px;
          padding: 0 6px;
        }
      }
    }

    .log-list {
      flex: 1;
      overflow-y: auto;
      padding: 0 12px;

      .log-item {
        padding: 6px 0;
        border-bottom: 1px solid var(--el-border-color-light);

        &:last-child {
          border-bottom: none;
        }

        .log-row {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 2px;
          height: 32px;
          /* 固定高度，确保对齐 */

          .log-time {
            font-size: 11px;
            color: var(--el-text-color-secondary);
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            min-width: 50px;
            flex-shrink: 0;
          }

          .log-device-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            /* 垂直排列 */
            justify-content: center;
            min-width: 0;
            /* 关键：允许 flex item 收缩 */
            line-height: 1.2;

            .device-name {
              font-size: 12px;
              color: var(--el-text-color-primary);
              font-weight: 500;
              width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .device-id {
              font-size: 10px;
              color: var(--el-text-color-secondary);
              width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }

          .log-tag {
            flex-shrink: 0;
            height: 18px;
            padding: 0 4px;
            font-size: 10px;
            line-height: 16px;
            border: none;
            margin-left: auto;
            /* 靠右对齐 */
          }
        }

        .log-reason {
          font-size: 11px;
          color: var(--el-color-danger);
          padding-left: 56px;
          line-height: 1.2;
          word-break: break-all;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .empty-tip {
        text-align: center;
        color: var(--el-text-color-placeholder);
        padding-top: 60px;
        font-size: 13px;
      }
    }
  }
}

/* 状态遮罩层样式 - 优化版 */
.device-state-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--el-mask-color-extra-light);
  backdrop-filter: blur(10px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  opacity: 1;

  .state-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 32px;

    .icon-wrapper {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px
        var(--app-shadow-base-color, var(--app-shadow-base-color, var(--el-box-shadow-lighter)));
      transition: all 0.3s ease;
    }

    .state-icon {
      font-size: 36px;
      transition: all 0.3s ease;
    }

    .state-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;

      .state-text {
        font-size: 18px;
        color: var(--el-text-color-primary);
        font-weight: 600;
        letter-spacing: 0.5px;
      }

      .state-desc {
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}

/* 动画过渡样式 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
