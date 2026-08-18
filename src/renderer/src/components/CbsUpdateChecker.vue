<script setup lang="ts">
import { shallowRef, computed, onMounted, onUnmounted } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, type Host } from '@shared/ipc/data.types'
import {
  fetchCbsRemoteConfig,
  queryHostCbsVersions,
  type CbsRemoteConfig,
  type HostCbsInfo
} from '@renderer/utils/cbsUpdateService'
import CbsUpdateDialog from './CbsUpdateDialog.vue'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

const isMainWindow = computed(() => {
  if (!ipc.isMainWindow()) return false
  return !window.location.hash.includes('/phone')
})

const dialogVisible = shallowRef(false)
const remoteConfig = shallowRef<CbsRemoteConfig | null>(null)
const outdatedHosts = shallowRef<HostCbsInfo[]>([])
const hasChecked = shallowRef(false)

let startupTimer: number | null = null

const DISMISS_KEY = 'cbs_update_dismiss_until'

const isDismissed = (): boolean => {
  const until = Number(localStorage.getItem(DISMISS_KEY))
  return !isNaN(until) && Date.now() < until
}

const saveDismiss = () => {
  localStorage.setItem(DISMISS_KEY, String(Date.now() + SEVEN_DAYS_MS))
}

const checkCbsUpdate = async () => {
  if (!isMainWindow.value || hasChecked.value) return
  hasChecked.value = true

  try {
    if (isDismissed()) return

    const config = await fetchCbsRemoteConfig()

    const flatRes = await ipc.invoke<{ hosts: Host[] }>(DATA_EVENTS.GET_FLAT_DATA)
    if (!flatRes.success || !flatRes.data) return

    const onlineHosts = (flatRes.data.hosts ?? []).filter((h) => h.status === 'online')
    if (onlineHosts.length === 0) return

    const hostInfos = await queryHostCbsVersions(onlineHosts, config.cbs_version)
    if (!hostInfos.some((h) => h.needsUpdate)) return

    remoteConfig.value = config
    outdatedHosts.value = hostInfos
    dialogVisible.value = true
  } catch {
    // 静默失败，不阻断启动
  }
}

onMounted(() => {
  startupTimer = window.setTimeout(() => {
    void checkCbsUpdate()
  }, 3000)
})

onUnmounted(() => {
  if (startupTimer !== null) {
    window.clearTimeout(startupTimer)
    startupTimer = null
  }
})
</script>

<template>
  <CbsUpdateDialog
    v-if="remoteConfig"
    v-model="dialogVisible"
    :remote-config="remoteConfig"
    :outdated-hosts="outdatedHosts"
    @dismiss="saveDismiss"
  />
</template>
