<template>
  <div class="automation-container">
    <!-- 左侧：编排区域 -->
    <div class="panel orchestration-panel">
      <div class="panel-header">
        <div class="header-left">
          <span class="title" :title="t('aiWorkflow.page.workflow')"
            ><svg-icon name="aiworkflow" :width="20" :height="20" />{{
              t('aiWorkflow.page.workflow')
            }}</span
          >
        </div>
        <div class="header-right">
          <el-select
            v-model="selectedModelId"
            size="small"
            :placeholder="t('aiWorkflow.page.modelPlaceholder')"
            :disabled="models.length === 0"
            style="width: 160px"
          >
            <el-option
              v-for="model in models"
              :key="model.id"
              :label="model.displayName || `${model.vendor} ${model.modelName}`"
              :value="model.id"
            />
            <template #footer>
              <div class="select-footer">
                <el-button size="small" link :icon="Setting" @click="handleOpenManager">
                  {{ t('aiWorkflow.page.manageModelConfig') }}
                </el-button>
              </div>
            </template>
          </el-select>
          <el-button size="small" :icon="Setting" @click="handleOpenManager">{{
            t('layout.header.settings')
          }}</el-button>
        </div>
      </div>

      <div class="orchestration-content">
        <ChatPanel
          :provider="currentProviderConfig"
          :device="selectedDevice"
          @workflow-complete="handleWorkflowComplete"
          @save-workflow="handleSaveWorkflowFromChat"
          @run-workflow="handleRunWorkflowFromChat"
          @session-changed="handleSessionChanged"
          @loading-changed="(val) => (isGenerating = val)"
        />
      </div>
    </div>

    <!-- 中间：脚本预览 -->
    <div class="panel script-panel">
      <div class="panel-header">
        <div class="header-left">
          <span class="title" :title="t('aiWorkflow.page.scriptOrchestration')">{{
            t('aiWorkflow.page.scriptOrchestration')
          }}</span>
          <el-tag
            v-if="currentWorkflow && currentWorkflow.flow.length > 0"
            size="small"
            type="success"
            style="margin-left: 8px"
          >
            {{ t('aiWorkflow.page.stepCount', { count: currentWorkflow.flow.length }) }}
          </el-tag>
        </div>
        <div class="header-right">
          <el-button size="small" :icon="Collection" class="run-btn" @click="handleOpenLibrary">
            {{ t('aiWorkflow.page.scriptLibrary') }}
          </el-button>
        </div>
      </div>

      <div class="script-content-wrapper">
        <!-- 右侧：步骤详情 -->
        <div class="script-detail">
          <div class="script-content">
            <!-- 列表视图 - 按步骤分组展示 -->
            <el-scrollbar v-if="currentWorkflow && currentWorkflow.flow.length > 0">
              <div class="workflow-view">
                <!-- 工作流信息 -->
                <div class="workflow-header">
                  <div class="workflow-name">{{ currentWorkflow.name || currentWorkflow.id }}</div>
                </div>

                <!-- 步骤列表 -->
                <div
                  v-for="(stepId, stepIndex) in currentWorkflow.flow"
                  :key="stepId"
                  :class="['step-group', { 'is-running': runningStepId === stepId }]"
                >
                  <div class="step-group-header">
                    <div class="step-group-index">{{ stepIndex + 1 }}</div>
                    <div class="step-group-info">
                      <div class="step-group-title">{{ stepId }}</div>
                      <div
                        v-if="currentWorkflow.steps[stepId]?.description"
                        class="step-group-desc"
                      >
                        {{ currentWorkflow.steps[stepId].description }}
                      </div>
                      <div v-if="currentWorkflow.steps[stepId]?.loop" class="step-group-tags">
                        <el-tag size="small" type="warning">
                          {{
                            t('aiWorkflow.page.loopCount', {
                              count: getLoopCount(currentWorkflow.steps[stepId].loop)
                            })
                          }}
                        </el-tag>
                      </div>
                    </div>
                    <div class="step-header-tools">
                      <el-button
                        size="small"
                        class="step-edit-toggle-btn"
                        @click.stop="toggleStepEditor(stepId)"
                      >
                        <el-icon
                          class="step-edit-toggle-icon"
                          :class="{ expanded: isStepEditorExpanded(stepId) }"
                        >
                          <ArrowDown />
                        </el-icon>
                        {{
                          isStepEditorExpanded(stepId)
                            ? t('aiWorkflow.page.collapseEdit')
                            : t('aiWorkflow.page.expandEdit')
                        }}
                      </el-button>
                      <div v-if="runningStepId === stepId" class="step-running-indicator">
                        <el-icon class="is-loading"><Loading /></el-icon>
                      </div>
                    </div>
                  </div>

                  <!-- 步骤内的 actions -->
                  <div class="step-actions">
                    <div
                      v-for="(action, actionIndex) in currentWorkflow.steps[stepId]?.actions || []"
                      :key="actionIndex"
                      class="action-item"
                    >
                      <div class="action-index">{{ actionIndex + 1 }}</div>
                      <div class="action-info">
                        <div class="action-main">
                          <span class="action-desc" :title="getActionDescription(action)">
                            {{ getActionDescription(action) }}
                          </span>
                        </div>
                        <el-collapse-transition>
                          <div v-show="isStepEditorExpanded(stepId)" class="action-editor">
                            <div class="param-row">
                              <span class="param-key">{{ t('aiWorkflow.page.readonlyPath') }}</span>
                              <el-input :model-value="action.path" class="param-value" disabled />
                            </div>
                            <template
                              v-for="entry in getActionParamEntries(action)"
                              :key="entry.keyPath"
                            >
                              <div class="param-row">
                                <span class="param-key">{{ entry.label }}</span>
                                <el-input-number
                                  v-if="entry.valueType === 'number'"
                                  :model-value="entry.value as number"
                                  :controls="false"
                                  class="param-value"
                                  :disabled="!canEditActionParams"
                                  @change="
                                    (val) =>
                                      updateActionParam(action, entry.keyPath, val, entry.valueType)
                                  "
                                />
                                <el-switch
                                  v-else-if="entry.valueType === 'boolean'"
                                  :model-value="entry.value as boolean"
                                  class="param-switch"
                                  :disabled="!canEditActionParams"
                                  @change="
                                    (val) =>
                                      updateActionParam(action, entry.keyPath, val, entry.valueType)
                                  "
                                />
                                <el-input
                                  v-else
                                  :model-value="String(entry.value ?? '')"
                                  class="param-value"
                                  :disabled="!canEditActionParams"
                                  @input="
                                    (val) =>
                                      updateActionParam(action, entry.keyPath, val, entry.valueType)
                                  "
                                />
                              </div>
                            </template>
                            <div
                              v-if="getActionParamEntries(action).length === 0"
                              class="param-empty"
                            >
                              {{ t('aiWorkflow.page.noEditableParams') }}
                            </div>
                          </div>
                        </el-collapse-transition>
                      </div>
                      <div v-if="action.throw_if_empty" class="action-tags">
                        <el-tag size="small" type="danger">{{
                          t('aiWorkflow.page.validation')
                        }}</el-tag>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-scrollbar>
            <div v-else class="empty-steps">
              <div class="custom-empty">
                <div class="empty-icon-wrapper">
                  <el-icon class="base-icon"><MagicStick /></el-icon>
                  <div class="circles">
                    <span class="c1"></span><span class="c2"></span><span class="c3"></span>
                  </div>
                </div>
                <div class="empty-text">
                  <h3>{{ t('aiWorkflow.page.scriptPendingTitle') }}</h3>
                  <p>
                    {{ t('aiWorkflow.page.scriptPendingDesc1') }}<br />{{
                      t('aiWorkflow.page.scriptPendingDesc2')
                    }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="script-action-footer">
        <div class="footer-right">
          <el-button
            type="primary"
            size="small"
            :icon="DocumentAdd"
            class="run-btn"
            :disabled="
              !currentWorkflow ||
              currentWorkflow.flow.length === 0 ||
              isGenerating ||
              currentWorkflow.id === 'generating'
            "
            :loading="isGenerating"
            @click="handleSaveScript"
          >
            {{ t('aiWorkflow.page.save') }}
          </el-button>
          <el-button
            type="warning"
            plain
            size="small"
            :icon="Delete"
            class="run-btn"
            :disabled="
              !currentWorkflow ||
              currentWorkflow.flow.length === 0 ||
              isRunningScript ||
              isGenerating ||
              currentWorkflow.id === 'generating'
            "
            @click="handleClearWorkflow"
          >
            {{ t('aiWorkflow.page.clear') }}
          </el-button>
          <el-button
            type="danger"
            size="small"
            :icon="VideoPause"
            :disabled="!selectedDevice"
            class="run-btn"
            @click="handleCancelWorkflow"
          >
            {{ t('aiWorkflow.page.stop') }}
          </el-button>
          <el-button
            type="success"
            size="small"
            :icon="VideoPlay"
            :disabled="
              !currentWorkflow ||
              currentWorkflow.flow.length === 0 ||
              isRunningScript ||
              isGenerating ||
              currentWorkflow.id === 'generating'
            "
            :loading="isRunningScript"
            class="run-btn"
            @click="handleRunScript"
          >
            {{ isRunningScript ? t('aiWorkflow.page.running') : t('aiWorkflow.page.run') }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 右侧：云机画面 -->
    <div class="panel device-panel">
      <div class="panel-header">
        <div class="header-left">
          <span class="title" :title="t('aiWorkflow.page.deviceScreen')">{{
            t('aiWorkflow.page.deviceScreen')
          }}</span>
        </div>
        <div class="header-right">
          <div class="device-selector-trigger" @click="showDeviceSelector = true">
            <span
              class="device-name"
              :title="selectedDeviceName || t('aiWorkflow.page.selectDevice')"
            >
              {{ selectedDeviceName || t('aiWorkflow.page.selectDevice') }}
            </span>
            <el-icon class="arrow-icon"><ArrowDown /></el-icon>
          </div>
        </div>
      </div>

      <div class="device-preview-area">
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
              <div v-if="selectedDevice" class="device-render-container">
                <div ref="canvasContainerRef" class="canvas-container"></div>

                <div v-if="!isClientReady || clientError" class="render-status-mask">
                  <div class="status-content">
                    <template v-if="clientError">
                      <el-icon class="error-icon"><CircleClose /></el-icon>
                      <span class="status-text">{{ clientError }}</span>
                      <el-button
                        type="primary"
                        size="small"
                        style="margin-top: 10px"
                        @click="startClient"
                      >
                        {{ t('aiWorkflow.page.retryConnection') }}
                      </el-button>
                    </template>
                    <template v-else-if="!isClientReady">
                      <div class="premium-loader">
                        <div class="loader-inner"></div>
                        <div class="loader-text">{{ t('aiWorkflow.page.connecting') }}</div>
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
                  <div class="placeholder-text">
                    <h4>{{ t('aiWorkflow.page.noDeviceConnected') }}</h4>
                    <p>
                      {{ t('aiWorkflow.page.noDeviceDesc1') }}<br />{{
                        t('aiWorkflow.page.noDeviceDesc2')
                      }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <!-- phone-inner -->
          </div>
          <!-- phone-frame -->

          <!-- 将导航栏移到手机框架外部，避免遮挡屏幕点击 -->
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
        <!-- phone-wrapper -->
      </div>
      <!-- device-preview-area -->
    </div>
    <!-- device-panel -->

    <DeviceSelectorDialog
      v-model="showDeviceSelector"
      :current-device-id="selectedDevice?.id"
      @select="handleDeviceSelect"
    />

    <!-- AI 模型管理对话框 -->
    <AiModelManagerDialog
      v-model="showManagerDialog"
      :models="models"
      :selected-model-id="selectedModelId"
      @add="handleModelAdd"
      @update="handleModelUpdate"
      @delete="handleModelDelete"
    />

    <!-- 脚本库对话框 -->
    <ScriptLibraryDialog
      v-model="showLibraryDialog"
      @select-script="handleSelectScriptFromLibrary"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  VideoPlay,
  VideoPause,
  Setting,
  ArrowDown,
  Loading,
  CircleClose,
  ArrowLeft,
  HomeFilled,
  Menu as MenuIcon,
  MagicStick,
  Collection,
  DocumentAdd,
  Delete,
  Iphone
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VmosEdgeClient, VmosEdgeClientEvents } from '@vmosedge/web-sdk'
import { MacvlanPortMap } from '@renderer/utils/constant'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, DeviceState } from '@shared/ipc/data.types'
import { AUTOMATION_SCRIPT_EVENTS } from '@shared/ipc/automationScript.types'
import { logVmosEdgeClientInternalError } from '@renderer/utils/vmosEdgeClientLogger'
import { useAiModelConfig, vendorToProvider } from '@renderer/hooks/useAiModelConfig'
import store from 'store'
import AiModelManagerDialog from './components/AiModelManagerDialog.vue'
import ScriptLibraryDialog from './components/ScriptLibraryDialog.vue'
import DeviceSelectorDialog from './components/DeviceSelectorDialog.vue'
import ChatPanel from './components/ChatPanel.vue'
import type { AiModelConfig } from '@renderer/hooks/useAiModelConfig'
import type { Device } from '@shared/ipc/data.types'
import type {
  WorkflowScript,
  AIProviderConfig,
  AIVendor,
  WorkflowAction
} from '@shared/ipc/agent.types'
import { AutomationService } from './services/automationService'
import { createActionDescriptionGetter } from './utils/actionDescription'

defineOptions({ name: 'Automation' })

const { t } = useI18n()
const getActionDescription = createActionDescriptionGetter(t)

// ==================== AI 模型配置 ====================
// ... (rest of the imports)

const { models, addModel, updateModel, deleteModel } = useAiModelConfig()

// 工作流页面自己维护的选中模型 ID（与 AI Agent 页面独立）
const WORKFLOW_MODEL_KEY = 'workflow_selected_model_id'
const selectedModelId = ref<string>(store.get(WORKFLOW_MODEL_KEY) || '')
watch(selectedModelId, (id) => store.set(WORKFLOW_MODEL_KEY, id))
const currentModel = computed(() => {
  if (!selectedModelId.value || models.value.length === 0) return undefined
  return models.value.find((m) => m.id === selectedModelId.value)
})

const showManagerDialog = ref(false)
const showLibraryDialog = ref(false)

const handleOpenManager = () => {
  showManagerDialog.value = true
}

const handleOpenLibrary = () => {
  showLibraryDialog.value = true
}

const handleModelAdd = (model: AiModelConfig) => {
  addModel(model)
  if (!selectedModelId.value) {
    selectedModelId.value = model.id
  }
}

const handleModelUpdate = (id: string, model: AiModelConfig) => {
  updateModel(id, model)
}

const handleModelDelete = (id: string) => {
  deleteModel(id)
  if (selectedModelId.value === id) {
    selectedModelId.value = models.value.length > 0 ? models.value[0].id : ''
  }
}

// 转换为 Provider 配置
const currentProviderConfig = computed<AIProviderConfig | undefined>(() => {
  if (!currentModel.value) return undefined

  return {
    vendor: vendorToProvider(currentModel.value.vendor) as AIVendor,
    baseUrl: currentModel.value.apiHost || undefined,
    apiKey: currentModel.value.apiKey,
    model: currentModel.value.modelName
  }
})

// ==================== 脚本步骤 ====================

const currentWorkflow = ref<WorkflowScript | undefined>(undefined)
const currentScriptId = ref<string | null>(null) // 当前加载或保存过的脚本 ID
const isRunningScript = ref(false)
const isGenerating = ref(false)
const runningStepId = ref<string | null>(null)
const expandedStepEditors = ref<Record<string, boolean>>({})

function isStepEditorExpanded(stepId: string): boolean {
  return !!expandedStepEditors.value[stepId]
}

function toggleStepEditor(stepId: string): void {
  expandedStepEditors.value[stepId] = !expandedStepEditors.value[stepId]
}

function resetStepEditorState(): void {
  expandedStepEditors.value = {}
}

/**
 * 处理工作流生成完成（Phase 2 输出）
 */
const handleWorkflowComplete = (workflow: WorkflowScript) => {
  currentWorkflow.value = workflow
  resetStepEditorState()
}

/**
 * 从 ChatPanel 保存工作流
 */
const handleSaveWorkflowFromChat = (workflow: WorkflowScript) => {
  currentWorkflow.value = workflow
  resetStepEditorState()
  handleSaveScript()
}

/**
 * 从 ChatPanel 运行工作流
 */
const handleRunWorkflowFromChat = (workflow: WorkflowScript) => {
  currentWorkflow.value = workflow
  resetStepEditorState()
  handleRunScript()
}

const handleSelectScriptFromLibrary = (payload: { scriptId: string; workflow: WorkflowScript }) => {
  currentWorkflow.value = payload.workflow
  currentScriptId.value = payload.scriptId
  runningStepId.value = null
  resetStepEditorState()
}

const handleSessionChanged = () => {
  currentWorkflow.value = undefined
  currentScriptId.value = null
  resetStepEditorState()
}

const handleClearWorkflow = async () => {
  if (!currentWorkflow.value || currentWorkflow.value.flow.length === 0) {
    ElMessage.warning(t('aiWorkflow.page.clearWorkflowEmpty'))
    return
  }

  if (isRunningScript.value || isGenerating.value || currentWorkflow.value.id === 'generating') {
    ElMessage.warning(t('aiWorkflow.page.clearWorkflowBusy'))
    return
  }

  try {
    await ElMessageBox.confirm(
      t('aiWorkflow.page.clearWorkflowConfirm'),
      t('aiWorkflow.page.clearWorkflowConfirmTitle'),
      {
        confirmButtonText: t('aiWorkflow.page.clear'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }

  currentWorkflow.value = undefined
  currentScriptId.value = null
  runningStepId.value = null
  resetStepEditorState()
  ElMessage.success(t('aiWorkflow.page.clearedWorkflow'))
}

// ==================== 脚本保存与列表 ====================

/**
 * 保存当前脚本
 */
const handleSaveScript = async () => {
  if (!currentWorkflow.value || currentWorkflow.value.flow.length === 0) {
    ElMessage.warning(t('aiWorkflow.page.noWorkflowToSave'))
    return
  }

  if (isGenerating.value || currentWorkflow.value.id === 'generating') {
    ElMessage.warning(t('aiWorkflow.page.generatingCannotSave'))
    return
  }

  try {
    const isUpdate = !!currentScriptId.value
    const { value: name } = await ElMessageBox.prompt(
      t('aiWorkflow.page.scriptNamePrompt', { max: 40 }),
      isUpdate ? t('aiWorkflow.page.updateScriptTitle') : t('aiWorkflow.page.saveScriptTitle'),
      {
        confirmButtonText: t('aiWorkflow.page.save'),
        cancelButtonText: t('common.cancel'),
        inputPlaceholder: t('aiWorkflow.page.scriptNamePlaceholder', { max: 40 }),
        inputValue: currentWorkflow.value.id !== 'generating' ? currentWorkflow.value.name : '',
        inputValidator: (val) => {
          const trimmed = (val || '').trim()
          if (!trimmed) return t('aiWorkflow.page.scriptNameEmpty')
          if (Array.from(trimmed).length > 40)
            return t('aiWorkflow.page.scriptNameTooLong', { max: 40 })
          return true
        }
      }
    )

    const normalizedName = (name || '').trim()
    if (!normalizedName) return

    // 对工作流数据进行脱水处理，避免 Vue Proxy 导致 IPC 序列化错误
    const cleanWorkflow = JSON.parse(JSON.stringify(currentWorkflow.value))

    const res = await ipc.invoke<string>(AUTOMATION_SCRIPT_EVENTS.SAVE_SCRIPT, {
      id: currentScriptId.value || undefined,
      name: normalizedName,
      workflow: {
        ...cleanWorkflow,
        name: normalizedName // 保持 workflow 内部名称与数据库名称一致
      }
    })

    if (res.success) {
      currentScriptId.value = res.data || null
      // 更新当前 workflow 的名称，避免 UI 不同步
      if (currentWorkflow.value) {
        currentWorkflow.value.name = normalizedName
      }
      ElMessage.success(
        isUpdate ? t('aiWorkflow.page.scriptUpdated') : t('aiWorkflow.page.scriptSaved')
      )
    } else {
      throw new Error(res.error || t('aiWorkflow.page.saveFailed'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(t('aiWorkflow.page.saveFailedWithError', { error: error.message }))
    }
  }
}

/**
 * 获取循环次数文本
 */
const getLoopCount = (loop: any) => {
  if (!loop) return '0'
  if (loop.max_count === -1 || loop.count === -1) return t('aiWorkflow.page.infinite')
  return loop.max_count || loop.count || '0'
}

// 运行脚本
type EditableParamType = 'string' | 'number' | 'boolean'

interface EditableParamEntry {
  keyPath: string
  label: string
  value: string | number | boolean
  valueType: EditableParamType
}

const canEditActionParams = computed(() => {
  return !isGenerating.value && !isRunningScript.value && currentWorkflow.value?.id !== 'generating'
})

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const COMMON_PARAM_LABELS = computed<Record<string, string>>(() => ({
  package_name: t('aiWorkflow.paramLabels.packageName'),
  grant_all: t('aiWorkflow.paramLabels.grantAll'),
  selector: t('aiWorkflow.paramLabels.selector'),
  'selector.resource_id': t('aiWorkflow.paramLabels.selectorResourceId'),
  'selector.text': t('aiWorkflow.paramLabels.selectorText'),
  'selector.content_desc': t('aiWorkflow.paramLabels.selectorContentDesc'),
  'selector.class_name': t('aiWorkflow.paramLabels.selectorClassName'),
  action: t('aiWorkflow.paramLabels.action'),
  wait_timeout: t('aiWorkflow.paramLabels.waitTimeout'),
  wait_interval: t('aiWorkflow.paramLabels.waitInterval'),
  'action_params.text': t('aiWorkflow.paramLabels.actionParamsText'),
  start_x: t('aiWorkflow.paramLabels.startX'),
  start_y: t('aiWorkflow.paramLabels.startY'),
  end_x: t('aiWorkflow.paramLabels.endX'),
  end_y: t('aiWorkflow.paramLabels.endY'),
  duration: t('aiWorkflow.paramLabels.duration'),
  text: t('aiWorkflow.paramLabels.text'),
  key_code: t('aiWorkflow.paramLabels.keyCode'),
  x: t('aiWorkflow.paramLabels.x'),
  y: t('aiWorkflow.paramLabels.y'),
  message: t('aiWorkflow.paramLabels.message')
}))

const ACTION_PARAM_LABELS = computed<Record<string, Record<string, string>>>(() => ({
  'base/sleep': {
    duration: t('aiWorkflow.actionParamLabels.sleepDuration')
  },
  'input/scroll_bezier': {
    duration: t('aiWorkflow.actionParamLabels.scrollDuration')
  }
}))

function translateParamSegment(segment: string): string {
  if (COMMON_PARAM_LABELS.value[segment]) return COMMON_PARAM_LABELS.value[segment]
  return t('aiWorkflow.page.unknownParam', { segment })
}

function getParamLabel(actionPath: string, keyPath: string): string {
  const actionLabels = ACTION_PARAM_LABELS.value[actionPath]
  if (actionLabels && actionLabels[keyPath]) {
    return `${actionLabels[keyPath]} (${keyPath})`
  }
  if (COMMON_PARAM_LABELS.value[keyPath]) {
    return `${COMMON_PARAM_LABELS.value[keyPath]} (${keyPath})`
  }

  const lastSegment = keyPath.split('.').pop() || keyPath
  return `${translateParamSegment(lastSegment)} (${keyPath})`
}

function collectEditableParams(
  source: Record<string, unknown>,
  actionPath: string,
  parentPath = '',
  entries: EditableParamEntry[] = []
): EditableParamEntry[] {
  for (const [key, value] of Object.entries(source)) {
    const path = parentPath ? `${parentPath}.${key}` : key

    if (isPlainRecord(value)) {
      collectEditableParams(value, actionPath, path, entries)
      continue
    }

    if (Array.isArray(value)) continue

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
      const valueType: EditableParamType =
        typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'
      entries.push({
        keyPath: path,
        label: getParamLabel(actionPath, path),
        value,
        valueType
      })
      continue
    }

    if (value === null || value === undefined) {
      entries.push({
        keyPath: path,
        label: getParamLabel(actionPath, path),
        value: '',
        valueType: 'string'
      })
    }
  }
  return entries
}

function getActionParamEntries(action: WorkflowAction): EditableParamEntry[] {
  if (!action.params || !isPlainRecord(action.params)) return []
  return collectEditableParams(action.params, action.path)
}

function ensureActionParams(action: WorkflowAction): Record<string, unknown> {
  if (!action.params || !isPlainRecord(action.params)) {
    action.params = {}
  }
  return action.params
}

function setParamByPath(target: Record<string, unknown>, keyPath: string, value: unknown): void {
  const segments = keyPath.split('.')
  const lastKey = segments.pop()
  if (!lastKey) return

  let cursor = target
  for (const segment of segments) {
    const next = cursor[segment]
    if (!isPlainRecord(next)) {
      cursor[segment] = {}
    }
    cursor = cursor[segment] as Record<string, unknown>
  }

  cursor[lastKey] = value
}

function updateActionParam(
  action: WorkflowAction,
  keyPath: string,
  nextValue: string | number | boolean | null | undefined,
  valueType: EditableParamType
): void {
  const params = ensureActionParams(action)

  if (valueType === 'number') {
    if (nextValue === null || nextValue === undefined) return
    const num = typeof nextValue === 'number' ? nextValue : Number(nextValue)
    if (Number.isNaN(num)) return
    setParamByPath(params, keyPath, num)
    return
  }

  if (valueType === 'boolean') {
    setParamByPath(params, keyPath, Boolean(nextValue))
    return
  }

  setParamByPath(params, keyPath, String(nextValue ?? ''))
}

const handleRunScript = async () => {
  if (!selectedDevice.value) {
    ElMessage.warning(t('aiWorkflow.page.selectDeviceFirst'))
    return
  }
  if (!currentWorkflow.value || currentWorkflow.value.flow.length === 0) {
    ElMessage.warning(t('aiWorkflow.page.generateWorkflowFirst'))
    return
  }

  isRunningScript.value = true
  runningStepId.value = currentWorkflow.value.flow[0] || null

  try {
    const result = await AutomationService.executeWorkflow(
      selectedDevice.value,
      currentWorkflow.value
    )

    if (result.code !== 200) {
      throw new Error(result.msg || t('aiWorkflow.page.executeWorkflowFailed'))
    }

    ElMessage.success(t('aiWorkflow.page.executeWorkflowSuccess'))
  } catch (error: unknown) {
    ElMessage.error(t('aiWorkflow.page.executeFailed', { error: (error as Error).message }))
  } finally {
    isRunningScript.value = false
    runningStepId.value = null
  }
}

// 停止脚本运行
const handleCancelWorkflow = async () => {
  if (!selectedDevice.value) {
    ElMessage.warning(t('aiWorkflow.page.selectDeviceFirst'))
    return
  }
  try {
    const result = await AutomationService.cancelWorkflow(selectedDevice.value)
    if (result.code == 200) {
      ElMessage.success(t('aiWorkflow.page.cancelScriptSuccess'))
      isRunningScript.value = false
      runningStepId.value = null
    } else {
      ElMessage.error(result.msg || t('aiWorkflow.page.cancelScriptFailed'))
    }
  } catch (error: unknown) {
    ElMessage.error(
      t('aiWorkflow.page.cancelScriptFailedWithError', { error: (error as Error).message })
    )
  }
}

// ==================== 云机相关 ====================

const selectedDevice = ref<Device | null>(null)
const showDeviceSelector = ref(false)

const isClientReady = ref(false)
const clientError = ref<string | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)
let client: VmosEdgeClient | null = null

const MAX_DISPLAY_SIDE = 572
const phoneSize = ref({ width: 286, height: 572 })

const selectedDeviceName = computed(() => {
  return selectedDevice.value?.user_name
})

const handleDeviceSelect = (device: Device) => {
  selectedDevice.value = device
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
      logVmosEdgeClientInternalError('Automation', error, info)
    }
  })

  client.on(VmosEdgeClientEvents.STARTED, () => {
    isClientReady.value = true
  })

  client.on(VmosEdgeClientEvents.ERROR, (error) => {
    clientError.value = error.message || t('aiWorkflow.page.connectionFailed')
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

const stopClient = () => {
  if (client) {
    client.stop()
    client = null
  }
  isClientReady.value = false
  clientError.value = null
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

watch(selectedDevice, (newVal, oldVal) => {
  const idChanged = newVal?.id !== oldVal?.id
  const stateChanged = newVal?.state !== oldVal?.state

  if (idChanged || stateChanged) {
    if (newVal && newVal.state === DeviceState.StateRunning) {
      startClient()
    } else {
      stopClient()
    }
  }
})

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
})

onUnmounted(() => {
  stopClient()
  if (removeDeviceListener) {
    removeDeviceListener()
  }
})

// 路由离开时清空云机投屏和选中的云机
onBeforeRouteLeave(() => {
  stopClient()
  selectedDevice.value = null
})
</script>

<style scoped lang="scss">
.automation-container {
  display: flex;
  height: calc(100vh - 56px);
  padding: var(--app-padding-base);
  gap: var(--app-padding-base);
  background-color: var(--el-bg-color-page);
  box-sizing: border-box;

  .panel {
    display: flex;
    flex-direction: column;
    background-color: var(--el-bg-color);
    border-radius: 12px;
    border: 1px solid var(--el-border-color-lighter);
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .panel-header {
    height: 54px;
    padding: 0 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: linear-gradient(to bottom, var(--el-bg-color), var(--el-fill-color-extra-light));
    flex-shrink: 0;

    .header-left {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .title {
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      letter-spacing: -0.01em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 5px;
    }
  }

  .orchestration-panel {
    flex: 4.3;
    min-width: 390px;
  }
  .script-panel {
    flex: 3.8;
    min-width: 430px;

    .panel-header {
      .header-right {
        gap: 6px;
      }
    }

    .script-action-footer {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 10px 14px;
      border-top: 1px solid var(--el-border-color-lighter);
      background: linear-gradient(to top, var(--el-bg-color), var(--el-fill-color-extra-light));
    }
  }
  .device-panel {
    flex: 3.1;
    min-width: 340px;
  }

  .orchestration-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
    background-color: var(--el-bg-color);
    position: relative;
  }

  .trace-panel {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.05);
    z-index: 10;

    .trace-header {
      height: 36px;
      padding: 0 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--el-border-color-lighter);
      background: linear-gradient(to bottom, var(--el-fill-color-extra-light), var(--el-bg-color));
      flex-shrink: 0;

      .trace-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 600;
        color: var(--el-text-color-primary);

        .el-icon {
          color: var(--el-color-primary);
        }
      }
    }

    .trace-content {
      flex: 1;
      padding: 8px 12px;
      overflow-y: auto;

      .trace-item {
        display: flex;
        gap: 10px;
        padding: 8px 10px;
        margin-bottom: 6px;
        background-color: var(--el-fill-color-blank);
        border-left: 2px solid var(--el-color-success-light-5);
        border-radius: 6px;
        transition: all 0.2s ease;

        &:hover {
          background-color: var(--el-fill-color-light);
          box-shadow: var(--app-shadow-base);
        }

        &.trace-error {
          border-left-color: var(--el-color-danger-light-5);
        }

        .trace-item-time {
          flex-shrink: 0;
          width: 90px;
          font-size: 11px;
          font-family: 'Courier New', monospace;
          color: var(--el-text-color-secondary);
          line-height: 20px;
        }

        .trace-item-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;

          .trace-item-desc {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 8px;

            .trace-type {
              display: inline-block;
              padding: 2px 6px;
              background-color: var(--el-color-primary-light-9);
              color: var(--el-color-primary);
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              flex-shrink: 0;
            }

            .trace-desc-text {
              font-size: 12px;
              color: var(--el-text-color-regular);
              line-height: 1.4;
            }
          }

          .trace-item-result {
            flex-shrink: 0;
          }
        }
      }
    }
  }

  .script-content-wrapper {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .script-sidebar {
    width: 220px;
    border-right: 1px solid var(--el-border-color-lighter);
    display: flex;
    flex-direction: column;
    background-color: var(--el-fill-color-extra-light);

    .sidebar-header {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      border-bottom: 1px solid var(--el-border-color-lighter);
      background-color: var(--el-bg-color);

      .el-icon {
        color: var(--el-color-primary);
      }

      .count {
        margin-left: auto;
        font-size: 11px;
        background-color: var(--el-fill-color-darker);
        color: #fff;
        padding: 1px 6px;
        border-radius: 10px;
      }
    }

    .script-list {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .script-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;

      &:hover {
        background-color: var(--el-fill-color-light);

        .item-actions {
          opacity: 1;
        }
      }

      &.active {
        background-color: var(--el-color-primary-light-9);
        border-color: var(--el-color-primary-light-7);

        .item-icon {
          background-color: var(--el-color-primary);
          color: #fff;
        }

        .item-name {
          color: var(--el-color-primary);
        }
      }

      .item-icon {
        width: 32px;
        height: 32px;
        background-color: var(--el-fill-color-darker);
        color: var(--el-text-color-secondary);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .item-info {
        flex: 1;
        min-width: 0;

        .item-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--el-text-color-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-meta {
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--el-text-color-secondary);

          .el-icon {
            font-size: 12px;
          }
        }
      }

      .item-actions {
        opacity: 0;
        transition: opacity 0.2s;
        flex-shrink: 0;
      }
    }

    .empty-sidebar {
      padding: 40px 0;
      display: flex;
      justify-content: center;
      opacity: 0.6;
    }
  }

  .script-detail {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--el-bg-color);
  }

  .script-content {
    flex: 1;
    overflow: hidden;
    padding: var(--app-padding-base);
  }

  .workflow-view {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .workflow-header {
      padding: 10px 14px;
      border-radius: 8px;
      border-left: 3px solid var(--el-color-primary);
      margin-bottom: 4px;

      .workflow-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--el-color-primary-dark-2);
      }
    }

    .step-group {
      background-color: var(--el-bg-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.2s ease;

      &.is-running {
        border-color: var(--el-color-primary);
        box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
      }

      .step-group-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 14px;
        background-color: var(--el-fill-color-lighter);
        border-bottom: 1px solid var(--el-border-color-lighter);
        transition: background-color 0.2s;

        .step-group-index {
          width: 22px;
          height: 22px;
          background: var(--el-color-primary);
          color: white;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .step-group-info {
          flex: 1;
          min-width: 0;

          .step-group-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--el-text-color-primary);
            line-height: 1.4;
          }

          .step-group-desc {
            font-size: 12px;
            color: var(--el-text-color-secondary);
            margin-top: 4px;
            line-height: 1.4;
          }

          .step-group-tags {
            margin-top: 6px;
            display: flex;
            gap: 6px;
          }
        }

        .step-running-indicator {
          flex-shrink: 0;
          .el-icon {
            font-size: 20px;
            color: var(--el-color-primary);
          }
        }

        .step-header-tools {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .step-edit-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 24px;
          padding: 0 8px;
          font-size: 11px;
          line-height: 1;
          border: 1px dashed var(--el-color-primary-light-5);
          color: var(--el-color-primary);
        }

        .step-edit-toggle-icon {
          font-size: 11px;
          transition: transform 0.2s ease;

          &.expanded {
            transform: rotate(180deg);
          }
        }
      }

      .step-actions {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: var(--el-bg-color);

        .action-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 12px;
          position: relative;
          background-color: var(--el-fill-color-blank);
          border-radius: 8px;
          border: 1px solid var(--el-border-color-lighter);
          transition: all 0.2s ease;

          &:hover {
            border-color: var(--el-color-primary-light-7);
            box-shadow: var(--app-shadow-base);
          }

          .action-index {
            width: 20px;
            height: 20px;
            background-color: var(--el-fill-color-light);
            color: var(--el-text-color-secondary);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 600;
            flex-shrink: 0;
          }

          .action-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;

            .action-main {
              display: flex;
              align-items: flex-start;
              gap: 10px;
              padding-right: 76px;

              .action-desc {
                flex: 1;
                min-width: 0;
                font-size: 12.5px;
                color: var(--el-text-color-regular);
                white-space: normal;
                overflow: hidden;
                text-overflow: ellipsis;
                font-weight: 500;
              }
            }

            .action-editor {
              display: flex;
              flex-direction: column;
              gap: 6px;
              padding: 8px;
              width: 100%;
              box-sizing: border-box;
              border: 1px dashed var(--el-color-primary-light-6);
              border-radius: 8px;

              .param-row {
                display: flex;
                align-items: center;
                gap: 8px;
              }

              .param-key {
                width: 180px;
                flex-shrink: 0;
                font-size: 12px;
                color: var(--el-text-color-secondary);
                word-break: break-all;
              }

              .param-value {
                flex: 1;
                min-width: 0;
              }

              .param-switch {
                flex-shrink: 0;
              }

              .param-empty {
                font-size: 12px;
                color: var(--el-text-color-placeholder);
              }
            }
          }

          .action-tags {
            position: absolute;
            top: 8px;
            right: 12px;
            margin-top: 0;
            display: flex;
            align-items: center;
            z-index: 1;
          }
        }
      }
    }
  }

  .action-editor {
    :deep(.el-input-number) {
      width: 100%;
    }
  }

  .empty-steps {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-bottom: 40px;

    .custom-empty {
      text-align: center;

      .empty-icon-wrapper {
        position: relative;
        width: 120px;
        height: 120px;
        margin: 0 auto 24px;
        display: flex;
        align-items: center;
        justify-content: center;

        .base-icon {
          font-size: 48px;
          color: var(--el-color-primary-light-5);
          z-index: 2;
        }

        .circles {
          position: absolute;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;

          span {
            position: absolute;
            border: 1.5px solid var(--el-color-primary-light-8);
            border-radius: 50%;
            animation: ripple 4s infinite cubic-bezier(0, 0.2, 0.8, 1);
            opacity: 0;
          }
          .c1 {
            width: 40px;
            height: 40px;
            animation-delay: 0s;
          }
          .c2 {
            width: 40px;
            height: 40px;
            animation-delay: 1.2s;
          }
          .c3 {
            width: 40px;
            height: 40px;
            animation-delay: 2.4s;
          }
        }
      }

      .empty-text {
        h3 {
          font-size: 18px;
          font-weight: 700;
          color: var(--el-text-color-primary);
          margin-bottom: 12px;
        }
        p {
          font-size: 13.5px;
          color: var(--el-text-color-secondary);
          line-height: 1.6;
        }
      }
    }
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

    &::after {
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

  .status-content {
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

  .status-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.5;
    word-break: break-word;
  }

  .error-icon {
    font-size: 26px;
    color: var(--el-color-danger);
  }

  .device-placeholder {
    padding: 40px 20px;
    text-align: center;
    position: relative;
    z-index: 1;
    animation: fadeIn 0.8s ease-out;

    .placeholder-icon {
      width: 100px;
      height: 100px;
      background: linear-gradient(
        135deg,
        rgba(255, 255, 255, 0.08) 0%,
        rgba(255, 255, 255, 0.02) 100%
      );
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 32px;
      transform: rotate(-10deg);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      transition: all 0.5s ease;

      &:hover {
        transform: rotate(0deg) scale(1.05);
        border-color: rgba(var(--el-color-primary-rgb), 0.3);
      }

      .el-icon {
        font-size: 48px;
        color: rgba(255, 255, 255, 0.3);
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
      }
    }

    .placeholder-text {
      h4 {
        font-size: 18px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 12px;
        letter-spacing: 0.5px;
      }
      p {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.45);
        line-height: 1.6;
        max-width: 240px;
        margin: 0 auto;
      }
    }
  }

  .premium-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;

    .loader-inner {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.1) 0%,
        rgba(255, 255, 255, 0.03) 100%
      );
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
      display: flex;
      align-items: center;
      justify-content: center;

      &::after {
        content: '';
        width: 18px;
        height: 24px;
        border: 1.5px solid rgba(255, 255, 255, 0.6);
        border-radius: 4px;
        box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.25);
      }
    }
    .loader-text {
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.75);
      letter-spacing: 0.5px;
    }
  }

  @keyframes ripple {
    0% {
      width: 40px;
      height: 40px;
      opacity: 0.8;
    }
    100% {
      width: 120px;
      height: 120px;
      opacity: 0;
    }
  }

  .run-btn {
    padding: 8px 16px;
    font-weight: 600;
    border-radius: var(--app-radius-base);
    transition: all 0.2s ease;

    &:not(:disabled):hover {
      transform: translateY(-1px);
      box-shadow: var(--app-shadow-hover);
    }
  }

  .device-selector-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background-color: var(--el-fill-color-blank);
    border: 1px solid var(--el-border-color-light);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);

    &:hover {
      border-color: var(--el-color-primary);
      background-color: var(--el-fill-color-lighter);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .device-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      max-width: 120px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .arrow-icon {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .device-preview-area {
    flex: 1;
    background-color: var(--el-bg-color-page);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--app-padding-base);
    position: relative;
    overflow: hidden;

    &::before {
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

    &::before {
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

    &::after {
      content: '';
      width: 3px;
      height: 3px;
      background: #080808;
      border-radius: 50%;
      border: 1px solid #111;
    }
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

    .nav-item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      max-width: 44px;

      &:hover {
        background-color: rgba(255, 255, 255, 0.1);
        .el-icon {
          color: #fff;
          transform: scale(1.1);
        }
      }

      &:active {
        transform: scale(0.95);
      }

      .el-icon {
        font-size: 15px;
        color: #71717a;
        transition: all 0.2s;
      }
    }
  }
}

.select-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: center;
  background-color: var(--el-fill-color-extra-light);

  .el-button {
    width: 100%;
    font-weight: 600;
  }
}
</style>
