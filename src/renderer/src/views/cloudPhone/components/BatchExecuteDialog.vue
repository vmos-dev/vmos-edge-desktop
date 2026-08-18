<script setup lang="ts">
import { ref, computed, watch, toRaw, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { invoke } from '@renderer/core/ipc'
import { BATCH_TASK_EVENTS } from '@shared/ipc/batchTask.types'
import type { CreateBatchTaskPayload } from '@shared/ipc/batchTask.types'
import { WORKFLOW_EVENTS } from '@shared/ipc/workflow.types'
import type { Workflow } from '@shared/ipc/workflow.types'
import type { Device } from '@shared/ipc/data.types'
import { extractVariableNames } from '../utils/yamlVariableExtractor'
import WorkflowSelectStep from './WorkflowSelectStep.vue'
import ParamConfigStep from './ParamConfigStep.vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  selectedDevices: Device[]
}>()

const emit = defineEmits<{
  executed: [batchTaskId: string]
}>()

const open = defineModel<boolean>({ default: false })

const { t } = useI18n()

const currentStep = shallowRef(0)
const selectedWorkflowId = shallowRef<string | null>(null)
const selectedWorkflow = ref<Workflow | null>(null)
const variableNames = ref<string[]>([])
const paramMap = ref<Map<string, Record<string, string>>>(new Map())
const taskName = shallowRef('')
const submitting = shallowRef(false)

const stepLabels = computed(() => [
  t('taskCenter.batchExecute.selectWorkflow'),
  t('taskCenter.batchExecute.configParams'),
  t('taskCenter.batchExecute.confirm')
])

const hasParams = computed(() => variableNames.value.length > 0)

const canNext = computed(() => {
  if (currentStep.value === 0) return !!selectedWorkflowId.value
  return true
})

watch(open, (val) => {
  if (val) {
    currentStep.value = 0
    selectedWorkflowId.value = null
    selectedWorkflow.value = null
    taskName.value = ''
    variableNames.value = []
    paramMap.value = new Map()
  }
})

function getDeviceBaseUrl(dev: Device): string {
  const isMacvlan = dev.network_mode === 'macvlan' || (dev as any).is_macvlan === true
  if (isMacvlan) return `http://${dev.ip}:18185/api`
  return `http://${dev.host_ip}:18182/android_api/v2/${dev.id}`
}

async function handleNext() {
  if (currentStep.value === 0) {
    if (!selectedWorkflowId.value) return
    const resp = await invoke<Workflow>(WORKFLOW_EVENTS.GET, selectedWorkflowId.value)
    if (!resp.success || !resp.data) {
      ElMessage.error(resp.error ?? 'Failed to load workflow')
      return
    }
    selectedWorkflow.value = resp.data
    const yaml = resp.data.yamlText ?? ''
    variableNames.value = extractVariableNames(yaml)
    currentStep.value = hasParams.value ? 1 : 2
    return
  }
  if (currentStep.value === 1) {
    currentStep.value = 2
    return
  }
  if (currentStep.value === 2) {
    await handleSubmit()
  }
}

function handlePrev() {
  if (currentStep.value === 2 && !hasParams.value) {
    currentStep.value = 0
  } else {
    currentStep.value = Math.max(0, currentStep.value - 1)
  }
}

async function handleSubmit() {
  if (!selectedWorkflow.value) return
  submitting.value = true
  try {
    const wf = selectedWorkflow.value
    const payload: CreateBatchTaskPayload = {
      name: taskName.value.trim() || undefined,
      workflowId: wf.id,
      workflowName: wf.name,
      appId: wf.appId,
      appName: wf.appName,
      yamlText: wf.yamlText ?? '',
      devices: props.selectedDevices.map((d) => {
        const raw = toRaw(d)
        const env = paramMap.value.get(raw.id)
        return {
          id: raw.id,
          name: raw.user_name ?? raw.id,
          hostIp: raw.host_ip ?? '',
          baseUrl: getDeviceBaseUrl(raw),
          env: env ? { ...env } : undefined
        }
      })
    }
    const resp = await invoke<{ batchTaskId: string }>(BATCH_TASK_EVENTS.CREATE, payload)
    if (resp.success && resp.data) {
      open.value = false
      emit('executed', resp.data.batchTaskId)
    } else {
      ElMessage.error(resp.error ?? 'Create batch task failed')
    }
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  open.value = false
}
</script>

<template>
  <VmosDialog
    v-model="open"
    :title="t('taskCenter.batchExecute.title')"
    width="640px"
    @close="handleClose"
  >
    <div class="wizard-nav">
      <div
        v-for="(label, idx) in stepLabels"
        :key="idx"
        class="nav-item"
        :class="{
          active: idx === currentStep,
          done: idx < currentStep,
          hidden: idx === 1 && !hasParams
        }"
      >
        <span class="nav-dot" />
        <span class="nav-label">{{ label }}</span>
      </div>
    </div>

    <div class="wizard-body">
      <WorkflowSelectStep v-if="currentStep === 0" v-model="selectedWorkflowId" />
      <ParamConfigStep
        v-if="currentStep === 1"
        :devices="selectedDevices"
        :variable-names="variableNames"
        v-model="paramMap"
      />

      <div v-if="currentStep === 2" class="confirm-view">
        <div class="confirm-field">
          <div class="field-label">{{ t('taskCenter.table.name') }}</div>
          <el-input
            v-model="taskName"
            :placeholder="selectedWorkflow?.name"
            maxlength="60"
            clearable
          />
        </div>

        <div class="confirm-overview">
          <div class="overview-item">
            <div class="overview-label">{{ t('taskCenter.table.workflow') }}</div>
            <div class="overview-value">{{ selectedWorkflow?.name }}</div>
          </div>
          <div class="overview-item overview-right">
            <div class="overview-label">{{ t('taskCenter.table.devices') }}</div>
            <div class="overview-value">{{ selectedDevices.length }}</div>
          </div>
          <div v-if="hasParams" class="overview-item overview-right">
            <div class="overview-label">{{ t('taskCenter.batchExecute.configParams') }}</div>
            <div class="overview-value">{{ variableNames.length }}</div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="wizard-footer">
        <div class="footer-meta" v-if="currentStep === 2">
          {{ selectedDevices.length }} {{ t('taskCenter.table.devices') }}
        </div>
        <div class="footer-spacer" />
        <el-button v-if="currentStep > 0" @click="handlePrev">
          {{ t('taskCenter.batchExecute.prev') }}
        </el-button>
        <el-button v-if="currentStep < 2" type="primary" :disabled="!canNext" @click="handleNext">
          {{ t('taskCenter.batchExecute.next') }}
        </el-button>
        <el-button
          v-if="currentStep === 2"
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ t('taskCenter.batchExecute.startExecute') }}
        </el-button>
      </div>
    </template>
  </VmosDialog>
</template>

<style scoped>
.wizard-nav {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-item.hidden {
  display: none;
}

.nav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-border-color);
  transition: all 0.2s;
  flex-shrink: 0;
}

.nav-item.active .nav-dot {
  background: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-8);
}

.nav-item.done .nav-dot {
  background: var(--el-color-success);
}

.nav-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-disabled);
  transition: color 0.2s;
}

.nav-item.active .nav-label {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.nav-item.done .nav-label {
  color: var(--el-text-color-secondary);
}

.wizard-body {
  min-height: 340px;
}

/* ── 确认 ── */
.confirm-view {
  padding: 4px 0;
}

.confirm-field {
  margin-bottom: 20px;
}

.field-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
  font-weight: 500;
}

.confirm-overview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.overview-item {
  min-width: 0;
}

.overview-right {
  text-align: right;
  flex-shrink: 0;
}

.overview-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.overview-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 底栏 ── */
.wizard-footer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.footer-spacer {
  flex: 1;
}
</style>
