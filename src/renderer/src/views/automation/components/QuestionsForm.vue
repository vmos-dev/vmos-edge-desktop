<template>
  <div class="questions-form">
    <el-form ref="formRef" :model="formData" :rules="rules" label-position="top" size="default">
      <el-form-item
        v-for="question in questions"
        :key="question.id"
        :label="question.label"
        :prop="question.id"
        :required="question.required"
      >
        <!-- 文本输入 -->
        <el-input
          v-if="question.type === 'text'"
          v-model="formData[question.id]"
          :placeholder="question.placeholder"
        />

        <!-- 单选 -->
        <el-select
          v-else-if="question.type === 'select'"
          v-model="formData[question.id]"
          :placeholder="question.placeholder || t('automation.questionsForm.selectPlaceholder')"
          style="width: 100%"
        >
          <el-option
            v-for="opt in question.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <!-- 多选 -->
        <el-select
          v-else-if="question.type === 'multiselect'"
          v-model="formData[question.id]"
          :placeholder="question.placeholder || t('automation.questionsForm.selectPlaceholder')"
          multiple
          style="width: 100%"
        >
          <el-option
            v-for="opt in question.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <!-- 确认 -->
        <el-switch
          v-else-if="question.type === 'confirm'"
          v-model="formData[question.id]"
          :active-text="t('automation.questionsForm.yes')"
          :inactive-text="t('automation.questionsForm.no')"
        />
      </el-form-item>

      <el-form-item class="submit-item">
        <el-button type="primary" @click="handleSubmit">
          <el-icon><Check /></el-icon>
          {{ t('automation.questionsForm.submit') }}
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Check } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// ==================== Props & Emits ====================

const props = defineProps<{
  questions: any[]
}>()

const emit = defineEmits<{
  (e: 'submit', answers: Record<string, string | string[] | boolean>): void
}>()

// ==================== State ====================

const formRef = ref<FormInstance>()
const formData = ref<Record<string, string | string[] | boolean>>({})

// ==================== Computed ====================

const rules = computed<FormRules>(() => {
  const result: FormRules = {}

  for (const question of props.questions) {
    if (question.required) {
      result[question.id] = [
        {
          required: true,
          message:
            question.type === 'text'
              ? t('automation.questionsForm.requiredInput', { label: question.label })
              : t('automation.questionsForm.requiredSelect', { label: question.label }),
          trigger: question.type === 'text' ? 'blur' : 'change'
        }
      ]
    }
  }

  return result
})

// ==================== Watch ====================

// 初始化表单数据
watch(
  () => props.questions,
  (questions) => {
    const data: Record<string, string | string[] | boolean> = {}

    for (const question of questions) {
      if (question.defaultValue !== undefined) {
        data[question.id] = question.defaultValue
      } else {
        switch (question.type) {
          case 'text':
          case 'select':
            data[question.id] = ''
            break
          case 'multiselect':
            data[question.id] = []
            break
          case 'confirm':
            data[question.id] = false
            break
        }
      }
    }

    formData.value = data
  },
  { immediate: true }
)

// ==================== Methods ====================

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    emit('submit', { ...formData.value })
  } catch {
    // 验证失败
  }
}
</script>

<style scoped lang="scss">
.questions-form {
  margin-top: 12px;
  padding: 16px;
  background-color: var(--el-fill-color-lighter);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);

  :deep(.el-form-item) {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--el-text-color-primary);
    padding-bottom: 4px;
  }

  .submit-item {
    margin-top: 8px;
    margin-bottom: 0;

    :deep(.el-form-item__content) {
      justify-content: flex-end;
    }
  }
}
</style>
