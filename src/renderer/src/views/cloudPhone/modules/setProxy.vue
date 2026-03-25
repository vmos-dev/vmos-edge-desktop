<template>
  <VmosDialog
    v-model="visible"
    :title="t('cloudPhone.setProxyTitle', { name: currentDevice?.user_name })"
    width="600px"
    :show-close="!loading && !checking"
    @closed="handleClose"
  >
    <el-form
      :model="proxyForm"
      ref="formRef"
      class="proxy-form"
      label-width="auto"
      :rules="rules"
      label-position="top"
      @submit.prevent
    >
      <template v-if="currentProxy.nodes && currentProxy.nodes.length > 0">
        <el-form-item :label="t('cloudPhone.currentProxy')" prop="currentProxy">
          <span
            >{{ currentProxy.nodes[currentProxy.nodes.length - 1].proxyType }}://{{
              currentProxy.nodes[currentProxy.nodes.length - 1].ip
            }}:{{ currentProxy.nodes[currentProxy.nodes.length - 1].port }}</span
          >
          <el-tag size="small" style="margin-left: 8px">{{
            currentProxy.engineType === 1
              ? t('cloudPhone.engineEnhanced')
              : t('cloudPhone.engineStandard')
          }}</el-tag>
        </el-form-item>
        <el-form-item
          :label="t('cloudPhone.transferProxy')"
          prop="currentProxy"
          v-if="currentProxy.nodes.length > 1"
        >
          <div v-for="(node, index) in currentProxy.nodes.slice(0, -1)" :key="index">
            {{ node.proxyType }}://{{ node.ip }}:{{ node.port }}
          </div>
        </el-form-item>
      </template>
      <template v-else>
        <el-form-item
          :label="t('cloudPhone.currentProxy')"
          prop="currentProxy"
          v-if="currentProxy.proxyType && currentProxy.host && currentProxy.port"
        >
          <span
            >{{ currentProxy.proxyType }}://{{ currentProxy.host }}:{{ currentProxy.port }}</span
          >
          <el-tag size="small" style="margin-left: 8px">{{
            currentProxy.engineType === 1
              ? t('cloudPhone.engineEnhanced')
              : t('cloudPhone.engineStandard')
          }}</el-tag>
        </el-form-item>
      </template>
      <el-form-item prop="engineType">
        <template #label>
          <span class="engine-type-label">
            {{ t('cloudPhone.engineType') }}
            <el-tooltip placement="top" popper-class="proxy-engine-tip-popper">
              <template #content>
                <div class="proxy-engine-tip">
                  <div>
                    <strong>{{ t('cloudPhone.engineStandard') }}</strong
                    >：{{ t('cloudPhone.engineStandardDesc') }}
                  </div>
                  <div>
                    <strong>{{ t('cloudPhone.engineEnhanced') }}</strong
                    >：{{ t('cloudPhone.engineEnhancedDesc') }}
                  </div>
                </div>
              </template>
              <el-icon class="label-tip-icon" :size="16"><QuestionFilled /></el-icon>
            </el-tooltip>
          </span>
        </template>
        <el-radio-group v-model="proxyForm.engineType">
          <el-radio :value="0">{{ t('cloudPhone.engineStandard') }}</el-radio>
          <el-radio :value="1">{{ t('cloudPhone.engineEnhanced') }}</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item :label="t('proxy.protocol')" prop="id" class="proxy-item">
        <template #label>
          <div class="label-row">
            <div>
              <span style="color: var(--el-color-danger)">*</span> {{ t('cloudPhone.selectProxy') }}
            </div>
            <el-link
              v-if="!loading"
              type="primary"
              :underline="false"
              class="manage-link"
              @click="handleProxyLinkClick"
              >{{ t('cloudPhone.goToProxyManagement') }}</el-link
            >
          </div>
        </template>
        <el-select
          v-model="proxyForm.id"
          filterable
          :placeholder="t('cloudPhone.selectProxyPlaceholder')"
          style="width: 100%"
          @change="handleProxyChange"
        >
          <el-option
            :label="`${item.name}(${item.host}:${item.port})`"
            :value="item.id"
            v-for="item in proxyList"
            :key="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('cloudPhone.exitInfo')" prop="proxyInfo" v-if="checkVisible">
        <div class="proxy-info-wrapper">
          <el-row :gutter="20">
            <el-col :span="12">
              <span class="proxy-info-label">{{ t('proxy.ip') }}：</span>
              <span class="proxy-info-value">{{ proxyInfo?.ip || '-' }}</span>
            </el-col>
            <el-col :span="12">
              <span class="proxy-info-label">{{ t('cloudPhone.regionLabel') }}</span>
              <span class="proxy-info-value">{{ proxyInfo?.country || '-' }}</span>
            </el-col>
            <el-col :span="12">
              <span class="proxy-info-label">{{ t('cloudPhone.timezoneLabel') }}</span>
              <span class="proxy-info-value">{{ proxyInfo?.timezone || '-' }}</span>
            </el-col>
            <el-col :span="12">
              <span class="proxy-info-label">{{ t('cloudPhone.locLabel') }}</span>
              <span class="proxy-info-value">{{ proxyInfo?.loc || '-' }}</span>
            </el-col>
          </el-row>
        </div>
      </el-form-item>
      <el-row :gutter="20">
        <el-col :span="12">
          <el-form-item prop="dnsOverProxyDisabled" label-position="left">
            <template #label>
              <div class="label-row">
                {{ t('cloudPhone.proxyDns') }}&nbsp;
                <el-tooltip :content="t('cloudPhone.proxyDnsTip')" placement="top"
                  ><el-icon class="label-tip-icon" :size="16"><QuestionFilled /></el-icon
                ></el-tooltip>
              </div>
            </template>
            <el-switch v-model="proxyForm.dnsOverProxyDisabled" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('cloudPhone.enableUdp')" prop="udpDisabled" label-position="left">
            <el-switch v-model="proxyForm.udpDisabled" />
          </el-form-item>
        </el-col>
        <el-col :span="12" v-if="checkVisible">
          <el-form-item
            :label="t('cloudPhone.ipSimulator')"
            prop="ipSimulatorDisabled"
            label-position="left"
          >
            <el-switch v-model="proxyForm.ipSimulatorDisabled" />
          </el-form-item>
        </el-col>
      </el-row>
      <div class="ip-simulator-info" v-if="proxyForm.ipSimulatorDisabled && checkVisible">
        <el-icon>
          <InfoFilled />
        </el-icon>
        <span>{{ t('cloudPhone.ipSimulatorTip') }}</span>
      </div>

      <el-row :gutter="20" style="margin-top: 10px">
        <el-col :span="8">
          <el-form-item
            :label="t('cloudPhone.transferAgent')"
            prop="isTransferAgent"
            label-position="left"
          >
            <el-switch
              v-model="proxyForm.isTransferAgent"
              @change="proxyForm.transferAgentId = ''"
            />
          </el-form-item>
        </el-col>
        <el-col :span="16" v-if="proxyForm.isTransferAgent">
          <el-form-item prop="transferAgentId" label-position="left">
            <el-select
              v-model="proxyForm.transferAgentId"
              filterable
              :placeholder="t('cloudPhone.selectTransferAgent')"
            >
              <el-option
                :label="`${item.name}(${item.host}:${item.port})`"
                :value="item.id"
                v-for="item in proxyList"
                :key="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <div style="font-size: 12px; color: var(--el-text-color-placeholder); margin-left: 10px">
            {{ t('cloudPhone.transferAgentTip') }}
          </div>
        </el-col>
      </el-row>
      <template v-if="testResult !== null">
        <div
          :class="['test-result', testResult?.success ? 'test-success' : 'test-failure']"
          v-if="testResult?.success"
          style="margin-top: 10px"
        >
          <el-icon>
            <Check />
          </el-icon>
          <span
            >{{ t('cloudPhone.testPassed') }}
            <template v-if="testResult?.data?.providerType !== 'default'">
              {{ t('proxy.ip') }}: {{ testResult?.data?.ip || '-' }}，{{
                t('cloudPhone.regionLabel')
              }}
              {{ testResult?.data?.country || '-' }}，{{ t('cloudPhone.timezoneLabel') }}
              {{ testResult?.data?.timezone || '-' }}，{{ t('cloudPhone.locLabel') }}
              {{ testResult?.data?.loc || '-' }}
            </template>
          </span>
        </div>
        <div :class="['test-result', testResult?.success ? 'test-success' : 'test-failure']" v-else>
          <el-icon>
            <Close />
          </el-icon>
          <span>{{ t('cloudPhone.testFailed') }} {{ testResult?.error || '' }}</span>
        </div>
      </template>
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
              @change="handleCheckStrategyChange"
              style="width: 150px"
            >
              <el-option
                :label="item.label"
                :value="item.value"
                v-for="item in ProxyCheckStrategyList"
                :key="item.value"
              />
            </el-select>
          </div>
          <el-button
            :loading="checking"
            @click="handleCheckProxy"
            size="small"
            plain
            type="primary"
            :disabled="loading || checking"
          >
            <el-icon class="el-icon--left">
              <Connection />
            </el-icon>
            {{ t('cloudPhone.proxyTest') }}
          </el-button>
        </div>
        <div class="dialog-actions">
          <el-button @click="visible = false" :disabled="loading || checking">{{
            t('common.cancel')
          }}</el-button>
          <el-button
            type="primary"
            :loading="loading"
            @click="handleSave"
            :disabled="loading || checking"
            >{{ t('common.confirm') }}</el-button
          >
        </div>
      </div>
    </template>
  </VmosDialog>
</template>
<script setup lang="ts">
import { ref, toRaw, computed } from 'vue'
import { InfoFilled, Check, Close, Connection, QuestionFilled } from '@element-plus/icons-vue'
import { ipc } from '@renderer/core/ipc'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import { type Device, type Proxy } from '@shared/ipc/data.types'
import { useRouter } from 'vue-router'
import { ElForm, ElMessage, ElMessageBox } from 'element-plus'
import { request } from '@shared/api'
import { buildApiUrl, API_CONFIG, getErrorMessage } from '@shared/api'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { languages } from '../data/languages'
import { parseCoordinate } from '@renderer/utils'
import { parseUri } from '@vmosedge/proxy-sdk/parser'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import { ProxyCheckStrategyList } from '@renderer/utils/constant'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const visible = ref(false)
const loading = ref(false)
const currentDevice = ref<Device | null>(null)
const testResult = ref<{ success: boolean; data?: any; error?: string } | null>(null)
const proxyForm = ref<any>({
  id: '',
  dnsOverProxyDisabled: true,
  udpDisabled: true,
  ipSimulatorDisabled: true,
  isTransferAgent: false,
  transferAgentId: '',
  engineType: 0
})
// 当前代理信息
const currentProxy = ref<any>({
  engineType: 0,
  proxyType: '',
  host: '',
  port: '',
  nodes: []
})
const proxyList = ref<Proxy[]>([])
const formRef = ref<InstanceType<typeof ElForm>>()
const checking = ref(false)
const checkStrategy = ref<string>('default')
// 所有协议都支持检测
const checkVisible = computed(() => {
  const proxy = proxyList.value.find((item) => item.id === proxyForm.value.id)
  return !!proxy?.protocol
})
// 出口信息
const proxyInfo = computed(() => {
  const proxy: any = proxyList.value.find((item) => item.id === proxyForm.value.id)
  return proxy
})

const rules = computed(() => ({
  engineType: [{ required: true, message: t('cloudPhone.engineType'), trigger: 'change' }],
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
  testResult.value = null
  currentDevice.value = null
  visible.value = false
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
      try {
        loading.value = true
        // 根据id 获取代理信息
        const proxy = proxyList.value.find((item) => item.id === proxyForm.value.id)

        // 获取中转代理信息
        const transferAgent = proxyList.value.find(
          (item) => item.id === proxyForm.value.transferAgentId
        )

        let params: any = {
          dnsOverProxyDisabled: !proxyForm.value.dnsOverProxyDisabled,
          udpDisabled: !proxyForm.value.udpDisabled,
          engineType: Number(proxyForm.value.engineType || 0),
          ip: proxy?.host,
          port: proxy?.port,
          proxyType: 'proxy',
          proxyName: proxy?.protocol,
          nodes: []
        }

        const mergeConfig = (params: any, rawLink?: string) => {
          if (!rawLink) return params
          // URI 格式 (vmess://..., vless://...) 用 SDK parseUri 解析
          if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(rawLink)) {
            try {
              const config = parseUri(rawLink)
              return { ...params, ...config }
            } catch {
              throw new Error(t('proxy.parseConfigFailed'))
            }
          }
          // JSON 格式（手动编辑保存的配置）
          try {
            return {
              ...params,
              ...JSON.parse(rawLink)
            }
          } catch {
            throw new Error(t('proxy.parseConfigFailed'))
          }
        }

        const proxyNameMap: Record<string, string> = {
          vmess: 'vmess',
          ss: 'shadowsocks',
          ssr: 'shadowsocksr',
          vless: 'vless'
        }

        const buildProxyConfig = (proxyItem: any) => {
          const config: any = {
            ip: proxyItem.host,
            port: proxyItem.port,
            proxyName: proxyItem.protocol
          }

          if (['http', 'https', 'socks5'].includes(proxyItem.protocol)) {
            config.account = proxyItem.username
            config.password = proxyItem.password
          } else {
            const name = proxyNameMap[proxyItem.protocol]
            if (name && proxyItem.rawLink) {
              config.proxyName = name
              Object.assign(config, mergeConfig({}, proxyItem.rawLink))
            }
          }
          return config
        }

        if (transferAgent) {
          params.nodes.push(buildProxyConfig(transferAgent))
        }

        if (proxy) {
          // ① 传统代理
          if (['http', 'https', 'socks5'].includes(proxy.protocol)) {
            params.account = proxy.username
            params.password = proxy.password
          } else {
            // ③ VMESS / SS / SSR / VLESS（同一套路）
            const proxyName = proxyNameMap[proxy.protocol]
            if (proxyName && proxy.rawLink) {
              params.proxyName = proxyName
              Object.assign(params, mergeConfig({}, proxy.rawLink))
            }
          }
          params.nodes.push(buildProxyConfig(proxy))
        }

        // 设置代理
        await request.post(
          buildApiUrl(
            currentDevice.value?.host_ip || '',
            `${API_CONFIG.PATHS.SET_PROXY}/${currentDevice.value?.db_id || ''}`
          ),
          params,
          {
            timeout: 2 * 60 * 1000
          }
        )

        let isCountryChanged = false

        if (checkVisible.value && proxyForm.value.ipSimulatorDisabled) {
          // 查询当前实例国家、语言、时区
          const countryLanguageTimezoneRes = await request.get(
            buildApiUrl(
              currentDevice.value?.host_ip || '',
              `${API_CONFIG.PATHS.GET_DEVICE_COUNTRY_LANGUAGE_TIMEZONE}/${currentDevice.value?.db_id || ''}`
            )
          )

          const country = countryLanguageTimezoneRes?.data?.country
          const timezone = countryLanguageTimezoneRes?.data?.timezone

          const {
            country: proxyCountry,
            timezone: proxyTimezone,
            loc: proxyLoc
          } = proxyInfo.value || {}
          // 判断国家是否变更变更后需要重启

          isCountryChanged = proxyCountry && proxyCountry !== country

          if (isCountryChanged) {
            // 设置国家
            await request.post(
              buildApiUrl(
                currentDevice.value?.host_ip || '',
                `${API_CONFIG.PATHS.SET_DEVICE_COUNTRY}/${currentDevice.value?.db_id || ''}`
              ),
              {
                country: proxyCountry
              },
              {
                timeout: 20 * 1000
              }
            )
          }

          if (proxyCountry) {
            // 根据国家找语言
            const language = languages.find((item) => item.countryCode === proxyCountry)
            if (language) {
              // 设置语言
              await request.post(
                buildApiUrl(
                  currentDevice.value?.host_ip || '',
                  `${API_CONFIG.PATHS.SET_DEVICE_LANGUAGE}/${currentDevice.value?.db_id || ''}`
                ),
                {
                  country: proxyCountry,
                  // 默认英文
                  language: language?.languageCode
                },
                {
                  timeout: 20 * 1000
                }
              )
            }
          }

          if (proxyTimezone && proxyTimezone !== timezone) {
            // 设置时区
            await request.post(
              buildApiUrl(
                currentDevice.value?.host_ip || '',
                `${API_CONFIG.PATHS.SET_DEVICE_TIMEZONE}/${currentDevice.value?.db_id || ''}`
              ),
              {
                timezone: proxyTimezone
              },
              {
                timeout: 20 * 1000
              }
            )
          }

          if (proxyLoc) {
            const { longitude, latitude } = parseCoordinate(proxyLoc, 'latlng')
            // 设置经纬度
            await request.post(
              buildApiUrl(
                currentDevice.value?.host_ip || '',
                `${API_CONFIG.PATHS.SET_DEVICE_LOCATION}/${currentDevice.value?.db_id || ''}`
              ),
              {
                longitude,
                latitude
              },
              {
                timeout: 20 * 1000
              }
            )
          }
        }

        if (isCountryChanged) {
          ElMessageBox.confirm(t('cloudPhone.countryChangedRestartConfirm'), t('common.tips'), {
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel'),
            type: 'success'
          }).then(async () => {
            // 重启云机
            await ipc
              .invoke<{
                restartedDevices: Device[]
                failedDevices: Device[]
              }>(DATA_EVENTS.DEVICE_RESTARTED, [toRaw(currentDevice.value)])
              .then((res) => {
                if (res.success) {
                  ElMessage.success(t('common.operationSuccess'))
                } else {
                  ElMessage.error(getErrorMessage(res.error) || t('cloudPhone.restartFailed'))
                }
              })
              .finally(() => {
                visible.value = false
              })
          })
        } else {
          ElMessage.success(t('common.operationSuccess'))
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
    const res = await request.get(
      buildApiUrl(
        currentDevice.value?.host_ip || '',
        `${API_CONFIG.PATHS.GET_CLOUD_PHONE_PROXY}/${currentDevice.value?.db_id || ''}`
      )
    )
    const proxy = res?.data?.proxy_config || {}
    Object.assign(currentProxy.value, {
      // @ts-ignore
      engineType: Number(res?.data?.engineType ?? 0),
      proxyType: proxy?.proxyType,
      host: proxy?.ip ?? '',
      port: proxy?.port ?? '',
      nodes: proxy?.nodes ?? []
    })
  } catch (error) {}
}
const getProxy = async () => {
  const res = await ipc.invoke(PROXY_EVENTS.GET_PROXIES)
  if (res.success) {
    proxyList.value = res.data as Proxy[]
    getCloudPhoneProxy()
  }
}

const getCheckStrategy = async () => {
  const res = await ipc.invoke<any>(
    CONFIG_EVENTS.GET_CONFIGS,
    CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE
  )
  if (res.success) {
    checkStrategy.value = (res.data as string) || 'default'
  }
}

const handleCheckStrategyChange = () => {
  ipc.invoke(CONFIG_EVENTS.SET_CONFIG, {
    key: CONFIG_KEYS.PROXY_CHECK_PROVIDER_TYPE,
    value: checkStrategy.value
  })
  getCheckStrategy()
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
  .proxy-item {
    :deep(.el-form-item__label) {
      width: 100% !important;

      &::before {
        display: none;
      }
    }
  }
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .manage-link {
    font-size: 12px;
  }
}

.proxy-info-wrapper {
  width: 100%;

  .el-col {
    min-width: 0;
    display: flex;
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
  }

  .proxy-info-label {
    font-size: 13px;
    color: var(--el-text-color-regular);
    white-space: nowrap;
    margin-right: 4px;
    flex-shrink: 0;
  }

  .proxy-info-value {
    font-size: 13px;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
}

.ip-simulator-info {
  width: 100%;
  padding: 12px 16px;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  background-color: var(--el-color-primary-light-9);
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-color-primary-light-6);

  .el-icon {
    font-size: 16px;
    color: var(--el-color-primary);
    flex-shrink: 0;
    margin-top: 2px;
  }

  span {
    flex: 1;
    color: var(--el-text-color-regular);
  }
}

.test-result {
  padding: 12px 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;

  .el-icon {
    font-size: 16px;
  }

  &.test-success {
    background-color: var(--el-color-primary-light-9);
    color: var(--el-color-success);
    border: 1px solid #b3e19d;
  }

  &.test-failure {
    background-color: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
    border: 1px solid var(--el-color-danger-light-7);
  }
}

.dialog-footer {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 4px;

  .check-strategy-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .check-strategy-info {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-align: left;
  }

  .check-strategy-group {
    display: flex;
    align-items: center;
    gap: 8px;

    .check-strategy-label {
      font-size: 13px;
      color: var(--el-text-color-regular);
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

.engine-type-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.label-tip-icon {
  cursor: help;
  color: var(--el-text-color-secondary);
}
</style>

<style lang="scss">
.proxy-engine-tip-popper {
  max-width: 380px;
  line-height: 1.5;

  .proxy-engine-tip > div + div {
    margin-top: 8px;
  }
}
</style>
