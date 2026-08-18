<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'
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

const form = reactive({
  ssh_port: 22,
  ssh_user: 'root',
  ssh_password: ''
})

useDialogFormSync(visible, () => props.config, (cfg) => {
  form.ssh_port = cfg.ssh_port || 22
  form.ssh_user = cfg.ssh_user || 'root'
  form.ssh_password = cfg.ssh_password || ''
})

const handleSave = () => {
  const updates: Partial<FrpConfig> = {
    ssh_port: form.ssh_port,
    ssh_user: form.ssh_user,
    ssh_password: form.ssh_password
  }
  emit('save', updates)
}
</script>

<template>
  <vmos-dialog v-model="visible" :title="t('frp.action.sshConfig')" width="400px" :show-close="!loading" :close-on-click-modal="!loading" :close-on-press-escape="!loading">
    <el-form :model="form" label-position="top" class="settings-form">
      <div class="info-row" v-if="config">
        <span class="info-label">{{ t('frp.setup.serverHost') }}</span>
        <span class="info-val">{{ config.server_host }}</span>
      </div>

      <el-divider />

      <el-form-item :label="t('frp.setup.sshPort')">
        <el-input-number
          v-model="form.ssh_port"
          :min="1"
          :max="65535"
          controls-position="right"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item :label="t('frp.setup.sshUser')">
        <el-input v-model="form.ssh_user" />
        <div v-if="form.ssh_user && form.ssh_user !== 'root'" class="ssh-user-warn">
          {{ t('frp.setup.sshUserWarn') }}
        </div>
      </el-form-item>
      <el-form-item :label="t('frp.setup.sshPassword')">
        <el-input
          v-model="form.ssh_password"
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

.ssh-user-warn {
  font-size: 12px;
  color: var(--el-color-warning);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
