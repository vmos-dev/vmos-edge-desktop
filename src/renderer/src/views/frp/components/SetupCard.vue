<script setup lang="ts">
import { reactive, ref, shallowRef, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { FrpConfig } from '@shared/ipc/frp.types'

const { t } = useI18n()

type DeployMode = 'public' | 'nat'

const props = defineProps<{
  deploying?: boolean
  config?: FrpConfig | null
}>()

const emit = defineEmits<{
  deploy: [config: Partial<FrpConfig>]
}>()

const formRef = ref<FormInstance>()
const mode = shallowRef<DeployMode>('public')

const form = reactive({
  server_host: '',
  ssh_port: 22,
  ssh_user: 'root',
  ssh_password: '',
  public_host: '',
  public_frps_port: 0,
  frps_port: 7000,
  frps_dashboard_port: 7500,
  public_frps_dashboard_port: 0,
  frps_dashboard_user: 'admin',
  frps_dashboard_password: '',
  port_range_start: 30000,
  port_range_end: 31000,
  frpc_admin_port: 7400,
  frpc_password: '',
  proxy_bind_local: false
})

watch(
  () => props.config,
  (cfg) => {
    if (cfg) {
      mode.value = cfg.server_host ? cfg.deploy_mode || 'public' : 'public'
      form.server_host = cfg.server_host || ''
      form.ssh_port = cfg.ssh_port || 22
      form.ssh_user = cfg.ssh_user || 'root'
      form.ssh_password = cfg.ssh_password || ''
      form.public_host = cfg.public_host || ''
      form.public_frps_port = cfg.public_frps_port || 0
      form.frps_port = cfg.frps_port || 7000
      form.frps_dashboard_port = cfg.frps_dashboard_port || 7500
      form.public_frps_dashboard_port = cfg.public_frps_dashboard_port || 0
      form.frps_dashboard_user = cfg.frps_dashboard_user || 'admin'
      form.frps_dashboard_password = cfg.frps_dashboard_password || ''
      form.port_range_start = cfg.port_range_start || 30000
      form.port_range_end = cfg.port_range_end || 31000
      form.frpc_admin_port = cfg.frpc_admin_port || 7400
      form.frpc_password = cfg.frps_token || ''
      form.proxy_bind_local = cfg.proxy_bind_local === 1
    }
  },
  { immediate: true }
)

const hostValidator = (_rule: any, value: string, callback: any) => {
  if (value && !/^[a-zA-Z0-9._-]+$/.test(value)) {
    callback(new Error(t('frp.setup.serverHostInvalid')))
  } else {
    callback()
  }
}

const dashboardPasswordValidator = (_rule: any, value: string, callback: any) => {
  if (!value) {
    callback(new Error(t('frp.setup.dashboardPasswordPlaceholder')))
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

const rules = computed<FormRules>(() => {
  const base: FormRules = {
    server_host: [
      { required: true, message: t('frp.setup.serverHostPlaceholder'), trigger: 'blur' },
      { validator: hostValidator, trigger: 'blur' }
    ],
    ssh_port: [{ required: true, message: '', trigger: 'change' }],
    ssh_user: [{ required: true, message: t('frp.setup.sshUserPlaceholder'), trigger: 'blur' }],
    ssh_password: [
      { required: true, message: t('frp.setup.sshPasswordPlaceholder'), trigger: 'blur' }
    ],
    frps_port: [{ required: true, message: '', trigger: 'change' }],
    frps_dashboard_port: [{ required: true, message: '', trigger: 'change' }],
    frps_dashboard_password: [{ validator: dashboardPasswordValidator, trigger: 'blur' }],
    frpc_admin_port: [{ required: true, message: '', trigger: 'change' }],
    frpc_password: [{ validator: dashboardPasswordValidator, trigger: 'blur' }],
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
  }
  if (mode.value === 'nat') {
    base.public_host = [{ validator: hostValidator, trigger: 'blur' }]
  }
  return base
})

const handleDeploy = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const { frpc_password, proxy_bind_local, ...rest } = form
  const data: Partial<FrpConfig> = {
    ...rest,
    deploy_mode: mode.value,
    frps_token: frpc_password,
    proxy_bind_local: proxy_bind_local ? 1 : 0
  }
  if (mode.value === 'public') {
    data.public_host = ''
    data.public_frps_port = 0
    data.public_frps_dashboard_port = 0
  } else if (mode.value === 'nat' && !data.public_host) {
    data.public_host = form.server_host
  }
  emit('deploy', data)
}
</script>

<template>
  <div class="setting-card">
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="left"
      label-width="auto"
      @submit.prevent="handleDeploy"
    >
      <!-- 部署模式 -->
      <div class="group-header">
        <h3 class="group-title">{{ t('frp.setup.title') }}</h3>
        <div class="group-divider"></div>
      </div>
      <div class="group-content">
        <div class="config-item">
          <div class="config-label">{{ t('frp.setup.description') }}</div>
        </div>
        <div class="card-options">
          <div class="option-card" :class="{ active: mode === 'public' }" @click="mode = 'public'">
            <div class="option-check" v-if="mode === 'public'">
              <el-icon><check /></el-icon>
            </div>
            <span class="option-label">
              {{ t('frp.setup.modePublic') }}
              <span class="option-badge">{{ t('frp.setup.modeRecommended') }}</span>
            </span>
            <span class="option-desc">{{ t('frp.setup.modePublicDesc') }}</span>
          </div>
          <div class="option-card" :class="{ active: mode === 'nat' }" @click="mode = 'nat'">
            <div class="option-check" v-if="mode === 'nat'">
              <el-icon><check /></el-icon>
            </div>
            <span class="option-label">{{ t('frp.setup.modeNat') }}</span>
            <span class="option-desc">{{ t('frp.setup.modeNatDesc') }}</span>
          </div>
        </div>
      </div>

      <!-- SSH 连接 -->
      <div class="group-header">
        <h3 class="group-title">{{ t('frp.setup.sectionSsh') }}</h3>
        <div class="group-divider"></div>
      </div>
      <div class="group-content">
        <el-form-item
          prop="server_host"
          :label="t('frp.setup.serverHost')"
          class="config-form-item"
          required
        >
          <el-input
            v-model="form.server_host"
            :placeholder="
              mode === 'nat'
                ? t('frp.setup.natServerHostPlaceholder')
                : t('frp.setup.serverHostPlaceholder')
            "
            class="form-input-wide"
          />
        </el-form-item>
        <el-form-item
          prop="ssh_port"
          :label="t('frp.setup.sshPort')"
          class="config-form-item"
          required
        >
          <el-input-number
            v-model="form.ssh_port"
            :min="1"
            :max="65535"
            controls-position="right"
            class="form-input-narrow"
          />
        </el-form-item>
        <el-form-item
          prop="ssh_user"
          :label="t('frp.setup.sshUser')"
          class="config-form-item"
          required
        >
          <el-input
            v-model="form.ssh_user"
            :placeholder="t('frp.setup.sshUserPlaceholder')"
            class="form-input-wide"
          />
          <div class="field-hint">{{ t('frp.setup.sshUserWarn') }}</div>
        </el-form-item>
        <el-form-item
          prop="ssh_password"
          :label="t('frp.setup.sshPassword')"
          class="config-form-item"
          required
        >
          <el-input
            v-model="form.ssh_password"
            type="password"
            show-password
            :placeholder="t('frp.setup.sshPasswordPlaceholder')"
            class="form-input-wide"
          />
        </el-form-item>
      </div>

      <!-- NAT 公网映射 -->
      <template v-if="mode === 'nat'">
        <div class="group-header">
          <h3 class="group-title">{{ t('frp.setup.sectionPublic') }}</h3>
          <div class="group-divider"></div>
        </div>
        <div class="group-content">
          <el-form-item
            prop="public_host"
            :label="t('frp.setup.publicHost')"
            class="config-form-item"
          >
            <el-input
              v-model="form.public_host"
              :placeholder="t('frp.setup.publicHostPlaceholder')"
              class="form-input-wide"
            />
          </el-form-item>
          <el-form-item
            prop="frps_port"
            :label="t('frp.setup.frpsPort')"
            class="config-form-item"
            required
          >
            <div class="port-mapping">
              <el-input-number
                v-model="form.frps_port"
                :min="1"
                :max="65535"
                controls-position="right"
                class="form-input-narrow"
              />
              <span class="port-mapping-arrow">→</span>
              <el-input-number
                v-model="form.public_frps_port"
                :min="0"
                :max="65535"
                controls-position="right"
                class="form-input-narrow"
              />
            </div>
          </el-form-item>
          <el-form-item
            prop="frps_dashboard_port"
            :label="t('frp.settings.dashboardPort')"
            class="config-form-item"
            required
          >
            <div class="port-mapping">
              <el-input-number
                v-model="form.frps_dashboard_port"
                :min="1"
                :max="65535"
                controls-position="right"
                class="form-input-narrow"
              />
              <span class="port-mapping-arrow">→</span>
              <el-input-number
                v-model="form.public_frps_dashboard_port"
                :min="0"
                :max="65535"
                controls-position="right"
                class="form-input-narrow"
              />
            </div>
          </el-form-item>
          <div class="setting-desc">{{ t('frp.setup.portRangeNatTip') }}</div>
        </div>
      </template>

      <!-- 服务配置 -->
      <div class="group-header">
        <h3 class="group-title">{{ t('frp.setup.sectionPorts') }}</h3>
        <div class="group-divider"></div>
      </div>
      <div class="group-content">
        <template v-if="mode === 'public'">
          <el-form-item
            prop="frps_port"
            :label="t('frp.setup.frpsPort')"
            class="config-form-item"
            required
          >
            <el-input-number
              v-model="form.frps_port"
              :min="1"
              :max="65535"
              controls-position="right"
              class="form-input-narrow"
            />
          </el-form-item>
          <el-form-item
            prop="frps_dashboard_port"
            :label="t('frp.settings.dashboardPort')"
            class="config-form-item"
            required
          >
            <el-input-number
              v-model="form.frps_dashboard_port"
              :min="1"
              :max="65535"
              controls-position="right"
              class="form-input-narrow"
            />
          </el-form-item>
        </template>
        <el-form-item
          prop="frps_dashboard_password"
          :label="t('frp.settings.dashboardPassword')"
          class="config-form-item"
          required
        >
          <el-input
            v-model="form.frps_dashboard_password"
            type="password"
            show-password
            :placeholder="t('frp.setup.dashboardPasswordPlaceholder')"
            class="form-input-wide"
          />
        </el-form-item>
        <el-form-item
          prop="port_range_end"
          :label="t('frp.setup.portRange')"
          class="config-form-item"
          required
        >
          <div class="port-range">
            <el-input-number
              v-model="form.port_range_start"
              :min="1024"
              :max="65535"
              controls-position="right"
              class="form-input-narrow"
            />
            <span class="range-sep">—</span>
            <el-input-number
              v-model="form.port_range_end"
              :min="1024"
              :max="65535"
              controls-position="right"
              class="form-input-narrow"
            />
          </div>
        </el-form-item>
        <el-form-item
          :label="t('frp.settings.proxyBindLocal')"
          class="config-form-item"
          required
        >
          <el-switch v-model="form.proxy_bind_local" />
          <div class="field-hint">{{ t('frp.settings.proxyBindLocalDesc') }}</div>
        </el-form-item>
      </div>

      <!-- 客户端配置 -->
      <div class="group-header">
        <h3 class="group-title">{{ t('frp.settings.clientConfig') }}</h3>
        <div class="group-divider"></div>
      </div>
      <div class="group-content">
        <el-form-item
          prop="frpc_admin_port"
          :label="t('frp.settings.frpcAdminPort')"
          class="config-form-item"
          required
        >
          <el-input-number
            v-model="form.frpc_admin_port"
            :min="1024"
            :max="65535"
            controls-position="right"
            class="form-input-narrow"
          />
        </el-form-item>
        <el-form-item
          prop="frpc_password"
          :label="t('frp.settings.dashboardPassword')"
          class="config-form-item"
          required
        >
          <el-input
            v-model="form.frpc_password"
            type="password"
            show-password
            :placeholder="t('frp.setup.dashboardPasswordPlaceholder')"
            class="form-input-wide"
          />
        </el-form-item>
      </div>

      <!-- 部署按钮 -->
      <div class="config-item">
        <div class="config-label"></div>
        <el-button type="primary" :loading="props.deploying" @click="handleDeploy">
          {{ t('frp.setup.deploy') }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.setting-card {
  background: var(--el-bg-color);
  border-radius: var(--app-radius-base, 8px);
  padding: 32px;
  height: 100%;
  overflow-y: auto;
}

:deep(.el-input-number .el-input__inner) {
  text-align: left;
}

/* ── 复用通用设置样式 ── */
.group-header {
  margin-bottom: 24px;

  .group-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: var(--el-color-primary);
      margin-right: 12px;
      border-radius: 2px;
    }
  }

  .group-divider {
    height: 1px;
    background-color: var(--el-border-color-lighter);
    width: 100%;
  }
}

.group-content {
  padding-left: 4px;
  margin-bottom: 32px;
}

.config-item {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;

  .config-label {
    display: flex;
    align-items: center;
    font-size: 14px;
    color: var(--el-text-color-regular);
  }
}

.config-form-item {
  :deep(.el-form-item__label) {
    font-size: 14px;
    color: var(--el-text-color-regular);
    justify-content: flex-start;
  }
}

.card-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.option-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  background: var(--el-bg-color);
  transition: all 0.2s ease;
  min-width: 120px;
  user-select: none;

  &:hover {
    border-color: var(--el-border-color-hover);
    background-color: var(--el-fill-color-light);
  }

  &.active {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);

    .option-label {
      color: var(--el-color-primary);
    }
    .option-desc {
      color: var(--el-color-primary-light-3);
    }
  }

  .option-check {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 0 20px 20px;
    border-color: transparent transparent var(--el-color-primary) transparent;

    .el-icon {
      position: absolute;
      right: 0;
      top: 7px;
      color: var(--el-bg-color);
      font-size: 11px;
    }
  }

  .option-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 3px;
  }

  .option-badge {
    font-size: 10px;
    font-weight: 500;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-8);
    padding: 1px 6px;
    border-radius: 3px;
    line-height: 1.4;
  }

  .option-desc {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}

.setting-desc {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: -8px;
  padding-left: 136px;
}

/* ── 端口映射 ── */
.port-mapping {
  display: flex;
  align-items: center;
  gap: 10px;
}

.port-mapping-arrow {
  color: var(--el-color-primary);
  font-weight: 600;
}

.port-mapping-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

/* ── 端口范围 ── */
.port-range {
  display: flex;
  align-items: center;
  gap: 10px;
}

.range-sep {
  color: var(--el-text-color-placeholder);
}

.form-input-wide {
  width: 450px;
}

.form-input-narrow {
  width: 150px;
}

.field-hint {
  width: 100%;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
  margin-top: 4px;
}
</style>
