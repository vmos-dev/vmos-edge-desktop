<template>
  <div class="vmess-protocol-form">
    <el-form-item label="服务器地址" prop="vmess.server">
      <el-input
        v-model.trim="modelValue.server"
        maxlength="200"
        show-word-limit
        placeholder="请输入服务器地址"
      />
    </el-form-item>
    <el-form-item label="端口" prop="vmess.port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        placeholder="请输入端口"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item label="用户ID (UUID)" prop="vmess.uuid">
      <el-input
        v-model.trim="modelValue.uuid"
        maxlength="200"
        show-word-limit
        placeholder="请输入用户ID"
      />
    </el-form-item>
    <el-form-item label="额外ID (AlterId)" prop="vmess.alterId">
      <el-input-number
        v-model="modelValue.alterId"
        :min="0"
        :max="65535"
        placeholder="请输入AlterId (默认0)"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item label="加密方式" prop="vmess.cipher">
      <el-select v-model="modelValue.cipher" placeholder="请选择加密方式" style="width: 100%">
        <el-option label="Auto" value="auto" />
        <el-option label="AES-128-GCM" value="aes-128-gcm" />
        <el-option label="ChaCha20-Poly1305" value="chacha20-poly1305" />
        <el-option label="None" value="none" />
      </el-select>
    </el-form-item>
    <el-form-item label="传输协议" prop="vmess.network">
      <el-select v-model="modelValue.network" placeholder="请选择传输协议" style="width: 100%">
        <el-option label="TCP" value="tcp" />
        <el-option label="UDP" value="udp" />
        <el-option label="WebSocket" value="ws" />
        <el-option label="HTTP/2" value="h2" />
        <el-option label="gRPC" value="grpc" />
        <el-option label="QUIC" value="quic" />
        <el-option label="mKCP" value="kcp" />
      </el-select>
    </el-form-item>
    <el-form-item label="TLS" prop="vmess.tls">
      <el-switch v-model="modelValue.tls" />
    </el-form-item>

    <template v-if="modelValue.tls">
      <el-form-item label="SNI" prop="vmess.servername">
        <el-input
          v-model.trim="modelValue.servername"
          maxlength="200"
          placeholder="Server Name Indication"
        />
      </el-form-item>
      <el-form-item label="Fingerprint" prop="vmess.fingerprint">
        <el-input
          v-model.trim="modelValue.fingerprint"
          maxlength="50"
          placeholder="TLS Fingerprint (e.g. chrome, firefox)"
        />
      </el-form-item>
    </template>
  </div>
</template>

<script setup lang="ts">
import parseUri from '@renderer/utils/uri-parser'
import { ElMessage } from 'element-plus'

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
  color: #909399;
  margin-top: 4px;
  line-height: 1.5;
}
</style>
