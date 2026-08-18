<script setup lang="ts">
import { computed } from 'vue'
import { Check, Close, Connection, QuestionFilled } from '@element-plus/icons-vue'
import type { Proxy } from '@shared/ipc/data.types'
import type { ProxyFormModel } from '@renderer/views/cloudPhone/services/proxyService'
import { ProxyCheckStrategyList } from '@renderer/utils/constant'
import { useI18n } from 'vue-i18n'
import CustomProxyInput from './CustomProxyInput.vue'
import type { CustomProxyFormModel, ParsedProxyResult } from './customProxyTypes'
import { createDefaultCustomProxyForm } from './customProxyTypes'

interface TestResult {
  success: boolean
  data?: Record<string, any>
  error?: string
}

const props = withDefaults(
  defineProps<{
    form: ProxyFormModel
    proxyList: Proxy[]
    disabled?: boolean
    testResult?: TestResult | null
    checking?: boolean
    checkStrategy?: string
    showCheckRow?: boolean
    proxyMode?: 'select' | 'custom'
    customForm?: CustomProxyFormModel
    hideProxySource?: boolean
  }>(),
  {
    disabled: false,
    testResult: null,
    checking: false,
    checkStrategy: 'default',
    showCheckRow: false,
    proxyMode: 'select',
    customForm: () => createDefaultCustomProxyForm(),
    hideProxySource: false
  }
)

const emit = defineEmits<{
  'update:form': [ProxyFormModel]
  'update:checkStrategy': [string]
  'update:proxyMode': ['select' | 'custom']
  'update:customForm': [CustomProxyFormModel]
  'manage-proxy': []
  'proxy-change': []
  'ip-simulator-change': [boolean]
  'check-proxy': []
  'parse-success': [ParsedProxyResult]
  'parse-fail': []
  'mode-change': ['select' | 'custom']
}>()

const { t } = useI18n()

const selectedProxy = computed(
  () => props.proxyList.find((item) => item.id === props.form.id) ?? null
)

const showExitInfo = computed(() => !!selectedProxy.value?.protocol)

const proxyModeModel = computed({
  get: () => props.proxyMode,
  set: (val: 'select' | 'custom') => {
    emit('update:proxyMode', val)
    emit('mode-change', val)
  }
})

const isSelectMode = computed(() => props.proxyMode === 'select')
const isCustomMode = computed(() => props.proxyMode === 'custom')

const customExitInfo = computed(() => {
  if (!isCustomMode.value || !props.testResult?.success || !props.testResult?.data) return null
  return props.testResult.data
})

const hasExitInfo = computed(() => {
  if (props.hideProxySource) return true
  if (isSelectMode.value) {
    const p = selectedProxy.value
    return !!(p && (p.ip || p.country || p.timezone || p.loc))
  }
  return !!customExitInfo.value
})

const updateForm = (patch: Partial<ProxyFormModel>) => {
  emit('update:form', { ...props.form, ...patch })
}
</script>

<template>
  <div class="proxy-form-fields">
    <!-- 代理引擎 -->
    <el-form-item prop="engineType" class="proxy-field-item">
      <template #label>
        <span class="engine-type-label">
          {{ t('cloudPhone.engineType') }}
          <el-tooltip placement="top" popper-class="proxy-engine-tip-popper">
            <template #content>
              <div class="proxy-engine-tip">
                <div>
                  <strong>{{ t('cloudPhone.engineStandard') }}</strong
                  >：{{ t('cloudPhone.engineStandardDesc') }}
                </div>
                <div>
                  <strong>{{ t('cloudPhone.engineEnhanced') }}</strong
                  >：{{ t('cloudPhone.engineEnhancedDesc') }}
                </div>
              </div>
            </template>
            <el-icon class="label-tip-icon" :size="14"><QuestionFilled /></el-icon>
          </el-tooltip>
        </span>
      </template>
      <el-radio-group
        :model-value="form.engineType"
        :disabled="disabled"
        @update:model-value="updateForm({ engineType: $event as number })"
      >
        <el-radio :value="0">{{ t('cloudPhone.engineStandard') }}</el-radio>
        <el-radio :value="1">{{ t('cloudPhone.engineEnhanced') }}</el-radio>
      </el-radio-group>
    </el-form-item>

    <!-- 代理来源区块 -->
    <div v-if="!hideProxySource" class="proxy-source-card">
      <div class="proxy-source-header">
        <el-radio-group v-model="proxyModeModel" :disabled="disabled" size="small">
          <el-radio-button value="select">{{ t('cloudPhone.proxyModeSelect') }}</el-radio-button>
          <el-radio-button value="custom">{{ t('cloudPhone.proxyModeCustom') }}</el-radio-button>
        </el-radio-group>
        <el-link
          v-if="isSelectMode && !disabled"
          type="primary"
          :underline="false"
          class="manage-link"
          @click="emit('manage-proxy')"
        >
          {{ t('cloudPhone.goToProxyManagement') }}
        </el-link>
      </div>

      <!-- 选择代理模式 -->
      <template v-if="isSelectMode">
        <el-form-item prop="id" class="proxy-select-item compact-form-item">
          <el-select
            :model-value="form.id"
            filterable
            :placeholder="t('cloudPhone.selectProxyPlaceholder')"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="
              (val: string) => {
                updateForm({ id: val })
                emit('proxy-change')
              }
            "
          >
            <el-option
              v-for="item in proxyList"
              :key="item.id"
              :label="`${item.name}(${item.host}:${item.port})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <!-- 出口信息 -->
        <div v-if="showExitInfo" class="exit-info-card">
          <div class="exit-info-title">{{ t('cloudPhone.exitInfo') }}</div>
          <div class="exit-info-grid">
            <div class="exit-info-item">
              <span class="exit-info-label">{{ t('proxy.ip') }}</span>
              <span class="exit-info-value">{{ selectedProxy?.ip || '-' }}</span>
            </div>
            <div class="exit-info-item">
              <span class="exit-info-label">{{ t('cloudPhone.regionLabel') }}</span>
              <span class="exit-info-value">{{ selectedProxy?.country || '-' }}</span>
            </div>
            <div class="exit-info-item">
              <span class="exit-info-label">{{ t('cloudPhone.timezoneLabel') }}</span>
              <span class="exit-info-value">{{ selectedProxy?.timezone || '-' }}</span>
            </div>
            <div class="exit-info-item">
              <span class="exit-info-label">{{ t('cloudPhone.locLabel') }}</span>
              <span class="exit-info-value">{{ selectedProxy?.loc || '-' }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 自定义代理模式 -->
      <template v-if="isCustomMode">
        <CustomProxyInput
          :model-value="props.customForm"
          @update:model-value="emit('update:customForm', $event)"
          @parse-success="emit('parse-success', $event)"
          @parse-fail="emit('parse-fail')"
        />

        <!-- 自定义代理出口信息（检测成功后显示） -->
        <div v-if="customExitInfo" class="exit-info-card">
          <div class="exit-info-title">{{ t('cloudPhone.exitInfo') }}</div>
          <div class="exit-info-grid">
            <div class="exit-info-item">
              <span class="exit-info-label">{{ t('proxy.ip') }}</span>
              <span class="exit-info-value">{{ customExitInfo.ip || '-' }}</span>
            </div>
            <div class="exit-info-item">
              <span class="exit-info-label">{{ t('cloudPhone.regionLabel') }}</span>
              <span class="exit-info-value">{{ customExitInfo.country || '-' }}</span>
            </div>
            <div class="exit-info-item">
              <span class="exit-info-label">{{ t('cloudPhone.timezoneLabel') }}</span>
              <span class="exit-info-value">{{ customExitInfo.timezone || '-' }}</span>
            </div>
            <div class="exit-info-item">
              <span class="exit-info-label">{{ t('cloudPhone.locLabel') }}</span>
              <span class="exit-info-value">{{ customExitInfo.loc || '-' }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 网络设置区 -->
    <div class="settings-card">
      <div class="switch-row-pair">
        <div class="switch-row-half">
          <div class="switch-row-label">
            {{ t('cloudPhone.proxyDns') }}
            <el-tooltip :content="t('cloudPhone.proxyDnsTip')" placement="top">
              <el-icon class="label-tip-icon" :size="14"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          <el-switch
            :model-value="form.dnsOverProxyDisabled"
            :disabled="disabled"
            @update:model-value="updateForm({ dnsOverProxyDisabled: $event as boolean })"
          />
        </div>
        <div class="switch-row-half">
          <div class="switch-row-label">{{ t('cloudPhone.enableUdp') }}</div>
          <el-switch
            :model-value="form.udpDisabled"
            :disabled="disabled"
            @update:model-value="updateForm({ udpDisabled: $event as boolean })"
          />
        </div>
      </div>
      <!-- 中转代理 -->
      <div class="switch-row">
        <div class="switch-row-label">{{ t('cloudPhone.transferAgent') }}</div>
        <el-switch
          :model-value="form.isTransferAgent"
          :disabled="disabled"
          @update:model-value="
            (val: boolean) =>
              updateForm({ isTransferAgent: val, transferAgentId: val ? form.transferAgentId : '' })
          "
        />
      </div>
      <div v-if="form.isTransferAgent" class="transfer-select-wrapper">
        <el-form-item prop="transferAgentId" class="compact-form-item">
          <el-select
            :model-value="form.transferAgentId"
            filterable
            :placeholder="t('cloudPhone.selectTransferAgent')"
            :disabled="disabled"
            style="width: 100%"
            @update:model-value="updateForm({ transferAgentId: $event as string })"
          >
            <el-option
              v-for="item in proxyList"
              :key="item.id"
              :label="`${item.name}(${item.host}:${item.port})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
      </div>
    </div>

    <!-- IP 仿真 -->
    <div class="ip-simulator-card">
      <div class="switch-row">
        <div class="switch-row-label">
          {{ t('cloudPhone.ipSimulator') }}
          <el-tooltip
            v-if="!hasExitInfo"
            :content="t('cloudPhone.ipSimulatorNeedCheck')"
            placement="top"
          >
            <el-icon class="label-tip-icon" :size="14"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
        <el-switch
          :model-value="hasExitInfo ? form.ipSimulatorDisabled : false"
          :disabled="disabled || !hasExitInfo"
          @update:model-value="
            (val: boolean) => {
              updateForm({ ipSimulatorDisabled: val })
              emit('ip-simulator-change', val)
            }
          "
        />
      </div>

      <slot name="ip-simulator-extra" />

      <div v-if="form.ipSimulatorDisabled" class="ip-simulator-hint">
        {{ t('cloudPhone.ipSimulatorTip') }}
      </div>
    </div>

    <!-- 检测策略 + 测试按钮（内联模式） -->
    <div v-if="showCheckRow" class="check-row">
      <div class="check-strategy-group">
        <span class="check-strategy-label">{{ t('cloudPhone.checkStrategy') }}</span>
        <el-select
          :model-value="checkStrategy"
          :placeholder="t('cloudPhone.selectCheckStrategy')"
          size="small"
          :disabled="disabled"
          style="width: 180px"
          @update:model-value="emit('update:checkStrategy', $event as string)"
        >
          <el-option
            v-for="item in ProxyCheckStrategyList"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <el-button
        plain
        type="primary"
        :loading="checking"
        :disabled="disabled || checking"
        @click="emit('check-proxy')"
      >
        <el-icon class="el-icon--left"><Connection /></el-icon>
        {{ t('cloudPhone.proxyTest') }}
      </el-button>
    </div>

    <!-- 检测结果 -->
    <template v-if="testResult !== null && testResult !== undefined">
      <div v-if="testResult.success" class="test-result test-success">
        <el-icon><Check /></el-icon>
        <span>
          {{ t('cloudPhone.testPassed') }}
          <template v-if="testResult.data?.providerType !== 'default'">
            {{ t('proxy.ip') }}: {{ testResult.data?.ip || '-' }}，{{ t('cloudPhone.regionLabel') }}
            {{ testResult.data?.country || '-' }}，{{ t('cloudPhone.timezoneLabel') }}
            {{ testResult.data?.timezone || '-' }}，{{ t('cloudPhone.locLabel') }}
            {{ testResult.data?.loc || '-' }}
          </template>
        </span>
      </div>
      <div v-else class="test-result test-failure">
        <el-icon><Close /></el-icon>
        <span>{{ t('cloudPhone.testFailed') }} {{ testResult.error || '' }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.proxy-form-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.proxy-field-item {
  margin-bottom: 10px;
}

// ── 代理来源区块 ──
.proxy-source-card {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.proxy-source-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.compact-form-item {
  margin-bottom: 0;
}

// ── Label 通用 ──
.engine-type-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.label-tip-icon {
  cursor: help;
  color: var(--el-text-color-placeholder);
  transition: color 0.2s;

  &:hover {
    color: var(--el-color-primary);
  }
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.required-mark {
  color: var(--el-color-danger);
}

.manage-link {
  font-size: 12px;
}

.proxy-select-item {
  :deep(.el-form-item__label) {
    width: 100% !important;

    &::before {
      display: none;
    }
  }
}

// ── 出口信息卡片 ──
.exit-info-card {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.exit-info-title {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 500;
}

.exit-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
}

.exit-info-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  line-height: 1.6;
}

.exit-info-label {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.exit-info-value {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// ── 设置卡片（公用） ──
.settings-card,
.ip-simulator-card {
  margin-bottom: 10px;
  padding: 4px 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

// ── Switch 行 ──
.switch-row-pair {
  display: flex;
  gap: 0;

  .switch-row-half {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    padding: 4px 0;

    &:first-child {
      padding-right: 16px;
      border-right: 1px solid var(--el-border-color-extra-light);
    }

    &:last-child {
      padding-left: 16px;
    }
  }

  & + .switch-row {
    border-top: 1px solid var(--el-border-color-extra-light);
  }
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 4px 0;

  & + .switch-row {
    border-top: 1px solid var(--el-border-color-extra-light);
  }
}

.switch-row-label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
}

.transfer-select-wrapper {
  padding: 0 0 10px;
}

// ── IP 仿真 ──
.ip-simulator-hint {
  padding: 8px 0 6px;
  border-top: 1px solid var(--el-border-color-extra-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

// ── 检测行 ──
.check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.check-strategy-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.check-strategy-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}

// ── 检测结果 ──
.test-result {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;

  .el-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }

  &.test-success {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success);
  }

  &.test-failure {
    background: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
  }
}
</style>

<style lang="scss">
.proxy-engine-tip-popper {
  max-width: 380px;
  line-height: 1.5;

  .proxy-engine-tip > div + div {
    margin-top: 8px;
  }
}
</style>
