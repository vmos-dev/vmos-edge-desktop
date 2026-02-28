<template>
  <el-config-provider :locale="currentElLocale">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { ElConfigProvider } from 'element-plus'
import { useLocale } from './hooks/useLocale'
import { useTheme } from './hooks/useTheme'
import { ipc, MEDIAMTX_LOG } from '@renderer/core/ipc'

const { currentElLocale, setupStorageListener } = useLocale()
const { initTheme, setupThemeListener } = useTheme()

onMounted(() => {
  initTheme()
  const cleanupLocale = setupStorageListener()
  const cleanupTheme = setupThemeListener()

  const cleanupMediaMtxLog = ipc.on<{ type: 'stdout' | 'stderr'; message: string }>(
    MEDIAMTX_LOG,
    (data) => {
      // @ts-ignore
      if (window.isDebug) {
        if (data.type === 'stderr') {
          console.warn('[MediaMTX] stderr', data.message)
        } else {
          console.log('[MediaMTX] stdout', data.message)
        }
      }
    }
  )

  onUnmounted(() => {
    cleanupLocale()
    cleanupTheme()
    cleanupMediaMtxLog()
  })
})
</script>
<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body,
#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
