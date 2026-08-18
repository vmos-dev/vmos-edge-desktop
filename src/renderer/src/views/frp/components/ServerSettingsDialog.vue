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
const isNat = computed(() => props.config?.deploy_mode === 'nat')

const form = reactive({
  frps_port: 7000,
  frps_dashboard_port: 7500,
  frps_dashboard_password: '',
  port_range_start: 30000,
  port_range_end: 31000,
  public_host: '',
  public_frps_port: 0,
  public_frps_dashboard_port: 0,
  proxy_bind_local: false
})

const dashboardPasswordValidator = (_rule: any, value: string, callback: any) => {
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
  frps_dashboard_password: [{ validator: dashboardPasswordValidator, trigger: 'blur' }],
  port_range_end: [
    {
      validator: (_rule: any, _value: any, callback: any) => {
        if (form.port_range_start >= form.port_range_end) {
          callback(new Error(t('frp.setup.portRangeInvalid')))
        } else {
          callback()
        }
      },
      trigger: 'change'
    }
  ]
}))

useDialogFormSync(visible, () => props.config, (cfg) => {
  form.frps_port = cfg.frps_port || 7000
  form.frps_dashboard_port = cfg.frps_dashboard_port || 7500
  form.frps_dashboard_password = cfg.frps_dashboard_password || ''
  form.port_range_start = cfg.port_range_start
  form.port_range_end = cfg.port_range_end
  form.public_host = cfg.public_host || ''
  form.public_frps_port = cfg.public_frps_port || cfg.frps_port
  form.public_frps_dashboard_port =
    cfg.public_frps_dashboard_port || cfg.frps_dashboard_port || 7500
  form.proxy_bind_local = cfg.proxy_bind_local === 1
})

const handleSave = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const updates: Partial<FrpConfig> = {
    frps_port: form.frps_port,
    frps_dashboard_port: form.frps_dashboard_port,
    port_range_start: form.port_range_start,
    port_range_end: form.port_range_end
  }
  updates.frps_dashboard_password = form.frps_dashboard_password
  updates.proxy_bind_local = form.proxy_bind_local ? 1 : 0
  if (isNat.value) {
    updates.public_host = form.public_host
    updates.public_frps_port = form.public_frps_port
    updates.public_frps_dashboard_port = form.public_frps_dashboard_port
  }
  emit('save', updates)
}
</script>

<template>
  <vmos-dialog
    v-model="visible"
    :title="t('frp.settings.serverConfig')"
    width="460px"
    :show-close="!loading"
    :close-on-click-modal="!loading"
    :close-on-press-escape="!loading"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="settings-form">
      <div class="info-row" v-if="config">
        <span class="info-label">{{ t('frp.setup.serverHost') }}</span>
        <span class="info-val">{{ config.server_host }}</span>
      </div>

      <el-divider />

      <template v-if="isNat">
        <el-form-item :label="t('frp.settings.publicHost')">
          <el-input
            v-model="form.public_host"
            :placeholder="t('frp.setup.publicHostPlaceholder')"
          />
        </el-form-item>

        <el-form-item :label="t('frp.settings.commPort')">
          <div class="port-mapping">
            <el-input-number
              v-model="form.frps_port"
              :min="1"
              :max="65535"
              controls-position="right"
            />
            <span class="port-mapping-arrow">&rarr;</span>
            <el-input-number
              v-model="form.public_frps_port"
              :min="1"
              :max="65535"
              controls-position="right"
            />
          </div>
        </el-form-item>

        <el-form-item :label="t('frp.settings.dashboardPort')">
          <div class="port-mapping">
            <el-input-number
              v-model="form.frps_dashboard_port"
              :min="1024"
              :max="65535"
              controls-position="right"
            />
            <span class="port-mapping-arrow">&rarr;</span>
            <el-input-number
              v-model="form.public_frps_dashboard_port"
              :min="1"
              :max="65535"
              controls-position="right"
            />
          </div>
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item :label="t('frp.settings.commPort')">
          <el-input-number
            v-model="form.frps_port"
            :min="1"
            :max="65535"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item :label="t('frp.settings.dashboardPort')">
          <el-input-number
            v-model="form.frps_dashboard_port"
            :min="1024"
            :max="65535"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
      </template>

      <el-form-item prop="port_range_end" :label="t('frp.setup.portRange')">
        <div class="port-range-row">
          <el-input-number
            v-model="form.port_range_start"
            :min="1024"
            :max="65535"
            controls-position="right"
          />
          <span class="port-range-sep">&mdash;</span>
          <el-input-number
            v-model="form.port_range_end"
            :min="1024"
            :max="65535"
            controls-position="right"
          />
        </div>
      </el-form-item>

      <div v-if="isNat" class="nat-tip">{{ t('frp.setup.portRangeNatTip') }}</div>
      <div v-else class="nat-tip">{{ t('frp.setup.portRangePublicTip') }}</div>

      <el-divider />

      <el-form-item prop="frps_dashboard_password" :label="t('frp.settings.dashboardPassword')">
        <el-input v-model="form.frps_dashboard_password" type="password" show-password />
      </el-form-item>

      <el-form-item :label="t('frp.settings.proxyBindLocal')" required>
        <el-switch v-model="form.proxy_bind_local" />
        <div class="field-hint">{{ t('frp.settings.proxyBindLocalDesc') }}</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="loading" @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleSave">{{
        t('frp.settings.save')
      }}</el-button>
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

.settings-form :deep(.el-divider) {
  margin: 8px 0 12px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.info-label {
  color: var(--el-text-color-secondary);
}

.info-val {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  color: var(--el-text-color-primary);
}

.port-mapping {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.port-mapping .el-input-number {
  flex: 1;
}

.port-mapping-arrow {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  flex-shrink: 0;
}

.nat-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  padding: 4px 0 0;
}

.port-range-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.port-range-row .el-input-number {
  flex: 1;
}

.port-range-sep {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  flex-shrink: 0;
}

.field-hint {
  width: 100%;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
