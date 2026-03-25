<template>
  <el-dialog
    v-model="updateDialogVisible"
    :title="t('common.appUpdateAvailable')"
    width="min(800px, 92vw)"
    top="5vh"
    class="desktop-update-checker-dialog"
    append-to-body
  >
    <div v-if="desktopUpdateInfo" class="desktop-update-dialog">
      <div class="desktop-update-meta">
        <span>{{ t('common.currentVersion', { version: desktopUpdateInfo.currentVersion }) }}</span>
        <span>{{ t('common.latestVersion', { version: desktopUpdateInfo.latestVersion }) }}</span>
        <el-link type="primary" @click="openReleaseHistory">
          {{ t('common.viewReleaseHistory') }}
        </el-link>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="desktop-update-html" v-html="desktopUpdateInfo.sectionHtml"></div>
    </div>
    <template #footer>
      <el-button @click="ignoreCurrentVersion">
        {{ t('common.ignoreThisVersion') }}
      </el-button>
      <el-button type="primary" @click="updateDialogVisible = false">
        {{ t('common.gotIt') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ipc } from '@renderer/core/ipc'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { runVersionChecker, type DesktopReleaseUpdateInfo } from '@renderer/utils/versionChecker'

// eslint-disable-next-line no-undef
const appVersion = __APP_VERSION__

const { t, locale } = useI18n()
const updateDialogVisible = ref(false)
const desktopUpdateInfo = ref<DesktopReleaseUpdateInfo | null>(null)
const hasCheckedDesktopUpdate = ref(false)
let startupTimer: number | null = null

const isMainWindow = computed(() => {
  if (!ipc.isMainWindow()) return false
  return !window.location.hash.includes('/phone')
})

const openReleaseHistory = () => {
  if (!desktopUpdateInfo.value?.sourceUrl) return
  window.open(desktopUpdateInfo.value.sourceUrl, '_blank')
}

const readIgnoredVersion = async (): Promise<string> => {
  const res = await ipc.invoke<string>(
    CONFIG_EVENTS.GET_CONFIGS,
    CONFIG_KEYS.CLIENT_UPDATE_IGNORED_VERSION
  )
  if (!res.success || !res.data) {
    return ''
  }
  return String(res.data).trim()
}

const ignoreCurrentVersion = async () => {
  const latestVersion = desktopUpdateInfo.value?.latestVersion
  updateDialogVisible.value = false
  if (!latestVersion) return

  try {
    await ipc.invoke<void>(CONFIG_EVENTS.SET_CONFIG, {
      key: CONFIG_KEYS.CLIENT_UPDATE_IGNORED_VERSION,
      value: latestVersion
    })
    console.info('[UpdateCheck] Ignored desktop update version:', latestVersion)
  } catch (error) {
    console.warn('[UpdateCheck] Failed to persist ignored version', error)
  }
}

const checkDesktopUpdateAtStartup = async () => {
  if (!isMainWindow.value || hasCheckedDesktopUpdate.value) return
  hasCheckedDesktopUpdate.value = true

  try {
    const result = await runVersionChecker(appVersion, locale.value)
    if (!result) return

    console.info('[UpdateCheck] Extracted info:', result.summary)
    console.info('[UpdateCheck] Version comparison result:', {
      platform: result.platform || 'unknown',
      currentVersion: appVersion,
      latestVersion: result.latestVersion || '',
      hasUpdate: result.hasUpdate,
      cacheSource: result.cacheSource
    })

    if (result.hasUpdate) {
      const ignoredVersion = await readIgnoredVersion()
      if (ignoredVersion && ignoredVersion === result.latestVersion) {
        console.info('[UpdateCheck] Latest version is ignored, skip dialog:', ignoredVersion)
        return
      }

      desktopUpdateInfo.value = result
      updateDialogVisible.value = true
    }
  } catch (error) {
    console.warn('[DesktopUpdateChecker] Failed to check desktop release update', error)
  }
}

onMounted(() => {
  // Run after first paint to avoid blocking initial mount.
  startupTimer = window.setTimeout(() => {
    void checkDesktopUpdateAtStartup()
  }, 0)
})

onUnmounted(() => {
  if (startupTimer !== null) {
    window.clearTimeout(startupTimer)
    startupTimer = null
  }
})
</script>

<style>
.desktop-update-checker-dialog {
  --desktop-update-dialog-bottom-gap: 5vh;
  --desktop-update-dialog-height: min(
    800px,
    calc(100vh - var(--el-dialog-margin-top, 5vh) - var(--desktop-update-dialog-bottom-gap))
  );
  --desktop-update-dialog-chrome-height: 170px;
  --desktop-update-content-height: max(
    220px,
    calc(var(--desktop-update-dialog-height) - var(--desktop-update-dialog-chrome-height))
  );
  margin-bottom: var(--desktop-update-dialog-bottom-gap);
  max-height: var(--desktop-update-dialog-height);
  display: flex;
  flex-direction: column;
}

.desktop-update-checker-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.desktop-update-dialog {
  display: flex;
  flex-direction: column;
  height: var(--desktop-update-content-height);
  min-height: 0;
  overflow: hidden;
}

.desktop-update-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.desktop-update-html {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 6px;
  color: var(--el-text-color-primary);
  font-size: 14px;
  line-height: 1.65;
}

.desktop-update-html > * + * {
  margin-top: 10px;
}

.desktop-update-html .header-anchor {
  display: none;
}

.desktop-update-html h1,
.desktop-update-html h2,
.desktop-update-html h3,
.desktop-update-html h4 {
  margin: 16px 0 10px;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.desktop-update-html h1 {
  font-size: 18px;
}

.desktop-update-html h2 {
  font-size: 17px;
}

.desktop-update-html h3 {
  font-size: 18px;
}

.desktop-update-html h4 {
  font-size: 14px;
}

.desktop-update-html p {
  margin: 8px 0;
}

.desktop-update-html ul,
.desktop-update-html ol {
  margin: 8px 0;
  padding-left: 20px;
}

.desktop-update-html li {
  margin: 4px 0;
}

.desktop-update-html a {
  color: var(--el-color-primary);
  text-decoration: none;
}

.desktop-update-html a:hover {
  text-decoration: underline;
}

.desktop-update-html code {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
}

.desktop-update-html table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  table-layout: auto;
}

.desktop-update-html th,
.desktop-update-html td {
  border: 1px solid var(--el-border-color-light);
  padding: 8px 10px;
  vertical-align: top;
  word-break: normal;
  overflow-wrap: break-word;
}

.desktop-update-html th {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.desktop-update-html .tip.custom-block {
  border: 0;
  background: #e9ebf9;
  padding: 12px 14px;
  margin: 10px 0;
  border-radius: 8px;
}

.desktop-update-html .tip.custom-block .custom-block-title {
  margin-bottom: 6px;
  font-weight: 600;
}
</style>
