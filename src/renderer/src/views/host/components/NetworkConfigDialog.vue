<template>
  <VmosDialog
    v-model="visible"
    :title="`${t('host.networkConfig')} - ${hostIp}`"
    width="520px"
    :show-close="!busy"
    :before-close="handleBeforeClose"
    @closed="handleClosed"
  >
    <div v-loading="loadingConfig" class="network-config">
      <!-- 加载失败 -->
      <div v-if="loadError" class="load-error">
        <el-icon :size="40" color="var(--el-color-danger)"><WarningFilled /></el-icon>
        <span>{{ loadError }}</span>
        <el-button type="primary" size="small" @click="loadConfig">{{
          t('common.retry')
        }}</el-button>
      </div>

      <template v-else-if="!loadingConfig">
        <!-- 当前状态 -->
        <div class="config-section">
          <div class="config-row">
            <span class="config-label">{{ t('host.networkInterface') }}</span>
            <span class="config-value">{{ config.interface || '-' }}</span>
          </div>
          <div class="config-row">
            <span class="config-label">{{ t('host.networkMode') }}</span>
            <el-tag :type="config.manual ? 'warning' : 'success'" size="small" effect="plain">
              {{ config.manual ? t('host.networkModeStatic') : t('host.networkModeDhcp') }}
            </el-tag>
          </div>
          <div class="config-row">
            <span class="config-label">{{ t('host.networkIp') }}</span>
            <span class="config-value">{{ config.ip || '-' }}</span>
          </div>
        </div>

        <el-divider />

        <!-- 表单 -->
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <el-form-item :label="t('host.networkIp')" prop="ip">
            <el-input
              v-model.trim="form.ip"
              :placeholder="t('host.networkIpPlaceholder')"
              :disabled="busy"
            />
          </el-form-item>
          <el-form-item :label="t('host.networkNetmask')" prop="netmask">
            <el-input
              v-model.trim="form.netmask"
              :placeholder="t('host.networkNetmaskPlaceholder')"
              :disabled="busy"
            />
          </el-form-item>
          <el-form-item :label="t('host.networkGateway')" prop="gateway">
            <el-input
              v-model.trim="form.gateway"
              :placeholder="t('host.networkGatewayPlaceholder')"
              :disabled="busy"
            />
          </el-form-item>
          <el-form-item :label="t('host.networkDns')" prop="dns">
            <el-input
              v-model.trim="form.dns"
              :placeholder="t('host.networkDnsPlaceholder')"
              :disabled="busy"
            />
          </el-form-item>
        </el-form>
      </template>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button
          type="warning"
          plain
          :loading="resetting"
          :disabled="!config.manual || saving"
          @click="handleRestore"
        >
          {{ t('host.networkRestoreDefault') }}
        </el-button>
        <div style="flex: 1" />
        <el-button :disabled="busy" @click="handleCancel">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="resetting || loadingConfig || !!loadError"
          @click="handleSave"
        >
          {{ t('common.confirm') }}
        </el-button>
      </div>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { API_CONFIG, buildApiUrl, request } from '@shared/api'

defineOptions({ name: 'NetworkConfigDialog' })

const emit = defineEmits<{
  (e: 'success'): void
}>()

const { t } = useI18n()

const visible = ref(false)
const loadingConfig = ref(false)
const loadError = ref('')
const saving = ref(false)
const resetting = ref(false)
const formRef = ref<FormInstance>()
const hostIp = ref('')

/** 任一异步操作进行中 */
const busy = computed(() => saving.value || resetting.value)

const config = reactive({
  interface: '',
  ip: '',
  netmask: '',
  gateway: '',
  dns: [] as string[],
  manual: false
})

const form = reactive({
  ip: '',
  netmask: '',
  gateway: '',
  dns: ''
})

const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/

const rules = computed<FormRules>(() => ({
  ip: [
    { required: true, message: t('host.networkIpPlaceholder'), trigger: 'blur' },
    { pattern: ipPattern, message: t('host.networkIpPlaceholder'), trigger: 'blur' }
  ],
  netmask: [
    { required: true, message: t('host.networkNetmaskPlaceholder'), trigger: 'blur' },
    { pattern: ipPattern, message: t('host.networkNetmaskPlaceholder'), trigger: 'blur' }
  ],
  gateway: [
    { required: true, message: t('host.networkGatewayPlaceholder'), trigger: 'blur' },
    { pattern: ipPattern, message: t('host.networkGatewayPlaceholder'), trigger: 'blur' }
  ]
}))

// ==================== 数据加载 ====================

const loadConfig = async () => {
  loadingConfig.value = true
  loadError.value = ''
  try {
    const url = buildApiUrl(hostIp.value, API_CONFIG.PATHS.GET_NETWORK_CONFIG)
    const resp = await request.get(url)
    const data = resp.data
    if (data) {
      config.interface = data.interface || ''
      config.ip = data.ip || ''
      config.netmask = data.netmask || ''
      config.gateway = data.gateway || ''
      config.dns = data.dns || []
      config.manual = !!data.manual

      // 预填表单
      form.ip = config.ip
      form.netmask = config.netmask
      form.gateway = config.gateway
      form.dns = config.dns.join(', ')
    }
  } catch (error: any) {
    loadError.value = error?.message || t('host.networkLoadFailed')
  } finally {
    loadingConfig.value = false
  }
}

// ==================== 保存 ====================

const handleSave = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const url = buildApiUrl(hostIp.value, API_CONFIG.PATHS.SET_NETWORK_CONFIG)
    const dnsArr = form.dns
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const resp = await request.post(url, {
      ip: form.ip,
      netmask: form.netmask,
      gateway: form.gateway,
      dns: dnsArr.length > 0 ? dnsArr : undefined
    })

    if (resp.code === 200) {
      ElMessage.success(t('host.networkSaveSuccess'))
      emit('success')
      visible.value = false
    } else {
      ElMessage.error(resp.msg || t('common.operationFailed'))
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t('common.operationFailed'))
  } finally {
    saving.value = false
  }
}

// ==================== 恢复默认 ====================

const handleRestore = async () => {
  try {
    await ElMessageBox.confirm(t('host.networkRestoreDefaultConfirm'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  resetting.value = true
  try {
    const url = buildApiUrl(hostIp.value, API_CONFIG.PATHS.RESET_NETWORK_CONFIG)
    const resp = await request.post(url)
    if (resp.code === 200) {
      ElMessage.success(t('host.networkResetSuccess'))
      emit('success')
      visible.value = false
    } else {
      ElMessage.error(resp.msg || t('common.operationFailed'))
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t('common.operationFailed'))
  } finally {
    resetting.value = false
  }
}

// ==================== 关闭/取消 ====================

/** 关闭前拦截：操作进行中不允许关闭 */
const handleBeforeClose = (done: () => void) => {
  if (busy.value) return
  done()
}

const handleCancel = () => {
  if (busy.value) return
  visible.value = false
}

/** 弹窗完全关闭后重置 */
const handleClosed = () => {
  formRef.value?.resetFields()
  Object.assign(config, { interface: '', ip: '', netmask: '', gateway: '', dns: [], manual: false })
  Object.assign(form, { ip: '', netmask: '', gateway: '', dns: '' })
  loadError.value = ''
  hostIp.value = ''
}

// ==================== 对外接口 ====================

const init = (ip: string) => {
  hostIp.value = ip
  visible.value = true
  loadConfig()
}

defineExpose({ init })
</script>

<style scoped lang="scss">
.network-config {
  min-height: 200px;
}

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  min-width: 60px;
}

.config-value {
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.dialog-footer {
  display: flex;
  align-items: center;
}
</style>
