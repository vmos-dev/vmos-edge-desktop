<template>
  <div v-if="enabled" class="ui-inspector-overlay">
    <!-- SVG 叠加层，viewBox 匹配设备屏幕尺寸 -->
    <svg
      v-if="dump"
      class="bounds-svg"
      :viewBox="`0 0 ${dump.screenWidth} ${dump.screenHeight}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect
        v-for="node in dump.nodes"
        :key="node.id"
        :x="node.bounds[0]"
        :y="node.bounds[1]"
        :width="node.bounds[2] - node.bounds[0]"
        :height="node.bounds[3] - node.bounds[1]"
        class="node-rect"
        :class="{ highlighted: highlightNodeId === node.id }"
      />
    </svg>

    <!-- 加载状态 -->
    <div v-if="loading && !dump" class="loading-mask">
      <el-icon class="is-loading" :size="24"><Loading /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import type { Device } from '@shared/ipc/data.types'
import { postDeviceModuleJson } from '@renderer/utils/deviceApi'
import { parseDumpXml } from './dumpParser'
import type { UiNode, DumpResult } from './types'

interface Props {
  enabled: boolean
  device: Device | null
  highlightNodeId?: number | null
}

const props = defineProps<Props>()

const dump = ref<DumpResult | null>(null)
const loading = ref(false)
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

const fetchDump = async () => {
  if (!props.device || loading.value) return
  loading.value = true
  try {
    const xml = await postDeviceModuleJson<string>(props.device, 'accessibility', 'dump', {})
    dump.value = parseDumpXml(xml)
  } catch {
    // 自动刷新时静默忽略错误
  } finally {
    loading.value = false
  }
}

/** 启动每秒自动刷新 */
function startAutoRefresh() {
  stopAutoRefresh()
  fetchDump()
  autoRefreshTimer = setInterval(fetchDump, 1000)
}

/** 停止自动刷新 */
function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
}

/**
 * 根据鼠标在容器内的坐标，找到最小的包含该点的 UI 节点
 */
const findNodeAt = (clientX: number, clientY: number, containerEl: HTMLElement): UiNode | null => {
  if (!dump.value) return null
  const rect = containerEl.getBoundingClientRect()
  const mouseX = clientX - rect.left
  const mouseY = clientY - rect.top

  const { screenWidth, screenHeight } = dump.value
  const containerW = rect.width
  const containerH = rect.height

  // xMidYMid meet 缩放计算
  const scale = Math.min(containerW / screenWidth, containerH / screenHeight)
  const offsetX = (containerW - screenWidth * scale) / 2
  const offsetY = (containerH - screenHeight * scale) / 2

  const devX = (mouseX - offsetX) / scale
  const devY = (mouseY - offsetY) / scale

  if (devX < 0 || devX > screenWidth || devY < 0 || devY > screenHeight) return null

  // 找到包含该点的最小节点
  let best: UiNode | null = null
  let bestArea = Infinity
  for (const node of dump.value.nodes) {
    const [x1, y1, x2, y2] = node.bounds
    if (devX >= x1 && devX <= x2 && devY >= y1 && devY <= y2) {
      const area = (x2 - x1) * (y2 - y1)
      if (area < bestArea) {
        bestArea = area
        best = node
      }
    }
  }
  return best
}

// 开关时启动/停止自动刷新
watch(
  () => props.enabled,
  (val) => {
    if (val) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
      dump.value = null
    }
  }
)

defineExpose({ fetchDump, findNodeAt, loading })

onBeforeUnmount(() => {
  stopAutoRefresh()
  dump.value = null
})
</script>

<style scoped lang="scss">
.ui-inspector-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
}

.bounds-svg {
  width: 100%;
  height: 100%;
}

.node-rect {
  fill: transparent;
  stroke: var(--el-color-primary);
  stroke-opacity: 0.3;
  stroke-width: 3;
  transition:
    fill 0.15s,
    stroke-opacity 0.15s;

  &.highlighted {
    fill: var(--el-color-primary);
    fill-opacity: 0.2;
    stroke-opacity: 1;
    stroke-width: 5;
  }
}

.loading-mask {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--el-color-primary);
}
</style>
