<script setup lang="ts">
import { shallowRef, computed, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import type { Device } from '@shared/ipc/data.types'
import { findNodeAtPoint } from './dumpParser'
import { useDeviceUiDump } from './useDeviceUiDump'
import { resolvePickTarget, type PickResult } from './pickResolver'
import { useFlashHighlight } from './composables/useFlashHighlight'
import { mapClientPointToDevice, videoSurfaceFrameStyle } from './mapClientToDevice'
import type { UiNode, DumpResult } from './types'

interface Props {
  /** 是否显示叠加层 */
  enabled: boolean
  /** 是否处于选择模式(交互式,拦截鼠标) */
  picking: boolean
  device: Device | null
  /**
   * VmosEdgeClient 实际渲染区域(getBoundingClientRect)。
   * 必须与投屏 canvas 对齐;不传则回退 overlay 全屏(旧行为,易错位)。
   */
  videoSurfaceRect?: DOMRect | null
  /**
   * 视频流原始分辨率(来自 VmosEdgeClient SIZE_CHANGED 的 videoWidth/Height)。
   * dump 在弹窗/局部窗口时 screenWidth/Height 会偏小,必须用此值做坐标映射。
   */
  deviceScreenSize?: { width: number; height: number } | null
  /**
   * 外部指定的高亮节点 id。当其变化时触发 5 秒闪烁动画,辅助用户在候选列表
   * 切换时定位元素在屏幕上的位置。闪烁结束自动消失,不阻塞后续操作。
   */
  highlightNodeId?: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'node-hover': [node: UiNode | null]
  'node-select': [node: UiNode | null]
  'element-inspect': [payload: { node: UiNode; dump: DumpResult; pick: PickResult }]
}>()

// dump 拉取 / 自动刷新 / 清理:走 composable,以确保挂载时 enabled=true
// 也能立即触发(原本的 watch 没 immediate,导致首次进入选不了元素)
const { dump, loading } = useDeviceUiDump(() => props.device, {
  enabled: () => props.enabled && props.picking
})

const hoveredNodeId = shallowRef<number | null>(null)
const selectedNodeId = shallowRef<number | null>(null)

// 闪烁高亮:外部 highlightNodeId 变化 → 触发 5s 动画,自动清理
// 所有状态机/定时器/清理逻辑都收在 useFlashHighlight,SFC 只管渲染
const { target: flashingNode, animationKey: flashKey } = useFlashHighlight<UiNode>(
  () => props.highlightNodeId,
  {
    durationMs: 5000,
    lookup: (id) => dump.value?.nodes.find((n) => n.id === id) ?? null
  }
)

/**
 * 坐标换算 + 候选收集:鼠标屏幕坐标 → 设备坐标 → findNodeAtPoint(hit) → resolvePickTarget
 * winner 对齐 Maestro 基线(= hit,不升档),candidates 收集整个点击栈供 UI 切换
 */
const effectiveScreenSize = computed(() => {
  const fromVideo = props.deviceScreenSize
  if (fromVideo && fromVideo.width > 0 && fromVideo.height > 0) return fromVideo
  const d = dump.value
  return d ? { width: d.screenWidth, height: d.screenHeight } : null
})

function findPickAt(clientX: number, clientY: number): PickResult | null {
  if (!dump.value || !overlayRef.value) return null

  const screen = effectiveScreenSize.value
  if (!screen) return null

  const hitRect = props.videoSurfaceRect ?? overlayRef.value.getBoundingClientRect()
  const point = mapClientPointToDevice(
    clientX,
    clientY,
    hitRect,
    screen.width,
    screen.height
  )
  if (!point) return null

  const hit = findNodeAtPoint(dump.value, point.x, point.y)
  if (!hit) return null
  return resolvePickTarget(hit, dump.value, { x: point.x, y: point.y })
}

const overlayRef = shallowRef<HTMLElement | null>(null)

const svgFrameStyle = computed<Record<string, string> | null>(() => {
  if (!dump.value || !overlayRef.value || !props.videoSurfaceRect) return null
  const overlayRect = overlayRef.value.getBoundingClientRect()
  return videoSurfaceFrameStyle(overlayRect, props.videoSurfaceRect)
})

/** 锁定模式下只渲染选中节点 —— 升档后的目标可能落在 actionableNodes 之外(Tier 4) */
const selectedNodeOnly = computed(() => {
  if (selectedNodeId.value == null || !dump.value) return []
  // 优先从 actionableNodes 里找(常规路径),找不到再退到 nodes 全量
  const actionable = dump.value.actionableNodes.find((n) => n.id === selectedNodeId.value)
  if (actionable) return [actionable]
  const full = dump.value.nodes.find((n) => n.id === selectedNodeId.value)
  return full ? [full] : []
})

const onMouseMove = (e: MouseEvent) => {
  if (!props.picking) return
  const pick = findPickAt(e.clientX, e.clientY)
  const node = pick?.winner.node ?? null
  hoveredNodeId.value = node?.id ?? null
  emit('node-hover', node)
}

const onMouseLeave = () => {
  if (!props.picking) return
  hoveredNodeId.value = null
  emit('node-hover', null)
}

const onClick = (e: MouseEvent) => {
  if (!props.picking) return
  const pick = findPickAt(e.clientX, e.clientY)
  if (pick && dump.value) {
    const winnerNode = pick.winner.node
    selectedNodeId.value = winnerNode.id
    emit('node-select', winnerNode)
    emit('element-inspect', { node: winnerNode, dump: dump.value, pick })
  }
}

/**
 * 节点注解状态（对标 Maestro AnnotationState）
 * - default：粉色虚线
 * - hovered：蓝色实线 + 粉色遮罩
 * - selected：蓝色实线 + 蓝色遮罩
 * - hidden：已选中其他元素时隐藏
 */
function getNodeClass(nodeId: number): string {
  if (selectedNodeId.value != null) {
    if (selectedNodeId.value === nodeId) return 'selected'
    return 'hidden'
  }
  if (hoveredNodeId.value === nodeId) return 'hovered'
  return 'default'
}

/** 十字准线中心坐标（对标 Maestro Crosshairs） */
function getCrosshairCenter(): { cx: number; cy: number } | null {
  if (!dump.value) return null
  const targetId = selectedNodeId.value ?? hoveredNodeId.value
  if (targetId == null) return null
  // 升档后可能落在 actionableNodes 之外 —— 退到 nodes 全量查找
  const node =
    dump.value.actionableNodes.find((n) => n.id === targetId) ??
    dump.value.nodes.find((n) => n.id === targetId)
  if (!node) return null
  const [x1, y1, x2, y2] = node.bounds
  return {
    cx: (x1 + x2) / 2,
    cy: (y1 + y2) / 2
  }
}

// 进入 picking 模式 → 清除旧高亮(切回选取应当从干净状态开始)
// 关闭 enabled → emit 一次 node-hover(null) 让父级清掉残留显示
// 注:dump 的清理 / 重新拉取由 useDeviceUiDump 自己负责
watch(
  () => props.picking,
  (picking) => {
    if (picking) {
      hoveredNodeId.value = null
      selectedNodeId.value = null
    }
  }
)

watch(
  () => props.enabled,
  (enabled) => {
    if (!enabled) {
      hoveredNodeId.value = null
      selectedNodeId.value = null
      emit('node-hover', null)
    }
  }
)
</script>

<template>
  <div
    v-if="enabled"
    ref="overlayRef"
    class="ui-inspector-overlay"
    :class="{ picking }"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @click="onClick"
  >
    <div
      v-if="dump"
      class="svg-frame"
      :style="svgFrameStyle ?? { position: 'absolute', inset: 0 }"
    >
      <svg
        class="bounds-svg"
        :viewBox="`0 0 ${effectiveScreenSize?.width ?? dump.screenWidth} ${effectiveScreenSize?.height ?? dump.screenHeight}`"
        preserveAspectRatio="xMidYMid meet"
      >
      <!-- 选择模式：只渲染可操作元素（预过滤后的 actionableNodes） -->
      <template v-if="picking">
        <rect
          v-for="node in dump.actionableNodes"
          :key="node.id"
          :x="node.bounds[0]"
          :y="node.bounds[1]"
          :width="node.bounds[2] - node.bounds[0]"
          :height="node.bounds[3] - node.bounds[1]"
          class="node-rect"
          :class="getNodeClass(node.id)"
        />
      </template>
      <!-- 锁定模式：只高亮选中节点 -->
      <template v-else-if="selectedNodeOnly.length">
        <rect
          v-for="node in selectedNodeOnly"
          :key="node.id"
          :x="node.bounds[0]"
          :y="node.bounds[1]"
          :width="node.bounds[2] - node.bounds[0]"
          :height="node.bounds[3] - node.bounds[1]"
          class="node-rect selected"
        />
      </template>

      <!-- 十字准线（对标 Maestro Crosshairs） -->
      <template v-if="getCrosshairCenter()">
        <line
          :x1="getCrosshairCenter()!.cx"
          y1="0"
          :x2="getCrosshairCenter()!.cx"
          :y2="effectiveScreenSize?.height ?? dump.screenHeight"
          class="crosshair"
          :class="selectedNodeId != null ? 'crosshair-selected' : 'crosshair-hovered'"
        />
        <line
          x1="0"
          :y1="getCrosshairCenter()!.cy"
          :x2="effectiveScreenSize?.width ?? dump.screenWidth"
          :y2="getCrosshairCenter()!.cy"
          class="crosshair"
          :class="selectedNodeId != null ? 'crosshair-selected' : 'crosshair-hovered'"
        />
      </template>

      <!--
        闪烁高亮:仅在冻结模式渲染(picking=false)。
        picking 态下 overlay 在画可操作/悬停/选中节点,再叠闪烁会视觉嘈杂;
        只在用户看 popover 里切候选时需要"瞄"屏幕位置。
      -->
      <rect
        v-if="flashingNode && !picking"
        :key="`flash-${flashKey}`"
        :x="flashingNode.bounds[0]"
        :y="flashingNode.bounds[1]"
        :width="flashingNode.bounds[2] - flashingNode.bounds[0]"
        :height="flashingNode.bounds[3] - flashingNode.bounds[1]"
        class="flash-rect"
      />
    </svg>
    </div>

    <div v-if="loading && !dump" class="loading-mask">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ui-inspector-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  // 默认：锁定模式，不拦截鼠标
  pointer-events: none;

  // 选择模式：拦截鼠标
  &.picking {
    pointer-events: auto;
    cursor: crosshair;
  }
}

.bounds-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.svg-frame {
  pointer-events: none;
}

/* 对标 Maestro AnnotatedScreenshot 4 种注解状态 */
.node-rect {
  fill: transparent;
  transition:
    fill 0.1s,
    stroke 0.1s,
    opacity 0.1s;

  /* default：粉色虚线（对标 Maestro border-dashed border-pink-400/60） */
  &.default {
    stroke: rgba(244, 114, 182, 0.6);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }

  /* hovered：蓝色实线 + 粉色阴影（对标 Maestro border-blue-500 + box-shadow） */
  &.hovered {
    fill: rgba(244, 114, 182, 0.15);
    stroke: #3b82f6;
    stroke-width: 3;
  }

  /* selected：蓝色实线 + 蓝色阴影 */
  &.selected {
    fill: rgba(96, 165, 250, 0.15);
    stroke: #3b82f6;
    stroke-width: 3;
  }

  /* hidden：已选中其他元素时隐藏（对标 Maestro state="hidden"） */
  &.hidden {
    opacity: 0;
  }
}

/* 十字准线（对标 Maestro Crosshairs） */
.crosshair {
  stroke-width: 1;
  pointer-events: none;

  &.crosshair-hovered {
    stroke: rgba(59, 130, 246, 0.5);
  }

  &.crosshair-selected {
    stroke: rgba(244, 114, 182, 0.6);
  }
}

.loading-mask {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--el-color-primary);
}

/* 闪烁高亮:主题色 + 粗虚线 + 游走动画 + 辉光
   区隔策略:选取态是"蓝色实线小阴影"(静态),闪烁是"同色粗虚线大辉光"(动感)
   —— 靠线型和动效区分,不靠换色,保持主题整洁
   pulse 5 次 → 末尾淡出,总时长 ≈ 5s
   :key 每次变化强制动画重播 */
.flash-rect {
  fill: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  stroke: var(--el-color-primary);
  stroke-width: 5;
  stroke-dasharray: 16 8;
  stroke-linecap: round;
  pointer-events: none;
  /* 双重外发光:让闪烁元素在设备画面上强烈突出 */
  filter: drop-shadow(0 0 16px color-mix(in srgb, var(--el-color-primary) 80%, transparent))
    drop-shadow(0 0 6px color-mix(in srgb, var(--el-color-primary) 55%, transparent));
  animation:
    flash-pulse 0.9s ease-in-out 5,
    flash-dash 1.6s linear infinite,
    flash-fade 0.4s ease-out 4.6s forwards;
}

@keyframes flash-pulse {
  0%,
  100% {
    stroke-opacity: 1;
    stroke-width: 5;
  }
  50% {
    stroke-opacity: 0.6;
    stroke-width: 10;
  }
}

/* 虚线游走,增强 "正在被标记" 的动感 */
@keyframes flash-dash {
  to {
    stroke-dashoffset: -48;
  }
}

@keyframes flash-fade {
  to {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flash-rect {
    animation: flash-fade 0.4s ease-out 4.6s forwards;
  }
}
</style>
