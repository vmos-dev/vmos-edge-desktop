<template>
  <VmosDialog
    v-model="visible"
    :title="t('cloudPhone.addHost')"
    :show-close="!loading && !adding"
    width="580px"
    @closed="handleClose"
    @open="handleOpen"
  >
    <!-- 分组选择 -->
    <div class="group-bar">
      <div class="group-bar-icon">
        <el-icon :size="16"><Folder /></el-icon>
      </div>
      <span class="group-bar-label">{{ t('cloudPhone.selectHostGroup') }}</span>
      <el-select
        v-model="groupId"
        :placeholder="t('cloudPhone.selectHostGroupPlaceholder')"
        style="flex: 1"
      >
        <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
      </el-select>
    </div>

    <el-tabs v-model="activeTab" class="host-tabs">
      <!-- 扫描发现 -->
      <el-tab-pane :label="t('cloudPhone.scanDiscover')" name="scan">
        <div class="scan-content">
          <!-- 左：雷达 -->
          <div class="scan-radar-side">
            <div class="radar-wrap">
              <RadarScan :size="200" :scanning="scanning" :blips="scanBlips" />
            </div>
            <div class="scan-status">
              <span
                class="scan-dot"
                :class="
                  scanning ? 'scanning' : scanDone && scanResults.length > 0 ? 'done' : 'idle'
                "
              />
              <span class="scan-status-text">
                <template v-if="scanning">{{ t('cloudPhone.scanning') }}</template>
                <template v-else-if="scanDone && scanResults.length === 0">{{
                  t('cloudPhone.scanNoResult')
                }}</template>
                <template v-else-if="scanDone">{{
                  t('cloudPhone.scanComplete', { count: scanResults.length })
                }}</template>
                <template v-else>{{ t('cloudPhone.scanReady') }}</template>
              </span>
              <el-button v-if="scanDone" link type="primary" size="small" @click="startScan">
                <el-icon><RefreshRight /></el-icon>
              </el-button>
            </div>
          </div>

          <!-- 右：设备列表 -->
          <div class="scan-list-side">
            <template v-if="scanResults.length > 0">
              <div class="list-toolbar">
                <el-checkbox
                  :model-value="isAllSelected"
                  :indeterminate="isIndeterminate"
                  @change="toggleSelectAll"
                >
                  {{ t('cloudPhone.selectAll') }}
                </el-checkbox>
                <span class="list-count">
                  <span class="list-count-num">{{ selectedIds.size }}</span>
                  / {{ scanResults.length }}
                </span>
              </div>
              <div class="device-list">
                <transition-group name="item-in">
                  <div
                    v-for="d in scanResults"
                    :key="d.id"
                    class="device-item"
                    :class="{ active: selectedIds.has(d.id) }"
                    @click="toggleSelect(d.id)"
                  >
                    <el-checkbox
                      :model-value="selectedIds.has(d.id)"
                      @click.stop
                      @change="toggleSelect(d.id)"
                    />
                    <div class="device-icon">
                      <svg-icon name="host" :size="16" />
                    </div>
                    <div class="item-info">
                      <span class="item-id">{{ d.id }}</span>
                      <span class="item-ip">{{ d.ip }}</span>
                    </div>
                  </div>
                </transition-group>
              </div>
            </template>
            <div v-else class="list-empty">
              <span class="list-empty-text">
                <template v-if="scanning">{{ t('cloudPhone.scanning') }}…</template>
                <template v-else-if="scanDone">{{ t('cloudPhone.scanNoResult') }}</template>
                <template v-else>{{ t('cloudPhone.scanReady') }}</template>
              </span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 手动添加 -->
      <el-tab-pane :label="t('cloudPhone.manualAdd')" name="manual">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="auto"
          label-position="top"
          @submit.prevent
        >
          <el-form-item :label="t('cloudPhone.hostIp')" prop="ips">
            <el-input
              v-model="form.ips"
              type="textarea"
              :rows="6"
              :placeholder="t('cloudPhone.hostIpPlaceholder')"
              class="ip-textarea"
            />
          </el-form-item>
        </el-form>
        <div class="manual-hint">
          <el-icon :size="14"><InfoFilled /></el-icon>
          <span>{{ t('cloudPhone.manualAddHint') }}</span>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <template v-if="activeTab === 'manual'">
        <el-button :disabled="loading" @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="loading" @click="handleAddHost">{{
          t('common.confirm')
        }}</el-button>
      </template>
      <template v-else>
        <el-button :disabled="adding" @click="visible = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="adding"
          :disabled="selectedIds.size === 0 || scanning"
          @click="handleAddScanned"
        >
          {{ t('cloudPhone.addSelected', { count: selectedIds.size }) }}
        </el-button>
      </template>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, type Group, type Host, type UDPDevice } from '@shared/ipc/data.types'
import { API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api'
import { ElForm, ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import RadarScan from '@renderer/components/radar/RadarScan.vue'
import { Folder, InfoFilled, RefreshRight } from '@element-plus/icons-vue'

const { t } = useI18n()

const visible = ref(false)
const loading = ref(false)
const adding = ref(false)
const activeTab = ref<'manual' | 'scan'>('scan')
const formRef = ref<InstanceType<typeof ElForm>>()
const groups = ref<Group[]>([])
const groupId = ref('')

// ===== 手动添加 =====
const ipv4Reg = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const ipv6Reg = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/
const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/

const validateIPs = (_rule: any, value: string, callback: any) => {
  if (!value) return callback(new Error(t('cloudPhone.enterHostIp')))
  const ips = value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (ips.length === 0) return callback(new Error(t('cloudPhone.enterHostIp')))
  if (ips.length > 128) return callback(new Error(t('cloudPhone.maxHosts')))
  const bad = ips.filter((ip) => !ipv4Reg.test(ip) && !ipv6Reg.test(ip) && !domainRegex.test(ip))
  if (bad.length > 0)
    return callback(new Error(t('cloudPhone.invalidIpFormat', { ips: bad.join(', ') })))
  callback()
}

const rules = computed(() => ({
  ips: [{ required: true, validator: validateIPs, trigger: 'blur' }]
}))
const form = ref({ ips: '' })

// ===== 扫描 =====
const scanning = ref(false)
const scanDone = ref(false)
const scanResults = ref<UDPDevice[]>([])
const selectedIds = ref<Set<string>>(new Set())
const existingHosts = ref<Host[]>([])

const isAllSelected = computed(
  () => scanResults.value.length > 0 && selectedIds.value.size === scanResults.value.length
)
const isIndeterminate = computed(
  () => selectedIds.value.size > 0 && selectedIds.value.size < scanResults.value.length
)

let offScanFound: (() => void) | null = null
let offScanComplete: (() => void) | null = null

// 设备在雷达上的位置（极坐标 + 黄金角均匀分散）
const scanBlips = computed(() =>
  scanResults.value.map((d, i) => {
    const angle = i * 2.399963 // 黄金角（弧度）
    const r = 0.12 + ((i * 0.131) % 0.32) // 距圆心 12%~44% 半径
    return {
      id: d.id,
      x: 0.5 + r * Math.cos(angle),
      y: 0.5 + r * Math.sin(angle)
    }
  })
)

// ===== 心跳检测队列 =====
const checkHeartbeatQueue = async (
  items: { ip: string }[]
): Promise<{ ip: string; id: string | null; success: boolean }[]> => {
  const results: { ip: string; id: string | null; success: boolean }[] = []
  const concurrency = 20
  let cursor = 0
  const run = async () => {
    while (cursor < items.length) {
      const i = cursor++
      try {
        const url = `http://${items[i].ip}:${API_CONFIG.DEFAULT_PORT}${API_CONFIG.PATHS.GET_HARDWARE_CFG}`
        const res = await request.get(url, null, { timeout: 3000 })
        results.push({
          ip: items[i].ip,
          id: res?.data?.device_id ?? null,
          success: !!res?.data?.device_id
        })
      } catch {
        results.push({ ip: items[i].ip, id: null, success: false })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()))
  return results
}

const addHostsWithCheck = async (ips: { ip: string }[], setLoading: (v: boolean) => void) => {
  if (!groupId.value) {
    ElMessage.warning(t('cloudPhone.selectGroup'))
    return
  }
  if (ips.length === 0) return
  setLoading(true)
  try {
    const results = await checkHeartbeatQueue(ips)
    const ok = results.filter((r) => r.success)
    const failCount = results.length - ok.length
    if (ok.length === 0) {
      ElMessage.error(t('cloudPhone.allHostCheckFailed'))
      return
    }
    const res = await ipc.invoke(DATA_EVENTS.ADD_HOST, {
      groupId: groupId.value,
      hosts: ok.map((r) => ({ ip: r.ip, id: r.id! }))
    })
    if (res.success) {
      if (failCount > 0) {
        ElMessage.warning(t('cloudPhone.addHostResult', { success: ok.length, fail: failCount }))
      } else {
        ElMessage.success(t('cloudPhone.addHostResult', { success: ok.length, fail: 0 }))
      }
      visible.value = false
    } else {
      ElMessage.error(res.error)
    }
  } finally {
    setLoading(false)
  }
}

// ===== IPC =====
const fetchGroups = async () => {
  try {
    const res = await ipc.invoke<Group[]>(DATA_EVENTS.GET_GROUPS)
    if (res.success && res.data) {
      groups.value = res.data?.filter((g) => !g.type || g.type === 'host') ?? []
      if (groups.value.length > 0 && !groupId.value) groupId.value = groups.value[0].id
    }
  } catch (err) {
    console.error(err)
  }
}

const startScan = async () => {
  scanResults.value = []
  selectedIds.value = new Set()
  scanning.value = true
  scanDone.value = false

  const hostsRes = await ipc.invoke<Host[]>(DATA_EVENTS.GET_HOSTS)
  existingHosts.value = hostsRes.success && hostsRes.data ? hostsRes.data : []

  offScanFound?.()
  offScanComplete?.()
  offScanFound = ipc.on<UDPDevice>(DATA_EVENTS.HOST_SCAN_FOUND, (device) => {
    const isDuplicate = existingHosts.value.some((h) => h.id === device.id && h.ip === device.ip)
    if (!isDuplicate) scanResults.value.push(device)
  })
  offScanComplete = ipc.on<void>(DATA_EVENTS.HOST_SCAN_COMPLETE, () => {
    scanning.value = false
    scanDone.value = true
    offScanFound?.()
    offScanComplete?.()
    offScanFound = null
    offScanComplete = null
  })
  await ipc.invoke(DATA_EVENTS.START_HOST_SCAN)
}

const cancelScan = () => {
  if (!scanning.value) return
  ipc.send(DATA_EVENTS.CANCEL_HOST_SCAN)
  scanning.value = false
  scanDone.value = false
  offScanFound?.()
  offScanComplete?.()
  offScanFound = null
  offScanComplete = null
}

const toggleSelect = (id: string) => {
  const n = new Set(selectedIds.value)
  n.has(id) ? n.delete(id) : n.add(id)
  selectedIds.value = n
}

const toggleSelectAll = (v: boolean | string | number) => {
  selectedIds.value = v ? new Set(scanResults.value.map((d) => d.id)) : new Set()
}

const handleOpen = () => {
  fetchGroups()
  startScan()
}

const handleClose = () => {
  cancelScan()
  formRef.value?.resetFields()
  form.value = { ips: '' }
  groupId.value = ''
  activeTab.value = 'scan'
  scanResults.value = []
  selectedIds.value = new Set()
  scanDone.value = false
}

const handleAddHost = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || loading.value) return
    const raw = form.value.ips
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const resolved: { ip: string }[] = []
    for (const addr of raw) {
      if (ipv4Reg.test(addr) || ipv6Reg.test(addr)) {
        resolved.push({ ip: addr })
      } else {
        try {
          const r = await ipc.invoke<string>(DATA_EVENTS.RESOLVE_DOMAIN, addr)
          if (r.success && r.data) resolved.push({ ip: r.data })
        } catch {}
      }
    }
    if (!resolved.length) {
      ElMessage.warning(t('cloudPhone.enterValidHostAddress'))
      return
    }
    await addHostsWithCheck(resolved, (v) => (loading.value = v))
  })
}

const handleAddScanned = async () => {
  if (selectedIds.value.size === 0 || adding.value) return
  const ips = scanResults.value
    .filter((d) => selectedIds.value.has(d.id))
    .map((d) => ({ ip: d.ip }))
  await addHostsWithCheck(ips, (v) => (adding.value = v))
}

const init = () => {
  visible.value = true
  handleOpen()
}
defineExpose({ init })
</script>

<style scoped>
/* ===== 分组选择 ===== */
.group-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: var(--el-fill-color-light);
  border-radius: var(--app-radius-base);
  border: 1px solid var(--el-border-color-extra-light);
}

.group-bar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.group-bar-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  font-weight: 500;
}

/* ===== Tabs ===== */
.host-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}

.host-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

/* ===== 手动添加 ===== */
.ip-textarea :deep(.el-textarea__inner) {
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.7;
  letter-spacing: 0.02em;
}

.manual-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  line-height: 1.5;
}

.manual-hint .el-icon {
  margin-top: 1px;
  color: var(--el-color-info);
  flex-shrink: 0;
}

/* ===== 扫描主体布局 ===== */
.scan-content {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-height: 230px;
}

/* ===== 左侧：雷达列 ===== */
.scan-radar-side {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.radar-wrap {
  border-radius: 50%;
  overflow: hidden;
  box-shadow:
    0 0 0 1px var(--el-border-color-lighter),
    0 4px 16px rgba(0, 0, 0, 0.08);
}

.scan-status {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 200px;
  justify-content: center;
}

.scan-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.scan-dot.idle {
  background: var(--el-text-color-placeholder);
}

.scan-dot.scanning {
  background: var(--el-color-success);
  box-shadow: 0 0 5px var(--el-color-success);
  animation: pulse-dot 1.4s ease-in-out infinite;
}

.scan-dot.done {
  background: var(--el-color-success);
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.7);
  }
}

.scan-status-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* ===== 右侧：设备列 ===== */
.scan-list-side {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--app-radius-base);
  overflow: hidden;
  height: 230px;
  display: flex;
  flex-direction: column;
}

.list-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-empty-text {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.list-count {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}

.list-count-num {
  color: var(--el-color-primary);
  font-weight: 600;
}

.device-list {
  flex: 1;
  overflow-y: auto;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  font-size: 13px;
}

.device-item:last-child {
  border-bottom: none;
}

.device-item:hover {
  background: var(--el-fill-color-light);
}

.device-item.active {
  background: var(--el-color-primary-light-9);
  border-left: 3px solid var(--el-color-primary);
  padding-left: 11px;
}

.device-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.device-item.active .device-icon {
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}

.device-item.active .item-id {
  color: var(--el-color-primary);
}

.item-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.item-id {
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-ip {
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  flex-shrink: 0;
  margin-left: auto;
}

/* ===== 飞入动画 ===== */
.item-in-enter-active {
  transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.item-in-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
