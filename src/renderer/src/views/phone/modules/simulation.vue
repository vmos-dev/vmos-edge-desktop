<template>
  <div class="simulation-container">
    <!-- 第一级tabs -->
    <div class="tabs-primary">
      <div
        v-for="tab in primaryTabs"
        :key="tab.value"
        class="tab-item-primary"
        :class="{ active: activePrimaryTab === tab.value }"
        @click="handlePrimaryTabClick(tab.value)"
      >
        <span class="tab-label">{{ tab.label }}</span>
        <div class="tab-indicator" v-if="activePrimaryTab === tab.value"></div>
      </div>
    </div>
    <div class="tab-divider"></div>

    <!-- 第二级tabs - 仅在有二级菜单时显示 -->
    <template v-if="currentSecondaryTabs.length > 0">
      <div class="tabs-secondary">
        <div
          v-for="tab in currentSecondaryTabs"
          :key="tab.value"
          class="tab-item-secondary"
          :class="{ active: activeSecondaryTab === tab.value }"
          @click="handleSecondaryTabClick(tab.value)"
        >
          <span class="tab-label">{{ tab.label }}</span>
          <div class="tab-indicator" v-if="activeSecondaryTab === tab.value"></div>
        </div>
      </div>
      <div class="tab-divider"></div>
    </template>

    <!-- 内容区域 -->
    <div class="simulation-content">
      <component :is="currentComponent" v-if="currentComponent" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, defineAsyncComponent, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 当前激活的第一级tab
const activePrimaryTab = ref('multimedia')
// 当前激活的第二级tab
const activeSecondaryTab = ref('sms-record')

// 第一级tabs配置
const primaryTabs = computed(() => [
  { label: t('phone.simulation.multimedia'), value: 'multimedia' },
  { label: t('phone.simulation.smsCall'), value: 'sms-call' },
  { label: t('phone.simulation.sensor'), value: 'sensor' },
  { label: t('phone.simulation.battery'), value: 'battery' }
])

// 第二级tabs配置
const secondaryTabsConfig = computed<Record<string, Array<{ label: string; value: string }>>>(
  () => ({
    'sms-call': [
      { label: t('phone.simulation.contact'), value: 'contact' },
      { label: t('phone.simulation.sms'), value: 'sms-record' },
      { label: t('phone.simulation.callRecord'), value: 'call-record' }
    ]
  })
)

// 自动读取 components 文件夹中的所有组件
const componentsModules = import.meta.glob('../components/*.vue', { eager: false })

// 组件映射配置 - 支持二级tab和一级tab直接映射
const componentMap = computed<Record<string, Record<string, () => Promise<any>>>>(() => {
  const map: Record<string, Record<string, () => Promise<any>>> = {}

  // 遍历所有组件文件
  Object.keys(componentsModules).forEach((path) => {
    // 提取文件名（去掉路径和扩展名）
    // 例如: '../components/contact.vue' -> 'contact'
    // 例如: '../components/multimedia.vue' -> 'multimedia'
    const fileName = path.replace(/^.*\/([^/]+)\.vue$/, '$1')

    // 1. 先尝试匹配二级菜单
    let matched = false
    Object.keys(secondaryTabsConfig.value).forEach((primaryTab) => {
      const secondaryTabs = secondaryTabsConfig.value[primaryTab]
      const matchedTab = secondaryTabs.find((tab) => tab.value === fileName)

      if (matchedTab) {
        if (!map[primaryTab]) {
          map[primaryTab] = {}
        }
        map[primaryTab][fileName] = componentsModules[path] as () => Promise<any>
        matched = true
      }
    })

    // 2. 如果没有匹配到二级菜单，尝试匹配一级菜单
    if (!matched) {
      primaryTabs.value.forEach((primaryTab) => {
        // 如果一级菜单的 value 与文件名相同，且该一级菜单没有二级菜单
        if (primaryTab.value === fileName && !secondaryTabsConfig.value[primaryTab.value]) {
          if (!map[primaryTab.value]) {
            map[primaryTab.value] = {}
          }
          // 使用一级菜单的 value 作为 key
          map[primaryTab.value][primaryTab.value] = componentsModules[path] as () => Promise<any>
        }
      })
    }
  })

  return map
})

// 根据第一级tab获取对应的第二级tabs - 使用计算属性（需要先定义，供其他函数使用）
const currentSecondaryTabs = computed(() => {
  return secondaryTabsConfig.value[activePrimaryTab.value] || []
})

// 当前组件 - 使用shallowRef存储异步组件
const currentComponent = shallowRef<any>(null)

// 加载组件的函数
const loadComponent = () => {
  const primaryTab = activePrimaryTab.value
  const secondaryTab = activeSecondaryTab.value
  const hasSecondaryTabs = currentSecondaryTabs.value.length > 0

  let componentLoader: (() => Promise<any>) | undefined

  if (hasSecondaryTabs) {
    // 有二级菜单时，使用二级菜单映射
    componentLoader = componentMap.value[primaryTab]?.[secondaryTab]
  } else {
    // 没有二级菜单时，使用一级菜单的 value 直接查找
    componentLoader = componentMap.value[primaryTab]?.[primaryTab]
  }

  if (componentLoader) {
    currentComponent.value = defineAsyncComponent(componentLoader)
  } else {
    currentComponent.value = null
  }
}

// 监听tab变化，动态加载组件
watch(
  [activePrimaryTab, activeSecondaryTab],
  () => {
    loadComponent()
  },
  { immediate: true }
)

// 处理第一级tab点击
const handlePrimaryTabClick = (value: string) => {
  activePrimaryTab.value = value
  // 切换第一级tab时，如果有二级菜单则自动选择第一个，否则清空二级菜单选择
  if (currentSecondaryTabs.value.length > 0) {
    activeSecondaryTab.value = currentSecondaryTabs.value[0].value
  } else {
    // 没有二级菜单时，清空二级菜单选择（组件会通过一级菜单 value 加载）
    activeSecondaryTab.value = ''
  }
}

// 处理第二级tab点击
const handleSecondaryTabClick = (value: string) => {
  activeSecondaryTab.value = value
}
</script>

<style scoped lang="scss">
.simulation-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.tabs-primary {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 16px;
  background: var(--el-bg-color-page);
  border-radius: 6px 6px 0 0;
  min-height: 40px;
  padding-top: 4px;
}

.tab-item-primary {
  position: relative;
  cursor: pointer;
  user-select: none;
  padding: 8px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  border-radius: 6px 6px 0 0;
  margin-right: 4px;

  .tab-label {
    font-size: 14px;
    color: var(--el-text-color-regular);
    font-weight: 500;
    transition: all 0.2s ease;
    line-height: 1.5;
    white-space: nowrap;
  }

  .tab-indicator {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 3px;
    background: var(--el-color-primary);
    border-radius: 3px 3px 0 0;
    transition: width 0.25s ease-out;
  }

  &:hover:not(.active) {
    background: var(--el-mask-color-extra-light);

    .tab-label {
      color: var(--el-color-primary);
    }
  }

  &.active {
    background: var(--el-bg-color);
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);

    .tab-label {
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .tab-indicator {
      width: 60%;
    }
  }
}

.tabs-secondary {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 16px;
  background: var(--el-bg-color);
  min-height: 36px;
  border-bottom: 1px solid var(--el-border-color);
}

.tab-item-secondary {
  position: relative;
  cursor: pointer;
  user-select: none;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin-right: 8px;
  border-radius: 4px;

  .tab-label {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    font-weight: 400;
    transition: all 0.2s ease;
    line-height: 1.5;
    white-space: nowrap;
  }

  .tab-indicator {
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 2px;
    background: var(--el-color-primary);
    border-radius: 2px 2px 0 0;
    transition: width 0.25s ease-out;
  }

  &:hover:not(.active) {
    background: var(--el-bg-color-page);

    .tab-label {
      color: var(--el-color-primary);
    }
  }

  &.active {
    .tab-label {
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    .tab-indicator {
      width: 70%;
    }
  }
}

.tab-divider {
  display: none;
}

.simulation-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  background: var(--el-bg-color);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scaleX(0.8);
  }

  to {
    opacity: 1;
    transform: scaleX(1);
  }
}
</style>
