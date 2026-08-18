<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElForm, ElMessage, ElMessageBox } from 'element-plus'
import {
  CircleCloseFilled,
  Connection,
  InfoFilled,
  Loading,
  QuestionFilled,
  SuccessFilled
} from '@element-plus/icons-vue'
import ProxyFormFields from '@renderer/components/proxy/ProxyFormFields.vue'
import DeviceProxyMapping from './DeviceProxyMapping.vue'
import {
  createDefaultCustomProxyForm,
  type CustomProxyFormModel,
  type ParsedProxyResult
} from '@renderer/components/proxy/customProxyTypes'
import { buildApiUrl, API_CONFIG, getErrorMessage, request } from '@shared/api'
import { type Device, type Proxy } from '@shared/ipc/data.types'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import { ipc } from '@renderer/core/ipc'
import { RequestQueue, type RequestTask } from '@renderer/utils/requestQueue'
import { ProxyCheckStrategyList } from '@renderer/utils/constant'
import { useI18n } from 'vue-i18n'
import {
  applyProxyToDevice,
  closeProxyForDevice,
  createDefaultProxyForm,
  fetchProxyCheckStrategy,
  fetchProxyList,
  type ProxyFormModel,
  updateProxyCheckStrategy,
  buildCustomProxyPayload,
  runCustomProxyCheck,
  saveCustomProxyWithToast
} from '../services/proxyService'

type BatchProxyMode = 'set' | 'close'
type AssignMode = 'uniform' | 'one-to-one'

const { t } = useI18n()
const router = useRouter()

const visible = ref(false)
const mode = ref<BatchProxyMode>('set')
const devices = ref<Device[]>([])
const proxyList = ref<Proxy[]>([])
const proxyForm = ref<ProxyFormModel>(createDefaultProxyForm())
const formRef = ref<InstanceType<typeof ElForm>>()
const checkStrategy = ref('default')
const testResult = ref<{ success: boolean; data?: any; error?: string } | null>(null)
const isExecuted = ref(false)
const activeNames = ref<number[]>([])
const isProcessing = ref(false)
const isRestart = ref(false)
const checking = ref(false)
const taskList = ref<RequestTask[]>([])
const proxyMode = ref<'select' | 'custom'>('select')
const customProxyForm = ref<CustomProxyFormModel>(createDefaultCustomProxyForm())
const customProxyInfo = ref<Record<string, any> | null>(null)
const assignMode = ref<AssignMode>('uniform')
const deviceProxyMap = ref<Record<string, string>>({})
const checkingDevices = ref(new Set<string>())

const queue = new RequestQueue({ concurrency: 5 })

const isSetMode = computed(() => mode.value === 'set')
const isOneToOne = computed(() => assignMode.value === 'one-to-one')
const showAssignModeSwitch = computed(() => isSetMode.value && proxyMode.value === 'select')
const hasExitInfo = computed(() => {
  if (isOneToOne.value) return true
  if (proxyMode.value === 'custom') return !!testResult.value?.success
  const p = proxyList.value.find((item) => item.id === proxyForm.value.id)
  return !!(p && (p.ip || p.country || p.timezone || p.loc))
})
const ipSimulatorEffective = computed(
  () => proxyForm.value.ipSimulatorDisabled && hasExitInfo.value
)
const showRestartSwitch = computed(() => isSetMode.value && ipSimulatorEffective.value)
const showExecutionResult = computed(() => isExecuted.value || taskList.value.length > 0)
const isFormReadonly = computed(() => isProcessing.value || isExecuted.value)
const dialogTitle = computed(() =>
  isSetMode.value ? t('cloudPhone.batchSetProxyTitle') : t('cloudPhone.batchCloseProxyTitle')
)
const resultTitle = computed(() =>
  isSetMode.value
    ? t('cloudPhone.batchSetProxyResultTitle')
    : t('cloudPhone.batchCloseProxyResultTitle')
)
const deviceCount = computed(() => devices.value.length)
const selectedProxy = computed(() => proxyList.value.find((item) => item.id === proxyForm.value.id))
const taskSummary = computed(() => ({
  processing: taskList.value.filter((task) => task.status === 'processing').length,
  success: taskList.value.filter((task) => task.status === 'success').length,
  error: taskList.value.filter((task) => task.status === 'error' || task.status === 'cancelled')
    .length,
  waiting: taskList.value.filter((task) => task.status === 'waiting').length
}))

const handleAssignModeChange = (val: AssignMode) => {
  assignMode.value = val
  testResult.value = null
  deviceProxyMap.value = {}
  checkingDevices.value = new Set()
  Object.assign(proxyForm.value, createDefaultProxyForm())
  proxyForm.value.ipSimulatorDisabled = false
  isRestart.value = false
  proxyMode.value = 'select'
  customProxyForm.value = createDefaultCustomProxyForm()
  customProxyInfo.value = null
  formRef.value?.clearValidate()
}

const allDevicesAssigned = computed(() => {
  if (!isOneToOne.value) return true
  return devices.value.every((device) => !!deviceProxyMap.value[device.db_id || ''])
})

const rules = computed(() => ({
  // engineType: [{ required: true, message: t('cloudPhone.engineType'), trigger: 'change' }],
  id:
    isSetMode.value && !isOneToOne.value
      ? [{ required: true, message: t('cloudPhone.selectProxyPlaceholder'), trigger: 'change' }]
      : [],
  transferAgentId: proxyForm.value.isTransferAgent
    ? [{ required: true, message: t('cloudPhone.selectTransferAgent'), trigger: 'change' }]
    : []
}))

queue.on('change', (list) => {
  taskList.value = [...list]
})

queue.on('finish', () => {
  if (!isProcessing.value) return

  const success = taskList.value.filter((task) => task.status === 'success').length
  const fail = taskList.value.filter(
    (task) => task.status === 'error' || task.status === 'cancelled'
  ).length

  if (fail > 0) {
    ElMessage.warning(t('cloudPhone.executeCompleted', { success, fail }))
    activeNames.value = taskList.value
      .filter((task) => task.status === 'error' || task.status === 'cancelled')
      .map((task) => task.id)
  } else if (isSetMode.value) {
    ElMessage.success(t('cloudPhone.batchSetProxyCompleted', { success }))
  } else {
    ElMessage.success(t('cloudPhone.batchCloseProxyCompleted', { success }))
  }

  isProcessing.value = false
})

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'processing':
      return Loading
    case 'success':
      return SuccessFilled
    case 'error':
    case 'cancelled':
      return CircleCloseFilled
    default:
      return Loading
  }
}

const getStatusIconClass = (status: string) => {
  return `status-icon status-icon-${status === 'waiting' ? 'loading' : status}`
}

const getResultClass = (status: string) => {
  return `result-item result-item-${status === 'waiting' ? 'loading' : status}`
}

const resetFormState = () => {
  Object.assign(proxyForm.value, createDefaultProxyForm())
  isRestart.value = false
  testResult.value = null
  formRef.value?.clearValidate()
  proxyMode.value = 'select'
  customProxyForm.value = createDefaultCustomProxyForm()
  customProxyInfo.value = null
  assignMode.value = 'uniform'
  deviceProxyMap.value = {}
  checkingDevices.value = new Set()
}

const resetExecutionState = () => {
  queue.clearAllTasks()
  isExecuted.value = false
  activeNames.value = []
  isProcessing.value = false
}

const handleClose = () => {
  resetExecutionState()
  resetFormState()
  checking.value = false
  devices.value = []
  proxyList.value = []
  checkStrategy.value = 'default'
  visible.value = false
}

const handleCancel = () => {
  visible.value = false
}

const handleReset = () => {
  if (isProcessing.value) return
  resetExecutionState()
  testResult.value = null
}

const handleProxyLinkClick = () => {
  visible.value = false
  router.push('/proxy')
}

const handleProxyChange = () => {
  testResult.value = null
}

const handleIpSimulatorChange = (value: boolean) => {
  if (!value) {
    isRestart.value = false
  }
}

const handleCheckProxy = async () => {
  if (!isSetMode.value || checking.value || isProcessing.value) return

  if (proxyMode.value === 'custom') {
    const parsed = customProxyForm.value.parsed
    if (!parsed) {
      ElMessage.warning(t('cloudPhone.fillRequiredFields'))
      return
    }
    checking.value = true
    testResult.value = null
    try {
      const result = await runCustomProxyCheck(parsed, proxyForm.value, proxyList.value)
      testResult.value = result
      if (result.success) {
        customProxyInfo.value = result.data || null
      }
    } finally {
      checking.value = false
    }
    return
  }

  try {
    await formRef.value?.validateField('id')
    if (proxyForm.value.isTransferAgent) {
      await formRef.value?.validateField('transferAgentId')
    }
  } catch {
    ElMessage.warning(t('cloudPhone.fillRequiredFields'))
    return
  }

  checking.value = true
  testResult.value = null

  try {
    const proxies: Array<Record<string, any>> = []

    if (proxyForm.value.isTransferAgent && proxyForm.value.transferAgentId) {
      const transferAgent = proxyList.value.find(
        (item) => item.id === proxyForm.value.transferAgentId
      )
      if (transferAgent) {
        proxies.push({
          protocol: transferAgent.protocol,
          host: transferAgent.host,
          port: transferAgent.port,
          username: transferAgent.username || undefined,
          password: transferAgent.password || undefined,
          rawLink: transferAgent.rawLink || undefined
        })
      }
    }

    const proxy = selectedProxy.value
    if (proxy) {
      proxies.push({
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
        rawLink: proxy.rawLink || undefined
      })
    }

    const res = await ipc.invoke<any>(
      PROXY_EVENTS.CHECK_PROXY,
      proxies.length > 1 ? proxies : proxies[0]
    )

    if (res.success) {
      testResult.value = { success: true, data: res?.data?.data || {} }
      compareProxyInfo(res?.data?.data || {})
    } else {
      testResult.value = { success: false, error: res.error || t('cloudPhone.testProxyFailed') }
    }
  } finally {
    checking.value = false
  }
}

const compareProxyInfo = (data: Record<string, any>) => {
  if (!selectedProxy.value) return

  if (
    (data?.ip && data.ip !== selectedProxy.value.ip) ||
    (data?.country && data.country !== selectedProxy.value.country) ||
    (data?.timezone && data.timezone !== selectedProxy.value.timezone) ||
    (data?.loc && data.loc !== selectedProxy.value.loc)
  ) {
    ElMessageBox.confirm(t('cloudPhone.proxyExitInfoChanged'), t('common.tips'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }).then(async () => {
      const currentProxy = selectedProxy.value
      if (!currentProxy) return

      const updatedProxy = {
        ...currentProxy,
        ip: data?.ip || currentProxy.ip,
        country: data?.country || currentProxy.country,
        timezone: data?.timezone || currentProxy.timezone,
        loc: data?.loc || currentProxy.loc,
        lastCheckStatus: 'success'
      }

      const res = await ipc.invoke(PROXY_EVENTS.UPDATE_PROXY, {
        id: currentProxy.id,
        isCheck: false,
        updates: updatedProxy
      })

      if (res.success) {
        proxyList.value = proxyList.value.map((item) =>
          item.id === currentProxy.id ? ({ ...item, ...updatedProxy } as Proxy) : item
        )
        ElMessage.success(t('cloudPhone.updateProxyExitInfoSuccess'))
      }
    })
  }
}

const handleCheckDeviceProxy = async (deviceDbId: string, proxyId: string) => {
  if (checkingDevices.value.has(deviceDbId)) return

  const proxy = proxyList.value.find((item) => item.id === proxyId)
  if (!proxy) return

  const next = new Set(checkingDevices.value)
  next.add(deviceDbId)
  checkingDevices.value = next

  try {
    const checkPayload: Record<string, any> = {
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username || undefined,
      password: proxy.password || undefined,
      rawLink: proxy.rawLink || undefined
    }

    const res = await ipc.invoke<any>(PROXY_EVENTS.CHECK_PROXY, checkPayload)

    if (res.success) {
      const data = res?.data?.data || {}
      const hasChanged =
        (data.ip && data.ip !== proxy.ip) ||
        (data.country && data.country !== proxy.country) ||
        (data.timezone && data.timezone !== proxy.timezone) ||
        (data.loc && data.loc !== proxy.loc)

      if (hasChanged) {
        const updatedProxy = {
          ...proxy,
          ip: data.ip || proxy.ip,
          country: data.country || proxy.country,
          timezone: data.timezone || proxy.timezone,
          loc: data.loc || proxy.loc,
          lastCheckStatus: 'success' as const
        }

        await ipc.invoke(PROXY_EVENTS.UPDATE_PROXY, {
          id: proxy.id,
          isCheck: false,
          updates: updatedProxy
        })

        proxyList.value = proxyList.value.map((item) =>
          item.id === proxy.id ? ({ ...item, ...updatedProxy } as Proxy) : item
        )
      }

      ElMessage.success(t('cloudPhone.testPassed'))
    } else {
      ElMessage.error(res.error || t('cloudPhone.testProxyFailed'))
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error) || t('cloudPhone.testProxyFailed'))
  } finally {
    const after = new Set(checkingDevices.value)
    after.delete(deviceDbId)
    checkingDevices.value = after
  }
}

const handleCheckStrategyChange = () => {
  updateProxyCheckStrategy(checkStrategy.value).catch((error) => {
    ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
  })
}

const loadSetModeResources = async () => {
  const [proxies, strategy] = await Promise.all([fetchProxyList(), fetchProxyCheckStrategy()])
  proxyList.value = proxies
  checkStrategy.value = strategy
}

const enqueueSetProxyTasks = (
  formSnapshot: ProxyFormModel,
  proxySnapshot: Proxy[],
  isRestartSnapshot: boolean,
  proxyMapSnapshot?: Record<string, string>
) => {
  devices.value.forEach((device) => {
    const deviceForm = proxyMapSnapshot
      ? { ...formSnapshot, id: proxyMapSnapshot[device.db_id || ''] || formSnapshot.id }
      : formSnapshot

    queue.add({
      url: buildApiUrl(device.host_ip || '', `${API_CONFIG.PATHS.SET_PROXY}/${device.db_id || ''}`),
      method: 'POST',
      meta: { device },
      executor: async () => {
        const result = await applyProxyToDevice({
          device,
          form: deviceForm,
          proxyList: proxySnapshot,
          parseConfigFailedMessage: t('proxy.parseConfigFailed'),
          successMessage: t('cloudPhone.proxySetSuccess'),
          restartMessage: t('cloudPhone.proxySetSuccess'),
          restartFailedMessage: t('cloudPhone.restartFailed'),
          ipSimulatorMode: 'custom-params',
          extraDataKey: 'extraData',
          isRestart: isRestartSnapshot
        })

        return {
          message: result.message
        }
      }
    })
  })
}

const enqueueCloseProxyTasks = () => {
  devices.value.forEach((device) => {
    queue.add({
      url: buildApiUrl(
        device.host_ip || '',
        `${API_CONFIG.PATHS.CLOSE_PROXY}/${device.db_id || ''}`
      ),
      method: 'GET',
      meta: { device },
      executor: async () => closeProxyForDevice(device, t('cloudPhone.proxyCloseSuccess'))
    })
  })
}

const enqueueCustomProxyTasks = (
  parsed: ParsedProxyResult,
  formSnapshot: ProxyFormModel,
  proxyInfoSnapshot: Record<string, any> | null,
  isRestartSnapshot: boolean
) => {
  const params = buildCustomProxyPayload(
    parsed,
    formSnapshot,
    proxyInfoSnapshot,
    {
      ipSimulatorMode: 'custom-params',
      extraDataKey: 'extraData',
      isRestart: isRestartSnapshot
    },
    t('proxy.parseConfigFailed'),
    proxyList.value
  )

  devices.value.forEach((device) => {
    queue.add({
      url: buildApiUrl(device.host_ip || '', `${API_CONFIG.PATHS.SET_PROXY}/${device.db_id || ''}`),
      method: 'POST',
      meta: { device },
      executor: async () => {
        await request.post(
          buildApiUrl(device.host_ip || '', `${API_CONFIG.PATHS.SET_PROXY}/${device.db_id || ''}`),
          params,
          { timeout: 2 * 60 * 1000 }
        )
        return { message: t('cloudPhone.proxySetSuccess') }
      }
    })
  })
}

const handleSubmit = async () => {
  if (checking.value || isProcessing.value) return

  if (isSetMode.value) {
    if (proxyMode.value === 'select') {
      if (isOneToOne.value) {
        // 一对一模式：校验所有设备是否都已分配代理
        if (!allDevicesAssigned.value) {
          ElMessage.warning(t('cloudPhone.batchProxyNotAllAssigned'))
          return
        }
      } else {
        try {
          await formRef.value?.validate()
        } catch {
          return
        }
      }
    } else {
      // 自定义模式只校验解析状态
      if (!customProxyForm.value.parsed) {
        ElMessage.warning(t('cloudPhone.parseFailed'))
        return
      }
    }
  }

  resetExecutionState()
  isExecuted.value = true
  isProcessing.value = true

  if (isSetMode.value) {
    if (proxyMode.value === 'custom') {
      if (!customProxyForm.value.parsed) {
        ElMessage.warning(t('cloudPhone.parseFailed'))
        return
      }
      enqueueCustomProxyTasks(
        customProxyForm.value.parsed,
        { ...proxyForm.value },
        customProxyInfo.value,
        proxyForm.value.ipSimulatorDisabled ? isRestart.value : false
      )
      saveCustomProxyWithToast(
        customProxyForm.value,
        customProxyForm.value.parsed,
        t('cloudPhone.proxySavedButFailed')
      )
    } else {
      enqueueSetProxyTasks(
        { ...proxyForm.value },
        [...proxyList.value],
        proxyForm.value.ipSimulatorDisabled ? isRestart.value : false,
        isOneToOne.value ? { ...deviceProxyMap.value } : undefined
      )
    }
  } else {
    enqueueCloseProxyTasks()
  }
}

const init = async (targetMode: BatchProxyMode, targetDevices: Device[]) => {
  resetExecutionState()
  resetFormState()
  mode.value = targetMode
  devices.value = targetDevices
  proxyList.value = []
  checkStrategy.value = 'default'

  if (targetMode === 'set') {
    try {
      await loadSetModeResources()
    } catch (error) {
      ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
      return
    }
  }

  visible.value = true
}

defineExpose({
  init
})
</script>

<template>
  <vmos-dialog
    v-model="visible"
    :title="dialogTitle"
    width="700px"
    :show-close="!isProcessing && !checking"
    @closed="handleClose"
  >
    <div class="batch-proxy-container">
      <section v-if="showExecutionResult" class="results-container">
        <div class="results-header">
          <div class="results-heading">
            <div class="results-title">{{ resultTitle }}</div>
            <div class="results-subtitle">{{ t('cloudPhone.batchProxyResultTip') }}</div>
          </div>

          <div class="queue-status queue-status-card">
            <div class="status-item processing">
              <span class="dot"></span>
              <span class="label">{{ t('cloudPhone.executing') }}</span>
              <span class="count">{{ taskSummary.processing }}</span>
            </div>
            <div class="status-item success">
              <span class="dot"></span>
              <span class="label">{{ t('cloudPhone.executeSuccess') }}</span>
              <span class="count">{{ taskSummary.success }}</span>
            </div>
            <div class="status-item error">
              <span class="dot"></span>
              <span class="label">{{ t('cloudPhone.executeFailed') }}</span>
              <span class="count">{{ taskSummary.error }}</span>
            </div>
            <div class="status-item waiting">
              <span class="dot"></span>
              <span class="label">{{ t('cloudPhone.waiting') }}</span>
              <span class="count">{{ taskSummary.waiting }}</span>
            </div>
          </div>
        </div>

        <el-scrollbar max-height="360px">
          <el-collapse v-model="activeNames" class="results-collapse">
            <el-collapse-item
              v-for="(task, index) in taskList"
              :key="task.id"
              :name="task.id"
              :class="getResultClass(task.status)"
              style="padding-bottom: 0px"
            >
              <template #title>
                <div class="result-item-title">
                  <span class="result-index">{{ index + 1 }}.</span>
                  <el-icon :class="getStatusIconClass(task.status)">
                    <component :is="getStatusIcon(task.status)" />
                  </el-icon>
                  <span class="device-info">
                    {{ task.meta?.device?.user_name }} - {{ task.meta?.device?.db_id }}
                  </span>
                  <span v-if="task.status === 'processing'" class="status-text">{{
                    t('cloudPhone.executing')
                  }}</span>
                  <span v-else-if="task.status === 'success'" class="status-text success">
                    {{ t('cloudPhone.executeSuccess') }}
                  </span>
                  <span
                    v-else-if="task.status === 'error' || task.status === 'cancelled'"
                    class="status-text error"
                  >
                    {{ t('cloudPhone.executeFailed') }}
                  </span>
                  <span v-else class="status-text">{{ t('common.waiting') }}</span>
                </div>
              </template>

              <div class="result-content">
                <div v-if="task.error" class="error-message">
                  <pre>{{ getErrorMessage(task.error) }}</pre>
                </div>
                <div v-else-if="task.data?.message" class="success-message">
                  <pre>{{ task.data.message }}</pre>
                </div>
                <div v-else class="empty-message">{{ t('cloudPhone.noOutput') }}</div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-scrollbar>
      </section>

      <el-form
        v-if="isSetMode && !showExecutionResult"
        ref="formRef"
        :model="proxyForm"
        :rules="rules"
        label-position="top"
        class="proxy-form"
        @submit.prevent
      >
        <!-- 分配模式切换 -->
        <div v-if="showAssignModeSwitch" class="assign-mode-bar">
          <el-radio-group
            :model-value="assignMode"
            size="small"
            :disabled="isFormReadonly"
            @update:model-value="handleAssignModeChange($event as AssignMode)"
          >
            <el-radio-button value="uniform">{{
              t('cloudPhone.batchProxyAssignUniform')
            }}</el-radio-button>
            <el-radio-button value="one-to-one">{{
              t('cloudPhone.batchProxyAssignOneToOne')
            }}</el-radio-button>
          </el-radio-group>
          <span class="assign-mode-count">{{
            t('cloudPhone.batchProxyDeviceCount', { count: deviceCount })
          }}</span>
        </div>

        <!-- 一对一映射表 -->
        <DeviceProxyMapping
          v-if="isOneToOne"
          v-model="deviceProxyMap"
          :devices="devices"
          :proxy-list="proxyList"
          :disabled="isFormReadonly"
          :checking-set="checkingDevices"
          @check-proxy="handleCheckDeviceProxy"
        />

        <!-- 代理表单（统一模式显示完整，一对一模式隐藏代理来源只保留网络设置） -->
        <ProxyFormFields
          :form="proxyForm"
          :proxy-list="proxyList"
          :disabled="isFormReadonly"
          :test-result="testResult"
          :checking="checking"
          :check-strategy="checkStrategy"
          :proxy-mode="proxyMode"
          :custom-form="customProxyForm"
          :hide-proxy-source="isOneToOne"
          @update:form="proxyForm = $event"
          @manage-proxy="handleProxyLinkClick"
          @proxy-change="handleProxyChange"
          @ip-simulator-change="handleIpSimulatorChange"
          @update:proxy-mode="proxyMode = $event"
          @update:custom-form="customProxyForm = $event"
          @parse-success="
            () => {
              testResult = null
            }
          "
          @parse-fail="
            () => {
              testResult = null
            }
          "
          @mode-change="
            () => {
              testResult = null
              proxyForm.ipSimulatorDisabled = false
              isRestart = false
              assignMode = 'uniform'
              deviceProxyMap = {}
              checkingDevices = new Set()
            }
          "
        >
          <template #ip-simulator-extra>
            <div v-if="ipSimulatorEffective" class="ip-simulator-secondary">
              <el-form-item
                v-if="showRestartSwitch"
                label-position="left"
                class="switch-item compact-form-item"
              >
                <template #label>
                  <div class="label-row">
                    {{ t('cloudPhone.batchProxyIsStart') }}&nbsp;
                    <el-tooltip :content="t('cloudPhone.batchProxyIsStartTip')" placement="top">
                      <el-icon class="label-tip-icon" :size="16"><QuestionFilled /></el-icon>
                    </el-tooltip>
                  </div>
                </template>
                <el-switch v-model="isRestart" :disabled="isFormReadonly" />
              </el-form-item>
            </div>
          </template>
        </ProxyFormFields>

        <div class="batch-tip-banner">
          <el-icon><InfoFilled /></el-icon>
          <span>{{
            isOneToOne
              ? t('cloudPhone.batchProxyOneToOneTip', { count: deviceCount })
              : t('cloudPhone.batchProxyTip', { count: deviceCount })
          }}</span>
        </div>
      </el-form>

      <div v-else-if="!showExecutionResult" class="confirm-tip">
        {{ t('cloudPhone.batchCloseProxyConfirm', { count: deviceCount }) }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div v-if="isSetMode && !showExecutionResult && !isOneToOne" class="check-strategy-wrapper">
          <div class="check-strategy-group">
            <span class="check-strategy-label">{{ t('cloudPhone.checkStrategy') }}</span>
            <el-select
              v-model="checkStrategy"
              :placeholder="t('cloudPhone.selectCheckStrategy')"
              size="small"
              :disabled="isFormReadonly"
              style="width: 150px"
              @change="handleCheckStrategyChange"
            >
              <el-option
                v-for="item in ProxyCheckStrategyList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
          <el-button
            size="small"
            plain
            type="primary"
            :loading="checking"
            :disabled="isProcessing || checking || isExecuted"
            @click="handleCheckProxy"
          >
            <el-icon class="el-icon--left"><Connection /></el-icon>
            {{ t('cloudPhone.proxyTest') }}
          </el-button>
        </div>

        <div class="dialog-actions">
          <el-button :disabled="isProcessing || checking" @click="handleCancel">
            {{ isExecuted ? t('cloudPhone.close') : t('common.cancel') }}
          </el-button>
          <el-button
            v-if="!isExecuted"
            type="primary"
            :loading="isProcessing"
            @click="handleSubmit"
          >
            {{ t('common.confirm') }}
          </el-button>
          <el-button v-else type="primary" :disabled="isProcessing" @click="handleReset">
            {{ t('cloudPhone.reExecute') }}
          </el-button>
        </div>
      </div>
    </template>
  </vmos-dialog>
</template>

<style scoped lang="scss">
.batch-proxy-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  scrollbar-gutter: stable;
}

.proxy-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compact-form-item {
  margin-bottom: 0;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.label-tip-icon {
  cursor: help;
  color: var(--el-text-color-secondary);
}

.switch-item {
  :deep(.el-form-item__label) {
    padding-bottom: 0;
    color: var(--el-text-color-primary);
    font-weight: 500;

    &::before {
      display: none !important;
    }
  }

  :deep(.el-form-item__content) {
    min-height: 32px;
    justify-content: flex-start;
  }
}

.ip-simulator-secondary {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

// ── 分配模式 ──
.assign-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.assign-mode-count {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.batch-tip-banner,
.confirm-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--el-color-info-light-9);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.results-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  background: var(--el-bg-color);
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.05);
}

.results-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.results-heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.results-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}

.results-subtitle {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.results-collapse {
  border: none;

  :deep(.el-collapse-item__content) {
    padding-bottom: 0;
  }

  :deep(.el-collapse-item) {
    margin-bottom: 8px;
    overflow: hidden;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;

    &.result-item-loading,
    &.result-item-waiting,
    &.result-item-success {
      background-color: var(--el-color-primary-light-9);
    }

    &.result-item-error,
    &.result-item-cancelled {
      background-color: var(--el-color-danger-light-9);
    }
  }

  :deep(.el-collapse-item__header) {
    height: auto;
    min-height: 36px;
    padding: 8px 10px;
    border: none;
    background-color: transparent;
    line-height: 1.5;
  }

  :deep(.el-collapse-item__wrap) {
    border: none;
    background-color: var(--el-bg-color);
  }
}

.result-item-title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  .result-index {
    min-width: 18px;
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .status-icon {
    font-size: 18px;

    &.status-icon-processing {
      color: var(--el-color-primary);
      animation: rotating 2s linear infinite;
    }

    &.status-icon-success {
      color: var(--el-color-success);
    }

    &.status-icon-error,
    &.status-icon-cancelled {
      color: var(--el-color-danger);
    }

    &.status-icon-loading {
      color: var(--el-text-color-secondary);
    }
  }

  .device-info {
    color: var(--el-text-color-regular);
    font-size: 13px;
  }

  .status-text {
    margin-left: auto;
    margin-right: 8px;
    color: var(--el-text-color-secondary);
    font-size: 12px;

    &.success {
      color: var(--el-color-success);
    }

    &.error {
      color: var(--el-color-danger);
    }
  }
}

.result-content {
  font-size: 13px;

  .error-message {
    pre {
      margin: 0;
      max-height: 300px;
      overflow-y: auto;
      padding: 12px;
      border-top: 1px solid var(--el-color-danger-light-7);
      background-color: var(--el-color-danger-light-9);
      color: var(--el-color-danger);
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }

  .success-message {
    pre {
      margin: 0;
      max-height: 300px;
      overflow-y: auto;
      padding: 12px;
      border-top: 1px solid var(--el-border-color);
      background-color: var(--el-bg-color-page);
      color: var(--el-text-color-primary);
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }

  .empty-message {
    padding: 12px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    text-align: center;
  }
}

.dialog-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.check-strategy-wrapper,
.queue-status,
.dialog-actions {
  display: flex;
  align-items: center;
}

.check-strategy-wrapper,
.queue-status {
  justify-content: space-between;
}

.check-strategy-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.check-strategy-label {
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.queue-status {
  gap: 8px;
  flex-wrap: wrap;
}

.queue-status-card {
  justify-content: flex-end;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--el-fill-color-extra-light);
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }

  .count {
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  &.processing {
    color: var(--el-color-primary);
  }

  &.success {
    color: var(--el-color-success);
  }

  &.error {
    color: var(--el-color-danger);
  }
}

.dialog-actions {
  justify-content: flex-end;
  gap: 8px;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
