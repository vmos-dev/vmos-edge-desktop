<template>
  <vmos-dialog
    v-model="visible"
    :title="t('aiWorkflow.modelManager.title')"
    width="860px"
    :close-on-click-modal="false"
    class="model-manager-dialog"
    @close="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-title-wrap">
          <el-icon class="header-icon"><Setting /></el-icon>
          <span class="header-title">{{ t('aiWorkflow.modelManager.headerTitle') }}</span>
        </div>
        <div class="header-desc">{{ t('aiWorkflow.modelManager.headerDesc') }}</div>
      </div>
    </template>

    <div class="manager-content">
      <div class="toolbar">
        <div class="stats">
          {{ t('aiWorkflow.modelManager.configuredCount', { count: models.length }) }}
        </div>
        <el-button type="primary" :icon="Plus" @click="handleAdd">
          {{ t('aiWorkflow.modelManager.addModel') }}
        </el-button>
      </div>

      <div class="table-container">
        <el-table :data="models" style="width: 100%" bo :header-cell-style="headerCellStyle">
          <el-table-column
            prop="displayName"
            :label="t('aiWorkflow.modelManager.modelName')"
            min-width="180"
          >
            <template #default="{ row }">
              <div class="name-cell">
                <div class="vendor-icon" :class="row.vendor.toLowerCase()">
                  <img
                    v-if="vendorLogos[row.vendor]"
                    :src="vendorLogos[row.vendor]"
                    class="vendor-icon-logo"
                  />
                  <template v-else>{{ row.vendor.charAt(0) }}</template>
                </div>
                <div class="name-info">
                  <div class="display-name" :title="row.displayName || row.modelName">
                    {{ row.displayName || row.modelName }}
                  </div>
                  <div class="model-id">{{ row.modelName }}</div>
                </div>
                <el-tag
                  v-if="selectedModelId === row.id"
                  size="small"
                  type="success"
                  effect="plain"
                  class="active-tag"
                >
                  {{ t('aiWorkflow.modelManager.currentSelected') }}
                </el-tag>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="vendor" :label="t('aiWorkflow.modelManager.provider')" width="120">
            <template #default="{ row }">
              <el-tag :type="getVendorType(row.vendor)" size="small" effect="light">
                {{ vendorDisplayName(row.vendor) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column :label="t('aiWorkflow.modelManager.action')" width="160" fixed="right">
            <template #default="{ row }">
              <div class="action-btns">
                <el-button type="primary" link :icon="Edit" @click="handleEdit(row)">{{
                  t('aiWorkflow.modelManager.edit')
                }}</el-button>
                <el-divider direction="vertical" />
                <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">{{
                  t('aiWorkflow.modelManager.remove')
                }}</el-button>
              </div>
            </template>
          </el-table-column>

          <template #empty>
            <div class="empty-state">
              <el-empty :image-size="100" :description="t('aiWorkflow.modelManager.emptyModels')">
                <el-button type="primary" plain @click="handleAdd">{{
                  t('aiWorkflow.modelManager.addNow')
                }}</el-button>
              </el-empty>
            </div>
          </template>
        </el-table>
      </div>
    </div>

    <!-- 内部嵌套编辑对话框 -->
    <AiModelConfigDialog
      v-model:model-visible="showConfigDialog"
      :editing-model="editingModel"
      :all-models="models"
      @saved="handleModelSaved"
    />
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { Setting, Plus, Edit, Delete } from '@element-plus/icons-vue'
import type { AiModelConfig } from '@renderer/hooks/useAiModelConfig'
import AiModelConfigDialog from './AiModelConfigDialog.vue'
import { useI18n } from 'vue-i18n'
import logoOpenai from '@renderer/assets/providers/openai.svg'
import logoAnthropic from '@renderer/assets/providers/anthropic.svg'
import logoGoogle from '@renderer/assets/providers/google.svg'
import logoDashscope from '@renderer/assets/providers/dashscope.svg'
import logoDeepseek from '@renderer/assets/providers/deepseek.svg'
import logoZhipu from '@renderer/assets/providers/zhipu.svg'
import logoOllama from '@renderer/assets/providers/ollama.svg'
import logoCustom from '@renderer/assets/providers/custom.svg'

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

const { t } = useI18n()

interface Props {
  modelValue: boolean
  models: AiModelConfig[]
  selectedModelId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  add: [model: AiModelConfig]
  update: [id: string, model: AiModelConfig]
  delete: [id: string]
  select: [id: string]
}>()

const visible = ref(false)
const showConfigDialog = ref(false)
const editingModel = ref<AiModelConfig | null>(null)

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
  },
  { immediate: true }
)

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const handleClose = () => {
  visible.value = false
}

const handleAdd = () => {
  editingModel.value = null
  showConfigDialog.value = true
}

const handleEdit = (model: AiModelConfig) => {
  editingModel.value = { ...model }
  showConfigDialog.value = true
}

const handleDelete = (model: AiModelConfig) => {
  ElMessageBox.confirm(
    t('aiWorkflow.modelManager.removeConfirm', { name: model.displayName || model.modelName }),
    t('aiWorkflow.modelManager.removeConfirmTitle'),
    {
      confirmButtonText: t('aiWorkflow.modelManager.confirmRemove'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
      buttonSize: 'default',
      draggable: true
    }
  )
    .then(() => {
      emit('delete', model.id)
      ElMessage.success(t('aiWorkflow.modelManager.removeSuccess'))
    })
    .catch(() => {})
}

const handleModelSaved = (model: AiModelConfig) => {
  if (editingModel.value) {
    emit('update', model.id, model)
  } else {
    emit('add', model)
  }
  showConfigDialog.value = false
  editingModel.value = null
}

const headerCellStyle = {
  backgroundColor: 'var(--el-fill-color-lighter)',
  color: 'var(--el-text-color-secondary)',
  fontWeight: '600',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
}

const vendorDisplayName = (vendor: string) => {
  return vendor === 'Other' ? t('aiWorkflow.modelManager.customVendor') : vendor
}

const getVendorType = (vendor: string) => {
  const v = vendor.toLowerCase()
  if (v.includes('openai')) return ''
  if (v.includes('anthropic')) return 'warning'
  if (v.includes('deepseek')) return 'success'
  if (v.includes('google')) return 'danger'
  if (v.includes('dashscope')) return ''
  if (v.includes('zhipu')) return ''
  if (v.includes('ollama')) return 'info'
  return 'info'
}
</script>

<style scoped lang="scss">
.model-manager-dialog {
  :deep(.el-dialog__body) {
    padding-top: 0;
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
      font-size: 20px;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      padding: 6px;
      border-radius: var(--app-radius-base);
    }

    .header-title {
      font-size: var(--app-text-h2-size);
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .header-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    padding-left: 42px;
  }
}

.manager-content {
  padding: var(--app-padding-base) 0 var(--app-padding-small);

  .toolbar {
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .stats {
      font-size: var(--app-text-body-size);
      color: var(--el-text-color-regular);

      .count {
        font-weight: 600;
        color: var(--el-color-primary);
        margin: 0 2px;
      }
    }

    .add-btn {
      padding: 8px 20px;
      font-weight: 600;
      border-radius: var(--app-radius-base);
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: var(--app-shadow-hover);
      }
    }
  }

  .table-container {
    .name-cell {
      display: flex;
      align-items: center;
      gap: 12px;

      .vendor-icon {
        width: 32px;
        height: 32px;
        border-radius: var(--app-radius-base);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 14px;
        color: white;
        background: transparent;
        flex-shrink: 0;
        overflow: hidden;

        .vendor-icon-logo {
          width: 32px;
          height: 32px;
          object-fit: cover;
          border-radius: var(--app-radius-base);
        }
      }

      .name-info {
        flex: 1;
        min-width: 0;

        .display-name {
          font-weight: 600;
          font-size: var(--app-text-body-size);
          color: var(--el-text-color-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .model-id {
          font-size: var(--app-text-small-size);
          color: var(--el-text-color-secondary);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
      }

      .active-tag {
        flex-shrink: 0;
        border-radius: var(--app-radius-base);
        font-weight: 600;
      }
    }
  }
}

.action-btns {
  display: flex;
  align-items: center;
  gap: 4px;

  .el-button {
    font-weight: 500;
    font-size: 13px;

    &.el-button--primary:hover {
      color: var(--el-color-primary-dark-2);
    }

    &.el-button--danger:hover {
      color: var(--el-color-danger-dark-2);
    }
  }
}

.empty-state {
  padding: 60px 0;

  :deep(.el-empty__description) {
    margin-top: 10px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
  }
}
</style>
