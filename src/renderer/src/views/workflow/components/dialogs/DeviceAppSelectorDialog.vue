<script setup lang="ts">
/**
 * 云机 + 应用选择对话框
 *
 * 三步:
 *  ① 选云机(按主机分组)
 *  ② 选应用(切云机后实时扫描)
 *  ③ 填脚本名(仅新建模式;换设备时隐藏)
 */
import { computed, watch, ref, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElInput } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import type { Device } from '@shared/ipc/data.types'
import type { AppInfo } from '@shared/ipc/workflow.types'
import { useDeviceAppSelector } from '../../composables/useDeviceAppSelector'
import { useOnboardingGuide } from '../../composables/useOnboardingGuide'
import { getCreateDialogSteps, CREATE_GUIDE_ID } from '../../guide/steps'
import { resolveRecentApps } from '../../utils/recentApps'
import HostGroup from '../shared/HostGroup.vue'
import AppRow from '../shared/AppRow.vue'

interface Props {
  open: boolean
  /** 新建脚本时需要让用户填名;换设备时不需要 */
  requireName?: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'confirm', payload: { device: Device; app: AppInfo; name?: string }): void
}

const props = withDefaults(defineProps<Props>(), { requireName: true })
const emit = defineEmits<Emits>()
const { t } = useI18n()

const selector = useDeviceAppSelector()
const searchKeyword = ref('')
const scriptName = ref('')
let teardown: (() => void) | null = null
const createGuide = useOnboardingGuide(CREATE_GUIDE_ID, getCreateDialogSteps())

watch(
  () => props.open,
  async (openNow) => {
    if (openNow) {
      selector.reset()
      searchKeyword.value = ''
      scriptName.value = ''
      teardown = await selector.initialize()
      if (props.requireName) createGuide.tryAutoStart()
    } else {
      createGuide.stop()
      if (teardown) {
        teardown()
        teardown = null
      }
    }
  },
  { immediate: true }
)

// 选中应用后,如果用户还没敲过名字,自动填入应用名作为默认
watch(
  () => selector.selectedApp.value,
  (app) => {
    if (props.requireName && app && !scriptName.value.trim()) {
      scriptName.value = t('workflow.deviceDialog.defaultName', {
        appName: (app as AppInfo).displayName
      })
    }
  }
)

onBeforeUnmount(() => {
  teardown?.()
})

const filteredApps = computed<AppInfo[]>(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return selector.apps.value as AppInfo[]
  return (selector.apps.value as AppInfo[]).filter(
    (a) =>
      a.displayName.toLowerCase().includes(keyword) || a.packageName.toLowerCase().includes(keyword)
  )
})

const recentApps = computed<AppInfo[]>(() =>
  resolveRecentApps(filteredApps.value, selector.getRecentApps(4))
)

const otherApps = computed<AppInfo[]>(() => {
  const recentKeys = new Set(recentApps.value.map((a) => a.packageName))
  return filteredApps.value.filter((a) => !recentKeys.has(a.packageName))
})

const trimmedName = computed(() => scriptName.value.trim())

const canConfirm = computed(() => {
  if (!selector.canConfirm.value) return false
  if (props.requireName && trimmedName.value.length === 0) return false
  return true
})

function handleClose(): void {
  emit('update:open', false)
}

function handleConfirm(): void {
  const device = selector.selectedDevice.value
  const app = selector.selectedApp.value
  if (!device || !app || !canConfirm.value) return
  emit('confirm', {
    device: device as Device,
    app: app as AppInfo,
    name: props.requireName ? trimmedName.value : undefined
  })
  emit('update:open', false)
}
</script>

<template>
  <VmosDialog
    class="device-app-selector-dialog"
    :model-value="props.open"
    :title="
      requireName ? t('workflow.deviceDialog.createTitle') : t('workflow.deviceDialog.switchTitle')
    "
    width="min(820px, calc(100vw - 32px))"
    :close-on-click-modal="false"
    :show-close="true"
    @update:model-value="(v) => emit('update:open', v)"
    @close="handleClose"
  >
    <div class="selector-container">
      <div class="selector-main">
        <!-- 左:云机 -->
        <div class="selector-col device-col">
          <div class="col-header">
            <div class="step-badge">1</div>
            <div class="header-content">
              <div class="step-title">{{ t('workflow.deviceDialog.selectDevice') }}</div>
              <div class="step-meta">
                {{
                  t('workflow.deviceDialog.hostStats', {
                    hosts: selector.hostGroups.value.length,
                    running: selector.hostGroups.value.reduce((sum, g) => sum + g.devices.length, 0)
                  })
                }}
              </div>
            </div>
          </div>

          <div class="col-body custom-scrollbar">
            <div v-if="selector.loadingTree.value" class="placeholder">
              <div class="shimmer-row" v-for="i in 3" :key="i"></div>
            </div>
            <div v-else-if="selector.treeError.value" class="placeholder error">
              <i class="error-icon">!</i>
              <p>{{ selector.treeError.value }}</p>
            </div>
            <div v-else-if="selector.hostGroups.value.length === 0" class="placeholder">
              <p>{{ t('workflow.deviceDialog.noHosts') }}</p>
            </div>

            <HostGroup
              v-for="group in selector.hostGroups.value"
              :key="group.host.id"
              :host="group.host"
              :devices="group.devices"
              :selected-device-id="selector.selectedDevice.value?.id ?? null"
              @select-device="(device) => selector.selectDevice(device)"
            />
          </div>
        </div>

        <!-- 右:应用 -->
        <div class="selector-col app-col">
          <div class="col-header">
            <div class="step-badge">2</div>
            <div class="header-content">
              <div class="step-title">{{ t('workflow.deviceDialog.selectApp') }}</div>
              <div v-if="selector.selectedDevice.value" class="step-meta">
                {{ t('workflow.deviceDialog.from') }}
                <strong>{{
                  selector.selectedDevice.value.user_name || selector.selectedDevice.value.id
                }}</strong>
              </div>
              <div v-else class="step-meta">{{ t('workflow.deviceDialog.selectDeviceFirst') }}</div>
            </div>
          </div>

          <div class="col-body">
            <template v-if="!selector.selectedDevice.value">
              <div class="placeholder empty-state">
                <div class="empty-icon">📱</div>
                <p>{{ t('workflow.deviceDialog.waitingForDevice') }}</p>
              </div>
            </template>
            <template v-else>
              <div class="app-search-wrap">
                <ElInput
                  v-model="searchKeyword"
                  :placeholder="t('workflow.deviceDialog.searchApp')"
                  :prefix-icon="Search"
                  clearable
                />
              </div>

              <div class="app-scroll-area custom-scrollbar">
                <div v-if="selector.appsLoading.value" class="placeholder">
                  <div class="shimmer-app" v-for="i in 4" :key="i"></div>
                </div>
                <div v-else-if="selector.appsError.value" class="placeholder error">
                  <p>{{ t('workflow.deviceDialog.scanFailed') }}: {{ selector.appsError.value }}</p>
                  <ElButton size="small" type="primary" link @click="selector.refreshApps()">
                    {{ t('workflow.deviceDialog.retryScan') }}
                  </ElButton>
                </div>
                <div v-else-if="filteredApps.length === 0" class="placeholder">
                  <p>
                    {{
                      searchKeyword
                        ? t('workflow.deviceDialog.noMatchApp')
                        : t('workflow.deviceDialog.noApps')
                    }}
                  </p>
                </div>

                <div v-else class="app-list">
                  <div v-if="recentApps.length > 0" class="app-group">
                    <div class="group-label">{{ t('workflow.deviceDialog.recentApps') }}</div>
                    <AppRow
                      v-for="app in recentApps"
                      :key="app.packageName"
                      :app="app"
                      :selected="selector.selectedApp.value?.packageName === app.packageName"
                      @select="selector.selectApp(app)"
                    />
                  </div>

                  <div class="app-group">
                    <div class="group-label">
                      {{ t('workflow.deviceDialog.allApps', { count: otherApps.length }) }}
                    </div>
                    <AppRow
                      v-for="app in otherApps"
                      :key="app.packageName"
                      :app="app"
                      :selected="selector.selectedApp.value?.packageName === app.packageName"
                      @select="selector.selectApp(app)"
                    />
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- ③ 脚本名(仅新建) -->
      <div v-if="requireName" class="name-section">
        <div class="section-header">
          <div class="step-badge">3</div>
          <label class="step-title" for="workflow-name-input">{{
            t('workflow.deviceDialog.nameYourScript')
          }}</label>
        </div>
        <div class="name-input-wrap">
          <ElInput
            id="workflow-name-input"
            v-model="scriptName"
            :placeholder="t('workflow.deviceDialog.namePlaceholder')"
            maxlength="60"
            show-word-limit
            @keyup.enter="handleConfirm"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-hint">
          <span class="hint-icon">💡</span>
          <span>{{ t('workflow.deviceDialog.scanHint') }}</span>
        </div>
        <div class="footer-btns">
          <ElButton @click="handleClose">{{ t('workflow.deviceDialog.cancel') }}</ElButton>
          <ElButton type="primary" :disabled="!canConfirm" @click="handleConfirm">
            {{
              requireName
                ? t('workflow.deviceDialog.startCreate')
                : t('workflow.deviceDialog.confirmSwitch')
            }}
          </ElButton>
        </div>
      </div>
    </template>
  </VmosDialog>
</template>

<style scoped>
.selector-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

.selector-main {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16px;
  height: 420px;
  min-height: 0;
}

.selector-col {
  display: flex;
  flex-direction: column;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.selector-col:focus-within {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.col-header {
  padding: 14px 16px;
  background: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.header-content {
  min-width: 0;
}

.step-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.2;
}

.step-meta {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
}

.col-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}

.app-search-wrap {
  padding: 8px;
}

.app-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.empty-state .empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.shimmer-row {
  width: 100%;
  height: 48px;
  background: linear-gradient(
    90deg,
    var(--el-fill-color-lighter) 25%,
    var(--el-fill-color) 50%,
    var(--el-fill-color-lighter) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 8px;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.app-group {
  margin-bottom: 16px;
}

.group-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-placeholder);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 8px;
  margin-bottom: 4px;
}

.name-section {
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 12px;
  border: 1px dashed var(--el-border-color);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.name-input-wrap {
  padding-left: 36px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.footer-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-btns {
  display: flex;
  gap: 12px;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--el-border-color-lighter);
  border-radius: 10px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
}

@media (max-width: 768px) {
  .selector-main {
    grid-template-columns: 1fr;
    height: auto;
    max-height: 500px;
  }

  .device-col {
    height: 200px;
  }
}
</style>
