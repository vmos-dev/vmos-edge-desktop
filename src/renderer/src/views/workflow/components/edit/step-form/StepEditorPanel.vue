<script setup lang="ts">
/**
 * StepEditorPanel · 单步编辑面板(行展开后的内嵌容器)
 *
 * 视觉灵感:Notion inline expand —— 白卡 + soft shadow,跟列表 row 形成深度差。
 *
 * 控制型组件:body 由父级派生并传入,编辑事件冒到父级。
 *
 * 职责:
 *  - 拉 schema 字段 + registry 标签 + 类别色
 *  - 选 form 组件:registry.form 优先,否则 AutoForm
 *  - 透传 body / 上抛 update:body
 *  - 内嵌 YAML 预览(默认折叠,点 chevron 展开)
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElIcon } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { actionLabel, getActionDefinition } from '../../../utils/actionRegistry'
import { getActionFields } from '../../../utils/actionSchema'
import { categoryStyle } from '../../../utils/actionCategoryStyle'
import AutoForm from './AutoForm.vue'
import StepYamlPreview from './StepYamlPreview.vue'

interface Props {
  /** YAML 中此 step 的 action 名(决定 schema / 标签 / 用哪个 form) */
  action: string
  /** 当前 YAML body(父级派生自 doc.text;每次更新会重新传入) */
  body: unknown
}

interface Emits {
  /** 表单输出新 body(完整);父级用 doc.editStepBody(stepId, action, body) 写回 */
  (e: 'update:body', body: unknown): void
  /** 关闭编辑器(收起这一行) */
  (e: 'close'): void
}

const props = defineProps<Props>()
defineEmits<Emits>()
const { t } = useI18n()

const definition = computed(() => getActionDefinition(props.action))
const headerLabel = computed(() => actionLabel(props.action))
const fields = computed(() => getActionFields(props.action))
const FormComponent = computed(() => definition.value?.form ?? AutoForm)
const style = computed(() => categoryStyle(definition.value?.category))
</script>

<template>
  <div class="editor-panel" @click.stop>
    <header class="head">
      <span
        class="head-icon"
        :style="{ background: style.bg50, color: style.c700 }"
        aria-hidden="true"
      >
        <ElIcon :size="14"><component :is="style.icon" /></ElIcon>
      </span>
      <span class="head-title">{{ headerLabel }}</span>
      <ElButton
        class="head-close"
        :icon="Close"
        size="small"
        link
        :title="t('workflow.stepEditor.collapse')"
        :aria-label="t('workflow.stepEditor.collapseEditor')"
        @click="$emit('close')"
      />
    </header>

    <div class="body">
      <component
        :is="FormComponent"
        :fields="fields"
        :primary-fields="definition?.primaryFields"
        :body="body"
        :action="action"
        @update:body="(b: unknown) => $emit('update:body', b)"
      />
    </div>

    <StepYamlPreview class="preview" :action="action" :body="body" />
  </div>
</template>

<style scoped>
.editor-panel {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  margin: 8px 0;
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  background: var(--el-fill-color-blank);
}

.head-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex-shrink: 0;
}

.head-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.head-close {
  flex-shrink: 0;
}

.body {
  padding: 12px;
}

.preview {
  margin: 0;
  padding: 12px;
  border-top: 1px solid var(--el-border-color-extra-light);
  background: var(--el-fill-color-lighter);
}
</style>
