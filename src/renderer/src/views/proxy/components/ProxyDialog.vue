<template>
  <VmosDialog
    v-model="visible"
    :title="operationType === 'edit' ? '编辑代理' : '添加代理'"
    width="650px"
    :show-close="!saving && !checking"
    :close-on-click-modal="false"
    @closed="handleClose"
  >
    <div class="proxy-dialog-content">
      <!-- 一键解析区域 -->
      <div class="parse-section">
        <div class="parse-header">
          <span class="parse-title">自动解析</span>
          <el-button text type="primary" size="small" @click="showParseHelp = !showParseHelp">
            <el-icon size="16"><InfoFilled /></el-icon>&nbsp; 格式说明
          </el-button>
        </div>
        <div class="parse-input-group">
          <el-input
            v-model.trim="parseInput"
            placeholder="粘贴代理字符串，支持多种格式"
            clearable
            @blur="handleParse"
            @keyup.enter="handleParse"
          >
          </el-input>
        </div>
        <el-collapse-transition>
          <div v-show="showParseHelp" class="parse-help">
            <div class="help-title">支持的格式：</div>
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
                  必须使用标准 URL 格式，用户信息位于 @ 之前。
                  <br />
                  支持查询参数：tls、fingerprint、skip-cert-verify、ip-version (ipv4/ipv6/dual)
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
                  必须使用标准 URL 格式，用户信息位于 @ 之前。
                  <br />
                  支持查询参数：tls、fingerprint、skip-cert-verify、udp、ip-version (ipv4/ipv6/dual)
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
                  支持 SIP002、Legacy 格式，插件参数（plugin、v2ray-plugin），查询参数（uot、tfo）
                </div>
              </div>
              <div class="help-category">
                <div class="category-title">ShadowsocksR (SSR)：</div>
                <div class="help-item">
                  <code>ssr://base64(host:port:protocol:method:obfs:password/...)</code>
                </div>
                <div class="help-note" style="padding-left: 12px; margin-top: 4px">
                  base64 编码格式，支持查询参数：remarks、protoparam、obfsparam
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
                  支持 V2rayN JSON 格式、Shadowrocket 格式 (remarks, obfs, path, tls 等)、Quantumult
                  格式
                </div>
              </div>
              <div class="help-category">
                <div class="category-title">VLESS：</div>
                <div class="help-item">
                  <code>vless://uuid@host:port?params#remarks</code>
                </div>
                <div class="help-note" style="padding-left: 12px; margin-top: 4px">
                  支持参数：security, sni, flow, type, serviceName, headerType, host, path, fp,
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
        <el-form-item label="名称" prop="name">
          <el-input
            v-model.trim="formData.name"
            maxlength="200"
            show-word-limit
            placeholder="请输入名称"
          />
        </el-form-item>
        <el-form-item label="代理协议" prop="protocol">
          <el-select
            v-model="formData.protocol"
            placeholder="请选择代理协议"
            style="width: 100%"
            @change="handleProtocolChange"
          >
            <el-option label="HTTP" value="http" />
            <!-- <el-option label="HTTPS" value="https" /> -->
            <el-option label="SOCKS5" value="socks5" />
            <el-option label="VMess" value="vmess" />
            <el-option label="VLESS" value="vless" />
            <el-option label="Shadowsocks (SS)" value="ss" />
            <el-option label="ShadowsocksR (SSR)" value="ssr" />
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
            <el-icon><Check /></el-icon>

            <span
              >检测通过。
              <template v-if="testResult?.data?.providerType !== 'default'">
                IP: {{ testResult?.data?.ip || '-' }}，地区:
                {{ testResult?.data?.country || '-' }}，时区：{{
                  testResult?.data?.timezone || '-'
                }}，经纬度: {{ testResult?.data?.loc || '-' }}
              </template></span
            >
          </div>
          <div
            :class="['test-result', testResult?.success ? 'test-success' : 'test-failure']"
            v-else
          >
            <el-icon><Close /></el-icon>
            <span>检测失败! {{ testResult?.error || '' }}</span>
          </div>
        </template>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div
          class="check-strategy-wrapper"
          v-if="['http', 'https', 'socks5'].includes(formData.protocol)"
        >
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
            :loading="checking || saving"
            @click="handleCheckProxy"
            size="small"
            plain
            type="primary"
          >
            <el-icon class="el-icon--left"><Connection /></el-icon>
            代理检测
          </el-button>
        </div>

        <span class="check-strategy-info" v-else> 代理检测功能仅支持 HTTP/HTTPS/SOCKS5 协议 </span>
        <div class="dialog-actions">
          <el-button @click="visible = false" :disabled="saving || checking" size="default">
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="saving"
            @click="handleSave"
            :disabled="saving || checking"
            size="default"
            >保存</el-button
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

const visible = ref(false)
const saving = ref(false)
const checking = ref(false)
const testResult = ref<{ success: boolean; data?: any; error?: string } | null>(null)
const parseInput = ref('')
const showParseHelp = ref(false)
const parsedInfo = ref<any>(null)
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
    callback(new Error('请输入端口'))
  } else if (typeof value === 'number') {
    if (value < 1 || value > 65535) {
      callback(new Error('端口范围：1-65535'))
    } else {
      callback()
    }
  } else {
    callback(new Error('端口必须是数字'))
  }
}

const formRules = computed(() => {
  const baseRules: any = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    protocol: [{ required: true, message: '请选择代理协议', trigger: 'change' }]
  }

  const protocol = formData.value.protocol

  // 根据协议类型添加地址和端口的必填验证
  if (['http', 'https', 'socks5'].includes(protocol)) {
    // 传统协议
    baseRules.host = [{ required: true, message: '请输入地址', trigger: 'blur' }]
    baseRules.port = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  } else if (protocol === 'vmess') {
    // VMess 协议
    baseRules['vmess.server'] = [{ required: true, message: '请输入服务器地址', trigger: 'blur' }]
    baseRules['vmess.port'] = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  } else if (protocol === 'vless') {
    // VLESS 协议
    baseRules['vless.server'] = [{ required: true, message: '请输入服务器地址', trigger: 'blur' }]
    baseRules['vless.port'] = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  } else if (protocol === 'ss') {
    // SS 协议
    baseRules['ss.server'] = [{ required: true, message: '请输入服务器地址', trigger: 'blur' }]
    baseRules['ss.port'] = [{ validator: portValidator, trigger: ['blur', 'change'] }]
  } else if (protocol === 'ssr') {
    // SSR 协议
    baseRules['ssr.server'] = [{ required: true, message: '请输入服务器地址', trigger: 'blur' }]
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

  // VMESS, VLESS, SS, SSR 协议不支持检测
  if (
    formData.value.protocol === 'vmess' ||
    formData.value.protocol === 'vless' ||
    formData.value.protocol === 'ss' ||
    formData.value.protocol === 'ssr'
  ) {
    ElMessage.warning(`${formData.value.protocol.toUpperCase()} 协议不支持代理检测功能`)
    return
  }

  // 先验证必填字段
  try {
    await formRef.value?.validateField('protocol')
    await formRef.value?.validateField('host')
    await formRef.value?.validateField('port')
  } catch {
    ElMessage.warning('请先填写必填字段')
    return
  }

  checking.value = true
  testResult.value = null

  try {
    const res = await ipc.invoke<any>(PROXY_EVENTS.CHECK_PROXY, {
      protocol: formData.value.protocol,
      host: formData.value.host,
      port: formData.value.port,
      username: formData.value.username || undefined,
      password: formData.value.password || undefined
    })
    if (res.success) {
      testResult.value = { success: true, data: res?.data?.data || {} }
    } else {
      testResult.value = { success: false, error: res.error || '检测代理失败' }
    }
  } finally {
    checking.value = false
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
      ElMessage.success('操作成功')
      visible.value = false
      emit('success')
    } else {
      ElMessage.error(res.error || '操作失败')
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败')
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
    throw new Error(errorMsg || '解析失败')
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
    vmess: { target: formData.value.vmess, error: '解析 VMESS 链接失败' },
    vless: { target: formData.value.vless, error: '解析 VLESS 链接失败' },
    ss: { target: formData.value.ss, error: '解析 SS 链接失败' },
    ssr: { target: formData.value.ssr, error: '解析 SSR 链接失败' }
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

.parse-section {
  margin-bottom: 15px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
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
  color: #303133;
}

.parse-input-group {
  margin-bottom: 8px;
}

.parse-help {
  margin-top: 12px;
  padding: 12px;
  background-color: #fff;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.help-title {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
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
  color: #409eff;
  margin-bottom: 4px;
}

.help-item {
  font-size: 12px;
  color: #606266;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;

  code {
    padding: 2px 6px;
    background-color: #f5f7fa;
    border: 1px solid #e4e7ed;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    color: #409eff;
    font-size: 12px;
  }
}

.help-note {
  font-size: 11px;
  color: #909399;
  font-style: italic;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.5;
}
</style>
