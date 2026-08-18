<script setup lang="ts">
/**
 * DeviceStage · v3 工作流专用云机舞台
 *
 * 1:1 还原原型 HTML 的 device-stage 样式:
 *  - 深色径向渐变背景 + 蓝紫光晕
 *  - 顶部浮动胶囊 toolbar(操作 / 选元素 / 冻结 三模式)
 *  - 手机外框(圆角 + 阴影 + 发光)
 *  - 手机屏幕内:VmosEdgeClient 渲染 + UiInspectorOverlay 覆盖层
 *
 * 和 DevicePreview 的区别:
 *  - DevicePreview 是白色独立面板(原 v2 用),带自己的 header / 设备选择弹窗 / InspectorPanel
 *  - DeviceStage 只做展示,由父级传入 device;Inspector 走右侧 SidePanel 的「元素」tab
 *
 * 不依赖 DevicePreview,独立实现
 */
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElIcon } from 'element-plus'
import { ArrowLeft, HomeFilled, Menu as MenuIcon, Iphone } from '@element-plus/icons-vue'
import { VmosEdgeClient, VmosEdgeClientEvents } from '@vmosedge/web-sdk'
import { MacvlanPortMap } from '@renderer/utils/constant'
import { logVmosEdgeClientInternalError } from '@renderer/utils/vmosEdgeClientLogger'
import UiInspectorOverlay from '@renderer/components/ui-inspector/UiInspectorOverlay.vue'
import type { PickResult } from '@renderer/components/ui-inspector/pickResolver'
import type { Device } from '@shared/ipc/data.types'
import { DeviceState } from '@shared/ipc/data.types'
import type { UiNode, DumpResult } from '@renderer/components/ui-inspector/types'

interface Props {
  device: Device | null
  /**
   * 禁用元素拾取(但 overlay 仍启用 hover 预览)。
   * 用于 YAML 解析错误等"不该生成新步骤"的场景:
   * 画面依旧渲染、可冻结操作手机,只是点击不再触发 element-inspect
   */
  pickingDisabled?: boolean
  /**
   * 外部控制的高亮节点 id(用户在候选列表里切换时用)。
   * overlay 收到变化会触发 5 秒闪烁动画,方便用户看清位置。
   */
  highlightNodeId?: number | null
}

interface Emits {
  (e: 'element-inspect', payload: { node: UiNode; dump: DumpResult; pick: PickResult }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// ═══════════════ 模式 ═══════════════
// 两种模式:
//  - pick:  Overlay 拦截点击,命中元素则发出 element-inspect(供父级显示弹卡)
//  - freeze:Overlay 放行点击,用户可以直接操作手机(滑动/点击导航到目标屏幕)
//
// 交互约定:
//  - 默认 pick;点选元素成功后自动切到 freeze,让用户有空间看弹卡 / 继续操作手机
//  - 用户点击 toolbar 的"切回选取"按钮 或 父级关闭弹卡时,回到 pick
const frozen = defineModel<boolean>('frozen', { default: false })

// ═══════════════ VmosEdgeClient 连接 ═══════════════

const canvasContainerRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const isClientReady = shallowRef(false)
const clientError = shallowRef<string | null>(null)
let client: VmosEdgeClient | null = null

// ── 尺寸策略 ──
// 舞台用 CSS padding 留出 toolbar / nav / 左右呼吸的空间,
// ResizeObserver 报告的 contentRect 直接就是可用像素区
// 只设上限(避免 4K 屏上手机大得离谱),不设下限;按容器大小 + 设备比例收缩
const MAX_PHONE_WIDTH = 420
const MAX_PHONE_HEIGHT = 820
const FRAME_PADDING = 10 // device-frame 外框厚度(padding)

// 舞台可用尺寸(ResizeObserver 给 contentRect,已扣除 CSS padding)
const stageSize = shallowRef({ width: 600, height: 700 })
// 云机画面的理想分辨率(SIZE_CHANGED 更新)
const deviceIdeal = shallowRef<{ width: number; height: number } | null>(null)

/**
 * 按容器尺寸 + 设备比例,算出最终手机显示尺寸
 * 宽高各自取限制,选最严格那一项;再与硬上限取 min
 */
const phoneSize = computed<{ width: number; height: number }>(() => {
  const ideal = deviceIdeal.value
  if (!ideal || ideal.width <= 0 || ideal.height <= 0) {
    return { width: 330, height: 680 }
  }
  const aspect = ideal.width / ideal.height

  // 容器可用区 - 外框 padding(外框比屏幕多这 10+10px)
  const availW = Math.max(120, stageSize.value.width - FRAME_PADDING * 2)
  const availH = Math.max(200, stageSize.value.height - FRAME_PADDING * 2)

  const byWidth = availW
  const byHeight = availH * aspect
  const maxByCap = Math.min(MAX_PHONE_WIDTH, MAX_PHONE_HEIGHT * aspect)
  const w = Math.min(byWidth, byHeight, maxByCap)
  const h = w / aspect
  return { width: Math.round(w), height: Math.round(h) }
})

const canInspect = computed(() => !!props.device && isClientReady.value)

async function startClient(): Promise<void> {
  const device = props.device
  if (!device || !device.host_ip) return

  stopClient()
  await nextTick()

  const container = canvasContainerRef.value
  if (!container) return

  isClientReady.value = false
  clientError.value = null

  const isMacvlan = device.network_mode === 'macvlan'

  client = new VmosEdgeClient({
    config: {
      ip: isMacvlan ? device.ip || '' : device.host_ip,
      deviceId: device.id,
      ports: {
        video: isMacvlan ? MacvlanPortMap.video : device.tcp_port || 0,
        audio: isMacvlan ? MacvlanPortMap.audio : device.tcp_audio_port || 0,
        touch: isMacvlan ? MacvlanPortMap.touch : device.tcp_control_port || 0
      }
    },
    container,
    isGroupControl: false,
    retryCount: 5,
    retryInterval: 3000,
    onInternalError: (error, info: unknown) => {
      logVmosEdgeClientInternalError('Workflow', error, info as never)
    }
  })

  client.on(VmosEdgeClientEvents.STARTED, () => {
    isClientReady.value = true
  })
  client.on(VmosEdgeClientEvents.ERROR, (event: unknown) => {
    const msg =
      (event as { message?: string; errorMessage?: string } | undefined)?.message ||
      (event as { errorMessage?: string } | undefined)?.errorMessage ||
      t('workflow.deviceStage.connectionFailed')
    clientError.value = msg
    isClientReady.value = false
  })
  client.on(VmosEdgeClientEvents.SIZE_CHANGED, ({ idealWidth, idealHeight }) => {
    // 只保存理想分辨率;实际显示尺寸由 phoneSize computed 按容器大小推导
    deviceIdeal.value = { width: idealWidth, height: idealHeight }
  })

  client.start()
}

function stopClient(): void {
  if (client) {
    client.stop()
    client = null
  }
  isClientReady.value = false
  clientError.value = null
}

// ═══════════════ 生命周期 + 监听 ═══════════════

watch(
  () => props.device,
  (newVal, oldVal) => {
    const idChanged = newVal?.id !== oldVal?.id
    const stateChanged = newVal?.state !== oldVal?.state
    if (!idChanged && !stateChanged) return
    if (newVal && newVal.state === DeviceState.StateRunning) {
      void startClient()
    } else {
      stopClient()
    }
  },
  { immediate: true }
)

// ── ResizeObserver:舞台尺寸变化时重算手机大小 ──

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (stageRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) stageSize.value = { width: rect.width, height: rect.height }
    })
    resizeObserver.observe(stageRef.value)
  }

  if (props.device && props.device.state === DeviceState.StateRunning) {
    void startClient()
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  stopClient()
})

// ═══════════════ 导航按钮 ═══════════════

function handleNavClick(action: 'back' | 'home' | 'menu'): void {
  if (!client || !isClientReady.value) return
  switch (action) {
    case 'back':
      client.back()
      break
    case 'home':
      client.home()
      break
    case 'menu':
      client.menu()
      break
  }
}

// ═══════════════ 元素拾取 ═══════════════

function handleElementInspect(payload: { node: UiNode; dump: DumpResult; pick: PickResult }): void {
  emit('element-inspect', payload)
  // 点中元素 → 自动切到冻结模式:用户可以查看弹卡或继续操作手机
  frozen.value = true
}

// ═══════════════ 暴露给父级 ═══════════════

defineExpose({
  startClient,
  stopClient
})
</script>

<template>
  <div ref="stageRef" class="device-stage">
    <!-- 浮动 toolbar:显示当前模式 + 切换按钮 -->
    <div class="device-toolbar">
      <span
        class="hint-text"
        :title="
          pickingDisabled
            ? t('workflow.stage.yamlError')
            : frozen
              ? t('workflow.stage.frozenMode')
              : t('workflow.stage.pickMode')
        "
      >
        <span class="mode-dot" :class="{ frozen, disabled: pickingDisabled }" />
        <span class="hint-label">
          <template v-if="pickingDisabled">{{ t('workflow.stage.yamlError') }}</template>
          <template v-else-if="frozen">{{ t('workflow.stage.frozenMode') }}</template>
          <template v-else>{{ t('workflow.stage.pickMode') }}</template>
        </span>
      </span>
      <button
        class="mode-btn"
        :title="frozen ? t('workflow.stage.switchToPick') : t('workflow.stage.switchToFreeze')"
        :disabled="pickingDisabled"
        @click="frozen = !frozen"
      >
        {{ frozen ? t('workflow.stage.switchToPick') : t('workflow.stage.switchToFreeze') }}
      </button>
    </div>

    <!-- 手机外框 -->
    <div
      v-if="device"
      class="device-frame"
      :style="{
        width: phoneSize.width + 20 + 'px',
        height: phoneSize.height + 20 + 'px'
      }"
    >
      <div class="device-screen">
        <!-- 云机画面渲染容器 -->
        <div ref="canvasContainerRef" class="canvas-container"></div>

        <!-- 元素拾取 Overlay(选元素为默认行为,冻结只是暂停 dump 自动刷新) -->
        <UiInspectorOverlay
          v-if="canInspect"
          :enabled="true"
          :picking="!frozen && !pickingDisabled"
          :device="device"
          :highlight-node-id="highlightNodeId ?? null"
          @element-inspect="handleElementInspect"
        />

        <!-- loading / error mask -->
        <div v-if="!isClientReady || clientError" class="status-mask">
          <template v-if="clientError">
            <div class="error">
              ⚠ {{ clientError }}
              <button class="retry-btn" @click="startClient">
                {{ t('workflow.stage.retry') }}
              </button>
            </div>
          </template>
          <template v-else>
            <div class="loader">
              <div class="loader-icon"></div>
              <span>{{ t('workflow.stage.connecting') }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- 底部导航胶囊 -->
      <div v-if="isClientReady" class="phone-nav">
        <button class="nav-btn" @click="handleNavClick('back')">
          <ElIcon><ArrowLeft /></ElIcon>
        </button>
        <button class="nav-btn" @click="handleNavClick('home')">
          <ElIcon><HomeFilled /></ElIcon>
        </button>
        <button class="nav-btn" @click="handleNavClick('menu')">
          <ElIcon><MenuIcon /></ElIcon>
        </button>
      </div>
    </div>

    <!-- 未连接云机空态 -->
    <div v-else class="no-device">
      <div class="empty-phone-icon">
        <ElIcon><Iphone /></ElIcon>
      </div>
      <div class="empty-title">{{ t('workflow.stage.noDevice') }}</div>
      <div class="empty-desc">{{ t('workflow.stage.noDeviceHint') }}</div>
    </div>
  </div>
</template>

<style scoped>
/* ═══ 舞台(默认浅色,html.dark 覆盖深色) ═══ */
.device-stage {
  position: relative;
  background: radial-gradient(circle at 50% 30%, #f8fafc 0%, #f1f5f9 60%, #e2e8f0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  height: 100%;
  width: 100%;
  padding: 60px 24px 72px;
  box-sizing: border-box;
}
html.dark .device-stage {
  background: radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 60%, #020617 100%);
}

.device-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(124, 58, 237, 0.03) 0%, transparent 50%);
  pointer-events: none;
}
html.dark .device-stage::before {
  background-image:
    radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(124, 58, 237, 0.06) 0%, transparent 50%);
}

/* ═══ 浮动 toolbar ═══ */
.device-toolbar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 32px);
  display: flex;
  gap: 4px;
  padding: 4px 4px 4px 14px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  z-index: 20;
  align-items: center;
  color: rgba(0, 0, 0, 0.7);
  font-size: 12px;
  font-weight: 500;
}
html.dark .device-toolbar {
  background: rgba(15, 23, 42, 0.75);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.8);
}

.hint-text {
  padding-right: 8px;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.hint-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mode-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  animation: mode-pulse 1.6s ease-in-out infinite;
}
.mode-dot.frozen {
  background: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.22);
  animation: none;
}
.mode-dot.disabled {
  background: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.22);
  animation: none;
}
.mode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
@keyframes mode-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.8);
    opacity: 0.7;
  }
}
.mode-btn {
  flex-shrink: 0;
  padding: 6px 12px;
  border: none;
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.65);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 999px;
  transition: all 0.15s;
  white-space: nowrap;
}
.mode-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.85);
}
html.dark .mode-btn {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
}
html.dark .mode-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: white;
}

/* ═══ 手机外框 ═══ */
.device-frame {
  position: relative;
  background: #000;
  border-radius: 40px;
  padding: 10px;
  box-shadow:
    0 0 0 2px #cbd5e1,
    0 20px 50px -10px rgba(0, 0, 0, 0.15),
    0 0 60px rgba(37, 99, 235, 0.06);
  transition:
    width 0.25s,
    height 0.25s;
}
html.dark .device-frame {
  box-shadow:
    0 0 0 2px #1e293b,
    0 20px 50px -10px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(37, 99, 235, 0.15);
}

.device-screen {
  width: 100%;
  height: 100%;
  background: #f0f4f8;
  border-radius: 32px;
  position: relative;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

/* ═══ 状态遮罩(叠在手机屏幕上,始终深色) ═══ */
.status-mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  border-radius: 32px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
}
.status-mask .error {
  text-align: center;
}
.retry-btn {
  margin-top: 10px;
  padding: 6px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}
.loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.loader-icon {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--el-color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ═══ 手机底部导航 ═══ */
.phone-nav {
  position: absolute;
  bottom: -48px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}
html.dark .phone-nav {
  background: rgba(15, 23, 42, 0.75);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
  border-radius: 50%;
  font-size: 14px;
  transition: all 0.15s;
}
.nav-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.75);
}
html.dark .nav-btn {
  color: rgba(255, 255, 255, 0.7);
}
html.dark .nav-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

/* ═══ 未连接云机空态 ═══ */
.no-device {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(0, 0, 0, 0.4);
}
html.dark .no-device {
  color: rgba(255, 255, 255, 0.55);
}

.empty-phone-icon {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: rgba(0, 0, 0, 0.2);
}
html.dark .empty-phone-icon {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.3);
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.75);
}
html.dark .empty-title {
  color: rgba(255, 255, 255, 0.85);
}

.empty-desc {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
}
html.dark .empty-desc {
  color: rgba(255, 255, 255, 0.4);
}
</style>
