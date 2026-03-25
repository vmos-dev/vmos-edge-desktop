<template>
  <div class="traditional-protocol-form">
    <el-form-item :label="t('proxy.address')" prop="host">
      <el-input
        v-model.trim="modelValue.host"
        maxlength="200"
        show-word-limit
        :placeholder="t('proxy.addressPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.port')" prop="port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        :placeholder="t('proxy.portPlaceholder')"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.username')" prop="username">
      <el-input
        v-model.trim="modelValue.username"
        maxlength="200"
        show-word-limit
        :placeholder="t('proxy.usernamePlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.password')" prop="password">
      <el-input
        v-model.trim="modelValue.password"
        type="password"
        :placeholder="t('proxy.passwordOptional')"
        show-password
        maxlength="200"
        show-word-limit
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { parseUri } from '@vmosedge/proxy-sdk/parser'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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
      //@ts-ignore
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
