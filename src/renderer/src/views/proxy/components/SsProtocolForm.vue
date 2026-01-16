<template>
  <div class="ss-protocol-form">
    <el-form-item label="服务器地址" prop="ss.server">
      <el-input
        v-model.trim="modelValue.server"
        maxlength="200"
        show-word-limit
        placeholder="请输入服务器地址"
      />
    </el-form-item>

    <el-form-item label="端口" prop="ss.port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        placeholder="请输入端口"
        style="width: 100%"
      />
    </el-form-item>

    <el-form-item label="加密方法" prop="ss.cipher">
      <el-input
        v-model.trim="modelValue.cipher"
        maxlength="200"
        show-word-limit
        placeholder="请输入加密方法，如：aes-256-gcm、aes-128-gcm、chacha20-poly1305 等"
      />
    </el-form-item>

    <el-form-item label="密码" prop="ss.password">
      <el-input
        v-model.trim="modelValue.password"
        type="password"
        placeholder="请输入密码"
        show-password
        maxlength="200"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="插件 (Plugin)" prop="ss.plugin">
      <el-input
        v-model.trim="modelValue.plugin"
        maxlength="200"
        placeholder="插件名称 (如 obfs-local)"
      />
    </el-form-item>

    <el-form-item label="插件参数" prop="ss.plugin-opts">
      <el-input
        v-model.trim="modelValue['plugin-opts']"
        type="textarea"
        :rows="4"
        maxlength="500"
        placeholder="插件参数"
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import parseUri from '@renderer/utils/uri-parser'
import { ElMessage } from 'element-plus'

const modelValue = defineModel<IProxyShadowsocksConfig>({ required: true })

/**
 * 解析 SS 链接并填充到表单（供外部调用）
 */
const parseSsLink = (link: string) => {
  try {
    const result = parseUri(link)
    if (!result) return

    modelValue.value = {
      ...modelValue.value,
      ...(result as IProxyShadowsocksConfig)
    }
  } catch (error: any) {
    error.message && ElMessage.error(error.message)
  }
}

defineExpose({
  parseSsLink
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
