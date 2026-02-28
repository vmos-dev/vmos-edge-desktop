<template>
  <div class="tab-bar">
    <div
      v-for="tab in tabs"
      :key="tab.key"
      :class="['tab-item', { active: activeTab === tab.key }]"
      @click="handleTabClick(tab.key)"
    >
      <svg-icon :name="tab.icon" :size="20" />
      <span>{{ tab.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SvgIcon } from '@renderer/components'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Tab {
  key: string
  label: string
  icon: any
  path: string
}

const router = useRouter()

const route = useRoute()
const tabs = computed<Tab[]>(() => [
  { key: 'cloud', label: t('layout.cloud'), icon: 'phone', path: '/cloud' },
  { key: 'host', label: t('layout.host'), icon: 'host', path: '/host' },
  { key: 'image', label: t('layout.image'), icon: 'image', path: '/image' },
  { key: 'proxy', label: t('layout.proxy'), icon: 'proxy', path: '/proxy' }
])

const activeTab = ref('cloud')

// 监听路由变化
watch(
  () => route.path,
  (newPath: string) => {
    const tab = tabs.value.find((t) => t.path === newPath)
    if (tab) {
      activeTab.value = tab.key
    } else {
      activeTab.value = ''
    }
  }
)

const handleTabClick = (key: string) => {
  const tab = tabs.value.find((t) => t.key === key)
  if (tab) {
    router.push(tab.path)
  }
}
</script>

<style scoped>
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 0 8px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.3s;
  color: var(--el-text-color-regular);
  font-size: 14px;
  position: relative;
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

.tab-icon {
  font-size: 16px;
}
</style>
