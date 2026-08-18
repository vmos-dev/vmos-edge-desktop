<script setup lang="ts">
import { reactive, computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'
import type { FrpConfig } from '@shared/ipc/frp.types'
import { useDialogFormSync } from '../composables/useDialogFormSync'

const { t } = useI18n()

const props = defineProps<{
  config: FrpConfig | null
  loading?: boolean
}>()

const emit = defineEmits<{
  save: [updates: Partial<FrpConfig>]
}>()

const visible = defineModel<boolean>('visible', { default: false })
const formRef = ref<FormInstance>()

const form = reactive({
  frpc_admin_port: 7400,
  frps_token: ''
})

const tokenValidator = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback()
    return
  }
  const hasUpper = /[A-Z]/.test(value)
  const hasLower = /[a-z]/.test(value)
  const hasSpecial = /[^A-Za-z0-9]/.test(value)
  if (value.length < 8 || !hasUpper || !hasLower || !hasSpecial) {
    callback(new Error(t('frp.setup.dashboardPasswordInvalid')))
  } else {
    callback()
  }
}

const rules = computed<FormRules>(() => ({
  frps_token: [{ validator: tokenValidator, trigger: 'blur' }]
}))

useDialogFormSync(visible, () => props.config, (cfg) => {
  form.frpc_admin_port = cfg.frpc_admin_port
  form.frps_token = cfg.frps_token || ''
})

const handleSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const updates: Partial<FrpConfig> = {
    frpc_admin_port: form.frpc_admin_port,
    frps_token: form.frps_token
  }
  emit('save', updates)
}
</script>

<template>
  <vmos-dialog v-model="visible" :title="t('frp.settings.clientConfig')" width="420px" :show-close="!loading" :close-on-click-modal="!loading" :close-on-press-escape="!loading">
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="settings-form">
      <el-form-item :label="t('frp.settings.frpcAdminPort')">
        <el-input-number
          v-model="form.frpc_admin_port"
          :min="1024"
          :max="65535"
          controls-position="right"
          style="width: 100%"
        />
      </el-form-item>
      <div class="admin-tip">{{ t('frp.settings.frpcAdminTip') }}</div>
      <el-form-item prop="frps_token" :label="t('frp.settings.clientPassword')">
        <el-input
          v-model="form.frps_token"
          type="password"
          show-password
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="loading" @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSave">{{ t('frp.settings.save') }}</el-button>
    </template>
  </vmos-dialog>
</template>

<style scoped>
.settings-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.settings-form :deep(.el-form-item__label) {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding-bottom: 4px;
}

.admin-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  padding: 0 0 8px;
}
</style>
