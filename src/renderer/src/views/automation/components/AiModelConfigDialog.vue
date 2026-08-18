<template>
  <vmos-dialog
    v-model="visible"
    :title="dialogTitle"
    width="540px"
    :close-on-click-modal="false"
    class="model-config-dialog"
    @close="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-title-wrap">
          <el-icon class="header-icon"><Plus v-if="!editingModel" /><Edit v-else /></el-icon>
          <span class="header-title">{{ dialogTitle }}</span>
        </div>
        <div class="header-desc">{{ t('aiWorkflow.modelConfig.headerDesc') }}</div>
      </div>
    </template>

    <div class="config-form-wrap">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="auto"
        label-position="top"
        class="styled-form"
      >
        <div class="form-row">
          <el-form-item
            :label="t('aiWorkflow.modelConfig.vendorLabel')"
            prop="vendor"
            class="flex-1"
          >
            <el-select
              v-model="formData.vendor"
              :placeholder="t('aiWorkflow.modelConfig.vendorPlaceholder')"
              style="width: 100%"
            >
              <template #prefix>
                <img
                  v-if="vendorLogos[formData.vendor]"
                  :src="vendorLogos[formData.vendor]"
                  class="vendor-logo-prefix"
                />
                <div v-else class="vendor-dot" :class="formData.vendor.toLowerCase()"></div>
              </template>
              <el-option
                v-for="item in vendorOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              >
                <div class="vendor-option">
                  <img :src="item.logo" class="vendor-option-logo" />
                  <span>{{ item.label }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item
            :label="t('aiWorkflow.modelConfig.displayNameLabel')"
            prop="displayName"
            class="flex-1"
          >
            <el-input
              v-model="formData.displayName"
              :placeholder="t('aiWorkflow.modelConfig.displayNamePlaceholder')"
            />
          </el-form-item>
        </div>

        <el-form-item :label="t('aiWorkflow.modelConfig.apiHostLabel')" prop="apiHost">
          <el-input
            v-model="formData.apiHost"
            :placeholder="t('aiWorkflow.modelConfig.apiHostPlaceholder')"
          />
          <div class="form-tip">{{ t('aiWorkflow.modelConfig.apiHostTip') }}</div>
        </el-form-item>

        <el-form-item :label="t('aiWorkflow.modelConfig.modelNameLabel')" prop="modelName">
          <el-input
            v-model="formData.modelName"
            :placeholder="t('aiWorkflow.modelConfig.modelNamePlaceholder')"
          />
          <div class="form-tip">{{ t('aiWorkflow.modelConfig.modelNameTip') }}</div>
        </el-form-item>

        <el-form-item :label="t('aiWorkflow.modelConfig.apiKeyLabel')" prop="apiKey">
          <el-input
            v-model="formData.apiKey"
            type="password"
            :placeholder="t('aiWorkflow.modelConfig.apiKeyPlaceholder')"
            show-password
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
          <div class="form-tip important">
            <el-icon><InfoFilled /></el-icon>
            {{ t('aiWorkflow.modelConfig.apiKeyTip') }}
          </div>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">
          {{ primaryButtonText }}
        </el-button>
      </div>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Edit, Lock, InfoFilled } from '@element-plus/icons-vue'
import type { AiModelConfig } from '@renderer/hooks/useAiModelConfig'
import { useI18n } from 'vue-i18n'
import logoOpenai from '@renderer/assets/providers/openai.svg'
import logoAnthropic from '@renderer/assets/providers/anthropic.svg'
import logoGoogle from '@renderer/assets/providers/google.svg'
import logoDashscope from '@renderer/assets/providers/dashscope.svg'
import logoDeepseek from '@renderer/assets/providers/deepseek.svg'
import logoZhipu from '@renderer/assets/providers/zhipu.svg'
import logoOllama from '@renderer/assets/providers/ollama.svg'
import logoCustom from '@renderer/assets/providers/custom.svg'

const { t } = useI18n()

interface Props {
  modelVisible?: boolean
  editingModel?: AiModelConfig | null
  allModels?: AiModelConfig[]
}

const props = withDefaults(defineProps<Props>(), {
  modelVisible: false,
  editingModel: null,
  allModels: () => []
})

const emit = defineEmits<{
  'update:modelVisible': [value: boolean]
  saved: [model: AiModelConfig]
}>()

const formRef = ref<FormInstance>()
const visible = ref(false)

const VENDOR_DEFAULTS: Record<string, { apiHost: string; modelName: string }> = {
  DeepSeek: {
    apiHost: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat'
  },
  OpenAI: {
    apiHost: 'https://api.openai.com/v1',
    modelName: 'gpt-5.4'
  },
  Anthropic: {
    apiHost: 'https://api.anthropic.com',
    modelName: 'claude-sonnet-4-6'
  },
  Google: {
    apiHost: 'https://generativelanguage.googleapis.com/v1beta',
    modelName: 'gemini-2.5-pro'
  },
  Dashscope: {
    apiHost: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelName: 'qwen3.5-plus'
  },
  Zhipu: {
    apiHost: 'https://open.bigmodel.cn/api/paas/v4',
    modelName: 'glm-5'
  },
  Ollama: {
    apiHost: 'http://localhost:11434/v1',
    modelName: 'qwen3:8b'
  }
}
const vendorLogos: Record<string, string> = {
  DeepSeek: logoDeepseek,
  OpenAI: logoOpenai,
  Anthropic: logoAnthropic,
  Google: logoGoogle,
  Dashscope: logoDashscope,
  Zhipu: logoZhipu,
  Ollama: logoOllama,
  Other: logoCustom
}

const formData = reactive<AiModelConfig>({
  id: '',
  vendor: 'DeepSeek',
  apiHost: 'https://api.deepseek.com/v1',
  modelName: 'deepseek-chat',
  apiKey: '',
  displayName: ''
})

const dialogTitle = computed(() =>
  props.editingModel ? t('aiWorkflow.modelConfig.editTitle') : t('aiWorkflow.modelConfig.addTitle')
)

const primaryButtonText = computed(() =>
  props.editingModel ? t('aiWorkflow.modelConfig.saveChanges') : t('aiWorkflow.modelConfig.addNow')
)

const vendorOptions = computed(() => [
  { label: 'DeepSeek', value: 'DeepSeek', logo: logoDeepseek },
  { label: 'OpenAI', value: 'OpenAI', logo: logoOpenai },
  { label: 'Anthropic', value: 'Anthropic', logo: logoAnthropic },
  { label: 'Google', value: 'Google', logo: logoGoogle },
  { label: 'Dashscope', value: 'Dashscope', logo: logoDashscope },
  { label: t('aiWorkflow.modelConfig.vendorZhipu'), value: 'Zhipu', logo: logoZhipu },
  { label: 'Ollama', value: 'Ollama', logo: logoOllama },
  { label: t('aiWorkflow.modelConfig.vendorCustom'), value: 'Other', logo: logoCustom }
])

const rules = computed<FormRules>(() => ({
  vendor: [
    { required: true, message: t('aiWorkflow.modelConfig.validateVendor'), trigger: 'change' }
  ],
  apiHost: [
    { required: true, message: t('aiWorkflow.modelConfig.validateApiHost'), trigger: 'blur' }
  ],
  modelName: [
    { required: true, message: t('aiWorkflow.modelConfig.validateModelName'), trigger: 'blur' }
  ],
  apiKey: [{ required: true, message: t('aiWorkflow.modelConfig.validateApiKey'), trigger: 'blur' }]
}))

// 监听 visible 变化
watch(
  () => props.modelVisible,
  (val) => {
    visible.value = val
    if (val && props.editingModel) {
      // 编辑模式：填充表单
      Object.assign(formData, {
        id: props.editingModel.id,
        vendor: props.editingModel.vendor,
        apiHost: props.editingModel.apiHost,
        modelName: props.editingModel.modelName,
        apiKey: props.editingModel.apiKey,
        displayName: props.editingModel.displayName || ''
      })
    } else if (val) {
      // 新增模式：重置表单
      Object.assign(formData, {
        id: '',
        vendor: 'DeepSeek',
        apiHost: 'https://api.deepseek.com/v1',
        modelName: 'deepseek-chat',
        apiKey: '',
        displayName: ''
      })
    }
  },
  { immediate: true }
)

watch(visible, (val) => {
  emit('update:modelVisible', val)
})

// 监听厂商变化，提供默认值
watch(
  () => formData.vendor,
  (newVendor) => {
    if (!visible.value || props.editingModel) return

    const defaults = VENDOR_DEFAULTS[newVendor]
    Object.assign(formData, {
      apiHost: defaults?.apiHost ?? '',
      modelName: defaults?.modelName ?? ''
    })
  }
)

const handleClose = () => {
  visible.value = false
  formRef.value?.resetFields()
}

const handleSave = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()

    // 生成 ID（如果是新增）
    const modelId = formData.id || `model-${Date.now()}`

    // 生成显示名称
    const displayName = formData.displayName || `${formData.vendor} ${formData.modelName}`

    const model: AiModelConfig = {
      id: modelId,
      vendor: formData.vendor,
      apiHost: formData.apiHost,
      modelName: formData.modelName,
      apiKey: formData.apiKey,
      displayName
    }

    emit('saved', model)
    ElMessage.success(
      props.editingModel
        ? t('aiWorkflow.modelConfig.updateSuccess')
        : t('aiWorkflow.modelConfig.addSuccess')
    )
    handleClose()
  } catch (error) {
    console.error(t('aiWorkflow.modelConfig.validateFailedLog'), error)
  }
}
</script>

<style scoped lang="scss">
.model-config-dialog {
  :deep(.el-dialog__body) {
    padding-top: 8px;
  }
}

.dialog-header {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;

    .header-icon {
      font-size: 18px;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      padding: 6px;
      border-radius: 8px;
    }

    .header-title {
      font-size: 17px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .header-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    padding-left: 40px;
  }
}

.config-form-wrap {
  padding: 8px 0;
}

.styled-form {
  .form-row {
    display: flex;
    gap: 16px;

    .flex-1 {
      flex: 1;
    }
  }

  :deep(.el-form-item__label) {
    font-weight: 600;
    font-size: 13px;
    color: var(--el-text-color-primary);
    margin-bottom: 6px;
    padding-bottom: 0;
  }

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-border-color-light) inset;
    padding: 2px 12px;
    background-color: var(--el-fill-color-blank);
    transition: all 0.2s;

    &.is-focus {
      box-shadow: 0 0 0 1px var(--el-color-primary) inset;
      background-color: #fff;
    }
  }
}

.vendor-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  background: var(--el-text-color-placeholder);

  &.openai {
    background: #10a37f;
  }
  &.anthropic {
    background: #d97757;
  }
  &.deepseek {
    background: #3d5afe;
  }
  &.google {
    background: #4285f4;
  }
  &.dashscope {
    background: #ff6a00;
  }
  &.zhipu {
    background: #3562f7;
  }
  &.ollama {
    background: #000000;
  }
}

.vendor-logo-prefix {
  width: 22px;
  height: 22px;
  object-fit: contain;
  display: block;
  border-radius: 4px;
}

.vendor-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.vendor-option-logo {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
  border-radius: 4px;
}

.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 6px;
  line-height: 1.4;

  &.important {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
    padding: 6px 10px;
    border-radius: 6px;
    margin-top: 10px;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 8px;

  .el-button {
    padding: 10px 24px;
    border-radius: 8px;
    font-weight: 500;
  }

  .save-btn {
    font-weight: 600;
    box-shadow: 0 4px 10px var(--el-color-primary-light-7);
  }
}
</style>
