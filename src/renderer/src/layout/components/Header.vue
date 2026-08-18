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
      <!-- 引流广告 -->
      <a class="promotion-banner" href="https://www.vmoscloud.com/" target="_blank">
        <img :src="promotionBanner" alt="VMOSCloud" class="promotion-img" />
      </a>

      <!-- 帮助中心 -->
      <el-dropdown @command="handleHelpCommand">
        <span class="header-tool-item help-trigger">
          <el-icon :size="18">
            <QuestionFilled />
          </el-icon>
          <span class="help-text">{{ t('layout.header.helpCenter') }}</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="item in helpMenuItems"
              :key="item.command"
              :command="item.command"
            >
              <div class="menu-item">
                <el-icon class="menu-item-icon">
                  <component :is="item.icon" />
                </el-icon>
                <span>{{ item.label }}</span>
              </div>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

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
              v-for="lang in languageMenuItems"
              :key="lang.value"
              :command="lang.value"
            >
              <div class="language-menu-item">
                <div class="menu-item">
                  <span class="language-menu-badge">{{ lang.badge }}</span>
                  <span>{{ lang.label }}</span>
                </div>
                <el-icon v-if="lang.isCurrent" class="language-menu-check">
                  <Check />
                </el-icon>
              </div>
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
import {
  Setting,
  Minus,
  CopyDocument,
  Close,
  ArrowDown,
  QuestionFilled,
  Document,
  Link,
  Check
} from '@element-plus/icons-vue'
import TabBar from './TabBar.vue'
import { ipc, WINDOW_TOP } from '@renderer/core/ipc'
import icon from '@renderer/assets/logo.png'
import bannerZhCN from '@renderer/assets/promotion/banner-zh-CN.png'
import bannerZhTW from '@renderer/assets/promotion/banner-zh-TW.png'
import bannerEnUS from '@renderer/assets/promotion/banner-en-US.png'
import { useRouter } from 'vue-router'
import { useLocale } from '@renderer/hooks/useLocale'
import { useI18n } from 'vue-i18n'
import { copyToClipboard } from '@renderer/utils'

const version = __APP_VERSION__
const versionCode = __APP_VERSION_CODE__
const versionHash = __APP_VERSION_HASH__

const showVersionTooltip = ref(false)

const handleVersionDblClick = () => {
  const textToCopy = `v${version} ${versionCode}@${versionHash}`
  copyToClipboard(textToCopy, () => {
    showVersionTooltip.value = true
    setTimeout(() => {
      showVersionTooltip.value = false
    }, 2500)
  })
}

const router = useRouter()

const { changeLocale, currentLanguageLabel, languageList } = useLocale()
const { t, locale } = useI18n()

const promotionBannerMap: Record<string, string> = {
  'zh-CN': bannerZhCN,
  'zh-TW': bannerZhTW,
  'en-US': bannerEnUS
}

const promotionBanner = computed(() => promotionBannerMap[locale.value] || bannerEnUS)

const helpDocUrl = computed(() => {
  return locale.value === 'zh-CN' ? 'https://help.vmosedge.com/' : 'https://help.vmosedge.com/en/'
})

const officialWebsiteUrl = computed(() => {
  return 'https://www.vmosedge.com/'
})

const helpMenuItems = computed(() => [
  {
    label: t('layout.header.helpDocs'),
    command: 'help-docs',
    icon: Document
  },
  {
    label: t('layout.header.officialWebsite'),
    command: 'official-website',
    icon: Link
  }
])

const isTop = ref(false)

const languageBadgeMap = {
  'zh-CN': '简',
  'zh-TW': '繁',
  'en-US': 'EN'
} as const

const languageMenuItems = computed(() =>
  languageList.map((lang) => ({
    ...lang,
    badge: languageBadgeMap[lang.value as keyof typeof languageBadgeMap] ?? 'A',
    isCurrent: lang.value === locale.value
  }))
)

const handleLanguageChange = (command: string) => {
  changeLocale(command)
}

const handleHelpCommand = (command: string) => {
  const urlMap: Record<string, string> = {
    'help-docs': helpDocUrl.value,
    'official-website': officialWebsiteUrl.value
  }

  const targetUrl = urlMap[command]
  if (!targetUrl) return

  window.open(targetUrl, '_blank')
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
  padding-left: 10px;
  flex: 1;
  min-width: 0;
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
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
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
  white-space: nowrap;
}

.header-tool-item:hover {
  background-color: var(--el-bg-color-page);
}

.promotion-banner {
  display: inline-flex;
  align-items: center;
  height: 36px;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  transition: opacity 0.2s;
  text-decoration: none;
  vertical-align: middle;
}

.promotion-banner:hover {
  opacity: 0.85;
}

.promotion-img {
  height: 100%;
  display: block;
  object-fit: contain;
}

.help-trigger {
  color: var(--el-text-color-regular);
  display: flex;
  align-items: center;
}

.help-text {
  margin-left: 6px;
}

.menu-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.menu-item-icon {
  color: var(--el-text-color-secondary);
  font-size: 16px;
  flex-shrink: 0;
}

.language-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.language-menu-badge {
  min-width: 20px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
  flex-shrink: 0;
}

.language-menu-check {
  color: var(--el-text-color-regular);
  font-size: 16px;
  opacity: 0.8;
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

.header-tool-item :deep(.el-badge__content) {
  font-size: 10px;
}
</style>
