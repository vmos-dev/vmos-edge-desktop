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
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SvgIcon } from '@renderer/components'

interface Tab {
  key: string
  label: string
  icon: any
  path: string
}

const router = useRouter()

const route = useRoute()
const tabs: Tab[] = [
  { key: 'cloud', label: '云机', icon: 'phone', path: '/cloud' },
  { key: 'host', label: '主机', icon: 'host', path: '/host' },
  { key: 'image', label: '镜像', icon: 'image', path: '/image' },
  { key: 'proxy', label: '代理', icon: 'proxy', path: '/proxy' }
]

const activeTab = ref('cloud')

// 监听路由变化
watch(
  () => route.path,
  (newPath: string) => {
    const tab = tabs.find((t) => t.path === newPath)
    if (tab) {
      activeTab.value = tab.key
    } else {
      activeTab.value = ''
    }
  }
)

const handleTabClick = (key: string) => {
  const tab = tabs.find((t) => t.key === key)
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
  color: #606266;
  font-size: 14px;
  position: relative;
}

.tab-item:hover {
  background-color: #f5f7fa;
  color: #409eff;
}

.tab-item.active {
  color: #409eff;
  font-weight: 500;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background-color: #409eff;
  border-radius: 2px 2px 0 0;
}

.tab-icon {
  font-size: 16px;
}
</style>
