<template>
  <div class="traditional-protocol-form">
    <el-form-item label="地址" prop="host">
      <el-input
        v-model.trim="modelValue.host"
        maxlength="200"
        show-word-limit
        placeholder="请输入地址"
      />
    </el-form-item>
    <el-form-item label="端口" prop="port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        placeholder="请输入端口"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item label="用户名" prop="username">
      <el-input
        v-model.trim="modelValue.username"
        maxlength="200"
        show-word-limit
        placeholder="请输入用户名（可选）"
      />
    </el-form-item>
    <el-form-item label="密码" prop="password">
      <el-input
        v-model.trim="modelValue.password"
        type="password"
        placeholder="请输入密码（可选）"
        show-password
        maxlength="200"
        show-word-limit
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import parseUri from '@renderer/utils/uri-parser'
import { ElMessage } from 'element-plus'
const modelValue = defineModel<any>({ required: true })

/**
 * 解析 传统协议 链接并填充到表单（供外部调用）
 */
const parseTraditionalLink = (link: string) => {
  try {
    const result = parseUri(link)
    if (!result) return

    modelValue.value = {
      ...modelValue.value,
      ...(result as IProxyShadowsocksConfig),
      host: result.server
    }
  } catch (error: any) {
    error.message && ElMessage.error(error.message)
  }
}
defineExpose({
  parseTraditionalLink
})
</script>

<style scoped lang="scss">
// 组件样式
</style>
