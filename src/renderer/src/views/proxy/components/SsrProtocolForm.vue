<template>
  <div class="ssr-protocol-form">
    <el-form-item :label="t('proxy.serverAddress')" prop="ssr.server">
      <el-input
        v-model.trim="modelValue.server"
        maxlength="200"
        show-word-limit
        :placeholder="t('proxy.serverAddressPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.port')" prop="ssr.port">
      <el-input-number
        v-model="modelValue.port"
        :min="1"
        :max="65535"
        :placeholder="t('proxy.portPlaceholder')"
        style="width: 100%"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.password')" prop="ssr.password">
      <el-input
        v-model.trim="modelValue.password"
        type="password"
        :placeholder="t('proxy.passwordPlaceholder')"
        show-password
        maxlength="200"
        show-word-limit
      />
    </el-form-item>
    <el-form-item :label="t('proxy.cipher')" prop="ssr.cipher">
      <el-input
        v-model.trim="modelValue.cipher"
        maxlength="50"
        :placeholder="t('proxy.cipherPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.protocol')" prop="ssr.protocol">
      <el-input
        v-model.trim="modelValue.protocol"
        maxlength="50"
        :placeholder="t('proxy.protocolPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.obfs')" prop="ssr.obfs">
      <el-input v-model.trim="modelValue.obfs" maxlength="50" :placeholder="t('proxy.obfsPlaceholder')" />
    </el-form-item>
    <el-form-item :label="t('proxy.obfsParam')" prop="ssr.obfs-param">
      <el-input
        v-model.trim="modelValue['obfs-param']"
        maxlength="200"
        :placeholder="t('proxy.obfsParamPlaceholder')"
      />
    </el-form-item>
    <el-form-item :label="t('proxy.protocolParam')" prop="ssr.protocol-param">
      <el-input
        v-model.trim="modelValue['protocol-param']"
        maxlength="200"
        :placeholder="t('proxy.protocolParamPlaceholder')"
      />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import parseUri from '@renderer/utils/uri-parser'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.5;
}
</style>
