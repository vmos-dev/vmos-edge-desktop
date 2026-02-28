<template>
  <VmosDialog
    v-model="visible"
    :title="operationType === 'edit' ? t('proxy.editProxy') : t('proxy.addProxy')"
    width="650px"
    :show-close="!saving && !checking"
    :close-on-click-modal="false"
    @closed="handleClose"
  >
    <div class="proxy-dialog-content">
      <!-- 一键解析区域 -->
      <div class="parse-section">
        <div class="parse-header">
          <span class="parse-title">{{ t('proxy.autoParse') }}</span>
          <el-button text type="primary" size="small" @click="showParseHelp = !showParseHelp">
            <el-icon size="16"> <InfoFilled /> </el-icon>&nbsp; {{ t('proxy.formatHelp') }}
          </el-button>
        </div>
        <div class="parse-input-group">
          <el-input
            v-model.trim="parseInput"
            :placeholder="t('proxy.parsePlaceholder')"
            clearable
            @blur="handleParse"
            @keyup.enter="handleParse"
          >
          </el-input>
        </div>
        <el-collapse-transition>
          <div v-show="showParseHelp" class="parse-help">
            <div class="help-title">{{ t('proxy.supportedFormats') }}</div>
            <div class="help-examples">
              <div class="help-category">
                <div class="category-title">HTTP / HTTPS：</div>
                <div class="help-item">
                  <code>http://username:password@host:port</code>
                </div>
                <div class="help-item">
                  <code>http://host:port</code>
                </div>
                <div class="help-item">
                  <code>https://username:password@host:port</code>
                </div>
                <div class="help-note" style="padding-left: 12px; margin-top: 4px">
                  {{ t('proxy.httpHttpsNote') }}
                </div>
              </div>
              <div class="help-category">
                <div class="category-title">SOCKS5：</div>
                <div class="help-item">
                  <code>socks5://username:password@host:port</code>
                </div>
                <div class="help-item">
                  <code>socks5://host:port</code>
                </div>
                <div class="help-note" style="padding-left: 12px; margin-top: 4px">
                  {{ t('proxy.socks5Note') }}
                </div>
              </div>
              <div class="help-category">
                <div class="category-title">Shadowsocks (SS)：</div>
                <div class="help-item">
                  <code>ss://base64(method:password)@host:port[?plugin=...][#remarks]</code>
                </div>
                <div class="help-item">
                  <code>ss://base64(method:password@host:port)[?plugin=...][#remarks]</code>
                </div>
                <div class="help-note" style="padding-left: 12px; margin-top: 4px">
                  {{ t('proxy.ssNote') }}
                </div>
              </div>
              <div class="help-category">
                <div class="category-title">ShadowsocksR (SSR)：</div>
                <div class="help-item">
                  <code>ssr://base64(host:port:protocol:method:obfs:password/...)</code>
                </div>
                <div class="help-note" style="padding-left: 12px; margin-top: 4px">
                  {{ t('proxy.ssrNote') }}
                </div>
              </div>
              <div class="help-category">
                <div class="category-title">VMess：</div>
                <div class="help-item">
                  <code>vmess://base64(json)</code>
                </div>
                <div class="help-item">
                  <code>vmess://base64?params</code>
                </div>
                <div class="help-note" style="padding-left: 12px; margin-top: 4px">
                  {{ t('proxy.vmessNote') }}
                </div>
              </div>
              <div class="help-category">
                <div class="category-title">VLESS：</div>
                <div class="help-item">
                  <code>vless://uuid@host:port?params#remarks</code>
                </div>
                <div class="help-note" style="padding-left: 12px; margin-top: 4px">
                  {{ t('proxy.vlessNote') }}
                  alpn, pbk, sid
                </div>
              </div>
            </div>
          </div>
        </el-collapse-transition>
      </div>

      <el-form
        ref="formRef"
        :model="formData"
        label-width="auto"
        :rules="formRules"
        @submit.prevent
      >
        <!-- 共享字段：名称和协议 -->
        <el-form-item :label="t('proxy.name')" prop="name">
          <el-input
            v-model.trim="formData.name"
            maxlength="200"
            show-word-limit
            :placeholder="t('proxy.namePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('proxy.protocolLabel')" prop="protocol">
          <el-select
            v-model="formData.protocol"
            :placeholder="t('proxy.protocolPlaceholder')"
            style="width: 100%"
            @change="handleProtocolChange"
          >
            <el-option :label="t('proxy.protocolHttp')" value="http" />
            <!-- <el-option :label="t('proxy.protocolHttps')" value="https" /> -->
            <el-option :label="t('proxy.protocolSocks5')" value="socks5" />
            <el-option :label="t('proxy.protocolVmess')" value="vmess" />
            <el-option :label="t('proxy.protocolVless')" value="vless" />
            <el-option :label="t('proxy.protocolSs')" value="ss" />
            <el-option :label="t('proxy.protocolSsr')" value="ssr" />
          </el-select>
        </el-form-item>

        <!-- 根据协议类型动态加载不同的表单组件 -->
        <TraditionalProtocolForm
          v-if="isTraditionalProtocol"
          ref="traditionalFormRef"
          v-model="formData"
        />
        <VmessProtocolForm
          v-else-if="formData.protocol === 'vmess'"
          ref="vmessFormRef"
          v-model="formData.vmess"
        />
        <VlessProtocolForm
          v-else-if="formData.protocol === 'vless'"
          ref="vlessFormRef"
          v-model="formData.vless"
        />
        <SsProtocolForm
          v-else-if="formData.protocol === 'ss'"
          ref="ssFormRef"
          v-model="formData.ss"
        />
        <SsrProtocolForm
          v-else-if="formData.protocol === 'ssr'"
          ref="ssrFormRef"
          v-model="formData.ssr"
        />

        <!-- 测试结果 -->

        <template v-if="testResult !== null">
          <div
            :class="['test-result', testResult?.success ? 'test-success' : 'test-failure']"
            v-if="testResult?.success"
          >
            <el-icon>
              <Check />
            </el-icon>

            <span
              >{{ t('proxy.testPassed') }}
              <template v-if="testResult?.data?.providerType !== 'default'">
                {{ t('proxy.ip') }}: {{ testResult?.data?.ip || '-' }}，{{ t('proxy.country') }}:
                {{ testResult?.data?.country || '-' }}，{{ t('proxy.timezone') }}：{{
                  testResult?.data?.timezone || '-'
                }}，{{ t('proxy.loc') }}: {{ testResult?.data?.loc || '-' }}
              </template></span
            >
          </div>
          <div
            :class="['test-result', testResult?.success ? 'test-success' : 'test-failure']"
            v-else
          >
            <el-icon>
              <Close />
            </el-icon>
            <span>{{ t('proxy.testFailed') }} {{ testResult?.error || '' }}</span>
          </div>
        </template>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="check-strategy-wrapper">
          <div class="check-strategy-group">
            <span class="check-strategy-label">{{ t('proxy.testStrategy') }}</span>
            <el-select
              v-model="checkStrategy"
              :placeholder="t('proxy.testStrategyPlaceholder')"
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
            :loading="checking || saving"
            @click="handleCheckProxy"
            size="small"
            plain
            type="primary"
          >
            <el-icon class="el-icon--left">
              <Connection />
            </el-icon>
            {{ t('proxy.testProxy') }}
          </el-button>
        </div>

        <div class="dialog-actions">
          <el-button @click="visible = false" :disabled="saving || checking" size="default">
            {{ t('common.cancel') }}
          </el-button>
          <el-button
            type="primary"
            :loading="saving"
            @click="handleSave"
            :disabled="saving || checking"
            size="default"
            >{{ t('common.save') }}</el-button
          >
        </div>
      </div>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { Check, Close, Connection, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage, ElForm } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import type { Proxy } from '@shared/ipc/data.types'
import TraditionalProtocolForm from './TraditionalProtocolForm.vue'
import VmessProtocolForm from './VmessProtocolForm.vue'
import VlessProtocolForm from './VlessProtocolForm.vue'
import SsProtocolForm from './SsProtocolForm.vue'
import SsrProtocolForm from './SsrProtocolForm.vue'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { ProxyCheckStrategyList } from '@renderer/utils/constant'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const saving = ref(false)
const checking = ref(false)
const testResult = ref<{ success: boolean; data?: any; error?: string } | null>(null)
const parseInput = ref('')
const showParseHelp = ref(false)
const parsedInfo = ref<any>(null)
// 上次检测完成时间，用于前端节流
let lastCheckTime = 0
const CHECK_THROTTLE_MS = 500
const emit = defineEmits<{
  success: []
}>()

const formRef = ref<InstanceType<typeof ElForm>>()

// 扩展的表单数据（包含所有协议的字段）
interface ExtendedFormData extends Omit<Proxy, 'createTime' | 'lastCheckStatus'> {
  id: string
  name: string
  protocol: 'http' | 'https' | 'socks5' | 'vmess' | 'vless' | 'ss' | 'ssr'
  vmess: IProxyVmessConfig
  vless: IProxyVlessConfig
  ss: IProxyShadowsocksConfig
  ssr: IProxyshadowsocksRConfig
}

const defaultFormData = (): ExtendedFormData => ({
  id: '',
  name: '',
  protocol: 'socks5',
  host: '',
  port: 1080,
  username: '',
  password: '',
  rawLink: '',
  vmess: {
    name: '',
    type: 'vmess',
    server: '',
    port: undefined,
    uuid: '',
    alterId: 0,
    cipher: 'auto',
    network: 'tcp',
    tls: false,
    servername: '',
    fingerprint: ''
  },
  vless: {
    name: '',
    type: 'vless',
    server: '',
    port: undefined,
    uuid: '',
    flow: '',
    network: 'tcp',
    tls: false,
    servername: '',
    fingerprint: ''
  },
  ss: {
    name: '',
    type: 'ss',
    server: '',
    port: undefined,
    cipher: undefined,
    password: '',
    plugin: undefined,
    'plugin-opts': undefined
  },
  ssr: {
    name: '',
    type: 'ssr',
    server: '',
    port: undefined,
    password: '',
    cipher: undefined,
    protocol: '',
    obfs: '',
    'obfs-param': '',
    'protocol-param': ''
  }
})

// 主表单数据（包含所有字段）
const formData = ref<ExtendedFormData>(defaultFormData())
const checkStrategy = ref<string>('default')

const vmessFormRef = ref<InstanceType<typeof VmessProtocolForm>>()
const vlessFormRef = ref<InstanceType<typeof VlessProtocolForm>>()
const ssFormRef = ref<InstanceType<typeof SsProtocolForm>>()
const ssrFormRef = ref<InstanceType<typeof SsrProtocolForm>>()
const traditionalFormRef = ref<InstanceType<typeof TraditionalProtocolForm>>()

// 判断是否为传统协议（HTTP/HTTPS/SOCKS5）
const isTraditionalProtocol = computed(() => {
  return ['http', 'https', 'socks5'].includes(formData.value.protocol)
})

// 端口验证器
const portValidator = (_rule: any, value: any, callback: any) => {
  if (value === undefined || value === null || value === '') {
    callback(new Error(t('proxy.portRequired')))
  } else if (typeof value === 'number') {
    if (value < 1 || value > 65535) {
      callback(new Error(t('proxy.portRange')))
    } else {
      callback()
    }
  } else {
    callback(new Error(t('proxy.portMustNumber')))
  }
}

const formRules = computed(() => {
  const baseRules: any = {
    name: [{ required: true, message: t('proxy.namePlaceholder'), trigger: 'blur' }],
    protocol: [{ required: true, message: t('proxy.protocolPlaceholder'), trigger: 'change' }]
  }

  const protocol = formData.value.protocol

  // 根据协议类型添加地址和端口的必填验证
  if (['http', 'https', 'socks5'].includes(protocol)) {
    // 传统协议
    baseRules.host = [{ required: true, message: t('proxy.hostPlaceholder'), trigger: 'blur' }]
    baseRules.port = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  } else if (protocol === 'vmess') {
    // VMess 协议
    baseRules['vmess.server'] = [
      { required: true, message: t('proxy.serverAddressRequired'), trigger: 'blur' }
    ]
    baseRules['vmess.port'] = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  } else if (protocol === 'vless') {
    // VLESS 协议
    baseRules['vless.server'] = [
      { required: true, message: t('proxy.serverAddressRequired'), trigger: 'blur' }
    ]
    baseRules['vless.port'] = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  } else if (protocol === 'ss') {
    // SS 协议
    baseRules['ss.server'] = [
      { required: true, message: t('proxy.serverAddressRequired'), trigger: 'blur' }
    ]
    baseRules['ss.port'] = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  } else if (protocol === 'ssr') {
    // SSR 协议
    baseRules['ssr.server'] = [
      { required: true, message: t('proxy.serverAddressRequired'), trigger: 'blur' }
    ]
    baseRules['ssr.port'] = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  }

  return baseRules
})
const operationType = ref<'add' | 'edit'>('add')

/**
 * 协议切换处理（优化版）
 */
const handleProtocolChange = () => {
  // ===== 公共状态清理 =====
  parsedInfo.value = null
  parseInput.value = ''
  testResult.value = null

  const defaults = defaultFormData()

  // 重置传统协议字段
  formData.value.host = defaults.host
  formData.value.port = defaults.port
  formData.value.username = defaults.username
  formData.value.password = defaults.password

  // 重置各协议配置对象
  formData.value.vmess = { ...defaults.vmess }
  formData.value.vless = { ...defaults.vless }
  formData.value.ss = { ...defaults.ss }
  formData.value.ssr = { ...defaults.ssr }

  setTimeout(() => {
    formRef.value?.clearValidate()
  }, 80)
}

const resetForm = () => {
  formRef.value?.resetFields()
  const defaults = defaultFormData()
  formData.value = { ...defaults }
  formRef.value?.clearValidate()
  testResult.value = null
  parseInput.value = ''
  showParseHelp.value = false
  parsedInfo.value = null
  // 清除规则缓存
  setTimeout(() => {
    formRef.value?.clearValidate()
  }, 80)
}

const handleCheckProxy = async () => {
  if (checking.value || saving.value) return

  // 前端节流：防止快速连续点击
  const now = Date.now()
  if (now - lastCheckTime < CHECK_THROTTLE_MS) {
    console.log('[ProxyDialog] Check throttled, please wait...')
    return
  }

  // 先验证必填字段
  try {
    await formRef.value?.validate()
  } catch {
    ElMessage.warning(t('proxy.fillRequiredFields'))
    return
  }

  checking.value = true
  testResult.value = null

  try {
    const updateData = buildUpdateData()
    const res = await ipc.invoke<any>(PROXY_EVENTS.CHECK_PROXY, {
      protocol: updateData.protocol,
      host: updateData.host,
      port: updateData.port,
      username: updateData.username || undefined,
      password: updateData.password || undefined,
      rawLink: updateData.rawLink || undefined
    })
    if (res.success) {
      testResult.value = { success: true, data: res?.data?.data || {} }
    } else {
      testResult.value = { success: false, error: res.error || t('proxy.testProxyFailed') }
    }
  } finally {
    checking.value = false
    lastCheckTime = Date.now()
  }
}
const buildUpdateData = () => {
  const protocol = formData.value.protocol

  const base: any = {
    name: formData.value.name,
    protocol
  }

  // 传统协议
  if (['http', 'https', 'socks5'].includes(protocol)) {
    return {
      ...base,
      host: formData.value.host,
      port: formData.value.port,
      username: formData.value.username || undefined,
      password: formData.value.password || undefined
    }
  }

  // 协议配置 map
  const map: Record<string, { config: any; serverKey?: string; portKey?: string }> = {
    vmess: { config: formData.value.vmess, serverKey: 'server', portKey: 'port' },
    vless: { config: formData.value.vless, serverKey: 'server', portKey: 'port' },
    ss: { config: formData.value.ss, serverKey: 'server', portKey: 'port' },
    ssr: { config: formData.value.ssr, serverKey: 'server', portKey: 'port' }
  }

  const entry = map[protocol]
  if (!entry) return base

  const cfg = { ...entry.config }

  return {
    ...base,
    rawLink: JSON.stringify(cfg),
    host: cfg[entry.serverKey!] || '',
    port: cfg[entry.portKey!] || 0
  }
}

const handleSave = async () => {
  if (checking.value || saving.value) return

  await formRef.value?.validate()

  saving.value = true
  try {
    const updateData = buildUpdateData()

    const res =
      operationType.value === 'edit'
        ? await ipc.invoke(PROXY_EVENTS.UPDATE_PROXY, {
            id: formData.value.id,
            updates: updateData
          })
        : await ipc.invoke(PROXY_EVENTS.ADD_PROXY, updateData)

    if (res.success) {
      ElMessage.success(t('common.operationSuccess'))
      visible.value = false
      emit('success')
    } else {
      ElMessage.error(res.error || t('common.operationFailed'))
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t('common.operationFailed'))
  } finally {
    // 等关闭弹窗动画完成后，再设置 loading 为 false
    setTimeout(() => {
      saving.value = false
    }, 300)
  }
}
const parseAndMerge = <T extends object>(target: T, rawLink?: string, errorMsg?: string) => {
  if (!rawLink) return
  try {
    const config = JSON.parse(rawLink)
    Object.assign(target, config)
  } catch {
    throw new Error(errorMsg || t('proxy.parseFailed'))
  }
}

// 获取当前检测策略

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

const init = (proxy?: Proxy | null, type: 'add' | 'edit' = 'add') => {
  visible.value = true
  operationType.value = type
  getCheckStrategy()

  if (!proxy || type !== 'edit') return

  // ① 基础字段
  Object.assign(formData.value, {
    name: proxy.name,
    protocol: proxy.protocol,
    id: proxy.id
  })

  const protocol = formData.value.protocol
  const rawLink = (proxy as any).rawLink || ''

  // ② 传统代理
  if (['http', 'https', 'socks5'].includes(protocol)) {
    Object.assign(formData.value, {
      host: proxy.host || '',
      port: proxy.port || 1080,
      username: proxy.username || '',
      password: proxy.password || ''
    })
    return
  }

  // ③ 协议 map（重点）
  const protocolMap: Record<string, { target: any; error: string }> = {
    vmess: { target: formData.value.vmess, error: t('proxy.parseVmessFailed') },
    vless: { target: formData.value.vless, error: t('proxy.parseVlessFailed') },
    ss: { target: formData.value.ss, error: t('proxy.parseSsFailed') },
    ssr: { target: formData.value.ssr, error: t('proxy.parseSsrFailed') }
  }

  const entry = protocolMap[protocol]
  if (entry) {
    parseAndMerge(entry.target, rawLink, entry.error)
  }
}

defineExpose({
  init
})

const handleClose = () => {
  resetForm()
  parseInput.value = ''
  showParseHelp.value = false
  parsedInfo.value = null
}

/**
 * 解析代理字符串
 */
const handleParse = () => {
  const input = parseInput.value.trim()

  if (!input) {
    return
  }

  try {
    // 检查是否是特殊协议
    const vmessMatch = input.match(/^vmess:\/\/(.+)/i)
    const ssMatch = input.match(/^ss:\/\/(.+)/i)
    const vlessMatch = input.match(/^vless:\/\/(.+)/i)
    const ssrMatch = input.match(/^ssr:\/\/(.+)/i)
    const httpMatch = input.match(/^http:\/\/(.+)/i)
    const httpsMatch = input.match(/^https:\/\/(.+)/i)
    const socks5Match = input.match(/^socks5:\/\/(.+)/i)

    if (vmessMatch) {
      formData.value.protocol = 'vmess'
      nextTick(() => {
        setTimeout(() => {
          vmessFormRef.value?.parseVmessLink(input)
          formRef.value?.clearValidate()
        }, 80)
      })
      return
    }

    if (vlessMatch) {
      formData.value.protocol = 'vless'
      nextTick(() => {
        setTimeout(() => {
          vlessFormRef.value?.parseVlessLink(input)
          formRef.value?.clearValidate()
        }, 80)
      })
      return
    }

    if (ssMatch) {
      formData.value.protocol = 'ss'
      nextTick(() => {
        setTimeout(() => {
          ssFormRef.value?.parseSsLink(input)
          formRef.value?.clearValidate()
        }, 80)
      })
      return
    }

    if (ssrMatch) {
      formData.value.protocol = 'ssr'
      nextTick(() => {
        setTimeout(() => {
          ssrFormRef.value?.parseSsrLink(input)
          formRef.value?.clearValidate()
        }, 80)
      })
      return
    }

    // 处理 HTTP/HTTPS/SOCKS5 协议

    if (httpMatch || httpsMatch) {
      formData.value.protocol = 'http'
      nextTick(() => {
        setTimeout(() => {
          traditionalFormRef.value?.parseTraditionalLink(input)
          formRef.value?.clearValidate()
        }, 80)
      })
      return
    }

    if (socks5Match) {
      formData.value.protocol = 'socks5'
      nextTick(() => {
        setTimeout(() => {
          traditionalFormRef.value?.parseTraditionalLink(input)
          formRef.value?.clearValidate()
        }, 80)
      })
      return
    }
  } catch (error: any) {
    console.error(error)
  }
}
</script>

<style scoped lang="scss">
.proxy-dialog-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  max-height: 500px;
  overflow-y: auto;
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

.parse-section {
  margin-bottom: 15px;
  padding: 10px;
  background-color: var(--el-bg-color-page);
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
}

.parse-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.parse-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.parse-input-group {
  margin-bottom: 8px;
}

.parse-help {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--el-bg-color);
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
}

.help-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.help-examples {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-category {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.category-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.help-item {
  font-size: 12px;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;

  code {
    padding: 2px 6px;
    background-color: var(--el-bg-color-page);
    border: 1px solid var(--el-border-color);
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    color: var(--el-color-primary);
    font-size: 12px;
  }
}

.help-note {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-style: italic;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.5;
}
</style>
