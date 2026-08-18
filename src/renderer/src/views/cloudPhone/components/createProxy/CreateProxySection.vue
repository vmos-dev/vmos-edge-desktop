<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getErrorMessage } from '@shared/api'
import { ipc } from '@renderer/core/ipc'
import type { Proxy } from '@shared/ipc/data.types'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import {
  createDefaultProxyForm,
  type ProxyFormModel,
  runCustomProxyCheck
} from '@renderer/views/cloudPhone/services/proxyService'
import type { CustomProxyFormModel } from '@renderer/components/proxy/customProxyTypes'
import { useI18n } from 'vue-i18n'
import { useCreateProxy } from './composables/useCreateProxy'
import ProxyFormFields from '@renderer/components/proxy/ProxyFormFields.vue'

const props = defineProps<{
  enabled: boolean
  form: ProxyFormModel
  proxyMode: 'select' | 'custom'
  customForm: CustomProxyFormModel
}>()

const emit = defineEmits<{
  'update:enabled': [boolean]
  'update:form': [ProxyFormModel]
  'proxy-info-change': [payload: { proxy: Proxy | null; proxyList: Proxy[] } | null]
  'ip-simulator-change': [boolean]
  'manage-proxy': []
  'update:proxyMode': ['select' | 'custom']
  'update:customForm': [CustomProxyFormModel]
  'custom-proxy-info': [Record<string, any> | null]
}>()

const { t } = useI18n()
const createProxy = useCreateProxy()

const loadingResources = shallowRef(false)
const loadError = shallowRef('')

const selectedProxy = computed(
  () => createProxy.proxyList.value.find((item) => item.id === props.form.id) ?? null
)

const enabledModel = computed({
  get: () => props.enabled,
  set: (value: boolean) => emit('update:enabled', value)
})

const emitProxyInfo = () => {
  if (!props.enabled) {
    emit('proxy-info-change', null)
    return
  }

  emit('proxy-info-change', {
    proxy: selectedProxy.value,
    proxyList: createProxy.proxyList.value
  })
}

// 出口信息失效（切换代理来源、自定义链接重新解析）时只清空出口代理信息。
// proxyList 是已加载的代理资源，中转代理在两种来源下都要靠它解析，不能一并清空：
// buildCustomProxyPayload 查不到中转代理时会静默丢弃该节点，云机按直连创建，
// 而界面仍显示中转代理已开启（见 proxyService.test.ts「代理列表为空时中转节点被静默丢弃」）。
const clearProxyExitInfo = () => {
  emit('proxy-info-change', { proxy: null, proxyList: createProxy.proxyList.value })
}

const transferAgentMissing = computed(
  () => props.form.isTransferAgent && !props.form.transferAgentId
)

const resetLocalState = () => {
  createProxy.clearTestResult()
  loadError.value = ''
}

const loadResources = async () => {
  if (!props.enabled || loadingResources.value) {
    return
  }

  loadingResources.value = true
  loadError.value = ''

  try {
    await createProxy.load()
  } catch (error) {
    loadError.value = getErrorMessage(error) || t('common.loadFailed')
    ElMessage.error(loadError.value)
  } finally {
    loadingResources.value = false
    emitProxyInfo()
  }
}

const handleEnabledChange = async (value: boolean) => {
  enabledModel.value = value

  if (!value) {
    emit('update:form', createDefaultProxyForm())
    emit('update:proxyMode', 'select')
    emit('update:customForm', { name: '', rawLink: '', parsed: null, parseError: false })
    emit('ip-simulator-change', false)
    resetLocalState()
    emit('proxy-info-change', null)
    return
  }

  await loadResources()
}

const handleCheckStrategyChange = async (value: string) => {
  try {
    await createProxy.setCheckStrategy(value)
  } catch (error) {
    ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
  }
}

const compareProxyInfo = async (data: Record<string, any>) => {
  const proxy = selectedProxy.value
  if (!proxy) {
    return
  }

  const changed =
    (data.ip && data.ip !== proxy.ip) ||
    (data.country && data.country !== proxy.country) ||
    (data.timezone && data.timezone !== proxy.timezone) ||
    (data.loc && data.loc !== proxy.loc)

  if (!changed) {
    return
  }

  try {
    await ElMessageBox.confirm(t('cloudPhone.proxyExitInfoChanged'), t('common.tips'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  const updatedProxy = {
    ...proxy,
    ip: data.ip || proxy.ip,
    country: data.country || proxy.country,
    timezone: data.timezone || proxy.timezone,
    loc: data.loc || proxy.loc,
    lastCheckStatus: 'success' as const
  }

  const response = await ipc.invoke(PROXY_EVENTS.UPDATE_PROXY, {
    id: proxy.id,
    isCheck: false,
    updates: updatedProxy
  })

  if (!response.success) {
    throw new Error(response.error || t('common.operationFailed'))
  }

  createProxy.updateProxy(proxy.id, updatedProxy)
  emitProxyInfo()
  ElMessage.success(t('cloudPhone.updateProxyExitInfoSuccess'))
}

const handleCheckProxy = async () => {
  if (props.proxyMode === 'custom') {
    return handleCheckCustomProxy()
  }

  if (!props.enabled || loadingResources.value || createProxy.checking.value) {
    return
  }

  if (!props.form.id || transferAgentMissing.value) {
    ElMessage.warning(t('cloudPhone.fillRequiredFields'))
    return
  }

  try {
    const result = await createProxy.runCheck(props.form)
    if (result?.success) {
      await compareProxyInfo(result.data || {})
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
  } finally {
    emitProxyInfo()
  }
}

const handleModeChange = () => {
  createProxy.clearTestResult()
  clearProxyExitInfo()
  emit('update:form', { ...props.form, ipSimulatorDisabled: false })
  emit('ip-simulator-change', false)
}

const handleCheckCustomProxy = async () => {
  if (!props.enabled || createProxy.checking.value) return

  const parsed = props.customForm.parsed
  if (!parsed || transferAgentMissing.value) {
    ElMessage.warning(t('cloudPhone.fillRequiredFields'))
    return
  }

  createProxy.checking.value = true
  createProxy.testResult.value = null

  try {
    const result = await runCustomProxyCheck(parsed, props.form, createProxy.proxyList.value)
    createProxy.testResult.value = result
    if (result.success) {
      emit('custom-proxy-info', result.data || null)
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
  } finally {
    createProxy.checking.value = false
  }
}

const handleManageProxy = () => {
  emit('manage-proxy')
}

watch(
  () => props.enabled,
  (value) => {
    if (!value) {
      resetLocalState()
      emit('proxy-info-change', null)
      return
    }

    loadResources().catch(() => undefined)
  }
)

watch(
  [() => props.enabled, selectedProxy, () => createProxy.proxyList.value],
  () => {
    emitProxyInfo()
  },
  { immediate: true }
)
</script>

<template>
  <section class="create-proxy-section">
    <div class="proxy-section-card">
      <div class="section-header">
        <div class="section-title">{{ t('cloudPhone.setProxy') }}</div>
        <el-switch :model-value="enabledModel" @change="handleEnabledChange" />
      </div>

      <template v-if="enabledModel">
        <div v-if="loadError" class="proxy-error-banner">
          {{ loadError }}
        </div>

        <ProxyFormFields
          :form="props.form"
          :proxy-list="createProxy.proxyList.value"
          :disabled="loadingResources"
          :test-result="createProxy.testResult.value"
          :checking="createProxy.checking.value"
          :check-strategy="createProxy.checkStrategy.value"
          :show-check-row="true"
          :proxy-mode="props.proxyMode"
          :custom-form="props.customForm"
          @update:form="emit('update:form', $event)"
          @update:check-strategy="handleCheckStrategyChange"
          @manage-proxy="handleManageProxy"
          @proxy-change="createProxy.clearTestResult()"
          @ip-simulator-change="emit('ip-simulator-change', $event)"
          @check-proxy="handleCheckProxy"
          @update:proxy-mode="emit('update:proxyMode', $event)"
          @update:custom-form="emit('update:customForm', $event)"
          @parse-success="
            () => {
              createProxy.clearTestResult()
              clearProxyExitInfo()
            }
          "
          @parse-fail="
            () => {
              createProxy.clearTestResult()
              clearProxyExitInfo()
            }
          "
          @mode-change="handleModeChange"
        />
      </template>
    </div>
  </section>
</template>

<style scoped lang="scss">
.create-proxy-section {
  margin-bottom: 18px;
}

.proxy-section-card {
  padding: 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.proxy-error-banner {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--el-color-danger-light-7);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.6;
}
</style>
