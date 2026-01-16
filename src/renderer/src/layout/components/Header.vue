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
      <!-- <el-dropdown @command="handleLanguageChange">
        <span class="header-tool-item">
          {{ currentLanguage }}
          <el-icon class="el-icon--right">
            <ArrowDown />
          </el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="zh-CN">简体中文</el-dropdown-item>
            <el-dropdown-item command="en-US">English</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown> -->

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
      <span class="version">v{{ version }}</span>

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
import { ref } from 'vue'
import { Setting, Minus, CopyDocument, Close } from '@element-plus/icons-vue'
import TabBar from './TabBar.vue'
import { ipc, WINDOW_TOP } from '@renderer/core/ipc'
import icon from '@renderer/assets/logo.png'
import { useRouter } from 'vue-router'

const version = __APP_VERSION__

const router = useRouter()

// const currentLanguage = ref('简体中文')

const isTop = ref(false)

// const handleLanguageChange = (command: string) => {
//   if (command === 'zh-CN') {
//     currentLanguage.value = '简体中文'
//   } else if (command === 'en-US') {
//     currentLanguage.value = 'English'
//   }
// }

const settingsMenu: { label: string; command: string }[] = [
  {
    label: '通用设置',
    command: 'general-settings'
  },
  {
    label: '机型设置',
    command: 'machine-settings'
  }
]

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
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
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
  color: #409eff;
}
.logo-img {
  display: block; /* 防止图片底部留白 */
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: #303133; /* 调整为更柔和的深色，避免纯黑过于突兀 */
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
  color: #606266;
  font-size: 14px;
}

.header-tool-item:hover {
  background-color: #f5f7fa;
}

.version {
  color: #909399;
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
  background-color: #f5f7fa;
}

.control-btn.close:hover {
  background-color: #f56c6c;
  color: #fff;
}
</style>
