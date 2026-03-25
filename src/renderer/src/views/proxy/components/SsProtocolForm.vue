<template>
  <div class="ss-protocol-form">
    <el-form-item :label="t('proxy.serverAddress')" prop="ss.server">
      <el-input
        v-model.trim="modelValue.server"
        maxlength="200"
        show-word-limit
        :placeholder="t('proxy.serverAddressPlaceholder')"
      />
    </el-form-item>

    <el-form-item :label="t('proxy.port')" prop="ss.port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        :placeholder="t('proxy.portPlaceholder')"
        style="width: 100%"
      />
    </el-form-item>

    <el-form-item :label="t('proxy.cipher')" prop="ss.cipher">
      <el-input
        v-model.trim="modelValue.cipher"
        maxlength="200"
        show-word-limit
        :placeholder="t('proxy.cipherExamples')"
      />
    </el-form-item>

    <el-form-item :label="t('proxy.password')" prop="ss.password">
      <el-input
        v-model.trim="modelValue.password"
        type="password"
        :placeholder="t('proxy.passwordPlaceholder')"
        show-password
        maxlength="200"
        show-word-limit
      />
    </el-form-item>

    <el-form-item :label="t('proxy.plugin')" prop="ss.plugin">
      <el-input
        v-model.trim="modelValue.plugin"
        maxlength="200"
        :placeholder="t('proxy.pluginPlaceholder')"
      />
    </el-form-item>

    <el-form-item :label="t('proxy.pluginOpts')" prop="ss.plugin-opts">
      <el-input
        v-model.trim="modelValue['plugin-opts']"
        type="textarea"
        :rows="4"
        maxlength="500"
        :placeholder="t('proxy.pluginOptsPlaceholder')"
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { parseUri } from '@vmosedge/proxy-sdk/parser'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.5;
}
</style>
