<template>
  <vmos-dialog
    v-model="visible"
    :title="t('aiWorkflow.scriptLibrary.title')"
    width="900px"
    :close-on-click-modal="false"
    class="script-library-dialog"
    @close="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <span class="header-title">{{ t('aiWorkflow.scriptLibrary.headerTitle') }}</span>
      </div>
    </template>

    <div class="library-container">
      <!-- 左侧列表 -->
      <div class="library-sidebar">
        <div class="sidebar-search">
          <el-input
            v-model="searchKeyword"
            :placeholder="t('aiWorkflow.scriptLibrary.searchPlaceholder')"
            :prefix-icon="Search"
            clearable
          />
        </div>

        <div class="script-list-container">
          <el-scrollbar>
            <div v-if="filteredScripts.length > 0" class="script-list">
              <div
                v-for="item in filteredScripts"
                :key="item.id"
                class="script-item"
                :class="{ active: selectedScript?.id === item.id }"
                @click="handleSelectScript(item)"
              >
                <div class="item-icon">
                  <el-icon><MagicStick /></el-icon>
                </div>
                <div class="item-content">
                  <div class="item-name" :title="item.name">{{ item.name }}</div>
                  <div class="item-time">{{ formatTime(item.createTime) }}</div>
                </div>
                <div class="item-actions">
                  <el-button type="danger" link :icon="Delete" @click.stop="handleDelete(item)" />
                </div>
              </div>
            </div>
            <div v-else class="empty-list">
              <el-empty
                :image-size="60"
                :description="t('aiWorkflow.scriptLibrary.emptyScripts')"
              />
            </div>
          </el-scrollbar>
        </div>
      </div>

      <!-- 右侧详情预览 -->
      <div class="library-content">
        <div v-if="selectedScript" class="script-preview">
          <div class="preview-header">
            <div class="preview-title">
              <span class="name">{{ selectedScript.name }}</span>
              <el-button link type="primary" :icon="Edit" @click="handleRename(selectedScript)">
                {{ t('aiWorkflow.scriptLibrary.rename') }}
              </el-button>
            </div>
            <div class="preview-actions">
              <el-button
                type="success"
                size="small"
                :disabled="!selectedScript || !parsedWorkflow"
                @click="handleLoadToOrchestration"
              >
                {{ t('aiWorkflow.scriptLibrary.loadToOrchestration') }}
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="isSaving"
                :disabled="!isWorkflowDirty || !parsedWorkflow"
                @click="handleSaveWorkflow"
              >
                {{ t('aiWorkflow.scriptLibrary.saveChanges') }}
              </el-button>
            </div>
          </div>

          <div class="preview-body">
            <div class="steps-info">
              {{
                t('aiWorkflow.scriptLibrary.totalSteps', {
                  count: parsedWorkflow?.flow?.length || 0
                })
              }}
            </div>
            <el-scrollbar>
              <div v-if="parsedWorkflow && parsedWorkflow.flow?.length" class="workflow-view">
                <div
                  v-for="(stepId, stepIndex) in parsedWorkflow.flow"
                  :key="stepId"
                  class="step-group"
                >
                  <div class="step-group-header">
                    <div class="step-group-index">{{ stepIndex + 1 }}</div>
                    <div class="step-group-info">
                      <div class="step-group-title">{{ stepId }}</div>
                      <div v-if="parsedWorkflow.steps[stepId]?.description" class="step-group-desc">
                        {{ parsedWorkflow.steps[stepId].description }}
                      </div>
                      <div v-if="parsedWorkflow.steps[stepId]?.loop" class="step-group-tags">
                        <el-tag size="small" type="warning">
                          {{
                            t('aiWorkflow.page.loopCount', {
                              count: getLoopCount(parsedWorkflow.steps[stepId].loop)
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
                    </div>
                  </div>

                  <div class="step-actions">
                    <div
                      v-for="(action, actionIndex) in parsedWorkflow.steps[stepId]?.actions || []"
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
              <div v-else class="empty-preview">
                {{ t('aiWorkflow.scriptLibrary.cannotPreview') }}
              </div>
            </el-scrollbar>
          </div>
        </div>
        <div v-else class="empty-selection">
          <el-empty :image-size="100" :description="t('aiWorkflow.scriptLibrary.emptySelection')" />
        </div>
      </div>
    </div>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search, MagicStick, Delete, Edit, ArrowDown } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { AUTOMATION_SCRIPT_EVENTS } from '@shared/ipc/automationScript.types'
import type { AutomationScriptRecord } from '@shared/ipc/automationScript.types'
import type { WorkflowScript, WorkflowAction } from '@shared/ipc/agent.types'
import { useI18n } from 'vue-i18n'
import { createActionDescriptionGetter } from '../utils/actionDescription'

import moment from 'moment'

const { t } = useI18n()
const getActionDescription = createActionDescriptionGetter(t)

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  selectScript: [
    payload: {
      scriptId: string
      workflow: WorkflowScript
    }
  ]
}>()

const visible = ref(false)
const scripts = ref<AutomationScriptRecord[]>([])
const searchKeyword = ref('')
const selectedScript = ref<AutomationScriptRecord | null>(null)
const parsedWorkflow = ref<WorkflowScript | null>(null)
const expandedStepEditors = ref<Record<string, boolean>>({})
const isSaving = ref(false)
const workflowSnapshot = ref('')
const MAX_SCRIPT_NAME_LENGTH = 40

const isWorkflowDirty = computed(() => {
  if (!parsedWorkflow.value || !workflowSnapshot.value) return false
  try {
    return JSON.stringify(parsedWorkflow.value) !== workflowSnapshot.value
  } catch {
    return false
  }
})

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
    if (val) {
      selectedScript.value = null
      parsedWorkflow.value = null
      fetchScripts()
    }
  }
)

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const filteredScripts = computed(() => {
  if (!searchKeyword.value) return scripts.value
  const keyword = searchKeyword.value.toLowerCase()
  return scripts.value.filter((item) => item.name.toLowerCase().includes(keyword))
})

const handleClose = () => {
  visible.value = false
}

const handleLoadToOrchestration = () => {
  if (!selectedScript.value || !parsedWorkflow.value) return

  const cleanWorkflow = JSON.parse(JSON.stringify(parsedWorkflow.value)) as WorkflowScript
  emit('selectScript', {
    scriptId: selectedScript.value.id,
    workflow: cleanWorkflow
  })
  visible.value = false
}

const handleSelectScript = (item: AutomationScriptRecord) => {
  selectedScript.value = item
  try {
    parsedWorkflow.value = JSON.parse(item.content)
    workflowSnapshot.value = JSON.stringify(parsedWorkflow.value)
    resetStepEditorState()
  } catch {
    parsedWorkflow.value = null
    workflowSnapshot.value = ''
  }
}

const fetchScripts = async () => {
  try {
    const res = await ipc.invoke<AutomationScriptRecord[]>(AUTOMATION_SCRIPT_EVENTS.GET_SCRIPTS)
    if (res.success) {
      scripts.value = res.data || []
      if (scripts.value.length > 0) {
        handleSelectScript(scripts.value[0])
      } else {
        selectedScript.value = null
        parsedWorkflow.value = null
      }
    }
  } catch {
    ElMessage.error(t('aiWorkflow.scriptLibrary.fetchFailed'))
  }
}

const handleDelete = async (item: AutomationScriptRecord) => {
  try {
    await ElMessageBox.confirm(
      t('aiWorkflow.scriptLibrary.deleteConfirm', { name: item.name }),
      t('aiWorkflow.scriptLibrary.deleteConfirmTitle'),
      {
        confirmButtonText: t('aiWorkflow.scriptLibrary.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )

    const res = await ipc.invoke(AUTOMATION_SCRIPT_EVENTS.DELETE_SCRIPT, item.id)
    if (res.success) {
      ElMessage.success(t('aiWorkflow.scriptLibrary.deleteSuccess'))
      await fetchScripts()
      if (selectedScript.value?.id === item.id) {
        selectedScript.value = null
        parsedWorkflow.value = null
      }
    } else {
      ElMessage.error(t('aiWorkflow.scriptLibrary.deleteFailed'))
    }
  } catch {
    // Cancelled
  }
}

const handleRename = async (item: AutomationScriptRecord) => {
  try {
    const { value } = await ElMessageBox.prompt(
      t('aiWorkflow.scriptLibrary.renamePrompt', { max: MAX_SCRIPT_NAME_LENGTH }),
      t('aiWorkflow.scriptLibrary.renameTitle'),
      {
        inputValue: item.name,
        inputPlaceholder: t('aiWorkflow.scriptLibrary.renamePlaceholder', {
          max: MAX_SCRIPT_NAME_LENGTH
        }),
        inputValidator: (val) => {
          const trimmed = (val || '').trim()
          if (!trimmed) return t('aiWorkflow.scriptLibrary.nameEmpty')
          if (Array.from(trimmed).length > MAX_SCRIPT_NAME_LENGTH) {
            return t('aiWorkflow.scriptLibrary.nameTooLong', { max: MAX_SCRIPT_NAME_LENGTH })
          }
          return true
        }
      }
    )

    const normalizedName = (value || '').trim()
    if (normalizedName && normalizedName !== item.name) {
      // Parse current content to update name inside workflow
      let workflow: WorkflowScript
      try {
        workflow = JSON.parse(item.content)
        workflow.name = normalizedName
      } catch {
        ElMessage.error(t('aiWorkflow.scriptLibrary.parseFailed'))
        return
      }

      const res = await ipc.invoke(AUTOMATION_SCRIPT_EVENTS.SAVE_SCRIPT, {
        id: item.id,
        name: normalizedName,
        workflow
      })

      if (res.success) {
        ElMessage.success(t('aiWorkflow.scriptLibrary.renameSuccess'))
        await fetchScripts()
        // Update selected script if it's the one renamed
        if (selectedScript.value?.id === item.id) {
          selectedScript.value = {
            ...item,
            name: normalizedName,
            content: JSON.stringify(workflow)
          }
          parsedWorkflow.value = workflow
          workflowSnapshot.value = JSON.stringify(workflow)
          resetStepEditorState()
        }
      } else {
        ElMessage.error(t('aiWorkflow.scriptLibrary.renameFailed'))
      }
    }
  } catch {
    // Cancelled
  }
}

const formatTime = (ts: number) => moment(ts).format('YYYY-MM-DD HH:mm:ss')

function isStepEditorExpanded(stepId: string): boolean {
  return !!expandedStepEditors.value[stepId]
}

function toggleStepEditor(stepId: string): void {
  expandedStepEditors.value[stepId] = !expandedStepEditors.value[stepId]
}

function resetStepEditorState(): void {
  expandedStepEditors.value = {}
}

const canEditActionParams = computed(() => {
  return !!parsedWorkflow.value && !isSaving.value
})

const getLoopCount = (loop: any) => {
  if (!loop) return '0'
  if (loop.max_count === -1 || loop.count === -1) return t('aiWorkflow.page.infinite')
  return loop.max_count || loop.count || '0'
}

type EditableParamType = 'string' | 'number' | 'boolean'

interface EditableParamEntry {
  keyPath: string
  label: string
  value: string | number | boolean
  valueType: EditableParamType
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

const handleSaveWorkflow = async () => {
  if (!selectedScript.value || !parsedWorkflow.value || !isWorkflowDirty.value || isSaving.value) {
    return
  }

  isSaving.value = true
  try {
    const cleanWorkflow = JSON.parse(JSON.stringify(parsedWorkflow.value))
    cleanWorkflow.name = selectedScript.value.name

    const res = await ipc.invoke(AUTOMATION_SCRIPT_EVENTS.SAVE_SCRIPT, {
      id: selectedScript.value.id,
      name: selectedScript.value.name,
      workflow: cleanWorkflow
    })

    if (!res.success) {
      throw new Error(res.error || t('aiWorkflow.scriptLibrary.saveFailed'))
    }

    // 更新本地数据
    const updatedContent = JSON.stringify(cleanWorkflow)
    selectedScript.value = {
      ...selectedScript.value,
      content: updatedContent
    }
    const idx = scripts.value.findIndex((item) => item.id === selectedScript.value?.id)
    if (idx >= 0) {
      scripts.value[idx] = { ...scripts.value[idx], content: updatedContent }
    }

    workflowSnapshot.value = JSON.stringify(cleanWorkflow)
    ElMessage.success(t('aiWorkflow.scriptLibrary.saveSuccess'))
  } catch (error: any) {
    ElMessage.error(
      t('aiWorkflow.scriptLibrary.saveFailedWithError', {
        error: error.message || t('aiWorkflow.scriptLibrary.unknownError')
      })
    )
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped lang="scss">
.script-library-dialog {
  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 0;

  .header-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.library-container {
  display: flex;
  height: 500px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.library-sidebar {
  width: 280px;
  border-right: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  background-color: var(--el-fill-color-light);

  .sidebar-search {
    padding: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background-color: var(--el-bg-color);
  }

  .script-list-container {
    flex: 1;
    overflow: hidden;
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
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    margin-bottom: 4px;

    &:hover {
      background-color: var(--el-fill-color);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      .item-actions {
        opacity: 1;
      }
    }

    &.active {
      background-color: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-7);
      box-shadow: none;

      .item-icon {
        background-color: var(--el-color-primary);
        color: #fff;
      }

      .item-content {
        .item-name {
          color: var(--el-color-primary);
          font-weight: 600;
        }
      }
    }

    .item-icon {
      width: 36px;
      height: 36px;
      background-color: var(--el-fill-color-darker);
      color: var(--el-text-color-secondary);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
      font-size: 16px;
    }

    .item-content {
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

      .item-time {
        font-size: 11px;
        color: var(--el-text-color-secondary);
        margin-top: 2px;
      }
    }

    .item-actions {
      opacity: 0;
      transition: opacity 0.2s;
    }
  }

  .empty-list {
    padding: 40px 0;
    display: flex;
    justify-content: center;
  }
}

.library-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color);
  overflow: hidden;

  .empty-selection {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-placeholder);
    gap: 16px;
  }

  .script-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .preview-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;

    .preview-title {
      display: flex;
      align-items: center;
      gap: 12px;

      .name {
        font-size: 16px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    .preview-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .preview-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;

    .steps-info {
      padding: 10px 20px;
      background-color: var(--el-fill-color-lighter);
      font-size: 12px;
      color: var(--el-text-color-secondary);
      border-bottom: 1px solid var(--el-border-color-lighter);
      flex-shrink: 0;
    }

    .workflow-view {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .step-group {
      background-color: var(--el-bg-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 10px;
      overflow: hidden;
      transition: all 0.2s ease;

      .step-group-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 10px 12px;
        background-color: var(--el-fill-color-lighter);
        border-bottom: 1px solid var(--el-border-color-lighter);
        transition: background-color 0.2s;

        .step-group-index {
          width: 22px;
          height: 22px;
          background: var(--el-color-primary);
          color: var(--el-color-white);
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
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: var(--el-bg-color);

        .action-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 8px 10px;
          position: relative;
          border-radius: 8px;
          border: 1px solid var(--el-border-color-lighter);
          transition: all 0.2s ease;

          &:hover {
            border-color: var(--el-color-primary-light-7);
            background-color: var(--el-color-primary-light-9);
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
            right: 10px;
            margin-top: 0;
            display: flex;
            align-items: center;
            z-index: 1;
          }
        }
      }
    }

    .empty-preview {
      padding: 40px;
      text-align: center;
      color: var(--el-text-color-secondary);
    }
  }
}
</style>
