<template>
  <header class="layout-header">
    <!-- Logo 和标题 -->
    <div class="header-left">
      <div class="logo">
        <img :src="icon" alt="logo" class="logo-img" style="width: 32px; height: 32px" />
        <span class="title">VMOS Edge</span>
      </div>

      <TabBar />
    </div>

    <!-- 右侧工具栏 -->
    <div class="header-right">
      <!-- 语言切换 -->
      <el-dropdown @command="handleLanguageChange">
        <span class="header-tool-item">
          {{ currentLanguageLabel }}
          <el-icon class="el-icon--right">
            <ArrowDown />
          </el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="lang in languageList"
              :key="lang.value"
              :command="lang.value"
            >
              {{ lang.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 设置 -->

      <el-dropdown @command="handleSettings">
        <div class="header-tool-item">
          <el-icon :size="18">
            <Setting />
          </el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="item in settingsMenu"
              :key="item.command"
              :command="item.command"
            >
              {{ item.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 版本号 -->
      <el-tooltip
        :content="versionCode + '@' + versionHash"
        :visible="showVersionTooltip"
        placement="bottom"
      >
        <span class="version" @dblclick="handleVersionDblClick">v{{ version }}</span>
      </el-tooltip>

      <!-- 窗口控制按钮 -->
      <div class="window-controls">
        <!-- 置顶按钮 -->
        <div class="control-btn" @click="handleTop" :class="{ 'is-top': isTop }">
          <SvgIcon name="pinToTop" :size="14" />
        </div>
        <div class="control-btn" @click="handleMinimize">
          <el-icon :size="14">
            <Minus />
          </el-icon>
        </div>
        <div class="control-btn" @click="handleMaximize">
          <el-icon :size="14">
            <CopyDocument />
          </el-icon>
        </div>
        <div class="control-btn close" @click="handleClose">
          <el-icon :size="14">
            <Close />
          </el-icon>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Setting, Minus, CopyDocument, Close, ArrowDown } from '@element-plus/icons-vue'
import TabBar from './TabBar.vue'
import { ipc, WINDOW_TOP } from '@renderer/core/ipc'
import icon from '@renderer/assets/logo.png'
import { useRouter } from 'vue-router'
import { useLocale } from '@renderer/hooks/useLocale'
import { useI18n } from 'vue-i18n'

const version = __APP_VERSION__
const versionCode = __APP_VERSION_CODE__
const versionHash = __APP_VERSION_HASH__

const showVersionTooltip = ref(false)
const handleVersionDblClick = () => {
  showVersionTooltip.value = true
  setTimeout(() => {
    showVersionTooltip.value = false
  }, 2500)
}

const router = useRouter()
const { changeLocale, currentLanguageLabel, languageList } = useLocale()
const { t } = useI18n()

const isTop = ref(false)

const handleLanguageChange = (command: string) => {
  changeLocale(command)
}

const settingsMenu = computed(() => [
  {
    label: t('layout.header.generalSettings'),
    command: 'general-settings'
  },
  {
    label: t('layout.header.machineSettings'),
    command: 'machine-settings'
  }
])

const handleSettings = (command: string) => {
  switch (command) {
    case 'machine-settings':
      router.push('/adi')
      break
    case 'general-settings':
      router.push('/general')
      break
    default:
      break
  }
}

const handleTop = () => {
  // 切换状态
  isTop.value = !isTop.value
  // 发送消息给主进程
  ipc.send(WINDOW_TOP, isTop.value)
}

const handleMinimize = () => {
  ipc.minimize()
}

const handleMaximize = () => {
  ipc.maximize()
}

const handleClose = () => {
  ipc.close()
}
</script>

<style scoped>
.layout-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-light);
  -webkit-app-region: drag;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  -webkit-app-region: no-drag;
  padding-left: 10px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  /* 确保 Logo 区域垂直居中 */
  height: 100%;
}

.is-top {
  color: var(--el-color-primary);
}
.logo-img {
  display: block; /* 防止图片底部留白 */
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: var(--el-text-color-primary); /* 调整为更柔和的深色，避免纯黑过于突兀 */
  margin-left: 4px;
  line-height: 1; /* 避免行高导致文字垂直偏移 */
  position: relative;
  top: 1px; /* 微调文字垂直位置 */
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  -webkit-app-region: no-drag;
}

.header-tool-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.header-tool-item:hover {
  background-color: var(--el-bg-color-page);
}

.version {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  padding: 0 3px;
}

.window-controls {
  display: flex;
  margin-left: 8px;
}

.control-btn {
  width: 40px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s;
}

.control-btn:hover {
  background-color: var(--el-bg-color-page);
}

.control-btn.close:hover {
  background-color: var(--el-color-danger);
  color: var(--el-bg-color);
}
</style>
