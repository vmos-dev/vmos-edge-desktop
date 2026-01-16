<template>
  <div class="vless-protocol-form">
    <el-form-item label="服务器地址" prop="vless.server">
      <el-input
        v-model.trim="modelValue.server"
        maxlength="200"
        show-word-limit
        placeholder="请输入服务器地址"
      />
    </el-form-item>
    <el-form-item label="端口" prop="vless.port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        placeholder="请输入端口"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item label="用户ID (UUID)" prop="vless.uuid">
      <el-input
        v-model.trim="modelValue.uuid"
        maxlength="200"
        show-word-limit
        placeholder="请输入用户ID"
      />
    </el-form-item>
    <el-form-item label="流控 (Flow)" prop="vless.flow">
      <el-input
        v-model.trim="modelValue.flow"
        maxlength="50"
        placeholder="请输入流控，如 xtls-rprx-vision"
      />
    </el-form-item>
    <el-form-item label="传输协议" prop="vless.network">
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
    <el-form-item label="TLS" prop="vless.tls">
      <el-switch v-model="modelValue.tls" />
    </el-form-item>

    <template v-if="modelValue.tls">
      <el-form-item label="SNI" prop="vless.servername">
        <el-input
          v-model.trim="modelValue.servername"
          maxlength="200"
          placeholder="Server Name Indication"
        />
      </el-form-item>
      <el-form-item label="Fingerprint" prop="vless.fingerprint">
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
import { ElMessage } from 'element-plus'
import parseUri from '@renderer/utils/uri-parser'

const modelValue = defineModel<IProxyVlessConfig>({ required: true })

/**
 * 解析 VLESS 链接并填充到表单（供外部调用）
 */
const parseVlessLink = (link: string) => {
  try {
    const result = parseUri(link)
    if (!result) return

    modelValue.value = {
      ...modelValue.value,
      ...(result as IProxyVlessConfig)
    }
  } catch (error: any) {
    error.message && ElMessage.error(error.message)
  }
}

defineExpose({
  parseVlessLink
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
