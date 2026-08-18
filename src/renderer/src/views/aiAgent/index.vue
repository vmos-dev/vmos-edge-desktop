<template>
  <div class="ai-agent-container">
    <!-- 左侧面板 -->
    <div class="side-panel">
      <!-- 设备选择器 - 点击打开设备选择对话框 -->
      <div class="device-selector" @click="showDeviceSelector = true">
        <template v-if="selectedDevice">
          <span class="status-dot online" />
          <div class="device-selector-info">
            <span class="device-selected-name">{{ selectedDevice.user_name || deviceIp }}</span>
            <span class="device-selected-ip">{{ deviceIp }}</span>
          </div>
        </template>
        <template v-else>
          <el-icon color="var(--el-text-color-placeholder)"><Iphone /></el-icon>
          <span class="device-select-hint">{{ t('aiAgent.device.select') }}</span>
        </template>
        <el-icon class="selector-arrow"><ArrowDown /></el-icon>
      </div>

      <!-- 会话列表操作栏 -->
      <div class="conversation-actions">
        <span class="conversation-actions-title">{{ conversationActionTitle }}</span>
        <el-button
          plain
          size="small"
          @click="stopAllApps"
          :loading="isStoppingApps"
          :disabled="!selectedDevice"
        >
          {{ t('aiAgent.chat.closeAllApps') }}
        </el-button>
        <el-button
          plain
          size="small"
          :icon="Refresh"
          @click="refreshHistory"
          :disabled="!selectedDevice || controlApiVersionLoading || !isAgentSupported"
        />
      </div>

      <!-- 会话历史列表 -->
      <el-scrollbar class="conversation-list">
        <div
          v-for="(conv, convIdx) in conversations"
          :key="conv.task_id"
          class="conversation-item"
          :class="{
            active: !isBatchDeleteMode && currentTaskId === conv.task_id,
            selected: isBatchDeleteMode && isConversationSelected(conv.task_id),
            'selection-disabled': isBatchDeleteMode && !isConversationSelectable(conv)
          }"
          @click="handleConversationClick(conv)"
        >
          <div class="conv-top">
            <div class="conv-main">
              <el-checkbox
                v-if="isBatchDeleteMode"
                class="conv-checkbox"
                :model-value="isConversationSelected(conv.task_id)"
                :disabled="!isConversationSelectable(conv) || isBatchDeleting"
                @click.stop
                @change="(checked) => handleConversationCheckChange(conv, checked)"
              />
              <span v-else class="conv-seq">{{ convIdx + 1 }}.</span>
              <span class="conv-task">{{ conv.task }}</span>
              <span class="conv-status-label" :class="conv.status">{{
                statusLabel(conv.status)
              }}</span>
            </div>
          </div>
          <div class="conv-meta">
            <span class="conv-time">{{ formatTime(conv.created_at) }}</span>
            <span v-if="formatDuration(conv)" class="conv-duration">{{
              formatDuration(conv)
            }}</span>
          </div>
        </div>
        <el-empty
          v-if="conversations.length === 0"
          :description="
            !selectedDevice ? t('aiAgent.device.noDevice') : t('aiAgent.chat.noHistory')
          "
          :image-size="60"
        />
      </el-scrollbar>

      <!-- 底部栏 -->
      <div class="side-panel-footer" v-if="selectedDevice">
        <template v-if="isBatchDeleteMode">
          <div class="footer-select-all">
            <el-checkbox
              :model-value="isAllSelected"
              :disabled="isBatchDeleting"
              @change="toggleSelectAll"
            />
            <span class="conversation-count">{{
              t('aiAgent.chat.selectedCount', { count: selectedConversationIds.length })
            }}</span>
          </div>
          <div class="footer-actions">
            <el-button
              plain
              size="small"
              type="danger"
              :loading="isBatchDeleting"
              :disabled="selectedConversationIds.length === 0"
              @click="handleBatchDelete"
            >
              {{ t('common.delete') }}
            </el-button>
            <el-button plain size="small" @click="exitBatchDeleteMode">{{
              t('common.cancel')
            }}</el-button>
          </div>
        </template>
        <template v-else>
          <span v-if="conversations.length > 0" class="conversation-count">{{
            t('aiAgent.chat.historyCount', { count: conversations.length })
          }}</span>
          <el-button
            plain
            size="small"
            @click="enterBatchDeleteMode"
            :disabled="!canEnterBatchDeleteMode"
          >
            {{ t('aiAgent.chat.multiSelect') }}
          </el-button>
        </template>
      </div>
    </div>

    <!-- 右侧主区域 -->
    <div class="main-panel">
      <!-- 顶部操作栏 -->
      <div class="main-header">
        <div class="header-info">
          <span v-if="currentTaskId" class="task-id-header" @click="copyTaskId(currentTaskId)">
            {{ currentTaskId }}
          </span>
          <el-tag v-if="isRunning" size="small" type="warning" effect="light">
            {{ t('aiAgent.chat.running') }}
          </el-tag>
        </div>
        <div class="header-actions">
          <!-- 未配置模型提示 -->
          <el-button
            v-if="selectedDevice && !hasDeviceModel"
            type="warning"
            class="needs-config-btn"
            :disabled="!isAgentSupported || controlApiVersionLoading"
            @click="openSettings"
          >
            <template #icon
              ><el-icon><Setting /></el-icon
            ></template>
            {{ t('aiAgent.chat.configureModel') }}
          </el-button>
          <!-- 设置按钮（已配置时，展示 logo + 模型名） -->
          <el-button
            v-if="selectedDevice && hasDeviceModel"
            @click="openSettings"
            class="model-settings-btn"
            :disabled="!isAgentSupported || controlApiVersionLoading"
          >
            <img
              v-if="currentConfig?.provider && providerLogos[currentConfig.provider]"
              :src="providerLogos[currentConfig.provider]"
              class="model-btn-logo"
            />
            {{ currentConfig?.model }} · {{ t('layout.header.settings') }}
          </el-button>
          <el-button
            v-if="selectedDevice"
            :disabled="!isAgentSupported || controlApiVersionLoading"
            @click="showSkillManager = true"
          >
            {{ t('skill.title') }}
          </el-button>
          <el-button type="primary" @click="newChat">
            {{ t('aiAgent.chat.newChat') }}
          </el-button>
        </div>
      </div>

      <el-alert
        v-if="selectedDevice && !controlApiVersionLoading && !isAgentSupported"
        type="warning"
        :closable="false"
        class="agent-version-alert"
      >
        <template #title>{{ t('aiAgent.chat.agentUnsupportedTitle') }}</template>
        <div>{{ agentSupportMessage }}</div>
        <div class="agent-version-alert-hint">{{ t('aiAgent.chat.agentUnsupportedHint') }}</div>
      </el-alert>

      <!-- 消息区域（SDK MessageList） -->
      <el-scrollbar ref="chatScrollbar" class="chat-area">
        <div ref="chatContent">
          <MessageList
            :messages="groups.displayMessages.value"
            :is-running="isRunning"
            :has-recent-message="groups.hasRecentMessage.value"
            :ai-avatar="aiAvatar"
            :debug="isDev"
            :quick-actions="selectedDevice && isAgentSupported ? quickActions : undefined"
            :toggle-thinking="groups.toggleThinking"
            :is-thinking-expanded="groups.isThinkingExpanded"
            :toggle-tool-detail="groups.toggleToolDetail"
            :is-tool-detail-expanded="groups.isToolDetailExpanded"
            :t="sdkT"
            @quick-action="handleChatSend"
          >
            <template #empty>
              <div v-if="!selectedDevice" class="empty-state">
                <el-icon :size="48" color="var(--el-text-color-placeholder)"><Iphone /></el-icon>
                <p>{{ t('aiAgent.chat.noDeviceDesc') }}</p>
              </div>
              <template v-else>
                <img :src="aiAvatarGif" class="aic-empty-avatar" />
                <h3 class="aic-empty-title">{{ t('aiAgent.chat.welcomeTitle') }}</h3>
                <p class="aic-empty-desc">{{ t('aiAgent.chat.welcomeDesc') }}</p>
                <div v-if="quickActions.length > 0" class="aic-quick-actions">
                  <div
                    v-for="(action, i) in quickActions"
                    :key="i"
                    class="aic-quick-action-card"
                    @click="handleChatSend(action.prompt)"
                  >
                    <div class="aic-quick-action-icon" v-html="action.icon" />
                    <div class="aic-quick-action-text">
                      <div class="aic-quick-action-title">{{ action.title }}</div>
                      <div class="aic-quick-action-desc">{{ action.desc }}</div>
                    </div>
                  </div>
                </div>
              </template>
            </template>
          </MessageList>
        </div>
      </el-scrollbar>

      <!-- 输入区域 -->
      <div class="input-area">
        <div class="input-row">
          <el-input
            v-model="inputText"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            :placeholder="t('aiAgent.chat.inputPlaceholder')"
            :disabled="isChatInputDisabled"
            @keydown.enter.exact.prevent="handleSend"
            @keydown.ctrl.enter.prevent="insertNewline"
            @keydown.meta.enter.prevent="insertNewline"
          />
          <el-button
            v-if="!isRunning"
            type="primary"
            :disabled="!inputText.trim() || isChatInputDisabled"
            @click="handleSend"
          >
            {{ t('aiAgent.chat.send') }}
          </el-button>
          <el-button v-else type="danger" @click="stopTask">
            {{ t('aiAgent.chat.stop') }}
          </el-button>
        </div>
        <div class="input-tip">{{ t('aiAgent.chat.sendTip') }}</div>
      </div>
    </div>

    <!-- 右侧：云机画面 -->
    <div class="device-panel">
      <div class="device-preview-area">
        <!-- 控件信息面板：云机画面上方 -->
        <div v-if="showInspector && isClientReady" class="inspector-node-info">
          <template v-if="inspectorHoveredNode">
            <div class="node-info-class">{{ shortClassName(inspectorHoveredNode.className) }}</div>
            <div v-if="inspectorHoveredNode.attrs['text']" class="node-info-row">
              <span class="node-info-label">{{ t('aiAgent.chat.inspectorLabelText') }}:</span>
              <span class="node-info-value">{{ inspectorHoveredNode.attrs['text'] }}</span>
            </div>
            <div v-if="inspectorHoveredNode.attrs['resource-id']" class="node-info-row">
              <span class="node-info-label">{{ t('aiAgent.chat.inspectorLabelId') }}:</span>
              <span class="node-info-value">{{ inspectorHoveredNode.attrs['resource-id'] }}</span>
            </div>
            <div v-if="inspectorHoveredNode.attrs['content-desc']" class="node-info-row">
              <span class="node-info-label">{{ t('aiAgent.chat.inspectorLabelDesc') }}:</span>
              <span class="node-info-value">{{ inspectorHoveredNode.attrs['content-desc'] }}</span>
            </div>
            <div class="node-info-row">
              <span class="node-info-label">{{ t('aiAgent.chat.inspectorLabelBounds') }}:</span>
              <span class="node-info-value">[{{ inspectorHoveredNode.bounds.join(', ') }}]</span>
            </div>
            <div class="node-info-row">
              <span class="node-info-label">{{ t('aiAgent.chat.inspectorLabelSize') }}:</span>
              <span class="node-info-value"
                >{{ inspectorHoveredNode.bounds[2] - inspectorHoveredNode.bounds[0] }} ×
                {{ inspectorHoveredNode.bounds[3] - inspectorHoveredNode.bounds[1] }}</span
              >
            </div>
            <div class="node-info-flags">
              <el-tag
                v-for="flag in ['clickable', 'enabled', 'focusable', 'scrollable'].filter(
                  (f) => inspectorHoveredNode!.attrs[f] === 'true'
                )"
                :key="flag"
                size="small"
                type="success"
                effect="plain"
                >{{ flag }}</el-tag
              >
            </div>
          </template>
          <div v-else class="node-info-empty">{{ t('aiAgent.chat.inspectorMoveHint') }}</div>
        </div>
        <div class="phone-wrapper">
          <div
            class="phone-frame"
            :style="{
              width: phoneSize.width + 12 + 'px',
              height: phoneSize.height + 12 + 'px'
            }"
          >
            <div class="phone-header-feature"></div>
            <div class="phone-inner">
              <div
                v-if="selectedDevice"
                class="device-render-container"
                @mouseleave="inspectorHoveredNode = null"
              >
                <div ref="canvasContainerRef" class="canvas-container"></div>
                <UiInspectorOverlay
                  :enabled="showInspector && isClientReady"
                  :picking="showInspector && isClientReady"
                  :device="selectedDevice"
                  @node-hover="inspectorHoveredNode = $event"
                />
                <div v-if="!isClientReady || clientError" class="render-status-mask">
                  <div class="render-status-content">
                    <template v-if="clientError">
                      <el-icon class="error-icon"><CircleCloseFilled /></el-icon>
                      <span class="render-status-text">{{ clientError }}</span>
                      <el-button
                        type="primary"
                        size="small"
                        style="margin-top: 10px"
                        @click="startClient"
                      >
                        {{ t('aiAgent.chat.retry') }}
                      </el-button>
                    </template>
                    <template v-else>
                      <div class="premium-loader">
                        <div class="loader-inner"></div>
                        <div class="loader-text">{{ t('aiAgent.chat.connecting') }}</div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <div v-else class="empty-device-state">
                <div class="device-placeholder">
                  <div class="placeholder-icon">
                    <el-icon><Iphone /></el-icon>
                  </div>
                  <p class="placeholder-text">{{ t('aiAgent.chat.noDeviceDesc') }}</p>
                </div>
              </div>
            </div>
          </div>
          <div v-if="selectedDevice && isClientReady" class="phone-bottom-nav">
            <div class="nav-item" @click="handleNavClick('back')">
              <el-icon><ArrowLeft /></el-icon>
            </div>
            <div class="nav-item" @click="handleNavClick('home')">
              <el-icon><HomeFilled /></el-icon>
            </div>
            <div class="nav-item" @click="handleNavClick('menu')">
              <el-icon><MenuIcon /></el-icon>
            </div>
          </div>
        </div>
      </div>
      <!-- 调试模式开关 -->
      <div v-if="selectedDevice" class="device-panel-footer">
        <el-switch
          v-model="debugMode"
          size="small"
          :active-text="t('aiAgent.chat.debugMode')"
          class="debug-switch"
          :loading="isDebugLoading"
          :disabled="isDebugLoading"
          @change="handleDebugModeChange"
        />
      </div>
    </div>

    <!-- 设备选择对话框 -->
    <DeviceSelectorDialog
      v-model="showDeviceSelector"
      :current-device-id="selectedDevice?.id"
      @select="handleDeviceSelect"
    />

    <!-- Agent 设置弹窗 -->
    <el-dialog v-model="showSettingsDialog" :title="configDialogTitle" width="500px">
      <el-form label-position="top">
        <el-form-item :label="t('aiAgent.config.model')">
          <div class="model-select-row">
            <el-select
              v-model="settingsModelId"
              :placeholder="t('aiAgent.config.selectModel')"
              style="flex: 1"
            >
              <template #prefix>
                <img
                  v-if="settingsSelectedModel && vendorLogos[settingsSelectedModel.vendor]"
                  :src="vendorLogos[settingsSelectedModel.vendor]"
                  class="provider-logo-prefix"
                />
              </template>
              <el-option
                v-for="m in models"
                :key="m.id"
                :label="`${m.modelName} · ${vendorDisplayName(m.vendor)}`"
                :value="m.id"
              >
                <div class="provider-option">
                  <img
                    v-if="vendorLogos[m.vendor]"
                    :src="vendorLogos[m.vendor]"
                    class="provider-option-logo"
                  />
                  <span>{{ m.modelName }} · {{ vendorDisplayName(m.vendor) }}</span>
                </div>
              </el-option>
            </el-select>
            <el-button @click="showManagerDialog = true">
              {{ t('aiAgent.config.modelConfig') }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item :label="t('aiAgent.config.maxTurns')">
          <el-input-number v-model="configForm.maxTurns" :min="1" :max="100" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettingsDialog = false">{{ t('aiAgent.config.cancel') }}</el-button>
        <el-button type="primary" @click="saveAgentSettings">{{
          t('aiAgent.config.save')
        }}</el-button>
      </template>
    </el-dialog>

    <!-- 模型管理对话框 -->
    <AiModelManagerDialog
      v-model="showManagerDialog"
      :models="models"
      @add="handleModelAdd"
      @update="handleModelUpdate"
      @delete="handleModelDelete"
    />

    <!-- Skill 管理对话框 -->
    <SkillManagerDialog v-model="showSkillManager" :device="selectedDevice" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Iphone,
  ArrowDown,
  ArrowLeft,
  HomeFilled,
  Menu as MenuIcon,
  Refresh,
  CircleCloseFilled,
  Setting
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MessageList from './components/MessageList.vue'
import { useMessageGroups } from './composables/useMessageGroups'
import { formatJson, parseThinkingFromContent, formatTime } from './utils/chatUtils'
import './styles/chat.css'
import { VmosEdgeClient, VmosEdgeClientEvents } from '@vmosedge/web-sdk'
import { MacvlanPortMap } from '@renderer/utils/constant'
import { ipc } from '@renderer/core/ipc'
import { type Device, DATA_EVENTS, DeviceState } from '@shared/ipc/data.types'
import { logger } from '@renderer/utils/logger'
import { createDeviceApiTarget } from '@renderer/utils/deviceApi'
import { logVmosEdgeClientInternalError } from '@renderer/utils/vmosEdgeClientLogger'
import DeviceSelectorDialog from '../automation/components/DeviceSelectorDialog.vue'
import AiModelManagerDialog from '../automation/components/AiModelManagerDialog.vue'
import SkillManagerDialog from '@renderer/components/skill/SkillManagerDialog.vue'
import UiInspectorOverlay from '@renderer/components/ui-inspector/UiInspectorOverlay.vue'
import { useAiModelConfig, vendorToProvider } from '@renderer/hooks/useAiModelConfig'
import type { AiModelConfig as AiModelConfigType } from '@renderer/hooks/useAiModelConfig'
import {
  AiAgentService,
  type AiAgentConfig,
  type ControlApiVersionInfo,
  type TaskHistoryItem
} from './services/aiAgentService'
import logoOpenai from '@renderer/assets/providers/openai.svg'
import logoAnthropic from '@renderer/assets/providers/anthropic.svg'
import logoGoogle from '@renderer/assets/providers/google.svg'
import logoDashscope from '@renderer/assets/providers/dashscope.svg'
import logoDeepseek from '@renderer/assets/providers/deepseek.svg'
import logoZhipu from '@renderer/assets/providers/zhipu.svg'
import logoOllama from '@renderer/assets/providers/ollama.svg'
import logoCustom from '@renderer/assets/providers/custom.svg'
import aiAvatar from '@renderer/assets/svg/aiworkflow.svg'
const aiAvatarGif = aiAvatar

const { t } = useI18n()

const { models, addModel, updateModel, deleteModel } = useAiModelConfig()
const showManagerDialog = ref(false)
const showSkillManager = ref(false)
const showInspector = ref(false)
const inspectorHoveredNode = ref<import('@renderer/components/ui-inspector/types').UiNode | null>(
  null
)
watch(showInspector, (val) => {
  if (!val) {
    inspectorHoveredNode.value = null
  }
})

const shortClassName = (cls: string) => {
  const idx = cls.lastIndexOf('.')
  return idx >= 0 ? cls.substring(idx + 1) : cls
}

/** 状态文字标签 */
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    running: t('aiAgent.chat.statusRunning'),
    completed: t('aiAgent.chat.statusCompleted'),
    failed: t('aiAgent.chat.statusFailed'),
    cancelled: t('aiAgent.chat.statusCancelled')
  }
  return map[status] || status
}

/** 复制 task_id 到剪贴板 */
async function copyTaskId(taskId: string) {
  try {
    await navigator.clipboard.writeText(taskId)
    ElMessage.success(t('aiAgent.chat.copyTaskIdSuccess'))
  } catch {
    ElMessage.error(t('aiAgent.chat.copyTaskIdFailed'))
  }
}

/** 计算任务时长（finished_at - created_at），返回可读字符串 */
function formatDuration(conv: any): string {
  if (!conv.finished_at || !conv.created_at) return ''
  const ms = conv.finished_at - conv.created_at
  if (ms < 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return t('aiAgent.chat.durationSeconds', { count: totalSeconds })
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds > 0
    ? t('aiAgent.chat.durationMinutesSeconds', { minutes, seconds })
    : t('aiAgent.chat.durationMinutes', { minutes })
}

// vendor → logo 映射（本地模型配置中的 vendor 值，用于设置弹窗）
const vendorLogos: Record<string, string> = {
  DeepSeek: logoDeepseek,
  OpenAI: logoOpenai,
  Anthropic: logoAnthropic,
  Google: logoGoogle,
  Dashscope: logoDashscope,
  Zhipu: logoZhipu,
  Ollama: logoOllama,
  Other: logoCustom
}

// provider → logo 映射（设备端返回的 provider 值，用于顶部按钮展示）
const providerLogos: Record<string, string> = {
  deepseek: logoDeepseek,
  openai: logoOpenai,
  anthropic: logoAnthropic,
  google: logoGoogle,
  dashscope: logoDashscope,
  zhipu: logoZhipu,
  ollama: logoOllama,
  custom: logoCustom
}

// 设备端是否已配置模型
const hasDeviceModel = computed(() => {
  return !!(currentConfig.value?.model && currentConfig.value?.provider)
})

const vendorDisplayName = (vendor: string) => {
  return vendor === 'Other' ? t('aiAgent.config.customVendor') : vendor
}

const isDev = import.meta.env.DEV

// ===== 调试模式 =====
const debugMode = ref(false)
const isDebugLoading = ref(false)
let isSyncingDebug = false

async function refreshDebugMode() {
  if (!selectedDevice.value) {
    debugMode.value = false
    return
  }
  isDebugLoading.value = true
  try {
    const enabled = await AiAgentService.getDebugMode(
      selectedDevice.value.id!,
      selectedDevice.value.host_ip!
    )
    isSyncingDebug = true
    debugMode.value = enabled
  } catch (e: any) {
    logger.warn('refreshDebugMode failed', e)
  } finally {
    isSyncingDebug = false
    isDebugLoading.value = false
  }
}

const handleDebugModeChange = async (enabled: boolean) => {
  if (isSyncingDebug) return
  if (!selectedDevice.value) return
  const previous = !enabled
  isDebugLoading.value = true
  try {
    const next = await AiAgentService.setDebugMode(
      selectedDevice.value.id!,
      selectedDevice.value.host_ip!,
      enabled
    )
    debugMode.value = next
  } catch {
    debugMode.value = previous
    ElMessage.error(t('aiAgent.chat.debugSetFailed'))
  } finally {
    isDebugLoading.value = false
  }
}

// ===== 停止所有应用 =====
const isStoppingApps = ref(false)

async function stopAllApps() {
  if (!selectedDevice.value) return
  isStoppingApps.value = true
  try {
    const stopped = await AiAgentService.stopAllApps(
      selectedDevice.value.id!,
      selectedDevice.value.host_ip!
    )
    ElMessage.success(t('aiAgent.chat.stopAllAppsSuccess', { count: stopped.length }))
  } catch {
    ElMessage.error(t('aiAgent.chat.stopAllAppsFailed'))
  } finally {
    isStoppingApps.value = false
  }
}

// ===== 设备管理 =====
const LAST_DEVICE_KEY = 'ai-agent-last-device-id'
const MIN_CONTROL_API_VERSION = 10800
const selectedDevice = ref<Device | null>(null)
const showDeviceSelector = ref(false)
const agentTarget = computed(() => createDeviceApiTarget(selectedDevice.value))
const agentTargetKey = computed(() => agentTarget.value?.cacheKey || '')
const controlApiVersionInfo = ref<ControlApiVersionInfo | null>(null)
const controlApiVersionLoading = ref(false)
const controlApiVersionError = ref<'unknown' | 'failed' | null>(null)

const controlApiVersionCode = computed(() => {
  const code = Number(controlApiVersionInfo.value?.version_code)
  return Number.isFinite(code) && code > 0 ? code : null
})

const isAgentSupported = computed(() => {
  return (
    !!selectedDevice.value &&
    controlApiVersionCode.value !== null &&
    controlApiVersionCode.value >= MIN_CONTROL_API_VERSION
  )
})

const isChatInputDisabled = computed(() => {
  return (
    isRunning.value ||
    (!!selectedDevice.value && (controlApiVersionLoading.value || !isAgentSupported.value))
  )
})

const agentSupportMessage = computed(() => {
  if (controlApiVersionCode.value !== null) {
    return t('aiAgent.chat.agentUnsupportedVersion', {
      current: controlApiVersionCode.value,
      required: MIN_CONTROL_API_VERSION
    })
  }

  if (controlApiVersionLoading.value) {
    return t('aiAgent.chat.versionChecking')
  }

  return controlApiVersionError.value === 'unknown'
    ? t('aiAgent.chat.agentUnsupportedUnknown', { required: MIN_CONTROL_API_VERSION })
    : t('aiAgent.chat.agentUnsupportedFailed', { required: MIN_CONTROL_API_VERSION })
})

/** 根据设备网络模式获取 API 调用地址 */
const deviceIp = computed(() => {
  if (!selectedDevice.value) return ''
  return selectedDevice.value.network_mode === 'macvlan' || selectedDevice.value.is_macvlan
    ? selectedDevice.value.ip || ''
    : selectedDevice.value.host_ip || ''
})

function handleDeviceSelect(device: Device) {
  selectedDevice.value = device
  localStorage.setItem(LAST_DEVICE_KEY, device.id)
}

// ===== 云机投屏 =====
const isClientReady = ref(false)
const clientError = ref<string | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)
let client: VmosEdgeClient | null = null

const MAX_DISPLAY_SIDE = 572
const phoneSize = ref({ width: 286, height: 572 })

const stopClient = () => {
  if (client) {
    client.stop()
    client = null
  }
  isClientReady.value = false
  clientError.value = null
}

const startClient = async () => {
  if (!selectedDevice.value || !selectedDevice.value.host_ip) return

  stopClient()

  await nextTick()
  const container = canvasContainerRef.value
  if (!container) return

  isClientReady.value = false
  clientError.value = null

  client = new VmosEdgeClient({
    config: {
      ip:
        selectedDevice.value.network_mode === 'macvlan'
          ? selectedDevice.value.ip || ''
          : selectedDevice.value.host_ip || '',
      deviceId: selectedDevice.value.id,
      ports: {
        video:
          selectedDevice.value.network_mode === 'macvlan'
            ? MacvlanPortMap.video
            : selectedDevice.value.tcp_port || 0,
        audio:
          selectedDevice.value.network_mode === 'macvlan'
            ? MacvlanPortMap.audio
            : selectedDevice.value.tcp_audio_port || 0,
        touch:
          selectedDevice.value.network_mode === 'macvlan'
            ? MacvlanPortMap.touch
            : selectedDevice.value.tcp_control_port || 0
      }
    },
    container,
    isGroupControl: false,
    retryCount: 5,
    retryInterval: 3000,
    onInternalError: (error, info: any) => {
      logVmosEdgeClientInternalError('AiAgent', error, info)
    }
  })

  client.on(VmosEdgeClientEvents.STARTED, () => {
    isClientReady.value = true
  })

  client.on(VmosEdgeClientEvents.ERROR, (error) => {
    clientError.value = error.message || t('aiAgent.chat.connectionFailed')
    isClientReady.value = false
  })

  client.on(VmosEdgeClientEvents.SIZE_CHANGED, ({ idealWidth, idealHeight }) => {
    const maxSide = Math.max(idealWidth, idealHeight)
    const scale = MAX_DISPLAY_SIDE / maxSide
    phoneSize.value = {
      width: Math.round(idealWidth * scale),
      height: Math.round(idealHeight * scale)
    }
  })

  client.start()
}

const handleNavClick = (action: 'back' | 'home' | 'menu') => {
  if (!client || !isClientReady.value) return
  switch (action) {
    case 'back':
      client.back()
      break
    case 'home':
      client.home()
      break
    case 'menu':
      client.menu()
      break
  }
}

// ===== 设备数据 =====
const currentConfig = ref<AiAgentConfig | null>(null)
const conversations = ref<TaskHistoryItem[]>([])
const isBatchDeleteMode = ref(false)
const selectedConversationIds = ref<string[]>([])
const isBatchDeleting = ref(false)

const deletableConversations = computed(() => {
  return conversations.value.filter((conv) => isConversationSelectable(conv))
})

const canEnterBatchDeleteMode = computed(() => {
  return (
    !!selectedDevice.value &&
    !controlApiVersionLoading.value &&
    isAgentSupported.value &&
    deletableConversations.value.length > 0
  )
})

const conversationActionTitle = computed(() => {
  return t('aiAgent.chat.history')
})

const isAllSelected = computed(() => {
  return (
    deletableConversations.value.length > 0 &&
    deletableConversations.value.every((conv) =>
      selectedConversationIds.value.includes(conv.task_id)
    )
  )
})

function toggleSelectAll(checked: boolean | string | number) {
  if (checked) {
    selectedConversationIds.value = deletableConversations.value.map((conv) => conv.task_id)
  } else {
    selectedConversationIds.value = []
  }
}

function isConversationSelectable(conv: TaskHistoryItem) {
  return conv.status !== 'running'
}

function isConversationSelected(taskId: string) {
  return selectedConversationIds.value.includes(taskId)
}

function enterBatchDeleteMode() {
  isBatchDeleteMode.value = true
  selectedConversationIds.value = []
}

function exitBatchDeleteMode() {
  isBatchDeleteMode.value = false
  selectedConversationIds.value = []
}

function handleConversationCheckChange(conv: TaskHistoryItem, checked: boolean | string | number) {
  if (!isConversationSelectable(conv)) return
  const nextChecked = Boolean(checked)
  if (nextChecked) {
    if (!selectedConversationIds.value.includes(conv.task_id)) {
      selectedConversationIds.value.push(conv.task_id)
    }
    return
  }
  selectedConversationIds.value = selectedConversationIds.value.filter((id) => id !== conv.task_id)
}

function handleConversationClick(conv: TaskHistoryItem) {
  if (isBatchDeleteMode.value) {
    if (!isConversationSelectable(conv) || isBatchDeleting.value) return
    handleConversationCheckChange(conv, !isConversationSelected(conv.task_id))
    return
  }
  void selectConversation(conv)
}

async function refreshAgentSupport(targetKey = agentTargetKey.value): Promise<boolean> {
  controlApiVersionInfo.value = null
  controlApiVersionError.value = null

  if (!selectedDevice.value?.id || !selectedDevice.value.host_ip) {
    controlApiVersionError.value = 'unknown'
    return false
  }

  controlApiVersionLoading.value = true
  try {
    const info = await AiAgentService.getControlApiVersion(
      selectedDevice.value.id,
      selectedDevice.value.host_ip
    )
    if (targetKey !== agentTargetKey.value) return false
    controlApiVersionInfo.value = info
    return Number(info.version_code || 0) > MIN_CONTROL_API_VERSION
  } catch (e: any) {
    if (targetKey !== agentTargetKey.value) return false
    controlApiVersionError.value = e?.status === 404 || e?.code === 404 ? 'unknown' : 'failed'
    logger.warn('[AiAgent] Failed to fetch Control API version', e)
    return false
  } finally {
    if (targetKey === agentTargetKey.value) {
      controlApiVersionLoading.value = false
    }
  }
}

async function loadDeviceData() {
  const target = agentTarget.value
  const targetKey = agentTargetKey.value
  if (!target) return
  const supported = await refreshAgentSupport(targetKey)
  if (targetKey !== agentTargetKey.value || !supported) return
  // 并行加载配置和历史
  const [configResult, historyResult] = await Promise.allSettled([
    AiAgentService.getConfig(target),
    AiAgentService.getHistory(target, 50)
  ])
  if (targetKey !== agentTargetKey.value) return
  if (configResult.status === 'fulfilled' && configResult.value) {
    currentConfig.value = configResult.value
  }
  if (historyResult.status === 'fulfilled') {
    conversations.value = historyResult.value?.tasks || []
  } else {
    logger.error('[AiAgent] Failed to load history:', historyResult.reason)
  }
  // 检查是否有正在运行的任务
  checkRunningTask(targetKey)
}

async function refreshHistory() {
  const target = agentTarget.value
  const targetKey = agentTargetKey.value
  if (!target || !isAgentSupported.value) return
  try {
    const data = await AiAgentService.getHistory(target, 50)
    if (targetKey !== agentTargetKey.value) return
    conversations.value = data?.tasks || []
  } catch {
    /* ignore */
  }
}

async function handleBatchDelete() {
  const target = agentTarget.value
  const targetKey = agentTargetKey.value
  if (!target || !isAgentSupported.value) return
  const taskIds = [...selectedConversationIds.value]

  if (taskIds.length === 0) {
    ElMessage.warning(t('aiAgent.chat.selectConversationsToDelete'))
    return
  }

  try {
    await ElMessageBox.confirm(
      t('aiAgent.chat.deleteSelectedConfirm', { count: taskIds.length }),
      t('aiAgent.chat.deleteSelectedConfirmTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        buttonSize: 'default',
        draggable: true
      }
    )
  } catch {
    return
  }

  isBatchDeleting.value = true

  try {
    const results = await Promise.allSettled(
      taskIds.map(async (taskId) => {
        await AiAgentService.deleteTask(target, taskId)
        return taskId
      })
    )
    if (targetKey !== agentTargetKey.value) return

    const successIds = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map((result) => result.value)
    const failCount = results.length - successIds.length

    if (successIds.length > 0) {
      conversations.value = conversations.value.filter((item) => !successIds.includes(item.task_id))
      selectedConversationIds.value = selectedConversationIds.value.filter(
        (id) => !successIds.includes(id)
      )

      if (currentTaskId.value && successIds.includes(currentTaskId.value)) {
        newChat()
      }
    }

    if (failCount === 0) {
      ElMessage.success(t('aiAgent.chat.deleteSelectedSuccess', { count: successIds.length }))
      exitBatchDeleteMode()
    } else {
      ElMessage.warning(
        t('aiAgent.chat.deleteSelectedPartial', {
          success: successIds.length,
          fail: failCount
        })
      )
    }
  } catch (e: any) {
    ElMessage.error(e.message || t('aiAgent.chat.deleteFailed'))
  } finally {
    isBatchDeleting.value = false
  }
}

// ===== 聊天 =====
const messages = ref<any[]>([])
const isRunning = ref(false)
const currentTaskId = ref<string | null>(null)
const currentModel = ref<string | null>(null)
const inputText = ref('')
const chatScrollbar = ref<any>(null)
const chatContent = ref<HTMLElement | null>(null)

let sseConnection: EventSource | null = null

/** SDK 翻译适配器：将 SDK 的 'chat.xxx' 映射到桌面端 i18n 的 'aiAgent.chat.xxx' */
const sdkT = (key: string, params?: Record<string, any>): string => {
  return t(`aiAgent.${key}`, params ?? {})
}

// 工具分组（SDK composable）
const groups = useMessageGroups({ messages, t: sdkT })

function scrollToBottom() {
  nextTick(() => {
    chatScrollbar.value?.setScrollTop(chatContent.value?.scrollHeight || 0)
  })
}

function handleSend() {
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  handleChatSend(text)
}

function insertNewline() {
  inputText.value += '\n'
}

// 消息变化时自动滚动
watch(() => messages.value.length, scrollToBottom)

function closeSSE() {
  if (sseConnection) {
    sseConnection.close()
    sseConnection = null
  }
}

function subscribeSSE(taskId: string) {
  closeSSE()
  if (!agentTarget.value || !isAgentSupported.value) return
  const es = AiAgentService.connectSSE(agentTarget.value, taskId)
  sseConnection = es

  let turnStartTime = 0

  es.addEventListener('run_started', (e: MessageEvent) => {
    const data = JSON.parse(e.data)
    if (data.model) currentModel.value = data.model
  })

  es.addEventListener('turn_start', (e: MessageEvent) => {
    const data = JSON.parse(e.data)
    turnStartTime = Date.now()
    messages.value.push({ type: 'turn_divider', turn: data.turn, _raw: data, showRaw: false })
    scrollToBottom()
  })

  // ===== 流式 delta：实时更新当前消息 =====
  es.addEventListener('llm_response_delta', (e: MessageEvent) => {
    const data = JSON.parse(e.data)
    // reasoning delta → 更新或创建 thinking 消息
    if (data.reasoning) {
      const last = messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
      if (last && last.type === 'thinking' && last.status === 'loading') {
        last.content += data.reasoning
      } else {
        messages.value.push({
          type: 'thinking',
          content: data.reasoning,
          expanded: false,
          status: 'loading',
          duration: 0
        })
      }
    }
    // content delta → 更新或创建 assistant 消息
    if (data.content) {
      // 找到当前正在流式输出的 assistant（跳过 thinking）
      const last = messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
      const prevAssistant =
        last && last.type === 'assistant' && last._streaming
          ? last
          : (() => {
              // 上一条可能是 thinking，往前找
              for (let i = messages.value.length - 1; i >= 0; i--) {
                const m = messages.value[i]
                if (m.type === 'assistant' && m._streaming) return m
                if (m.type === 'turn_divider') break
              }
              return null
            })()
      if (prevAssistant) {
        prevAssistant.content += data.content
      } else {
        messages.value.push({
          type: 'assistant',
          content: data.content,
          _streaming: true,
          _raw: null,
          showRaw: false
        })
      }
    }
    scrollToBottom()
  })

  // ===== 完整 LLM 响应（流式结束后的最终事件） =====
  es.addEventListener('llm_response', (e: MessageEvent) => {
    const data = JSON.parse(e.data)
    const thinkingDuration = turnStartTime > 0 ? Date.now() - turnStartTime : 0

    // 结束流式 thinking
    const lastThinking = [...messages.value]
      .reverse()
      .find((m: any) => m.type === 'thinking' && m.status === 'loading') as any
    if (lastThinking) {
      lastThinking.status = 'done'
      lastThinking.duration = thinkingDuration
      // 如果流式没有 reasoning 但最终事件有，更新内容
      if (data.reasoning && (!lastThinking.content || !lastThinking.content.trim())) {
        lastThinking.content = data.reasoning
      }
    } else if (data.reasoning && typeof data.reasoning === 'string' && data.reasoning.trim()) {
      // 非流式情况（Responses API）直接创建
      messages.value.push({
        type: 'thinking',
        content: data.reasoning,
        expanded: false,
        status: 'done',
        duration: thinkingDuration
      })
    }

    // 结束流式 assistant 或创建新的
    const streamingAssistant = [...messages.value]
      .reverse()
      .find((m: any) => m.type === 'assistant' && m._streaming) as any
    if (streamingAssistant) {
      streamingAssistant._streaming = false
      streamingAssistant._raw = data
    } else if (data.content) {
      const parsed = parseThinkingFromContent(data.content)
      if (parsed.thinking && !data.reasoning && parsed.content) {
        messages.value.push({
          type: 'thinking',
          content: parsed.thinking,
          expanded: false,
          status: 'done',
          duration: thinkingDuration
        })
      }
      const assistantContent = parsed.content || parsed.thinking
      if (assistantContent) {
        messages.value.push({
          type: 'assistant',
          content: assistantContent,
          _raw: data,
          showRaw: false
        })
      }
    }

    if (data.toolCalls && data.toolCalls.length > 0) {
      data.toolCalls.forEach((tc: any) => {
        messages.value.push({
          type: 'tool_call',
          toolCallId: tc.id || '',
          toolName: tc.name,
          toolTitle: tc.toolTitle || '',
          arguments: formatJson(tc.arguments),
          status: 'loading',
          result: '',
          fullResult: '',
          expanded: false,
          _raw: data,
          showRaw: false
        })
      })
    }
    scrollToBottom()
  })

  es.addEventListener('tool_call_start', () => {
    scrollToBottom()
  })

  es.addEventListener('tool_call_result', (e: MessageEvent) => {
    const data = JSON.parse(e.data)
    if (data.toolResult) {
      const result = data.toolResult.result || ''
      const success = data.toolResult.success !== false
      // 找到对应的 tool_call 消息并更新状态
      const existing = [...messages.value]
        .reverse()
        .find(
          (m: any) =>
            m.type === 'tool_call' &&
            m.toolName === data.toolResult.toolName &&
            m.status === 'loading'
        ) as any
      if (existing) {
        existing.status = success ? 'ok' : 'fail'
        existing.result = result
        existing.fullResult = result
        if (data.toolResult.toolTitle) existing.toolTitle = data.toolResult.toolTitle
      } else {
        // 找不到对应的 call，兜底新增一条
        messages.value.push({
          type: 'tool_call',
          toolCallId: data.toolResult.toolCallId || '',
          toolName: data.toolResult.toolName,
          toolTitle: data.toolResult.toolTitle || '',
          arguments: '',
          status: success ? 'ok' : 'fail',
          result: result,
          fullResult: result,
          expanded: false,
          _raw: data,
          showRaw: false
        })
      }
    }
    scrollToBottom()
  })

  es.addEventListener('run_completed', (e: MessageEvent) => {
    const data = JSON.parse(e.data)
    isRunning.value = false
    const r = data.result || {}
    if (r.message && r.message.trim()) {
      messages.value.push({ type: 'assistant', content: r.message, _raw: data, showRaw: false })
    }
    messages.value.push({
      type: 'completed',
      content: '',
      turns: r.turns || 0,
      toolCallCount: (r.toolCalls || []).length,
      model: data.model || '',
      _raw: data,
      showRaw: false
    })
    closeSSE()
    scrollToBottom()
    refreshHistory()
  })

  es.addEventListener('run_failed', (e: MessageEvent) => {
    const data = JSON.parse(e.data)
    isRunning.value = false
    const r = data.result || {}
    messages.value.push({
      type: 'failed',
      content: r.message || data.content || t('aiAgent.chat.unknownError'),
      model: data.model || '',
      _raw: data,
      showRaw: false
    })
    closeSSE()
    refreshHistory()
    scrollToBottom()
  })

  es.addEventListener('error', (e: any) => {
    if (e.data) {
      try {
        const data = JSON.parse(e.data)
        if (data.error) ElMessage.error(data.error)
      } catch {
        /* ignore */
      }
    }
  })

  es.onerror = () => {
    if (!isRunning.value) closeSSE()
  }
}

function parseEventsToMessages(events: any[]) {
  let turnStartTimestamp = 0
  events.forEach((event) => {
    const type = (event.type || '').toLowerCase()
    switch (type) {
      case 'run_started':
        if (event.model) currentModel.value = event.model
        break
      case 'turn_start':
        turnStartTimestamp = event.timestamp || 0
        messages.value.push({ type: 'turn_divider', turn: event.turn, _raw: event, showRaw: false })
        break
      case 'llm_response': {
        const thinkingDuration =
          turnStartTimestamp > 0 && event.timestamp ? event.timestamp - turnStartTimestamp : 0
        if (event.reasoning && typeof event.reasoning === 'string' && event.reasoning.trim()) {
          messages.value.push({
            type: 'thinking',
            content: event.reasoning,
            expanded: false,
            status: 'done',
            duration: thinkingDuration
          })
        }
        if (event.content) {
          const parsed = parseThinkingFromContent(event.content)
          if (parsed.thinking && !event.reasoning && parsed.content) {
            messages.value.push({
              type: 'thinking',
              content: parsed.thinking,
              expanded: false,
              status: 'done',
              duration: thinkingDuration
            })
          }
          const assistantContent = parsed.content || parsed.thinking
          if (assistantContent) {
            messages.value.push({
              type: 'assistant',
              content: assistantContent,
              _raw: event,
              showRaw: false
            })
          }
        }
        if (event.toolCalls) {
          event.toolCalls.forEach((tc: any) => {
            messages.value.push({
              type: 'tool_call',
              toolCallId: tc.id || '',
              toolName: tc.name,
              toolTitle: tc.toolTitle || '',
              arguments: formatJson(tc.arguments),
              status: 'loading',
              result: '',
              fullResult: '',
              expanded: false,
              _raw: event,
              showRaw: false
            })
          })
        }
        break
      }
      case 'tool_call_result':
        if (event.toolResult) {
          const result = event.toolResult.result || ''
          const success = event.toolResult.success !== false
          const existing = [...messages.value]
            .reverse()
            .find(
              (m: any) =>
                m.type === 'tool_call' &&
                m.toolName === event.toolResult.toolName &&
                m.status === 'loading'
            ) as any
          if (existing) {
            existing.status = success ? 'ok' : 'fail'
            existing.result = result
            existing.fullResult = result
            if (event.toolResult.toolTitle) existing.toolTitle = event.toolResult.toolTitle
          } else {
            messages.value.push({
              type: 'tool_call',
              toolCallId: event.toolResult.toolCallId || '',
              toolName: event.toolResult.toolName,
              toolTitle: event.toolResult.toolTitle || '',
              arguments: '',
              status: success ? 'ok' : 'fail',
              result: result,
              fullResult: result,
              expanded: false,
              _raw: event,
              showRaw: false
            })
          }
        }
        break
      case 'run_completed': {
        const r = event.result || {}
        if (r.message && r.message.trim()) {
          messages.value.push({
            type: 'assistant',
            content: r.message,
            _raw: event,
            showRaw: false
          })
        }
        messages.value.push({
          type: 'completed',
          content: '',
          turns: r.turns || 0,
          toolCallCount: (r.toolCalls || []).length,
          model: event.model || '',
          _raw: event,
          showRaw: false
        })
        break
      }
      case 'run_failed': {
        const rf = event.result || {}
        messages.value.push({
          type: 'failed',
          content: rf.message || '',
          model: event.model || '',
          _raw: event,
          showRaw: false
        })
        break
      }
    }
  })
}

const SCENE_ICON_VIDEO =
  '<svg viewBox="0 0 40 40" width="40" height="40" fill="none"><rect width="40" height="40" rx="10" fill="#ecf5ff"/><rect x="8" y="11" width="16" height="18" rx="3" fill="#409eff" opacity="0.15" stroke="#409eff" stroke-width="1.5"/><polygon points="24,16 32,12 32,28 24,24" fill="#409eff" opacity="0.25" stroke="#409eff" stroke-width="1.5" stroke-linejoin="round"/><polygon points="14,17 14,23 19,20" fill="#409eff"/></svg>'
const SCENE_ICON_TRENDING =
  '<svg viewBox="0 0 40 40" width="40" height="40" fill="none"><rect width="40" height="40" rx="10" fill="#fef0f0"/><path d="M20 8c0 6-6 8-6 14a8 8 0 0 0 16 0c0-4-2-6-4-8 0 3-2 4-3 4s-2-2-2-5c0-2-1-4-1-5z" fill="#f56c6c" opacity="0.2" stroke="#f56c6c" stroke-width="1.5" stroke-linejoin="round"/><path d="M20 18c0 2-1.5 3-1.5 5a3.5 3.5 0 0 0 7 0c0-2-1-3-2-4 0 1-1 1.5-1.5 1.5s-1-1-1-1.5c0-.5-.5-1-.5-1z" fill="#f56c6c" opacity="0.5"/></svg>'
const SCENE_ICON_CAMERA =
  '<svg viewBox="0 0 40 40" width="40" height="40" fill="none"><rect width="40" height="40" rx="10" fill="#fdf6ec"/><rect x="6" y="14" width="28" height="19" rx="4" fill="#e6a23c" opacity="0.15" stroke="#e6a23c" stroke-width="1.5"/><path d="M14 14l2-5h8l2 5" stroke="#e6a23c" stroke-width="1.5" stroke-linejoin="round" fill="#e6a23c" opacity="0.1"/><circle cx="20" cy="23" r="5" fill="#e6a23c" opacity="0.2" stroke="#e6a23c" stroke-width="1.5"/><circle cx="20" cy="23" r="2" fill="#e6a23c"/></svg>'

const quickActions = computed(() => [
  {
    icon: SCENE_ICON_VIDEO,
    title: t('aiAgent.chat.scene1Title'),
    desc: t('aiAgent.chat.scene1Desc'),
    prompt: t('aiAgent.chat.scene1Task')
  },
  {
    icon: SCENE_ICON_TRENDING,
    title: t('aiAgent.chat.scene2Title'),
    desc: t('aiAgent.chat.scene2Desc'),
    prompt: t('aiAgent.chat.scene2Task')
  },
  {
    icon: SCENE_ICON_CAMERA,
    title: t('aiAgent.chat.scene3Title'),
    desc: t('aiAgent.chat.scene3Desc'),
    prompt: t('aiAgent.chat.scene3Task')
  }
])

function newChat() {
  closeSSE()
  currentTaskId.value = null
  currentModel.value = null
  messages.value = []
  isRunning.value = false
  inputText.value = ''
}

async function selectConversation(conv: TaskHistoryItem) {
  const target = agentTarget.value
  const targetKey = agentTargetKey.value
  if (!target || !isAgentSupported.value) return
  closeSSE()
  isRunning.value = false
  currentTaskId.value = conv.task_id

  try {
    const status = await AiAgentService.getStatus(target)
    if (targetKey !== agentTargetKey.value) return
    if (status && status.task_id === conv.task_id && status.status === 'running') {
      isRunning.value = true
      messages.value = [{ type: 'user', content: status.task || conv.task }]
      if (status.events) parseEventsToMessages(status.events)
      subscribeSSE(conv.task_id)
      scrollToBottom()
      return
    }
  } catch {
    /* ignore */
  }

  // 从 task_detail 接口加载 JSONL 事件
  messages.value = [{ type: 'user', content: conv.task }]
  try {
    const detail = await AiAgentService.getTaskDetail(target, conv.task_id)
    if (targetKey !== agentTargetKey.value) return
    if (detail && detail.events && detail.events.length > 0) {
      parseEventsToMessages(detail.events)
    }
  } catch (e: any) {
    messages.value.push({
      type: 'failed',
      content: e.message || t('aiAgent.chat.loadTaskDetailFailed')
    })
  }
  scrollToBottom()
}

/** 发送任务（SDK @send 和 @quick-action 事件共用） */
async function handleChatSend(task: string) {
  if (!task || isRunning.value) return

  const target = agentTarget.value
  const targetKey = agentTargetKey.value
  if (!selectedDevice.value || !target) {
    ElMessage.warning(t('aiAgent.chat.selectDevice'))
    return
  }
  if (controlApiVersionLoading.value || !isAgentSupported.value) {
    ElMessage.warning(
      controlApiVersionLoading.value
        ? t('aiAgent.chat.versionChecking')
        : t('aiAgent.chat.agentUnsupportedSend')
    )
    return
  }

  messages.value = [{ type: 'user', content: task }]
  isRunning.value = true

  try {
    const data = await AiAgentService.run(target, task)
    if (targetKey !== agentTargetKey.value) return
    currentTaskId.value = data.task_id
    subscribeSSE(data.task_id)
    refreshHistory()
  } catch (e: any) {
    isRunning.value = false
    messages.value.push({ type: 'failed', content: e.message || t('aiAgent.chat.startFailed') })
    ElMessage.error(e.message || t('aiAgent.chat.startFailed'))
  }
  scrollToBottom()
}

async function stopTask() {
  const target = agentTarget.value
  if (!target || !currentTaskId.value) return
  try {
    await AiAgentService.stop(target, currentTaskId.value)
    ElMessage.success(t('aiAgent.chat.stopSuccess'))
  } catch (e: any) {
    ElMessage.error(e.message || t('aiAgent.chat.stopFailed'))
  }
}

async function checkRunningTask(targetKey = agentTargetKey.value) {
  const target = agentTarget.value
  if (!target || !isAgentSupported.value) return
  try {
    const data = await AiAgentService.getStatus(target)
    if (targetKey !== agentTargetKey.value) return
    if (data && data.task_id) {
      currentTaskId.value = data.task_id
      if (data.task) {
        messages.value = [{ type: 'user', content: data.task }]
      }
      if (data.events && data.events.length > 0) {
        parseEventsToMessages(data.events)
      }
      if (data.status === 'running') {
        isRunning.value = true
        subscribeSSE(data.task_id)
      }
      scrollToBottom()
    }
  } catch {
    /* ignore */
  }
}

// ===== 配置管理 =====
const showSettingsDialog = ref(false)
const settingsModelId = ref('')
const configForm = reactive({ maxTurns: 20 })

const settingsSelectedModel = computed(() => {
  if (!settingsModelId.value) return undefined
  return models.value.find((m) => m.id === settingsModelId.value)
})

const configDialogTitle = computed(() => {
  const devName = selectedDevice.value?.user_name || deviceIp.value || ''
  const modelName = currentConfig.value?.model
  return modelName
    ? `${t('aiAgent.chat.settings')} — ${devName} · ${modelName}`
    : `${t('aiAgent.chat.settings')} — ${devName}`
})

/** 打开设置弹窗，根据设备端配置尝试匹配本地模型 */
function openSettings() {
  if (!selectedDevice.value) return
  if (controlApiVersionLoading.value || !isAgentSupported.value) {
    ElMessage.warning(
      controlApiVersionLoading.value
        ? t('aiAgent.chat.versionChecking')
        : t('aiAgent.chat.agentUnsupportedSend')
    )
    return
  }
  const cfg = currentConfig.value || ({} as AiAgentConfig)
  configForm.maxTurns = cfg.maxTurns || 20
  // 根据设备端当前配置匹配本地模型，预选到下拉框
  settingsModelId.value = matchLocalModel(cfg)
  showSettingsDialog.value = true
}

/** 根据设备端配置匹配本地模型 ID */
function matchLocalModel(config: AiAgentConfig): string {
  if (!config.model || models.value.length === 0) return ''
  const matched =
    models.value.find((m) => m.modelName === config.model && m.apiHost === config.baseUrl) ||
    models.value.find((m) => m.modelName === config.model)
  return matched?.id || ''
}

async function saveAgentSettings() {
  const target = agentTarget.value
  if (!target || !isAgentSupported.value) return
  try {
    const configToSave: Record<string, unknown> = { maxTurns: configForm.maxTurns }

    // 将选中的模型配置同步到设备端
    if (settingsModelId.value) {
      const model = models.value.find((m) => m.id === settingsModelId.value)
      if (model) {
        configToSave.provider = vendorToProvider(model.vendor)
        configToSave.model = model.modelName
        configToSave.baseUrl = model.apiHost
        configToSave.apiKey = model.apiKey
      }
    }

    await AiAgentService.setConfig(target, configToSave)

    // 更新本地缓存的设备配置
    if (settingsModelId.value) {
      const model = models.value.find((m) => m.id === settingsModelId.value)
      if (model) {
        if (!currentConfig.value) {
          currentConfig.value = {
            provider: '',
            model: '',
            baseUrl: '',
            apiKey: '',
            maxTurns: 20,
            systemPrompt: ''
          }
        }
        currentConfig.value.provider = vendorToProvider(model.vendor)
        currentConfig.value.model = model.modelName
        currentConfig.value.baseUrl = model.apiHost
        currentConfig.value.apiKey = model.apiKey
      }
    }
    if (currentConfig.value) {
      currentConfig.value.maxTurns = configForm.maxTurns
    }

    showSettingsDialog.value = false
    ElMessage.success(t('aiAgent.config.saveSuccess'))
  } catch (e: any) {
    ElMessage.error(e.message || t('aiAgent.config.saveFailed'))
  }
}

function handleModelAdd(model: AiModelConfigType) {
  addModel(model)
}

function handleModelUpdate(id: string, model: AiModelConfigType) {
  updateModel(id, model)
}

function handleModelDelete(id: string) {
  deleteModel(id)
}

// ===== 监听设备切换 =====
watch(agentTargetKey, (newKey, oldKey) => {
  if (newKey === oldKey) return

  exitBatchDeleteMode()
  closeSSE()
  messages.value = []
  currentTaskId.value = null
  currentModel.value = null
  currentConfig.value = null
  conversations.value = []
  controlApiVersionInfo.value = null
  controlApiVersionError.value = null
  controlApiVersionLoading.value = false
  isRunning.value = false
  inputText.value = ''

  if (newKey) {
    loadDeviceData()
  }
})

// 监听设备变化，启动/停止投屏
watch(selectedDevice, (newVal, oldVal) => {
  const idChanged = newVal?.id !== oldVal?.id
  const stateChanged = newVal?.state !== oldVal?.state

  if (idChanged) {
    refreshDebugMode()
  }

  if (idChanged || stateChanged) {
    if (newVal && newVal.state === DeviceState.StateRunning) {
      startClient()
    } else {
      stopClient()
    }
  }
})

// ===== 生命周期 =====
let removeDeviceListener: (() => void) | null = null

onMounted(async () => {
  removeDeviceListener = ipc.on(DATA_EVENTS.DEVICE_UPDATED, (devices: Device | Device[]) => {
    const deviceList = Array.isArray(devices) ? devices : [devices]
    if (selectedDevice.value) {
      const updated = deviceList.find((d) => d.id === selectedDevice.value?.id)
      if (updated) {
        selectedDevice.value = { ...selectedDevice.value, ...updated }
      }
    }
  })

  // 恢复上次选中的设备
  const lastDeviceId = localStorage.getItem(LAST_DEVICE_KEY)
  if (lastDeviceId && !selectedDevice.value) {
    try {
      const res = await ipc.invoke<Device[]>(DATA_EVENTS.GET_DEVICES_BY_IDS, [lastDeviceId])
      if (res.success && res.data && res.data.length > 0) {
        handleDeviceSelect(res.data[0])
      }
    } catch (e) {
      logger.warn('Failed to restore last device', e)
    }
  }
})

onBeforeUnmount(() => {
  closeSSE()
  stopClient()
  if (removeDeviceListener) {
    removeDeviceListener()
  }
})

onBeforeRouteLeave(() => {
  stopClient()
  selectedDevice.value = null
})
</script>

<style scoped>
.ai-agent-container {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ===== 左侧面板 ===== */
.side-panel {
  width: 300px;
  min-width: 300px;
  border-right: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.device-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  transition: background-color 0.2s;
}

.device-selector:hover {
  background-color: var(--el-fill-color-light);
}

.device-selector-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.device-selected-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-selected-ip {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.device-select-hint {
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-placeholder);
}

.selector-arrow {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  flex-shrink: 0;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background-color: var(--el-color-success);
}

.status-dot.offline {
  background-color: var(--el-color-info-light-5);
}

.conversation-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.conversation-actions-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.conversation-list {
  flex: 1;
  padding: 8px;
}

.conversation-item {
  padding: 9px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 3px;
  transition: background-color 0.2s;
}

.conversation-item:hover {
  background-color: var(--el-fill-color-light);
}

.conversation-item.active {
  background-color: var(--el-color-primary-light-9);
}

.conversation-item.selected {
  background-color: var(--el-color-primary-light-9);
}

.conversation-item.selection-disabled {
  cursor: not-allowed;
}

.conversation-item.selection-disabled .conv-task,
.conversation-item.selection-disabled .conv-time,
.conversation-item.selection-disabled .conv-duration {
  opacity: 0.6;
}

.conv-top {
  min-width: 0;
}

.conv-main {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.conv-seq {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
  width: 16px;
  text-align: left;
}

.conv-checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.conv-checkbox :deep(.el-checkbox__label) {
  display: none;
}

.conv-task {
  font-size: 13px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.conv-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.conv-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.conv-duration {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-left: auto;
}

.conv-status-label {
  font-size: 11px;
  flex-shrink: 0;
  color: var(--el-text-color-placeholder);
  white-space: nowrap;
}

.conv-status-label.completed {
  color: var(--el-color-success);
}

.conv-status-label.failed,
.conv-status-label.cancelled {
  color: var(--el-color-danger);
}

.conv-task-id {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-task-id:hover {
  color: var(--el-color-primary);
}

.conversation-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* ===== 侧边栏底部 ===== */
.side-panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.footer-select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ===== 右侧主面板 ===== */
.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-bg-color);
}

.device-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.task-id-header {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.task-id-header:hover {
  color: var(--el-color-primary);
}

/* ===== 顶部操作栏 ===== */
.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.agent-version-alert {
  margin: 12px 20px 0;
}

.agent-version-alert-hint {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-btn-logo {
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin-right: 4px;
}

/* ===== 消息区域 ===== */
.chat-area {
  flex: 1;
  overflow: hidden;
}

.chat-area :deep(.el-scrollbar__view) {
  padding: 20px;
}

/* ===== 输入区域 ===== */
.input-area {
  padding: 16px 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.input-row :deep(.el-textarea__inner) {
  resize: none;
}

.input-tip {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
  padding-left: 2px;
}

/* ===== SDK 主题色继承客户端 ===== */
.main-panel :deep(.aic-chat-content) {
  --aic-color-primary: var(--el-color-primary);
  --aic-color-primary-light-5: var(--el-color-primary-light-5);
  --aic-color-primary-light-7: var(--el-color-primary-light-7);
  --aic-color-primary-light-9: var(--el-color-primary-light-9);
  --aic-color-success: var(--el-color-success);
  --aic-color-success-light-5: var(--el-color-success-light-5);
  --aic-color-success-light-9: var(--el-color-success-light-9);
  --aic-color-danger: var(--el-color-danger);
  --aic-color-danger-light-5: var(--el-color-danger-light-5);
  --aic-color-danger-light-9: var(--el-color-danger-light-9);
  --aic-color-warning: var(--el-color-warning);
  --aic-color-warning-light-5: var(--el-color-warning-light-5);
  --aic-color-info-light-5: var(--el-color-info-light-5);
  --aic-text-color-primary: var(--el-text-color-primary);
  --aic-text-color-regular: var(--el-text-color-regular);
  --aic-text-color-secondary: var(--el-text-color-secondary);
  --aic-text-color-placeholder: var(--el-text-color-placeholder);
  --aic-border-color: var(--el-border-color);
  --aic-border-color-light: var(--el-border-color-light);
  --aic-border-color-lighter: var(--el-border-color-lighter);
  --aic-border-color-extra-light: var(--el-border-color-extra-light);
  --aic-bg-color: var(--el-bg-color);
  --aic-bg-color-page: var(--el-bg-color-page);
  --aic-fill-color: var(--el-fill-color);
  --aic-fill-color-light: var(--el-fill-color-light);
  --aic-fill-color-lighter: var(--el-fill-color-lighter);
  --aic-fill-color-blank: var(--el-fill-color-blank);
}

/* ===== 空状态（empty slot） ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: var(--el-text-color-placeholder);
  gap: 12px;
}

.empty-state p {
  font-size: 14px;
}

/* ===== 右侧设备投屏面板 ===== */
.device-panel {
  width: 420px;
  min-width: 420px;
  border-left: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.device-panel-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 12px;
  border-top: 1px solid var(--el-border-color-lighter);

  .debug-switch {
    :deep(.el-switch__label) {
      font-size: 11px;
    }
  }
}

.device-preview-area {
  flex: 1;
  background-color: var(--el-bg-color-page);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 16px;
  position: relative;
  overflow: hidden;
}

.device-preview-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(var(--el-border-color) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.3;
}

.phone-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 1;
  position: relative;
}

.phone-frame {
  background-color: #000;
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 0 0 1px #171717;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  flex-shrink: 0;
}

.phone-frame::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  pointer-events: none;
  z-index: 2;
}

.phone-header-feature {
  width: 40px;
  height: 10px;
  background-color: #000;
  border-radius: 0 0 4px 4px;
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

.phone-header-feature::after {
  content: '';
  width: 3px;
  height: 3px;
  background: #080808;
  border-radius: 50%;
  border: 1px solid #111;
}

.phone-inner {
  flex: 1;
  background-color: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.device-render-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  background-color: #000;
  overflow: hidden;
  border-radius: 8px;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.render-status-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.55));
  backdrop-filter: blur(6px);
  z-index: 5;
}

.render-status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 18px 22px;
  border-radius: 14px;
  background: rgba(10, 10, 10, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
  text-align: center;
  max-width: 240px;
}

.render-status-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.5;
  word-break: break-word;
}

.render-status-content .error-icon {
  font-size: 26px;
  color: var(--el-color-danger);
}

.empty-device-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background-color: #000;
  position: relative;
  overflow: hidden;
}

.empty-device-state::after {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle at center,
    rgba(var(--el-color-primary-rgb), 0.05) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.device-placeholder {
  padding: 40px 20px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.placeholder-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  transform: rotate(-10deg);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.placeholder-icon .el-icon {
  font-size: 36px;
  color: rgba(255, 255, 255, 0.3);
}

.placeholder-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.6;
  max-width: 200px;
  margin: 0 auto;
}

.premium-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.loader-inner {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loader-inner::after {
  content: '';
  width: 18px;
  height: 24px;
  border: 1.5px solid rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.25);
}

.loader-text {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.5px;
}

.phone-bottom-nav {
  width: 160px;
  height: 36px;
  background: rgba(10, 10, 10, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 10px;
  z-index: 10;
  flex-shrink: 0;
  margin: 0 auto;
}

.phone-bottom-nav .nav-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  max-width: 44px;
}

.phone-bottom-nav .nav-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.phone-bottom-nav .nav-item:hover .el-icon {
  color: #fff;
  transform: scale(1.1);
}

.phone-bottom-nav .nav-item:active {
  transform: scale(0.95);
}

.phone-bottom-nav .nav-item .el-icon {
  font-size: 15px;
  color: #71717a;
  transition: all 0.2s;
}

.inspector-node-info {
  width: 100%;
  height: 120px;
  padding: 6px 10px;
  margin-bottom: 8px;
  font-size: 11px;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow-y: auto;

  .node-info-class {
    font-weight: 600;
    color: var(--el-color-primary);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-info-row {
    display: flex;
    gap: 4px;
    color: var(--el-text-color-regular);

    .node-info-label {
      flex-shrink: 0;
      color: var(--el-text-color-secondary);
    }

    .node-info-value {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--el-text-color-primary);
    }
  }

  .node-info-flags {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-top: 4px;
  }

  .node-info-empty {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-placeholder);
    font-family: inherit;
  }
}

/* ===== 顶部栏模型名 ===== */
.current-model-name {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* ===== 设置对话框 ===== */
.provider-logo-prefix {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 4px;
}

.provider-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-option-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 4px;
}

.model-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.header-model-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
  border-radius: 4px;
}

.needs-config-btn {
  animation: config-pulse 2s ease-in-out infinite;
}

@keyframes config-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--el-color-warning-light-5);
  }
  50% {
    box-shadow: 0 0 0 4px var(--el-color-warning-light-7);
  }
}
</style>
