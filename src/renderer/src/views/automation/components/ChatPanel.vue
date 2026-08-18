<template>
  <div class="chat-panel">
    <!-- 聊天消息区域 -->
    <div class="chat-container">
      <el-scrollbar ref="chatScrollbar">
        <div class="chat-list" :class="{ 'has-messages': messages.length > 0 }">
          <!-- 欢迎消息 (仅当没有消息时显示) -->
          <div v-if="messages.length === 0" class="welcome-wrapper">
            <div class="welcome-card">
              <div class="welcome-header">
                <div class="welcome-subtitle">
                  {{ t('aiWorkflow.chat.welcomeSubtitle') }}
                </div>
                <div class="welcome-tips">
                  <span class="tip-item">
                    <el-icon><CircleCheckFilled /></el-icon>
                    {{ t('aiWorkflow.chat.tipRealtimeControl') }}
                  </span>
                  <span class="tip-item">
                    <el-icon><CircleCheckFilled /></el-icon>
                    {{ t('aiWorkflow.chat.tipAutoCapture') }}
                  </span>
                  <span class="tip-item">
                    <el-icon><CircleCheckFilled /></el-icon>
                    {{ t('aiWorkflow.chat.tipEditableParams') }}
                  </span>
                </div>
              </div>

              <div class="quick-actions">
                <div
                  class="action-card"
                  @click="handleExampleClick(t('aiWorkflow.chat.exampleVideoGoal'))"
                >
                  <div class="card-icon video-icon">
                    <el-icon><VideoCamera /></el-icon>
                  </div>
                  <div class="card-content">
                    <div class="card-title">{{ t('aiWorkflow.chat.exampleVideoTitle') }}</div>
                    <div class="card-desc">{{ t('aiWorkflow.chat.exampleVideoDesc') }}</div>
                  </div>
                </div>
                <div
                  class="action-card"
                  @click="handleExampleClick(t('aiWorkflow.chat.exampleDeviceGoal'))"
                >
                  <div class="card-icon">
                    <el-icon><Setting /></el-icon>
                  </div>
                  <div class="card-content">
                    <div class="card-title">{{ t('aiWorkflow.chat.exampleDeviceTitle') }}</div>
                    <div class="card-desc">{{ t('aiWorkflow.chat.exampleDeviceDesc') }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 消息列表 -->
          <template v-for="msg in messages" :key="msg.id">
            <!-- 用户消息 -->
            <div v-if="msg.type === 'user'" class="msg-row msg-user">
              <div class="msg-bubble user-bubble">{{ msg.content }}</div>
            </div>

            <!-- Agent 思考 -->
            <div v-else-if="msg.type === 'thinking'" class="msg-row msg-thinking">
              <div class="timeline-section">
                <div class="timeline-label">{{ t('aiWorkflow.chat.thinkingLabel') }}</div>
                <div class="thinking-block timeline-card">
                  <span class="thinking-text" v-html="renderMarkdown(msg.content)" />
                </div>
              </div>
            </div>

            <!-- 任务规划 -->
            <div v-else-if="msg.type === 'planning'" class="msg-row msg-planning">
              <div class="timeline-section">
                <div class="timeline-label">{{ t('aiWorkflow.chat.planningLabel') }}</div>
                <div
                  class="planning-card timeline-card"
                  :class="{ 'is-complete': msg.planningStatus === 'completed' }"
                >
                  <div class="planning-header">
                    <span class="planning-title">{{ msg.content }}</span>
                    <el-icon
                      v-if="msg.planningStatus === 'started'"
                      class="planning-status-icon is-loading"
                    >
                      <Loading />
                    </el-icon>
                    <el-icon v-else class="planning-status-icon is-complete">
                      <CircleCheckFilled />
                    </el-icon>
                  </div>

                  <template v-if="msg.planningStatus === 'completed' && msg.plan">
                    <div class="planning-goal">
                      <span class="planning-section-label">{{
                        t('aiWorkflow.chat.planningGoalLabel')
                      }}</span>
                      <span class="planning-goal-text">{{ msg.plan.goal }}</span>
                    </div>

                    <div class="planning-section">
                      <div class="planning-section-label">
                        {{ t('aiWorkflow.chat.planningSubtasksLabel') }}
                      </div>
                      <div
                        v-for="subtask in msg.plan.subtasks"
                        :key="subtask.id"
                        class="planning-item"
                      >
                        <div class="planning-item-main">
                          <span class="planning-item-index">{{ subtask.id }}</span>
                          <span class="planning-item-text">{{ subtask.description }}</span>
                        </div>
                        <div class="planning-item-meta">
                          {{ t('aiWorkflow.chat.planningSuccessCriteriaLabel') }}:
                          {{ subtask.successCriteria }}
                        </div>
                        <div
                          v-if="subtask.estimatedActions.length > 0"
                          class="planning-item-meta is-secondary"
                        >
                          {{ t('aiWorkflow.chat.planningActionsLabel') }}:
                          {{ subtask.estimatedActions.join(' / ') }}
                        </div>
                      </div>
                    </div>

                    <div v-if="msg.plan.risks.length > 0" class="planning-section">
                      <div class="planning-section-label">
                        {{ t('aiWorkflow.chat.planningRisksLabel') }}
                      </div>
                      <div class="planning-tags">
                        <span v-for="risk in msg.plan.risks" :key="risk" class="planning-tag">
                          {{ risk }}
                        </span>
                      </div>
                    </div>

                    <div v-if="msg.plan.assumptions.length > 0" class="planning-section">
                      <div class="planning-section-label">
                        {{ t('aiWorkflow.chat.planningAssumptionsLabel') }}
                      </div>
                      <div class="planning-tags">
                        <span
                          v-for="assumption in msg.plan.assumptions"
                          :key="assumption"
                          class="planning-tag"
                        >
                          {{ assumption }}
                        </span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- 工具调用 -->
            <div v-else-if="msg.type === 'tool_call'" class="msg-row msg-tool-call">
              <div class="timeline-section">
                <div class="tool-card timeline-card">
                  <div class="event-header">
                    <span class="event-label">{{ t('aiWorkflow.chat.toolCallLabel') }}</span>
                    <span class="tool-name">{{ msg.toolCall?.name }}</span>
                    <el-button
                      v-if="hasToolCallDetail(msg.toolCall)"
                      link
                      size="small"
                      class="expand-btn"
                      @click="toggleExpand(msg.id)"
                    >
                      {{
                        expandedMessages.has(msg.id)
                          ? t('aiWorkflow.chat.collapse')
                          : t('aiWorkflow.chat.expand')
                      }}
                    </el-button>
                  </div>
                  <div class="tool-header">
                    <span class="tool-args" :title="formatToolCallArgs(msg.toolCall!)">
                      {{ formatToolCallArgs(msg.toolCall!) }}
                    </span>
                  </div>
                  <div
                    v-if="expandedMessages.has(msg.id) && hasToolCallDetail(msg.toolCall)"
                    class="tool-detail"
                  >
                    <pre>{{ formatToolCallDetail(msg.toolCall) }}</pre>
                  </div>
                </div>
              </div>
            </div>

            <!-- 工具结果 -->
            <div v-else-if="msg.type === 'tool_result'" class="msg-row msg-tool-result">
              <div class="timeline-section">
                <div
                  class="tool-result-card timeline-card"
                  :class="{ 'result-error': msg.isError }"
                >
                  <div class="event-header">
                    <span class="event-label">{{ t('aiWorkflow.chat.toolResultLabel') }}</span>
                    <el-button
                      v-if="hasToolResultDetail(msg.toolResult?.data)"
                      link
                      size="small"
                      class="expand-btn"
                      @click="toggleExpand(msg.id)"
                    >
                      {{
                        expandedMessages.has(msg.id)
                          ? t('aiWorkflow.chat.collapse')
                          : t('aiWorkflow.chat.expand')
                      }}
                    </el-button>
                  </div>
                  <span class="result-text" :title="msg.content">{{ msg.content }}</span>
                  <div
                    v-if="expandedMessages.has(msg.id) && hasToolResultDetail(msg.toolResult?.data)"
                    class="tool-result-detail"
                  >
                    <pre>{{ formatToolResultDetail(msg.toolResult?.data) }}</pre>
                  </div>
                </div>
              </div>
            </div>

            <!-- Agent 文本消息 -->
            <div v-else-if="msg.type === 'text'" class="msg-row msg-assistant">
              <div class="timeline-section">
                <div class="timeline-label">{{ t('aiWorkflow.chat.assistantLabel') }}</div>
                <div
                  class="msg-bubble assistant-bubble timeline-card"
                  :class="{ 'error-bubble': msg.isError }"
                  v-html="renderMarkdown(msg.content)"
                />
              </div>
            </div>

            <!-- 系统消息 -->
            <div v-else-if="msg.type === 'system'" class="msg-row msg-system">
              <div class="timeline-section">
                <div class="timeline-label">{{ t('aiWorkflow.chat.systemLabel') }}</div>
                <span class="system-text timeline-card">{{ msg.content }}</span>
              </div>
            </div>

            <!-- 脚本生成中 -->
            <div v-else-if="msg.type === 'script_generating'" class="msg-row msg-system">
              <div class="timeline-section">
                <div class="timeline-label">{{ t('aiWorkflow.chat.systemLabel') }}</div>
                <div class="generating-card timeline-card">
                  <span>{{ msg.content }}</span>
                </div>
              </div>
            </div>

            <!-- 脚本生成完成 -->
            <div v-else-if="msg.type === 'script_complete'" class="msg-row msg-script-complete">
              <div class="timeline-section">
                <div class="timeline-label">{{ t('aiWorkflow.chat.workflowLabel') }}</div>
                <div class="script-complete-card timeline-card">
                  <div class="script-header">
                    <span class="script-title">{{ msg.content }}</span>
                  </div>
                  <div class="script-preview" v-if="msg.workflow">
                    <div v-for="stepId in msg.workflow.flow" :key="stepId" class="script-step">
                      <span class="step-id">{{ stepId }}</span>
                      <span class="step-desc">{{
                        msg.workflow.steps[stepId]?.description || ''
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </el-scrollbar>
    </div>

    <!-- 输入区域 -->
    <div
      class="input-section"
      :class="{ 'has-paused-actions': isPaused, 'is-generating': isGeneratingScript }"
    >
      <!-- Agent 暂停时的操作区 -->
      <div v-if="isPaused" class="paused-actions" :class="{ generating: isGeneratingScript }">
        <el-button
          type="primary"
          class="generate-script-btn"
          :loading="isGeneratingScript"
          :disabled="isGeneratingScript"
          @click="handleGenerateScript"
        >
          <el-icon><Document /></el-icon>&nbsp; {{ t('aiWorkflow.chat.generateScript') }}
        </el-button>
        <span class="paused-hint">
          <span class="paused-hint-main">{{ t('aiWorkflow.chat.pausedHintMain') }}</span>
          <span class="paused-hint-sub">{{ t('aiWorkflow.chat.pausedHintSub') }}</span>
        </span>
      </div>

      <div class="input-container" :class="{ 'is-busy': isGeneratingScript }">
        <el-input
          ref="inputRef"
          v-model="inputText"
          type="textarea"
          :rows="3"
          :autosize="{ minRows: 1, maxRows: 5 }"
          :placeholder="inputPlaceholder"
          :disabled="isInputDisabled"
          class="chat-input"
          @keydown.ctrl.enter="handleSend"
          @keydown.meta.enter="handleSend"
        />
        <div class="input-actions-right">
          <el-tooltip
            :content="t('aiWorkflow.chat.optimizeTooltip')"
            placement="top"
            v-if="!(isRunning && !isPaused) && !isGeneratingScript"
          >
            <el-button
              circle
              class="action-btn optimize-btn"
              :class="{ 'is-loading': isOptimizing }"
              :disabled="isOptimizeDisabled"
              @click="handleOptimize"
            >
              <el-icon v-if="isOptimizing" class="optimize-loading is-loading">
                <Loading />
              </el-icon>
              <el-icon v-else><MagicStick /></el-icon>
            </el-button>
          </el-tooltip>
          <el-button
            v-if="isRunning && !isPaused"
            type="danger"
            circle
            class="action-btn stop-btn"
            @click="handleStop"
          >
            <el-icon><VideoPause /></el-icon>
          </el-button>
          <el-button
            v-else
            type="primary"
            circle
            class="action-btn send-btn"
            :disabled="isSendDisabled"
            @click="handleSend"
          >
            <el-icon><Top /></el-icon>
          </el-button>
        </div>
      </div>

      <div class="footer-tools">
        <div class="tool-left">
          <el-tooltip :content="newSessionTooltip" placement="top">
            <el-button link size="small" :disabled="isNewSessionDisabled" @click="handleNewSession">
              <el-icon><Refresh /></el-icon>
              <span>{{ t('aiWorkflow.chat.newSession') }}</span>
            </el-button>
          </el-tooltip>

          <el-switch
            v-model="actionTrajectory"
            size="small"
            :active-text="t('aiWorkflow.chat.debugMode')"
            class="action-trajectory-switch"
            :loading="isActionTrajectoryLoading"
            :disabled="!device || isActionTrajectoryLoading"
            @change="handleActionTrajectoryChange"
          />
        </div>
        <div class="tool-right">
          <span class="device-tag" v-if="device">
            <el-icon><Iphone /></el-icon>
            <span class="device-name" :title="device.user_name">
              {{ device.user_name }}
            </span>
          </span>
          <span class="device-tag warning" v-else>
            <el-icon><WarningFilled /></el-icon>
            <span class="device-name">{{ t('aiWorkflow.chat.selectDeviceFirst') }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import {
  MagicStick,
  CircleCheckFilled,
  Setting,
  VideoCamera,
  Loading,
  VideoPause,
  Top,
  Refresh,
  Iphone,
  WarningFilled,
  Document
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import MarkdownIt from 'markdown-it'
import { ipc } from '@renderer/core/ipc'
import { AGENT_EVENTS } from '@shared/ipc/agent.types'
import type { AIProviderConfig, WorkflowScript } from '@shared/ipc/agent.types'
import type { Device } from '@shared/ipc/data.types'
import { useAgentSession } from '../hooks/useAgentSession'
import { AutomationService } from '../services/automationService'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Markdown 渲染器
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})

/** 将 Markdown 文本渲染为 HTML */
function renderMarkdown(content: string): string {
  return md.render(content)
}

// ==================== Props & Emits ====================

const props = defineProps<{
  provider?: AIProviderConfig
  device?: Device | null
}>()

const emit = defineEmits<{
  (e: 'workflowComplete', workflow: WorkflowScript): void
  (e: 'saveWorkflow', workflow: WorkflowScript): void
  (e: 'runWorkflow', workflow: WorkflowScript): void
  (e: 'sessionChanged', sessionId: string): void
  (e: 'loadingChanged', loading: boolean): void
}>()

// ==================== Agent Session Hook ====================

const {
  messages,
  isRunning,
  isPaused,
  isGeneratingScript,
  sessionId,
  hasProvider,
  sendMessage,
  stopAgent,
  generateScript,
  newSession,
  setupListeners,
  cleanupListeners,
  formatToolCallArgs
} = useAgentSession(props)

const actionTrajectory = ref(false)
const isActionTrajectoryLoading = ref(false)
let isSyncingActionTrajectory = false

async function refreshActionTrajectory(): Promise<void> {
  if (!props.device) {
    actionTrajectory.value = false
    return
  }

  isActionTrajectoryLoading.value = true
  try {
    const enabled = await AutomationService.getActionTrajectoryDebug(props.device)
    isSyncingActionTrajectory = true
    actionTrajectory.value = enabled
  } catch (error: any) {
    ElMessage.error(error?.message || t('aiWorkflow.service.queryDebugFailed'))
  } finally {
    isSyncingActionTrajectory = false
    isActionTrajectoryLoading.value = false
  }
}

const handleActionTrajectoryChange = async (enabled: boolean) => {
  if (isSyncingActionTrajectory) return
  if (!props.device) {
    actionTrajectory.value = false
    return
  }

  const previous = !enabled
  isActionTrajectoryLoading.value = true
  try {
    const next = await AutomationService.setActionTrajectoryDebug(props.device, enabled)
    actionTrajectory.value = next
  } catch (error: any) {
    actionTrajectory.value = previous
    ElMessage.error(error?.message || t('aiWorkflow.service.setDebugFailed'))
  } finally {
    isActionTrajectoryLoading.value = false
  }
}

watch([isRunning, isGeneratingScript], ([running, generating]) => {
  emit('loadingChanged', running || generating)
})

watch(
  () => props.device?.id,
  () => {
    void refreshActionTrajectory()
  },
  { immediate: true }
)

// ==================== UI 状态 ====================

const inputText = ref('')
const chatScrollbar = ref<any>(null)
const inputRef = ref<any>(null)
const expandedMessages = ref(new Set<string>())

const isOptimizing = ref(false)

const inputPlaceholder = computed(() => {
  if (!props.device) return t('aiWorkflow.chat.placeholderNoDevice')
  if (isGeneratingScript.value) return t('aiWorkflow.chat.placeholderGenerating')
  if (isRunning.value && !isPaused.value) return t('aiWorkflow.chat.placeholderRunning')
  if (isPaused.value) return t('aiWorkflow.chat.placeholderPaused')
  return t('aiWorkflow.chat.placeholderDefault')
})

const isInputDisabled = computed(
  () => !props.device || (isRunning.value && !isPaused.value) || isGeneratingScript.value
)

const isOptimizeDisabled = computed(
  () =>
    !inputText.value.trim() ||
    !hasProvider.value ||
    !props.device ||
    isOptimizing.value ||
    isGeneratingScript.value
)

const isSendDisabled = computed(
  () =>
    !inputText.value.trim() ||
    !hasProvider.value ||
    !props.device ||
    isGeneratingScript.value ||
    isOptimizing.value
)

const isNewSessionDisabled = computed(() => isRunning.value || isGeneratingScript.value)

const newSessionTooltip = computed(() => {
  if (isGeneratingScript.value) return t('aiWorkflow.chat.newSessionTooltipGenerating')
  if (isRunning.value) return t('aiWorkflow.chat.newSessionTooltipRunning')
  return t('aiWorkflow.chat.newSessionTooltipDefault')
})

// ==================== 方法 ====================

const scrollToBottom = async () => {
  await nextTick()
  if (chatScrollbar.value) {
    const scrollContainer = chatScrollbar.value.wrapRef
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
    }
  }
}

const handleExampleClick = (text: string) => {
  inputText.value = text
  inputRef.value?.focus()
}

const handleSend = async () => {
  if (
    !inputText.value.trim() ||
    (isRunning.value && !isPaused.value) ||
    isGeneratingScript.value ||
    isOptimizing.value
  )
    return
  const text = inputText.value
  inputText.value = ''
  await sendMessage(text)
}

const handleOptimize = async () => {
  if (!inputText.value.trim() || !props.provider || isOptimizing.value || isGeneratingScript.value)
    return
  isOptimizing.value = true
  try {
    const result = await ipc.invoke<{ optimizedText: string }>(AGENT_EVENTS.OPTIMIZE_INTENT, {
      input: inputText.value,
      provider: props.provider
    })
    if (result.success && result.data?.optimizedText) {
      inputText.value = result.data.optimizedText
    } else {
      ElMessage.error(
        t('aiWorkflow.chat.optimizeFailed', { error: result.error || t('common.unknownError') })
      )
    }
  } catch (error: any) {
    ElMessage.error(
      t('aiWorkflow.chat.optimizeFailed', { error: error.message || t('common.unknownError') })
    )
  } finally {
    isOptimizing.value = false
  }
}

const handleStop = async () => {
  await stopAgent()
}

const handleGenerateScript = async () => {
  if (isGeneratingScript.value) return
  await generateScript()
}

const handleNewSession = () => {
  if (isNewSessionDisabled.value) return
  newSession()
}

const toggleExpand = (msgId: string) => {
  if (expandedMessages.value.has(msgId)) {
    expandedMessages.value.delete(msgId)
  } else {
    expandedMessages.value.add(msgId)
  }
}

function hasToolCallDetail(toolCall?: { arguments?: Record<string, unknown> }): boolean {
  if (!toolCall?.arguments) return false
  return Object.keys(toolCall.arguments).length > 0
}

function formatToolCallDetail(toolCall?: { arguments?: Record<string, unknown> }): string {
  if (!toolCall?.arguments) return ''
  try {
    return JSON.stringify(toolCall.arguments, null, 2)
  } catch {
    return String(toolCall.arguments)
  }
}

function hasToolResultDetail(data: unknown): boolean {
  if (data === null || data === undefined) return false
  if (typeof data === 'string') {
    return data.length > 60 || data.includes('\n')
  }
  return true
}

function formatToolResultDetail(data: unknown): string {
  if (data === null || data === undefined) return ''
  if (typeof data === 'string') return data
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

// ==================== 生命周期 ====================

onMounted(() => {
  setupListeners((workflow: WorkflowScript) => emit('workflowComplete', workflow))
})

onUnmounted(() => {
  cleanupListeners()
})

watch(sessionId, (newId) => {
  if (newId) emit('sessionChanged', newId)
})

watch(
  () => messages.value.length,
  () => scrollToBottom(),
  { deep: true }
)
</script>

<style scoped lang="scss">
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: transparent;
  position: relative;
}

.chat-container {
  flex: 1;
  background-color: transparent;
  overflow: hidden;
  padding-bottom: 8px;

  .chat-list {
    padding: 24px;
    padding-bottom: 40px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    position: relative;

    &.has-messages::before {
      content: '';
      position: absolute;
      top: 10px;
      bottom: 10px;
      left: 13px;
      width: 1px;
      background: var(--el-border-color-light);
      pointer-events: none;
    }
  }

  :deep(.el-scrollbar__bar.is-horizontal) {
    display: none;
  }
}

/* 消息行基础 */
.msg-row {
  display: flex;
  width: 100%;
  position: relative;
}

.msg-row:not(.msg-user) {
  padding-left: 30px;
}

.msg-row:not(.msg-user)::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 11px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #dbeafe;
  border: 1px solid #60a5fa;
  box-sizing: border-box;
  z-index: 1;
}

.msg-thinking::before {
  background: #e9d5ff;
  border-color: #a78bfa;
}

.msg-planning::before {
  background: #fde68a;
  border-color: #f59e0b;
}

.msg-tool-call::before {
  background: #bfdbfe;
  border-color: #60a5fa;
}

.msg-tool-result::before {
  background: #bbf7d0;
  border-color: #4ade80;
}

.msg-assistant::before,
.msg-system::before,
.msg-script-complete::before {
  background: #fde68a;
  border-color: #f59e0b;
}

.timeline-section {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.timeline-label {
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--el-text-color-placeholder);
  line-height: 1;
}

.timeline-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

/* 用户消息 */
.msg-user {
  justify-content: flex-end;
  margin-top: 12px;

  .user-bubble {
    background: var(--el-color-primary);
    color: white;
    padding: 10px 16px;
    border-radius: 16px 16px 4px 16px;
    max-width: 75%;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
  }
}

/* Agent 思考 */
.msg-thinking {
  .thinking-block {
    display: flex;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
    overflow: hidden;
  }

  .thinking-text {
    display: block;
    width: 100%;
    font-style: normal;
    word-break: break-word;
    overflow-wrap: break-word;

    :deep(p) {
      margin: 0 0 6px 0;
      word-break: break-word;
      overflow-wrap: break-word;
      &:last-child {
        margin-bottom: 0;
      }
    }

    :deep(h1) {
      margin: 8px 0 6px;
      font-size: 17px;
      line-height: 1.35;
      font-weight: 700;
    }

    :deep(h2) {
      margin: 8px 0 6px;
      font-size: 15px;
      line-height: 1.4;
      font-weight: 700;
    }

    :deep(h3) {
      margin: 7px 0 5px;
      font-size: 13px;
      line-height: 1.4;
      font-weight: 700;
    }

    :deep(strong) {
      font-weight: 700;
    }

    :deep(em) {
      font-style: italic;
    }

    :deep(ul),
    :deep(ol) {
      margin: 4px 0 6px;
      padding-left: 18px;
    }

    :deep(li) {
      margin: 1px 0;
    }

    :deep(code) {
      background: var(--el-fill-color-darker);
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 11px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    :deep(pre) {
      background: var(--el-fill-color-darker);
      border-radius: 8px;
      padding: 8px 10px;
      margin: 6px 0;
      overflow-x: auto;
      font-size: 11px;

      code {
        background: none;
        padding: 0;
      }
    }
  }
}

/* 任务规划 */
.msg-planning {
  .planning-card {
    padding: 12px 14px;
    border-radius: 14px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--el-color-warning-light-9) 72%, var(--el-bg-color) 28%),
      var(--el-bg-color)
    );
    border-color: color-mix(
      in srgb,
      var(--el-color-warning-light-5) 65%,
      var(--el-border-color-lighter) 35%
    );

    &.is-complete {
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--el-color-success-light-9) 72%, var(--el-bg-color) 28%),
        var(--el-bg-color)
      );
      border-color: color-mix(
        in srgb,
        var(--el-color-success-light-5) 58%,
        var(--el-border-color-lighter) 42%
      );
    }

    .planning-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .planning-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      line-height: 1.45;
    }

    .planning-status-icon {
      margin-left: auto;
      flex-shrink: 0;
      font-size: 16px;
      color: var(--el-color-warning);

      &.is-complete {
        color: var(--el-color-success);
      }
    }

    .planning-goal {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .planning-goal-text {
      font-size: 13px;
      color: var(--el-text-color-primary);
      line-height: 1.5;
      word-break: break-word;
    }

    .planning-section {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .planning-section-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--el-text-color-placeholder);
      text-transform: uppercase;
    }

    .planning-item {
      background: color-mix(in srgb, var(--el-bg-color) 82%, transparent 18%);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 10px;
      padding: 10px 11px;
    }

    .planning-item-main {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 6px;
    }

    .planning-item-index {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--el-color-primary-light-8) 60%, var(--el-bg-color) 40%);
      color: var(--el-color-primary);
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .planning-item-text {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      line-height: 1.45;
      word-break: break-word;
    }

    .planning-item-meta {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      line-height: 1.45;
      word-break: break-word;

      &.is-secondary {
        margin-top: 4px;
      }
    }

    .planning-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .planning-tag {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--el-fill-color-lighter) 84%, var(--el-bg-color) 16%);
      border: 1px solid var(--el-border-color-lighter);
      color: var(--el-text-color-secondary);
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
  }
}

/* 工具调用 */
.msg-tool-call {
  .tool-card {
    padding: 10px 14px;

    .event-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .event-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--el-text-color-placeholder);
      line-height: 1;
      flex-shrink: 0;
    }

    .tool-name {
      font-weight: 600;
      color: var(--el-text-color-primary);
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      min-width: 0;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .expand-btn {
      margin-left: auto;
      font-size: 12px;
      flex-shrink: 0;
    }

    .tool-header {
      display: flex;
      align-items: center;
      font-size: 12px;
      min-width: 0;

      .tool-args {
        color: var(--el-text-color-secondary);
        font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        flex: 1;
        word-break: break-all;
      }
    }
  }

  .tool-detail {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--el-border-color-light);
    max-height: 260px;
    overflow: auto;

    pre {
      margin: 0;
      font-size: 11px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      color: var(--el-text-color-regular);
      white-space: pre-wrap;
      word-break: break-word;
    }
  }
}

/* 工具结果 */
.msg-tool-result {
  flex-direction: column;
  gap: 4px;

  .tool-result-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    padding: 8px 10px;

    &.result-error {
      color: var(--el-text-color-secondary);
      border-color: var(--el-color-danger-light-5);
      background: var(--el-color-danger-light-9);
    }

    .event-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .event-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--el-text-color-placeholder);
      line-height: 1;
      flex-shrink: 0;
    }

    .result-text {
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
      width: 100%;
    }

    .expand-btn {
      margin-left: auto;
      font-size: 12px;
      flex-shrink: 0;
    }
  }

  .tool-result-detail {
    width: 100%;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--el-border-color-light);
    max-height: 300px;
    overflow: auto;

    pre {
      margin: 0;
      font-size: 11px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      color: var(--el-text-color-regular);
      white-space: pre-wrap;
      word-break: break-word;
    }
  }
}

/* Assistant 文本 */
.msg-assistant {
  margin-top: 2px;

  .assistant-bubble {
    color: var(--el-text-color-primary);
    padding: 9px 12px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.5;
    word-break: break-word;

    &.error-bubble {
      background: var(--el-color-danger-light-9);
      color: var(--el-color-danger);
      border: 1px solid var(--el-color-danger-light-8);
    }

    // Markdown 渲染样式
    :deep(p) {
      margin: 0 0 6px 0;
      &:last-child {
        margin-bottom: 0;
      }
    }

    :deep(h1) {
      margin: 8px 0 6px;
      font-size: 18px;
      line-height: 1.35;
      font-weight: 700;
    }

    :deep(h2) {
      margin: 8px 0 6px;
      font-size: 16px;
      line-height: 1.4;
      font-weight: 700;
    }

    :deep(h3) {
      margin: 7px 0 5px;
      font-size: 14px;
      line-height: 1.4;
      font-weight: 700;
    }

    :deep(strong) {
      font-weight: 700;
    }

    :deep(em) {
      font-style: italic;
    }

    :deep(ul),
    :deep(ol) {
      margin: 4px 0 6px;
      padding-left: 18px;
    }

    :deep(li) {
      margin: 1px 0;
    }

    :deep(code) {
      background: var(--el-fill-color-darker);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 11px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    }

    :deep(pre) {
      background: var(--el-fill-color-darker);
      border-radius: 8px;
      padding: 8px 10px;
      margin: 6px 0;
      overflow-x: auto;
      font-size: 11px;

      code {
        background: none;
        padding: 0;
      }
    }
  }
}

/* 系统消息 */
.msg-system {
  justify-content: flex-start;
  margin: 2px 0;

  .system-text {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    padding: 6px 14px;
    border-radius: 10px;
  }
}

/* 脚本生成中 */
.generating-card {
  display: flex;
  align-items: center;
  color: var(--el-text-color-secondary);
  padding: 9px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

/* 脚本完成 */
.msg-script-complete {
  .script-complete-card {
    border-radius: 14px;
    padding: 12px;

    .script-header {
      display: flex;
      align-items: center;
      margin-bottom: 10px;

      .script-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    .script-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .script-preview {
      background: var(--el-fill-color-lighter);
      border-radius: 8px;
      padding: 10px 14px;

      .script-step {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: 12px;

        .step-id {
          font-weight: 600;
          color: var(--el-color-primary);
          font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
          flex-shrink: 0;
        }

        .step-desc {
          color: var(--el-text-color-secondary);
        }
      }
    }
  }
}

/* 暂停操作区 */
.paused-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;

  .generate-script-btn {
    height: 38px;
    min-width: 126px;
    border-radius: 10px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .paused-hint {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    line-height: 1.4;

    .paused-hint-main {
      font-size: 13px;
      color: var(--el-text-color-primary);
      font-weight: 500;
    }

    .paused-hint-sub {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  &.generating {
    .paused-hint-main {
      color: var(--el-color-primary);
    }
  }
}

/* 欢迎页样式 */
.welcome-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  padding: 12px 18px 18px;
  box-sizing: border-box;
  margin-top: 6vh;
}

.welcome-card {
  text-align: center;
  max-width: 520px;
  width: 100%;
  padding: 32px 24px 24px;
  background: linear-gradient(
    to bottom,
    var(--el-bg-color),
    color-mix(in srgb, var(--el-fill-color-extra-light) 50%, var(--el-bg-color) 50%)
  );
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 20px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.03),
    0 1px 3px rgba(0, 0, 0, 0.02);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 120px;
    background: radial-gradient(
      circle at top center,
      color-mix(in srgb, var(--el-color-primary-light-9) 40%, transparent 60%),
      transparent 70%
    );
    pointer-events: none;
  }
}

.welcome-header {
  margin-bottom: 20px;
  position: relative;

  .welcome-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(
      135deg,
      var(--el-color-primary) 0%,
      var(--el-color-primary-light-3) 100%
    );
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    color: var(--el-color-white);
    font-size: 32px;
    box-shadow:
      0 12px 24px rgba(var(--el-color-primary-rgb), 0.25),
      0 4px 8px rgba(var(--el-color-primary-rgb), 0.15);
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: -2px;
      background: linear-gradient(135deg, var(--el-color-primary-light-3), var(--el-color-primary));
      border-radius: 20px;
      z-index: -1;
      opacity: 0.3;
      filter: blur(8px);
    }
  }

  .welcome-title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--el-text-color-primary);
    letter-spacing: -0.02em;
  }

  .welcome-subtitle {
    font-size: 13.5px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
    margin: 0 auto 14px;
    max-width: 380px;
    font-weight: 500;
  }

  .welcome-tips {
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;

    .tip-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: var(--el-color-primary);
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--el-bg-color) 95%, var(--el-color-primary) 5%),
        color-mix(in srgb, var(--el-bg-color) 90%, var(--el-color-primary) 10%)
      );
      border: 1px solid var(--el-color-primary-light-7);
      border-radius: 999px;
      padding: 6px 12px;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(var(--el-color-primary-rgb), 0.08);
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(var(--el-color-primary-rgb), 0.15);
      }

      .el-icon {
        font-size: 12px;
      }
    }
  }
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;

  .action-card {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 16px;
    padding: 14px 16px;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    align-items: center;
    text-align: left;
    gap: 14px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--el-color-primary-light-9) 30%, transparent 70%),
        transparent
      );
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    &:hover {
      border-color: var(--el-color-primary-light-5);
      transform: translateY(-3px);
      box-shadow:
        0 12px 24px rgba(0, 0, 0, 0.08),
        0 4px 8px rgba(0, 0, 0, 0.04);

      &::before {
        opacity: 1;
      }

      .card-icon {
        background: linear-gradient(
          135deg,
          var(--el-color-primary-light-8),
          var(--el-color-primary-light-9)
        );
        transform: scale(1.08);
        box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.15);
      }

      .card-title {
        color: var(--el-color-primary);
      }
    }

    .card-icon {
      width: 44px;
      height: 44px;
      background: var(--el-fill-color-lighter);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
      position: relative;
      z-index: 1;

      .el-icon {
        font-size: 20px;
        color: var(--el-color-primary);
        transition: all 0.3s ease;
      }

      &.video-icon .el-icon {
        color: var(--el-color-danger);
      }
    }

    .card-content {
      min-width: 0;
      flex: 1;
      position: relative;
      z-index: 1;

      .card-title {
        font-size: 15px;
        font-weight: 700;
        color: var(--el-text-color-primary);
        margin-bottom: 3px;
        transition: color 0.3s ease;
        letter-spacing: -0.01em;
      }

      .card-desc {
        font-size: 12.5px;
        color: var(--el-text-color-secondary);
        line-height: 1.4;
        font-weight: 500;
      }
    }
  }
}

.progress-bar-floating {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;

  .progress-info {
    background: var(--el-color-primary);
    color: #ffffff;
    padding: 10px 24px;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.4);

    .el-icon {
      font-size: 18px;
    }
  }
}

.input-section {
  max-width: 900px;
  padding: 10px;
  box-sizing: border-box;
  margin: 0 auto;
  width: 100%;
  position: relative;

  &.has-paused-actions {
    gap: 10px;
    display: flex;
    flex-direction: column;
  }
}

.input-container {
  position: relative;
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  padding: 6px;
  padding-right: 104px;
  transition: all 0.3s ease;

  &:focus-within {
    border-color: var(--el-color-primary-light-4);
    background: var(--el-bg-color);
    box-shadow: 0 8px 18px rgba(var(--el-color-primary-rgb), 0.14);
  }
}

.chat-input {
  :deep(.el-textarea__inner) {
    box-shadow: none !important;
    background-color: transparent;
    padding: 11px 14px;
    border: none !important;
    resize: none;
    font-size: 14px;
    line-height: 1.55;
    color: var(--el-text-color-primary);
    max-height: 160px;

    &::placeholder {
      color: var(--el-text-color-placeholder);
    }
  }

  :deep(.el-textarea__inner:disabled) {
    color: var(--el-text-color-secondary);
    -webkit-text-fill-color: var(--el-text-color-secondary);
    cursor: not-allowed;
  }
}

.input-actions-right {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  width: 38px;
  height: 38px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  border: 1px solid
    color-mix(in srgb, var(--el-border-color-light) 80%, var(--el-color-primary-light-8) 20%);
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 3px 8px rgba(15, 23, 42, 0.06);

  &:hover:not(:disabled) {
    transform: translateY(-1px) scale(1.01);
    border-color: var(--el-color-primary-light-4);
    color: var(--el-color-primary);
    box-shadow: 0 8px 16px rgba(15, 23, 42, 0.1);
  }

  &:disabled {
    background: var(--el-fill-color-light);
    border-color: var(--el-border-color-light);
    color: var(--el-text-color-placeholder);
    cursor: not-allowed;
    box-shadow: none;
  }

  .el-icon {
    font-size: 18px;
  }
}

.action-btn.optimize-btn.is-loading {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  box-shadow: none;

  .optimize-loading {
    font-size: 18px;
  }
}

.action-btn.optimize-btn.is-loading:disabled {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-light);
  color: var(--el-text-color-placeholder);
  box-shadow: none;
}
.action-btn.send-btn {
  width: 40px;
  height: 40px;
  background: linear-gradient(
    160deg,
    var(--el-color-primary) 0%,
    var(--el-color-primary-light-3) 100%
  );
  border-color: var(--el-color-primary);
  color: var(--el-color-white);
  box-shadow: 0 8px 18px rgba(var(--el-color-primary-rgb), 0.28);

  &:hover:not(:disabled) {
    background: linear-gradient(
      160deg,
      var(--el-color-primary-light-3) 0%,
      var(--el-color-primary-light-2) 100%
    );
    border-color: var(--el-color-primary-light-3);
    color: var(--el-color-white);
  }
}

.action-btn.send-btn:disabled {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-light);
  color: var(--el-text-color-placeholder);
  box-shadow: none;
}

.action-btn.optimize-btn {
  background: var(--el-fill-color-blank);
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);

  &:hover:not(:disabled) {
    border-color: var(--el-color-primary-light-3);
    color: var(--el-color-primary);
  }
}

.action-btn.optimize-btn:disabled {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-light);
  color: var(--el-text-color-placeholder);
  box-shadow: none;
}

.action-btn.stop-btn {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-5);
  color: var(--el-color-danger);

  &:hover:not(:disabled) {
    background: var(--el-color-danger-light-7);
    border-color: var(--el-color-danger-light-5);
    color: var(--el-color-danger);
  }
}

.footer-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding: 0 2px 2px;

  .tool-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .el-button {
      color: var(--el-text-color-regular);
      font-size: 12px;
      font-weight: 600;
      padding: 5px 12px;
      height: 28px;
      border-radius: 999px;
      border: 1px solid var(--el-border-color);
      background: color-mix(in srgb, var(--el-fill-color-blank) 92%, var(--el-color-primary) 8%);
      transition: all 0.2s ease;

      &:hover {
        color: var(--el-color-primary);
        border-color: var(--el-color-primary-light-5);
      }

      .el-icon {
        margin-right: 6px;
        font-size: 13px;
      }
    }

    .action-trajectory-switch {
      :deep(.el-switch__label) {
        font-size: 11px;
      }
    }
  }

  .tool-right {
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: flex-end;
    margin-left: 12px;
  }

  .device-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--el-text-color-regular);
    background-color: color-mix(
      in srgb,
      var(--el-color-success-light-9) 78%,
      var(--el-bg-color) 22%
    );
    border: 1px solid
      color-mix(in srgb, var(--el-color-success-light-5) 65%, var(--el-border-color-lighter) 35%);
    padding: 4px 10px;
    border-radius: 999px;
    font-weight: 500;
    min-width: 0;
    max-width: min(230px, 50vw);

    &.warning {
      color: var(--el-text-color-regular);
      background-color: color-mix(
        in srgb,
        var(--el-color-warning-light-9) 76%,
        var(--el-bg-color) 24%
      );
      border-color: color-mix(
        in srgb,
        var(--el-color-warning-light-5) 60%,
        var(--el-border-color-lighter) 40%
      );
    }

    .el-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .device-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
