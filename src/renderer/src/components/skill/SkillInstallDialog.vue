<template>
  <vmos-dialog
    v-model="visible"
    :title="t('skill.createTitle')"
    width="560px"
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-title-wrap">
          <el-icon class="header-icon"><Plus /></el-icon>
          <span class="header-title">{{ t('skill.createTitle') }}</span>
        </div>
        <div class="header-desc">{{ t('skill.createDesc') }}</div>
      </div>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="install-form">
      <div class="name-row">
        <el-form-item :label="t('skill.displayNameLabel')" prop="displayName" class="name-row-item">
          <el-input v-model="form.displayName" :placeholder="t('skill.displayNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('skill.nameLabel')" prop="name" class="name-row-item">
          <el-input v-model="form.name" :placeholder="t('skill.namePlaceholder')" />
          <div class="form-tip">{{ t('skill.nameFormatTip') }}</div>
        </el-form-item>
      </div>
      <el-form-item prop="content">
        <template #label>
          <div class="content-label-row">
            <span>{{ t('skill.contentLabel') }}</span>
            <el-button
              text
              size="small"
              :icon="showPreview ? EditPen : View"
              @click="showPreview = !showPreview"
            >
              {{ showPreview ? t('skill.edit') : t('skill.preview') }}
            </el-button>
          </div>
        </template>
        <div class="content-tip">{{ t('skill.contentWritingTip') }}</div>
        <el-input
          v-if="!showPreview"
          v-model="form.content"
          type="textarea"
          :rows="16"
          resize="none"
          class="content-textarea"
          :placeholder="t('skill.contentPlaceholder')"
        />
        <el-scrollbar v-else class="preview-scrollbar">
          <div class="markdown-body" v-html="renderedContent" />
        </el-scrollbar>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleCreate">
        {{ t('skill.createBtn') }}
      </el-button>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, View, EditPen } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import type { Device } from '@shared/ipc/data.types'
import { SkillService } from './skillService'

const SKILL_TEMPLATE_ZH = `# {name}

## 显示名称
{display_name}

## 描述
请输入技能描述

## 适用场景
- 场景1
- 场景2

## 观察模式
AUTO

## 操作步骤

### 第一步：步骤标题

步骤描述

### 第二步：步骤标题

步骤描述

## 注意事项
- 注意事项1
`

const SKILL_TEMPLATE_EN = `# {name}

## Display Name
{display_name}

## Description
Describe what this skill does

## Scenarios
- Scenario 1
- Scenario 2

## Observe Mode
AUTO

## Steps

### Step 1: Title

Describe the step

### Step 2: Title

Describe the step

## Notes
- Note 1
`

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true
})

const { t, locale } = useI18n()

const getSkillTemplate = () => {
  return locale.value.startsWith('zh') ? SKILL_TEMPLATE_ZH : SKILL_TEMPLATE_EN
}

interface Props {
  modelValue: boolean
  device: Device | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  installed: []
}>()

const visible = ref(false)
const loading = ref(false)
const formRef = ref<FormInstance>()
const showPreview = ref(false)

const form = reactive({
  displayName: '',
  name: '',
  content: getSkillTemplate()
})

const renderedContent = computed(() => {
  if (!form.content) return ''
  return md.render(form.content)
})

const rules: FormRules = {
  name: [
    { required: true, message: () => t('skill.nameRequired'), trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: () => t('skill.nameInvalid'), trigger: 'blur' }
  ],
  content: [{ required: true, message: () => t('skill.contentRequired'), trigger: 'blur' }]
}

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

const resetForm = () => {
  form.displayName = ''
  form.name = ''
  form.content = getSkillTemplate()
  showPreview.value = false
  formRef.value?.resetFields()
}

const handleCreate = async () => {
  // 切回编辑模式以便校验
  showPreview.value = false
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  // 用用户填写的名称和显示名称替换模板占位符
  const content = form.content
    .replace(/\{name\}/g, form.name)
    .replace(/\{display_name\}/g, form.displayName || form.name)

  loading.value = true
  try {
    await SkillService.install(props.device, form.name, content)
    ElMessage.success(t('skill.createSuccess'))
    visible.value = false
    emit('installed')
  } catch (e: any) {
    ElMessage.error(t('skill.createFailed') + ': ' + (e.message || e))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
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

.install-form {
  padding: 16px 0 0;

  .form-tip {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
    margin-top: 4px;
  }
}

.name-row {
  display: flex;
  gap: 16px;

  .name-row-item {
    flex: 1;
    min-width: 0;
  }
}

.content-tip {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 8px;
  line-height: 1.5;
}

.content-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.content-textarea {
  :deep(.el-textarea__inner) {
    overflow-y: auto;
  }
}

.preview-scrollbar {
  width: 100%;
  height: 380px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 12px 16px;
}

.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  word-break: break-word;

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin-top: 16px;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  :deep(h1:first-child),
  :deep(h2:first-child) {
    margin-top: 0;
  }

  :deep(p) {
    margin-bottom: 8px;
  }

  :deep(code) {
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  :deep(pre) {
    background: var(--el-fill-color-light);
    padding: 12px 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 12px;

    code {
      background: none;
      padding: 0;
    }
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 20px;
    margin-bottom: 8px;
  }

  :deep(blockquote) {
    border-left: 3px solid var(--el-border-color);
    padding-left: 12px;
    margin: 8px 0;
    color: var(--el-text-color-secondary);
  }
}
</style>
