<template>
  <div class="ssr-protocol-form">
    <el-form-item label="服务器地址" prop="ssr.server">
      <el-input
        v-model.trim="modelValue.server"
        maxlength="200"
        show-word-limit
        placeholder="请输入服务器地址"
      />
    </el-form-item>
    <el-form-item label="端口" prop="ssr.port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        placeholder="请输入端口"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item label="密码" prop="ssr.password">
      <el-input
        v-model.trim="modelValue.password"
        type="password"
        placeholder="请输入密码"
        show-password
        maxlength="200"
        show-word-limit
      />
    </el-form-item>
    <el-form-item label="加密方法" prop="ssr.cipher">
      <el-input
        v-model.trim="modelValue.cipher"
        maxlength="50"
        placeholder="请输入加密方法，如：aes-256-cfb"
      />
    </el-form-item>
    <el-form-item label="协议" prop="ssr.protocol">
      <el-input
        v-model.trim="modelValue.protocol"
        maxlength="50"
        placeholder="请输入协议，如：origin"
      />
    </el-form-item>
    <el-form-item label="混淆" prop="ssr.obfs">
      <el-input v-model.trim="modelValue.obfs" maxlength="50" placeholder="请输入混淆，如：plain" />
    </el-form-item>
    <el-form-item label="混淆参数" prop="ssr.obfs-param">
      <el-input
        v-model.trim="modelValue['obfs-param']"
        maxlength="200"
        placeholder="请输入混淆参数（可选）"
      />
    </el-form-item>
    <el-form-item label="协议参数" prop="ssr.protocol-param">
      <el-input
        v-model.trim="modelValue['protocol-param']"
        maxlength="200"
        placeholder="请输入协议参数（可选）"
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import parseUri from '@renderer/utils/uri-parser'
import { ElMessage } from 'element-plus'

const modelValue = defineModel<IProxyshadowsocksRConfig>({ required: true })

/**
 * 解析 SSR 链接并填充到表单（供外部调用）
 */
const parseSsrLink = (link: string) => {
  try {
    const result = parseUri(link)
    if (!result) return

    modelValue.value = {
      ...modelValue.value,
      ...(result as IProxyshadowsocksRConfig)
    }
  } catch (error: any) {
    error.message && ElMessage.error(error.message)
  }
}

defineExpose({
  parseSsrLink
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
