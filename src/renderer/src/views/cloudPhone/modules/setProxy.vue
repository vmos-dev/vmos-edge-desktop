<template>
  <VmosDialog
    v-model="visible"
    :title="`设置代理(${currentDevice?.user_name})`"
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
      <el-form-item
        label="当前代理"
        prop="currentProxy"
        v-if="currentProxy.protocol && currentProxy.host && currentProxy.port"
      >
        <span>{{ currentProxy.protocol }}://{{ currentProxy.host }}:{{ currentProxy.port }}</span>
      </el-form-item>

      <el-form-item label="代理" prop="id" class="proxy-item">
        <template #label>
          <div class="label-row">
            <div><span style="color: #f56c6c">*</span> 选择代理</div>
            <el-link
              v-if="!loading"
              type="primary"
              :underline="false"
              class="manage-link"
              @click="handleProxyLinkClick"
              >前往代理管理</el-link
            >
          </div>
        </template>
        <el-select
          v-model="proxyForm.id"
          filterable
          placeholder="请选择代理"
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
      <el-form-item label="出口信息" prop="proxyInfo" v-if="checkVisible">
        <div class="proxy-info-wrapper">
          <el-row :gutter="20">
            <el-col :span="12">
              <span class="proxy-info-label">IP：</span>
              <span class="proxy-info-value">{{ proxyInfo?.ip || '-' }}</span>
            </el-col>
            <el-col :span="12">
              <span class="proxy-info-label">地区：</span>
              <span class="proxy-info-value">{{ proxyInfo?.country || '-' }}</span>
            </el-col>
            <el-col :span="12">
              <span class="proxy-info-label">时区：</span>
              <span class="proxy-info-value">{{ proxyInfo?.timezone || '-' }}</span>
            </el-col>
            <el-col :span="12">
              <span class="proxy-info-label">经纬度：</span>
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
                代理DNS&nbsp;
                <el-tooltip
                  content="开启代理DNS需要确保您的代理IP支持DNS解析，否则云手机将无法联网：关闭代理DNS可能会导致DNS泄露。"
                  placement="top"
                  ><el-icon size="16"><QuestionFilled /></el-icon
                ></el-tooltip>
              </div>
            </template>
            <el-switch v-model="proxyForm.dnsOverProxyDisabled" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="启用UDP" prop="udpDisabled" label-position="left">
            <el-switch v-model="proxyForm.udpDisabled" />
          </el-form-item>
        </el-col>
        <el-col :span="12" v-if="checkVisible">
          <el-form-item label="IP仿真" prop="ipSimulatorDisabled" label-position="left">
            <el-switch v-model="proxyForm.ipSimulatorDisabled" />
          </el-form-item>
        </el-col>
      </el-row>
      <div class="ip-simulator-info" v-if="proxyForm.ipSimulatorDisabled && checkVisible">
        <el-icon><InfoFilled /></el-icon>
        <span
          >开启 IP
          仿真后，云手机会根据代理的出口信息，自动设置所在地区、时区、语言和定位等信息。</span
        >
      </div>
      <template v-if="testResult !== null">
        <div
          :class="['test-result', testResult?.success ? 'test-success' : 'test-failure']"
          v-if="testResult?.success"
          style="margin-top: 10px"
        >
          <el-icon><Check /></el-icon>
          <span
            >检测通过。
            <template v-if="testResult?.data?.providerType !== 'default'">
              IP: {{ testResult?.data?.ip || '-' }}，地区:
              {{ testResult?.data?.country || '-' }}，时区:
              {{ testResult?.data?.timezone || '-' }}，经纬度: {{ testResult?.data?.loc || '-' }}
            </template>
          </span>
        </div>
        <div :class="['test-result', testResult?.success ? 'test-success' : 'test-failure']" v-else>
          <el-icon><Close /></el-icon>
          <span>检测失败! {{ testResult?.error || '' }}</span>
        </div>
      </template>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <div class="check-strategy-wrapper" v-if="checkVisible">
          <div class="check-strategy-group">
            <span class="check-strategy-label">检测策略：</span>
            <el-select
              v-model="checkStrategy"
              placeholder="请选择"
              size="small"
              @change="handleCheckStrategyChange"
              style="width: 150px"
            >
              <el-option label="默认(不支持获取出口信息)" value="default" />
              <el-option label="IPinfo" value="ipinfo" />
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
            <el-icon class="el-icon--left"><Connection /></el-icon>
            代理检测
          </el-button>
        </div>
        <span class="check-strategy-info" v-else>
          代理检测和IP仿真功能目前仅支持 HTTP/HTTPS/SOCKS5 协议
        </span>
        <div class="dialog-actions">
          <el-button @click="visible = false" :disabled="loading || checking">取消</el-button>
          <el-button
            type="primary"
            :loading="loading"
            @click="handleSave"
            :disabled="loading || checking"
            >确定</el-button
          >
        </div>
      </div>
    </template>
  </VmosDialog>
</template>
<script setup lang="ts">
import { ref, computed, toRaw } from 'vue'
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
import { DATA_EVENTS } from '@shared/ipc/data.types'

const router = useRouter()
const visible = ref(false)
const loading = ref(false)
const currentDevice = ref<Device | null>(null)
const testResult = ref<{ success: boolean; data?: any; error?: string } | null>(null)
const proxyForm = ref<any>({
  id: '',
  dnsOverProxyDisabled: true,
  udpDisabled: true,
  ipSimulatorDisabled: true
})
// 当前代理信息
const currentProxy = ref<any>({
  protocol: '',
  host: '',
  port: ''
})
const proxyList = ref<Proxy[]>([])
const formRef = ref<InstanceType<typeof ElForm>>()
const checking = ref(false)
const checkStrategy = ref<string>('default')
// 只有http https socks5 支持检测
const checkVisible = computed(() => {
  const proxy = proxyList.value.find((item) => item.id === proxyForm.value.id)
  return ['http', 'https', 'socks5'].includes(proxy?.protocol || '')
})
// 出口信息
const proxyInfo = computed(() => {
  const proxy: any = proxyList.value.find((item) => item.id === proxyForm.value.id)
  return proxy
})

const rules = ref({
  id: [{ required: true, message: '请选择代理', trigger: 'change' }],
  dnsOverProxyDisabled: [{ required: true, message: '请选择代理DNS', trigger: 'change' }],
  udpDisabled: [{ required: true, message: '请选择开启UDP', trigger: 'change' }],
  ipSimulatorDisabled: [{ required: true, message: '请选择开启IP仿真', trigger: 'change' }]
})

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
  } catch {
    ElMessage.warning('请先填写必填字段')
    return
  }

  checking.value = true
  testResult.value = null

  try {
    const proxy = proxyList.value.find((item) => item.id === proxyForm.value.id)
    const res = await ipc.invoke<any>(PROXY_EVENTS.CHECK_PROXY, {
      protocol: proxy?.protocol,
      host: proxy?.host,
      port: proxy?.port,
      username: proxy?.username || undefined,
      password: proxy?.password || undefined
    })
    if (res.success) {
      testResult.value = { success: true, data: res?.data?.data || {} }
      // 比较检测信息和出口信息是否一致
      compareProxyInfo(res?.data?.data || {})
    } else {
      testResult.value = { success: false, error: res.error || '检测代理失败' }
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
    ElMessageBox.confirm(
      '当前代理的实际出口信息已发生变化，可能由代理节点切换或出口策略调整导致。是否自动更新代理出口信息以保持数据一致？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(async () => {
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
        ElMessage.success('更新代理出口信息成功')

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
        console.log(
          buildApiUrl(
            currentDevice.value?.host_ip || '',
            `${API_CONFIG.PATHS.SET_PROXY}/${currentDevice.value?.db_id || ''}`
          )
        )

        let params: any = {
          dnsOverProxyDisabled: !proxyForm.value.dnsOverProxyDisabled,
          udpDisabled: !proxyForm.value.udpDisabled,
          ip: proxy?.host,
          port: proxy?.port,
          proxyType: 'proxy',
          proxyName: proxy?.protocol
        }

        const mergeConfig = (params: any, rawLink?: string) => {
          if (!rawLink) return params
          try {
            return {
              ...params,
              ...JSON.parse(rawLink)
            }
          } catch {
            throw new Error('解析代理配置失败')
          }
        }

        const proxyNameMap: Record<string, string> = {
          vmess: 'vmess',
          ss: 'shadowsocks',
          ssr: 'shadowsocksr',
          vless: 'vless'
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
        }

        // 设置代理
        await request.post(
          buildApiUrl(
            currentDevice.value?.host_ip || '',
            `${API_CONFIG.PATHS.SET_PROXY}/${currentDevice.value?.db_id || ''}`
          ),
          params,
          {
            timeout: 60 * 1000
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
            const { longitude, latitude } = parseCoordinate(proxyLoc)
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
          ElMessageBox.confirm(
            '操作成功，修改地区会重新设置 SIM 卡等信息，需要重启云机后才能生效，是否现在重启？',
            '提示',
            {
              confirmButtonText: '立即重启',
              cancelButtonText: '稍后重启',
              type: 'success'
            }
          ).then(async () => {
            // 重启云机
            await ipc
              .invoke<{
                restartedDevices: Device[]
                failedDevices: Device[]
              }>(DATA_EVENTS.DEVICE_RESTARTED, [toRaw(currentDevice.value)])
              .then((res) => {
                if (res.success) {
                  ElMessage.success('操作成功')
                } else {
                  ElMessage.error(getErrorMessage(res.error) || '重启失败')
                }
              })
              .finally(() => {
                visible.value = false
              })
          })
        } else {
          ElMessage.success('操作成功')
          visible.value = false
        }
      } catch (error: any) {
        ElMessage.error(getErrorMessage(error) || '操作失败')
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
    // 根据 ip 端口 有密码就还有账号密码 去匹配代理列表
    const proxy = proxyList.value.find(
      (item) =>
        item.host === res.data?.proxy_config?.ip && item.port === res.data?.proxy_config?.port
    )
    Object.assign(currentProxy.value, {
      protocol: proxy?.protocol ?? '',
      host: proxy?.host ?? '',
      port: proxy?.port ?? ''
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
    color: #606266;
    white-space: nowrap;
    margin-right: 4px;
    flex-shrink: 0;
  }

  .proxy-info-value {
    font-size: 13px;
    color: #303133;
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
  background-color: #f0f9ff;
  color: #606266;
  border: 1px solid #b3d8ff;

  .el-icon {
    font-size: 16px;
    color: #409eff;
    flex-shrink: 0;
    margin-top: 2px;
  }

  span {
    flex: 1;
    color: #606266;
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
    background-color: #f0f9ff;
    color: #67c23a;
    border: 1px solid #b3e19d;
  }

  &.test-failure {
    background-color: #fef0f0;
    color: #f56c6c;
    border: 1px solid #fbc4c4;
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
    color: #909399;
  }

  .check-strategy-group {
    display: flex;
    align-items: center;
    gap: 8px;

    .check-strategy-label {
      font-size: 13px;
      color: #606266;
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
