<template>
  <VmosDialog
    v-model="visible"
    :title="t('cloudPhone.setProxyTitle', { name: currentDevice?.user_name })"
    width="600px"
    :show-close="!loading && !checking"
    @closed="handleClose"
  >
    <el-form
      ref="formRef"
      :model="proxyForm"
      class="proxy-form"
      label-width="auto"
      :rules="rules"
      label-position="top"
      @submit.prevent
    >
      <template v-if="currentProxy.nodes && currentProxy.nodes.length > 0">
        <el-form-item :label="t('cloudPhone.currentProxy')" prop="currentProxy">
          <span>
            <template
              v-if="
                matchProxyName(
                  currentProxy.nodes[currentProxy.nodes.length - 1].ip,
                  currentProxy.nodes[currentProxy.nodes.length - 1].port,
                  currentProxy.nodes[currentProxy.nodes.length - 1].proxyName,
                  currentProxy.proxyHash
                )
              "
            >
              {{
                matchProxyName(
                  currentProxy.nodes[currentProxy.nodes.length - 1].ip,
                  currentProxy.nodes[currentProxy.nodes.length - 1].port,
                  currentProxy.nodes[currentProxy.nodes.length - 1].proxyName,
                  currentProxy.proxyHash
                )
              }}（{{ currentProxy.nodes[currentProxy.nodes.length - 1].ip }}:{{
                currentProxy.nodes[currentProxy.nodes.length - 1].port
              }}）
            </template>
            <template v-else>
              {{ currentProxy.nodes[currentProxy.nodes.length - 1].proxyType }}://{{
                currentProxy.nodes[currentProxy.nodes.length - 1].ip
              }}:{{ currentProxy.nodes[currentProxy.nodes.length - 1].port }}
            </template>
          </span>
          <el-tag size="small" style="margin-left: 8px">{{
            currentProxy.engineType === 1
              ? t('cloudPhone.engineEnhanced')
              : t('cloudPhone.engineStandard')
          }}</el-tag>
        </el-form-item>
        <el-form-item
          v-if="currentProxy.nodes.length > 1"
          :label="t('cloudPhone.transferProxy')"
          prop="currentProxy"
        >
          <div v-for="(node, index) in currentProxy.nodes.slice(0, -1)" :key="index">
            <template v-if="matchProxyName(node.ip, node.port, node.proxyName, node.proxyHash)">
              {{ matchProxyName(node.ip, node.port, node.proxyName, node.proxyHash) }}（{{
                node.ip
              }}:{{ node.port }}）
            </template>
            <template v-else> {{ node.proxyType }}://{{ node.ip }}:{{ node.port }} </template>
          </div>
        </el-form-item>
      </template>
      <template v-else>
        <el-form-item
          v-if="currentProxy.proxyType && currentProxy.host && currentProxy.port"
          :label="t('cloudPhone.currentProxy')"
          prop="currentProxy"
        >
          <span>
            <template
              v-if="
                matchProxyName(
                  currentProxy.host,
                  currentProxy.port,
                  currentProxy.proxyType,
                  currentProxy.proxyHash
                )
              "
            >
              {{
                matchProxyName(
                  currentProxy.host,
                  currentProxy.port,
                  currentProxy.proxyType,
                  currentProxy.proxyHash
                )
              }}（{{ currentProxy.host }}:{{ currentProxy.port }}）
            </template>
            <template v-else>
              {{ currentProxy.proxyType }}://{{ currentProxy.host }}:{{ currentProxy.port }}
            </template>
          </span>
          <el-tag size="small" style="margin-left: 8px">{{
            currentProxy.engineType === 1
              ? t('cloudPhone.engineEnhanced')
              : t('cloudPhone.engineStandard')
          }}</el-tag>
        </el-form-item>
      </template>

      <ProxyFormFields
        :form="proxyForm"
        :proxy-list="proxyList"
        :test-result="testResult"
        :checking="checking"
        :check-strategy="checkStrategy"
        :proxy-mode="proxyMode"
        :custom-form="customProxyForm"
        @update:form="proxyForm = $event"
        @manage-proxy="handleProxyLinkClick"
        @proxy-change="handleProxyChange"
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
          }
        "
      />
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <div class="check-strategy-wrapper">
          <div class="check-strategy-group">
            <span class="check-strategy-label">{{ t('cloudPhone.checkStrategy') }}</span>
            <el-select
              v-model="checkStrategy"
              :placeholder="t('cloudPhone.selectCheckStrategy')"
              size="small"
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
            :loading="checking"
            size="small"
            plain
            type="primary"
            :disabled="loading || checking"
            @click="handleCheckProxy"
          >
            <el-icon class="el-icon--left">
              <Connection />
            </el-icon>
            {{ t('cloudPhone.proxyTest') }}
          </el-button>
        </div>
        <div class="dialog-actions">
          <el-button :disabled="loading || checking" @click="visible = false">{{
            t('common.cancel')
          }}</el-button>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="loading || checking"
            @click="handleSave"
            >{{ t('common.confirm') }}</el-button
          >
        </div>
      </div>
    </template>
  </VmosDialog>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Connection } from '@element-plus/icons-vue'
import { ipc } from '@renderer/core/ipc'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import { type Device, type Proxy } from '@shared/ipc/data.types'
import { useRouter } from 'vue-router'
import { ElForm, ElMessage, ElMessageBox } from 'element-plus'
import { getErrorMessage, request, buildApiUrl, API_CONFIG } from '@shared/api'
import { ProxyCheckStrategyList } from '@renderer/utils/constant'
import { useI18n } from 'vue-i18n'
import ProxyFormFields from '@renderer/components/proxy/ProxyFormFields.vue'
import {
  applyProxyToDevice,
  buildCustomProxyPayload,
  computeProxyHash,
  proxyIdentity,
  createDefaultProxyForm,
  createEmptyCurrentProxy,
  fetchCloudPhoneProxy,
  fetchProxyCheckStrategy,
  fetchProxyList,
  restartCloudPhone,
  runCustomProxyCheck,
  saveCustomProxyWithToast,
  updateProxyCheckStrategy
} from '../services/proxyService'
import {
  createDefaultCustomProxyForm,
  type CustomProxyFormModel
} from '@renderer/components/proxy/customProxyTypes'

const { t } = useI18n()
const router = useRouter()
const visible = ref(false)
const loading = ref(false)
const currentDevice = ref<Device | null>(null)
const testResult = ref<{ success: boolean; data?: any; error?: string } | null>(null)
const proxyForm = ref(createDefaultProxyForm())
// 当前代理信息
const currentProxy = ref(createEmptyCurrentProxy())
const proxyList = ref<Proxy[]>([])
const formRef = ref<InstanceType<typeof ElForm>>()
const checking = ref(false)
const checkStrategy = ref<string>('default')
const proxyMode = ref<'select' | 'custom'>('select')
const customProxyForm = ref<CustomProxyFormModel>(createDefaultCustomProxyForm())
const customProxyInfo = ref<Record<string, any> | null>(null)
const matchProxyName = (
  host: string,
  port: string | number,
  protocol?: string,
  hash?: string
): string => {
  // 优先用身份指纹匹配：绕开协议名映射（ss→shadowsocks）与 host 归一化导致的失配
  if (hash) {
    const byHash = proxyList.value.find((item) => computeProxyHash(proxyIdentity(item)) === hash)
    if (byHash) return byHash.name
  }
  // 兜底：http/socks5 及改造前已设置的代理，沿用 host + port + protocol 匹配
  const matched = proxyList.value.find(
    (item) =>
      item.host === host &&
      String(item.port) === String(port) &&
      (!protocol || item.protocol === protocol)
  )
  return matched ? matched.name : ''
}

// 出口信息（用于 compareProxyInfo）
const proxyInfo = computed(() => {
  const proxy: any = proxyList.value.find((item) => item.id === proxyForm.value.id)
  return proxy
})

const rules = computed(() => ({
  // engineType: [{ required: true, message: t('cloudPhone.engineType'), trigger: 'change' }],
  id: [{ required: true, message: t('cloudPhone.selectProxyPlaceholder'), trigger: 'change' }],
  dnsOverProxyDisabled: [{ required: true, message: t('cloudPhone.proxyDns'), trigger: 'change' }],
  udpDisabled: [{ required: true, message: t('cloudPhone.enableUdp'), trigger: 'change' }],
  ipSimulatorDisabled: [
    { required: true, message: t('cloudPhone.ipSimulator'), trigger: 'change' }
  ],
  isTransferAgent: [{ required: true, message: t('cloudPhone.transferAgent'), trigger: 'change' }],
  transferAgentId: [
    { required: true, message: t('cloudPhone.selectTransferAgent'), trigger: 'change' }
  ]
}))

const handleClose = () => {
  formRef.value?.resetFields()
  proxyForm.value = createDefaultProxyForm()
  testResult.value = null
  currentDevice.value = null
  visible.value = false
  proxyMode.value = 'select'
  customProxyForm.value = createDefaultCustomProxyForm()
  customProxyInfo.value = null
}
const handleProxyLinkClick = () => {
  visible.value = false
  router.push('/proxy')
}
const handleProxyChange = () => {
  testResult.value = null
}
const handleCheckProxy = async () => {
  if (checking.value || loading.value) return

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

  // 先验证必填字段
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
    const proxies: any[] = []

    // 如果有中转代理，先放中转代理
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
          rawLink: (transferAgent as any).rawLink || undefined
        })
      }
    }

    // 落地代理
    const proxy = proxyList.value.find((item) => item.id === proxyForm.value.id)
    if (proxy) {
      proxies.push({
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || undefined,
        password: proxy.password || undefined,
        rawLink: (proxy as any).rawLink || undefined
      })
    }

    const res = await ipc.invoke<any>(
      PROXY_EVENTS.CHECK_PROXY,
      proxies.length > 1 ? proxies : proxies[0]
    )
    if (res.success) {
      testResult.value = { success: true, data: res?.data?.data || {} }
      // 比较检测信息和出口信息是否一致
      compareProxyInfo(res?.data?.data || {})
    } else {
      testResult.value = { success: false, error: res.error || t('cloudPhone.testProxyFailed') }
    }
  } finally {
    checking.value = false
  }
}

const compareProxyInfo = (data: any) => {
  if (
    (data?.ip && data?.ip !== proxyInfo.value.ip) ||
    (data?.country && data?.country !== proxyInfo.value.country) ||
    (data?.timezone && data?.timezone !== proxyInfo.value.timezone) ||
    (data?.loc && data?.loc !== proxyInfo.value.loc)
  ) {
    ElMessageBox.confirm(t('cloudPhone.proxyExitInfoChanged'), t('cloudPhone.tip'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }).then(async () => {
      const res = await ipc.invoke(PROXY_EVENTS.UPDATE_PROXY, {
        id: proxyInfo.value.id,
        isCheck: false,
        updates: {
          ...proxyInfo.value,
          ip: data?.ip || proxyInfo.value.ip,
          country: data?.country || proxyInfo.value.country,
          timezone: data?.timezone || proxyInfo.value.timezone,
          loc: data?.loc || proxyInfo.value.loc,
          lastCheckStatus: 'success'
        }
      })
      if (res.success) {
        ElMessage.success(t('cloudPhone.updateProxyExitInfoSuccess'))

        getProxy()
      }
    })
  }
}

const handleSave = () => {
  formRef.value?.validate().then(async (valid) => {
    if (valid) {
      if (loading.value || checking.value) return

      if (proxyMode.value === 'custom') {
        if (!customProxyForm.value.parsed) {
          ElMessage.warning(t('cloudPhone.parseFailed'))
          return
        }
        loading.value = true
        try {
          const parsed = customProxyForm.value.parsed
          const params = buildCustomProxyPayload(
            parsed,
            proxyForm.value,
            customProxyInfo.value,
            {},
            t('proxy.parseConfigFailed'),
            proxyList.value
          )

          await request.post(
            buildApiUrl(
              currentDevice.value!.host_ip || '',
              `${API_CONFIG.PATHS.SET_PROXY}/${currentDevice.value!.db_id || ''}`
            ),
            params,
            { timeout: 2 * 60 * 1000 }
          )

          saveCustomProxyWithToast(
            customProxyForm.value,
            parsed,
            t('cloudPhone.proxySavedButFailed')
          )

          ElMessage.success(t('common.operationSuccess'))
          visible.value = false
        } catch (error: any) {
          ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
        } finally {
          loading.value = false
        }
        return
      }

      try {
        loading.value = true
        const result = await applyProxyToDevice({
          device: currentDevice.value as Device,
          form: proxyForm.value,
          proxyList: proxyList.value,
          parseConfigFailedMessage: t('proxy.parseConfigFailed'),
          successMessage: t('common.operationSuccess'),
          restartMessage: t('common.operationSuccess'),
          restartFailedMessage: t('cloudPhone.restartFailed'),
          autoRestartOnCountryChange: false
        })

        if (result.countryChanged) {
          ElMessageBox.confirm(t('cloudPhone.countryChangedRestartConfirm'), t('common.tips'), {
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel'),
            type: 'success'
          }).then(async () => {
            try {
              await restartCloudPhone(currentDevice.value as Device, t('cloudPhone.restartFailed'))
              ElMessage.success(t('common.operationSuccess'))
            } catch (error) {
              ElMessage.error(getErrorMessage(error) || t('cloudPhone.restartFailed'))
            } finally {
              visible.value = false
            }
          })
        } else {
          ElMessage.success(result.message)
          visible.value = false
        }
      } catch (error: any) {
        ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
      } finally {
        loading.value = false
      }
    }
  })
}
const getCloudPhoneProxy = async () => {
  try {
    Object.assign(currentProxy.value, await fetchCloudPhoneProxy(currentDevice.value as Device))
  } catch {
    return
  }
}
const getProxy = async () => {
  try {
    proxyList.value = await fetchProxyList()
    getCloudPhoneProxy()
  } catch (error) {
    ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
  }
}

const getCheckStrategy = async () => {
  try {
    checkStrategy.value = await fetchProxyCheckStrategy()
  } catch (error) {
    ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
  }
}

const handleCheckStrategyChange = () => {
  updateProxyCheckStrategy(checkStrategy.value).catch((error) => {
    ElMessage.error(getErrorMessage(error) || t('common.operationFailed'))
  })
}

const init = (device: Device) => {
  currentDevice.value = device
  getProxy()
  getCheckStrategy()

  visible.value = true
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.proxy-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;
  padding: 0;

  .check-strategy-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }

  .check-strategy-group {
    display: flex;
    align-items: center;
    gap: 8px;

    .check-strategy-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
      font-weight: normal;
    }
  }

  .dialog-actions {
    display: flex;
    gap: 10px;
    margin-left: auto;
    flex-shrink: 0;
  }
}
</style>
