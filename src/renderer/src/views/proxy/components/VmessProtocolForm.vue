<template>
  <div class="vmess-protocol-form">
    <el-form-item :label="t('proxy.serverAddress')" prop="vmess.server">
      <el-input
        v-model.trim="modelValue.server"
        maxlength="200"
        show-word-limit
        :placeholder="t('proxy.serverAddressPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.port')" prop="vmess.port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        :placeholder="t('proxy.portPlaceholder')"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.userId')" prop="vmess.uuid">
      <el-input
        v-model.trim="modelValue.uuid"
        maxlength="200"
        show-word-limit
        :placeholder="t('proxy.userIdPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.alterId')" prop="vmess.alterId">
      <el-input-number
        v-model="modelValue.alterId"
        :min="0"
        :max="65535"
        :placeholder="t('proxy.alterIdPlaceholder')"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.encryption')" prop="vmess.cipher">
      <el-select v-model="modelValue.cipher" :placeholder="t('proxy.encryptionPlaceholder')" style="width: 100%">
        <el-option label="Auto" value="auto" />
        <el-option label="AES-128-GCM" value="aes-128-gcm" />
        <el-option label="ChaCha20-Poly1305" value="chacha20-poly1305" />
        <el-option label="None" value="none" />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('proxy.transportProtocol')" prop="vmess.network">
      <el-select v-model="modelValue.network" :placeholder="t('proxy.transportProtocolPlaceholder')" style="width: 100%">
        <el-option label="TCP" value="tcp" />
        <el-option label="UDP" value="udp" />
        <el-option label="WebSocket" value="ws" />
        <el-option label="HTTP/2" value="h2" />
        <el-option label="gRPC" value="grpc" />
        <el-option label="QUIC" value="quic" />
        <el-option label="mKCP" value="kcp" />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('proxy.tls')" prop="vmess.tls">
      <el-switch v-model="modelValue.tls" />
    </el-form-item>

    <template v-if="modelValue.tls">
      <el-form-item :label="t('proxy.sni')" prop="vmess.servername">
        <el-input
          v-model.trim="modelValue.servername"
          maxlength="200"
          placeholder="Server Name Indication"
        />
      </el-form-item>
      <el-form-item :label="t('proxy.fingerprint')" prop="vmess.fingerprint">
        <el-input
          v-model.trim="modelValue.fingerprint"
          maxlength="50"
          :placeholder="t('proxy.fingerprintPlaceholder')"
        />
      </el-form-item>
    </template>
  </div>
</template>

<script setup lang="ts">
import parseUri from '@renderer/utils/uri-parser'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const modelValue = defineModel<IProxyVmessConfig>({ required: true })

/**
 * 解析 VMESS 链接并填充到表单（供外部调用）
 */
const parseVmessLink = (link: string) => {
  try {
    const result = parseUri(link)
    if (!result) return

    modelValue.value = {
      ...modelValue.value,
      ...(result as IProxyVmessConfig)
    }
  } catch (error: any) {
    error.message && ElMessage.error(error.message)
  }
}

defineExpose({
  parseVmessLink
})
</script>

<style scoped lang="scss">
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.5;
}
</style>
