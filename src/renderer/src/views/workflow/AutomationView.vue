<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ListView from './ListView.vue'
import TaskCenterView from '../taskCenter/TaskCenterView.vue'

defineOptions({ name: 'AutomationView' })

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

type TabKey = 'scripts' | 'tasks'

const activeTab = shallowRef<TabKey>(route.query.tab === 'tasks' ? 'tasks' : 'scripts')

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = tab === 'tasks' ? 'tasks' : 'scripts'
  }
)

function switchTab(key: TabKey) {
  if (key === activeTab.value) return
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key === 'scripts' ? undefined : key } })
}
</script>

<template>
  <div class="automation-view">
    <div class="automation-topbar">
      <nav class="seg-control">
        <button
          class="seg-btn"
          :class="{ active: activeTab === 'scripts' }"
          :title="t('automation.tabs.scripts')"
          @click="switchTab('scripts')"
        >
          {{ t('automation.tabs.scripts') }}
        </button>
        <button
          class="seg-btn"
          :class="{ active: activeTab === 'tasks' }"
          :title="t('automation.tabs.tasks')"
          @click="switchTab('tasks')"
        >
          {{ t('automation.tabs.tasks') }}
        </button>
        <span class="seg-slider" :class="activeTab" />
      </nav>
    </div>

    <div class="automation-content">
      <ListView v-show="activeTab === 'scripts'" />
      <TaskCenterView v-show="activeTab === 'tasks'" />
    </div>
  </div>
</template>

<style scoped>
.automation-view {
  height: calc(100vh - 56px);
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  background: var(--el-bg-color);
}

/* ── 顶栏 ── */
.automation-topbar {
  display: flex;
  align-items: center;
  padding: 12px 28px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

/* ── iOS 风格分段控件 ── */
.seg-control {
  position: relative;
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  padding: 3px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
}

.seg-btn {
  position: relative;
  z-index: 1;
  padding: 6px 20px;
  border: 0;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: color 200ms ease;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
  line-height: 1.4;
  text-align: center;
}

.seg-btn:hover {
  color: var(--el-text-color-primary);
}

.seg-btn.active {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.seg-slider {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.1),
    0 0.5px 1px rgba(0, 0, 0, 0.06);
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.seg-slider.tasks {
  transform: translateX(100%);
}

/* ── 内容区 ── */
.automation-content {
  min-height: 0;
  overflow: hidden;
}

.automation-content > :deep(*) {
  height: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .seg-slider {
    transition: none;
  }
}
</style>
