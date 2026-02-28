<template>
  <div class="json-editor-wrapper">
    <!-- 编辑器 -->
    <div
      ref="container"
      class="json-editor-container"
      :style="{ height }"
      :class="{ invalid: !isValid }"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useFormItem } from 'element-plus'
import JSONEditor, { JSONEditorOptions } from 'jsoneditor'
import 'jsoneditor/dist/jsoneditor.min.css'

defineOptions({ name: 'VmosJson' })

/* ---------- Props ---------- */
interface Props {
  height?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: '150px',
  disabled: false
})

/* ---------- v-model ---------- */
const modelValue = defineModel<any>('modelValue', { required: true })
const { formItem } = useFormItem()

/* ---------- refs ---------- */
const container = ref<HTMLElement | null>(null)
let editor: JSONEditor | null = null

const isValid = ref(true)

/* ---------- 格式化方法（核心） ---------- */
function formatJson() {
  if (!editor || !isValid.value) return
  try {
    const json = editor.get()
    editor.set(json) // 自动 pretty-print
  } catch {
    // 忽略
  }
}

/* ---------- 初始化 ---------- */
onMounted(() => {
  if (!container.value) return

  const options: JSONEditorOptions = {
    mode: 'code',
    mainMenuBar: false,
    navigationBar: false,
    statusBar: false,

    // ⭐ 输入时只做校验，不格式化
    onChangeText: (text) => {
      if (props.disabled) return
      try {
        const json = JSON.parse(text)
        if (
          typeof json !== 'object' ||
          json === null ||
          Array.isArray(json) ||
          Object.keys(json).length === 0
        ) {
          throw new Error('Invalid JSON object')
        }

        isValid.value = true
        modelValue.value = json
        formItem?.validate('change')
      } catch {
        isValid.value = false
        modelValue.value = '' // ❗ 不合法 → 清空
        formItem?.validate('change')
      }
    },

    onBlur: () => {
      formatJson()
      formItem?.validate('blur')
    }
  }

  editor = new JSONEditor(container.value, options)

  if (props.disabled) {
    editor.setMode('view')
  }

  // 初始化显示
  if (modelValue.value) {
    editor.set(modelValue.value)
  }
})

watch(
  () => props.disabled,
  (val) => {
    if (editor) {
      editor.setMode(val ? 'view' : 'code')
    }
  }
)

/* ---------- 对外暴露 ---------- */
function getText(): string {
  return editor?.getText() ?? ''
}

function validate(): boolean {
  return isValid.value
}

defineExpose({
  format: formatJson,
  getText,
  validate
})

/* ---------- 销毁 ---------- */
onUnmounted(() => {
  editor?.destroy()
  editor = null
})
</script>

<style scoped>
.json-editor-wrapper {
  width: 100%;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;
}

.format-btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  border-radius: 4px;
  cursor: pointer;
}

.format-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 编辑器容器 */
.json-editor-container {
  width: 100%;
}

/* 基础边框 */
:deep(.jsoneditor) {
  border: 1px solid var(--el-border-color);
}

/* ❌ 非法 JSON 高亮 */
.invalid :deep(.jsoneditor) {
  border-color: var(--el-color-danger);
}

/* code 模式字体 */
:deep(.ace_editor) {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}
</style>
