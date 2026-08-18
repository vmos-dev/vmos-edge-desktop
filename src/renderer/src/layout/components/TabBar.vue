<template>
  <div class="tab-bar" ref="containerRef">
    <!-- 可见的 tab -->
    <div
      v-for="(tab, index) in tabs"
      :key="tab.key"
      v-show="index < visibleCount"
      :class="['tab-item', { active: activeTab === tab.key, 'tab-highlight': tab.highlight }]"
      @click="handleTabClick(tab.key)"
    >
      <svg-icon :name="tab.icon" :size="20" />
      <span>{{ tab.label }}</span>
    </div>

    <!-- 溢出 "..." 下拉菜单 -->
    <el-dropdown v-if="overflowTabs.length > 0" trigger="hover" @command="handleTabClick">
      <div :class="['tab-item', 'more-tab', { active: isOverflowActive }]">
        <el-icon :size="16"><More /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-for="tab in overflowTabs" :key="tab.key" :command="tab.key">
            <div class="overflow-item">
              <svg-icon :name="tab.icon" :size="16" />
              <span>{{ tab.label }}</span>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>

  <!-- 离屏测量容器：始终渲染全部 tab，用于获取真实宽度 -->
  <div class="tab-measure" aria-hidden="true" ref="measureContainerRef">
    <div
      v-for="tab in tabs"
      :key="tab.key"
      :ref="(el) => setMeasureRef(el as HTMLElement | null, tabs.indexOf(tab))"
      class="tab-item"
    >
      <svg-icon :name="tab.icon" :size="20" />
      <span>{{ tab.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SvgIcon } from '@renderer/components'
import { useI18n } from 'vue-i18n'
import { More } from '@element-plus/icons-vue'
import { getVisibleTabCount } from './tabOverflow'

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()

const tabs = computed(() => [
  { key: 'cloud', label: t('layout.cloud'), icon: 'phone', path: '/cloud' },
  { key: 'host', label: t('layout.host'), icon: 'host', path: '/host' },
  { key: 'image', label: t('layout.image'), icon: 'image', path: '/image' },
  { key: 'proxy', label: t('layout.proxy'), icon: 'proxy', path: '/proxy' },
  { key: 'frp', label: t('layout.frp'), icon: 'tunnel', path: '/frp' },
  {
    key: 'automation',
    label: t('layout.automation'),
    icon: 'workflow',
    path: '/automation',
    highlight: true
  },
  { key: 'aiAgent', label: t('layout.aiAgent'), icon: 'aiworkflow', path: '/ai-agent' }
])

const activeTab = shallowRef('cloud')

watch(
  () => route.path,
  (newPath) => {
    const tab = tabs.value.find((t) => newPath === t.path || newPath.startsWith(t.path + '/'))
    activeTab.value = tab ? tab.key : ''
  },
  { immediate: true }
)

const handleTabClick = (key: string) => {
  const tab = tabs.value.find((t) => t.key === key)
  if (tab) router.push(tab.path)
}

// ── 溢出检测 ──────────────────────────────────────────
const containerRef = ref<HTMLElement>()
const measureContainerRef = ref<HTMLElement>()
const measureRefs: (HTMLElement | null)[] = []
const visibleCount = shallowRef(tabs.value.length)

const GAP = 4
const MORE_BTN_WIDTH = 44 // "..." 按钮宽度 + gap
const MAX_MEASURE_RETRIES = 6

const setMeasureRef = (el: HTMLElement | null, index: number) => {
  measureRefs[index] = el
}

const readTabWidths = () =>
  tabs.value.map((_, index) => {
    const el = measureRefs[index]
    return el ? el.offsetWidth + GAP : 0
  })

const computeVisible = () => {
  const nextVisibleCount = getVisibleTabCount({
    containerWidth: containerRef.value?.offsetWidth ?? 0,
    tabCount: tabs.value.length,
    tabWidths: readTabWidths(),
    moreButtonWidth: MORE_BTN_WIDTH
  })

  if (nextVisibleCount === null) {
    return false
  }

  visibleCount.value = nextVisibleCount
  return true
}

let animationFrameId: number | null = null

const scheduleComputeVisible = (attempt = 0) => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }

  animationFrameId = requestAnimationFrame(() => {
    animationFrameId = null

    if (!computeVisible() && attempt < MAX_MEASURE_RETRIES) {
      scheduleComputeVisible(attempt + 1)
    }
  })
}

let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      scheduleComputeVisible()
    })
    resizeObserver.observe(containerRef.value)
  }

  // 监听测量容器的 DOM 变化（SvgIcon 异步加载 SVG 后 v-html 会变化），触发重新计算
  if (measureContainerRef.value) {
    mutationObserver = new MutationObserver(() => {
      scheduleComputeVisible()
    })
    mutationObserver.observe(measureContainerRef.value, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }

  scheduleComputeVisible()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  mutationObserver?.disconnect()
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})

// 语言切换后标签文字宽度变了，重新计算
watch(locale, () => scheduleComputeVisible(), { flush: 'post' })

const overflowTabs = computed(() => tabs.value.slice(visibleCount.value))
const isOverflowActive = computed(() => overflowTabs.value.some((t) => t.key === activeTab.value))
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

/* 离屏测量容器，不可见但占 DOM */
.tab-measure {
  display: flex;
  position: fixed;
  top: -9999px;
  left: -9999px;
  visibility: hidden;
  pointer-events: none;
  gap: 4px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.3s;
  color: var(--el-text-color-regular);
  font-size: 14px;
  position: relative;
  -webkit-app-region: no-drag;
  white-space: nowrap;
  flex-shrink: 0;
}

.tab-item:hover {
  background-color: var(--el-bg-color-page);
  color: var(--el-color-primary);
}

.tab-item.active {
  color: var(--el-color-primary);
  font-weight: 500;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background-color: var(--el-color-primary);
  border-radius: 2px 2px 0 0;
}

.more-tab {
  padding: 8px 10px;
}

/* ── 高亮 tab ── */
.tab-highlight {
  color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  border-radius: 6px;
  font-weight: 500;
  overflow: hidden;
}

.tab-highlight:hover {
  background: color-mix(in srgb, var(--el-color-primary) 14%, transparent);
}

.tab-highlight::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 35%,
    color-mix(in srgb, var(--el-color-primary) 14%, transparent) 50%,
    transparent 65%
  );
  background-size: 250% 100%;
  animation: tab-shimmer 4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes tab-shimmer {
  0%,
  100% {
    background-position: 200% 0;
  }
  50% {
    background-position: -50% 0;
  }
}

.overflow-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
