<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { parseUri } from '@vmosedge/proxy-sdk/parser'
import { useI18n } from 'vue-i18n'
import type { CustomProxyFormModel, ParsedProxyResult } from './customProxyTypes'
import { useDebounceFn } from '@renderer/utils/useDebounceFn'

const props = defineProps<{
  modelValue: CustomProxyFormModel
}>()

const emit = defineEmits<{
  'update:modelValue': [CustomProxyFormModel]
  'parse-success': [ParsedProxyResult]
  'parse-fail': []
}>()

const { t } = useI18n()

const nameModel = computed({
  get: () => props.modelValue.name,
  set: (val: string) => emit('update:modelValue', { ...props.modelValue, name: val })
})

const rawLinkModel = computed({
  get: () => props.modelValue.rawLink,
  set: (val: string) => emit('update:modelValue', { ...props.modelValue, rawLink: val })
})

const mapProtocol = (type: string, config: Record<string, any>): ParsedProxyResult['protocol'] => {
  if (type === 'http' && config.tls) return 'https'
  return type as ParsedProxyResult['protocol']
}

const tryParse = (link: string) => {
  if (!link.trim()) {
    emit('update:modelValue', {
      ...props.modelValue,
      rawLink: link,
      parsed: null,
      parseError: false
    })
    return
  }

  try {
    const config = parseUri(link.trim()) as Record<string, any>
    const result: ParsedProxyResult = {
      protocol: mapProtocol(config.type, config),
      host: config.server || '',
      port: Number(config.port) || 0,
      username: config.username,
      password: config.password,
      rawLink: link.trim(),
      rawConfig: config
    }

    emit('update:modelValue', {
      ...props.modelValue,
      rawLink: link,
      parsed: result,
      parseError: false
    })
    emit('parse-success', result)
  } catch {
    emit('update:modelValue', {
      ...props.modelValue,
      rawLink: link,
      parsed: null,
      parseError: true
    })
    emit('parse-fail')
  }
}

const debouncedParse = useDebounceFn(tryParse, 300)

watch(
  () => props.modelValue.rawLink,
  (val) => debouncedParse(val)
)

const showParseHelp = shallowRef(false)
const parsed = computed(() => props.modelValue.parsed)
const parseError = computed(() => props.modelValue.parseError)
const isTraditional = computed(() =>
  parsed.value ? ['http', 'https', 'socks5'].includes(parsed.value.protocol) : false
)
</script>

<template>
  <div class="custom-proxy-input">
    <!-- 代理名称 -->
    <el-form-item class="custom-proxy-field">
      <template #label>{{ t('cloudPhone.customProxyName') }}</template>
      <el-input v-model="nameModel" :placeholder="t('cloudPhone.customProxyNamePlaceholder')" />
    </el-form-item>

    <!-- 代理链接 -->
    <el-form-item class="custom-proxy-field">
      <template #label>
        <span class="required-mark">*</span>
        {{ t('cloudPhone.customProxyLink') }}
      </template>
      <el-input
        v-model="rawLinkModel"
        type="textarea"
        :rows="2"
        :placeholder="t('proxy.parsePlaceholder')"
      />
    </el-form-item>

    <!-- 格式说明 -->
    <div class="format-help-toggle">
      <el-button text type="primary" size="small" @click="showParseHelp = !showParseHelp">
        <el-icon size="16"><InfoFilled /></el-icon>&nbsp; {{ t('proxy.formatHelp') }}
      </el-button>
    </div>
    <el-collapse-transition>
      <div v-show="showParseHelp" class="parse-help">
        <div class="help-title">{{ t('proxy.supportedFormats') }}</div>
        <div class="help-examples">
          <div class="help-category">
            <div class="category-title">HTTP / HTTPS：</div>
            <div class="help-item"><code>http://username:password@host:port</code></div>
            <div class="help-item"><code>http://host:port</code></div>
            <div class="help-item"><code>https://username:password@host:port</code></div>
            <div class="help-note">{{ t('proxy.httpHttpsNote') }}</div>
          </div>
          <div class="help-category">
            <div class="category-title">SOCKS5：</div>
            <div class="help-item"><code>socks5://username:password@host:port</code></div>
            <div class="help-item"><code>socks5://host:port</code></div>
            <div class="help-note">{{ t('proxy.socks5Note') }}</div>
          </div>
          <div class="help-category">
            <div class="category-title">Shadowsocks (SS)：</div>
            <div class="help-item">
              <code>ss://base64(method:password)@host:port[?plugin=...][#remarks]</code>
            </div>
            <div class="help-item">
              <code>ss://base64(method:password@host:port)[?plugin=...][#remarks]</code>
            </div>
            <div class="help-note">{{ t('proxy.ssNote') }}</div>
          </div>
          <div class="help-category">
            <div class="category-title">ShadowsocksR (SSR)：</div>
            <div class="help-item">
              <code>ssr://base64(host:port:protocol:method:obfs:password/...)</code>
            </div>
            <div class="help-note">{{ t('proxy.ssrNote') }}</div>
          </div>
          <div class="help-category">
            <div class="category-title">VMess：</div>
            <div class="help-item"><code>vmess://base64(json)</code></div>
            <div class="help-item"><code>vmess://base64?params</code></div>
            <div class="help-note">{{ t('proxy.vmessNote') }}</div>
          </div>
          <div class="help-category">
            <div class="category-title">VLESS：</div>
            <div class="help-item"><code>vless://uuid@host:port?params#remarks</code></div>
            <div class="help-note">{{ t('proxy.vlessNote') }}</div>
          </div>
        </div>
      </div>
    </el-collapse-transition>

    <!-- 解析失败提示 -->
    <div v-if="parseError" class="parse-error">
      {{ t('cloudPhone.parseFailed') }}
    </div>

    <!-- 解析结果（只读，风格与出口信息卡片一致） -->
    <div v-if="parsed" class="parse-result-card">
      <div class="parse-result-title">{{ t('cloudPhone.parseResult') }}</div>
      <div class="parse-result-grid">
        <!-- 公共字段 -->
        <div class="parse-result-item">
          <span class="parse-result-label">{{ t('proxy.protocol') }}</span>
          <span class="parse-result-value" :title="parsed.protocol">{{ parsed.protocol }}</span>
        </div>
        <div class="parse-result-item">
          <span class="parse-result-label">{{
            isTraditional ? t('proxy.address') : t('proxy.serverAddress')
          }}</span>
          <span class="parse-result-value" :title="parsed.host">{{ parsed.host }}</span>
        </div>
        <div class="parse-result-item">
          <span class="parse-result-label">{{ t('proxy.port') }}</span>
          <span class="parse-result-value" :title="String(parsed.port)">{{ parsed.port }}</span>
        </div>

        <!-- HTTP/HTTPS/SOCKS5 -->
        <template v-if="isTraditional">
          <div v-if="parsed.username" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.username') }}</span>
            <span class="parse-result-value" :title="parsed.username">{{ parsed.username }}</span>
          </div>
          <div v-if="parsed.rawConfig?.password" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.password') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.password">{{
              parsed.rawConfig.password
            }}</span>
          </div>
        </template>

        <!-- VMess -->
        <template v-if="parsed.protocol === 'vmess'">
          <div v-if="parsed.rawConfig?.uuid" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.userId') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.uuid">{{
              parsed.rawConfig.uuid
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.alterId !== undefined" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.alterId') }}</span>
            <span class="parse-result-value" :title="String(parsed.rawConfig.alterId)">{{
              parsed.rawConfig.alterId
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.cipher" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.encryption') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.cipher">{{
              parsed.rawConfig.cipher
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.network" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.transportProtocol') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.network">{{
              parsed.rawConfig.network
            }}</span>
          </div>
          <div class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.tls') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig?.tls ? 'ON' : 'OFF'">{{
              parsed.rawConfig?.tls ? 'ON' : 'OFF'
            }}</span>
          </div>
          <div
            v-if="parsed.rawConfig?.tls && parsed.rawConfig?.servername"
            class="parse-result-item"
          >
            <span class="parse-result-label">{{ t('proxy.sni') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.servername">{{
              parsed.rawConfig.servername
            }}</span>
          </div>
        </template>

        <!-- VLESS -->
        <template v-if="parsed.protocol === 'vless'">
          <div v-if="parsed.rawConfig?.uuid" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.userId') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.uuid">{{
              parsed.rawConfig.uuid
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.flow" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.flow') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.flow">{{
              parsed.rawConfig.flow
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.network" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.transportProtocol') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.network">{{
              parsed.rawConfig.network
            }}</span>
          </div>
          <div class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.tls') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig?.tls ? 'ON' : 'OFF'">{{
              parsed.rawConfig?.tls ? 'ON' : 'OFF'
            }}</span>
          </div>
          <div
            v-if="parsed.rawConfig?.tls && parsed.rawConfig?.servername"
            class="parse-result-item"
          >
            <span class="parse-result-label">{{ t('proxy.sni') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.servername">{{
              parsed.rawConfig.servername
            }}</span>
          </div>
        </template>

        <!-- SS -->
        <template v-if="parsed.protocol === 'ss'">
          <div v-if="parsed.rawConfig?.cipher" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.cipher') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.cipher">{{
              parsed.rawConfig.cipher
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.password" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.password') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.password">{{
              parsed.rawConfig.password
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.plugin" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.plugin') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.plugin">{{
              parsed.rawConfig.plugin
            }}</span>
          </div>
        </template>

        <!-- SSR -->
        <template v-if="parsed.protocol === 'ssr'">
          <div v-if="parsed.rawConfig?.cipher" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.cipher') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.cipher">{{
              parsed.rawConfig.cipher
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.password" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.password') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.password">{{
              parsed.rawConfig.password
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.protocol" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.protocol') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.protocol">{{
              parsed.rawConfig.protocol
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.obfs" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.obfs') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig.obfs">{{
              parsed.rawConfig.obfs
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.['obfs-param']" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.obfsParam') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig['obfs-param']">{{
              parsed.rawConfig['obfs-param']
            }}</span>
          </div>
          <div v-if="parsed.rawConfig?.['protocol-param']" class="parse-result-item">
            <span class="parse-result-label">{{ t('proxy.protocolParam') }}</span>
            <span class="parse-result-value" :title="parsed.rawConfig['protocol-param']">{{
              parsed.rawConfig['protocol-param']
            }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.custom-proxy-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.custom-proxy-field {
  margin-bottom: 10px;
}

.required-mark {
  color: var(--el-color-danger);
}

.format-help-toggle {
  margin-bottom: 8px;
}

.parse-help {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
  line-height: 1.6;
}

.help-title {
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.help-examples {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.help-category {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-title {
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.help-item {
  padding-left: 12px;
  color: var(--el-text-color-secondary);

  code {
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--el-fill-color);
  }
}

.help-note {
  padding-left: 12px;
  margin-top: 4px;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.parse-error {
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--el-color-danger-light-7);
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  font-size: 12px;
}

.parse-result-card {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
}

.parse-result-title {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 500;
}

.parse-result-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
}

.parse-result-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  line-height: 1.6;
}

.parse-result-label {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.parse-result-value {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
