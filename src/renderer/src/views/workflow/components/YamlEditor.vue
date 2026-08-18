<template>
  <div ref="editorContainer" class="yaml-editor"></div>
</template>

<script setup lang="ts">
import { shallowRef, computed, onMounted, onUnmounted, watch, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import * as monaco from 'monaco-editor'
import { useTheme } from '@renderer/hooks/useTheme'
import { ensureSetup, createWorkflowModel, refreshYamlSchema } from '../editor/monacoSetup'
import type { LineStatusMap, LineErrorMap } from '../composables/useFlowRunner'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    readOnly?: boolean
    lineStatuses?: LineStatusMap
    /** error 行的错误文案;用于 glyph hover tooltip */
    lineErrors?: LineErrorMap
  }>(),
  {
    modelValue: '',
    readOnly: false,
    lineStatuses: () => ({}),
    lineErrors: () => ({})
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /**
   * 光标行号冒泡给父级 —— 走 Events up,保持响应式,便于"插到光标处"等上层逻辑
   * 组合。初次 mount 立即 emit 当前位置;之后随 Monaco cursor change 更新
   */
  'update:cursorLine': [line: number]
}>()

const { t, locale } = useI18n()
const editorContainerRef = useTemplateRef<HTMLElement>('editorContainer')
const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)
const model = shallowRef<monaco.editor.ITextModel | null>(null)
let currentDecorations: string[] = []

/**
 * echo-loop 防护:
 *   setValue 会触发 onDidChangeModelContent,后者 emit update → 父级 watcher → 回写 modelValue
 *   记录"最近一次我们 emit 出去的值",来新 modelValue 和它一致时不再 setValue
 */
let lastEmitted: string = ''

const { themeMode } = useTheme()
const isDark = computed(() => {
  if (themeMode.value === 'dark') return true
  if (themeMode.value === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
})

// ── 行状态装饰样式 ──
function registerDecorationStyles() {
  if (document.getElementById('yaml-editor-decorations')) return
  const style = document.createElement('style')
  style.id = 'yaml-editor-decorations'
  style.textContent = `
    .yaml-line-running { background-color: rgba(59, 130, 246, 0.06) !important; }
    .yaml-line-success { }
    .yaml-line-error { background-color: rgba(239, 68, 68, 0.08) !important; }


    .yaml-glyph-running {
      background: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14' fill='none'><circle cx='7' cy='7' r='4' stroke='%233b82f6' stroke-width='2' fill='none' stroke-dasharray='12.56' stroke-dashoffset='4'><animateTransform attributeName='transform' type='rotate' from='0 7 7' to='360 7 7' dur='0.8s' repeatCount='indefinite'/></circle></svg>") no-repeat center center !important;
      background-size: 16px 16px !important;
    }
    .yaml-glyph-success {
      background: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'><path d='M3 8.5l3.5 3.5L13 4.5' stroke='%2322c55e' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>") no-repeat center center !important;
      background-size: 16px 16px !important;
    }
    .yaml-glyph-error {
      background: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'><path d='M4 4l8 8M12 4l-8 8' stroke='%23ef4444' stroke-width='2.2' stroke-linecap='round'/></svg>") no-repeat center center !important;
      background-size: 16px 16px !important;
    }

    /*
     * 隐藏 monaco-yaml schema hover 底部的 "Source: <schema-link>" 行。
     * Monaco 为了安全把 <a href> 清成空串,真实 URL 放在 data-href 里 ——
     * 所以按 data-href 定位更准也更能表达意图(只针对 schema 文件链接)。
     * glyph hover(执行失败)用纯文本 markdown,不含链接,不受影响。
     */
    .monaco-hover-content p:has(a[data-href^="file:"]) { display: none !important; }
    .monaco-hover-content hr:has(+ p a[data-href^="file:"]) { display: none !important; }
  `
  document.head.appendChild(style)
}

function updateDecorations() {
  if (!editor.value) return
  const decorations: monaco.editor.IModelDeltaDecoration[] = []
  for (const [lineStr, status] of Object.entries(props.lineStatuses)) {
    const lineNumber = Number(lineStr)
    if (lineNumber <= 0) continue

    const isCont = status.endsWith('-cont')
    const baseStatus = isCont ? status.slice(0, -5) : status

    // error 首行:hover X 图标显示错误文案
    const errMsg = baseStatus === 'error' && !isCont ? props.lineErrors[lineNumber] : undefined
    const hoverMessage = errMsg
      ? { value: `${t('workflow.yamlEditorHover.executionFailed')}\n\n${errMsg}`, isTrusted: false }
      : undefined

    decorations.push({
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: `yaml-line-${baseStatus}`,
        glyphMarginClassName: isCont ? '' : `yaml-glyph-${baseStatus}`,
        glyphMarginHoverMessage: hoverMessage,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      }
    })
  }
  currentDecorations = editor.value.deltaDecorations(currentDecorations, decorations)
}

// ── 初始化 ──
onMounted(() => {
  if (!editorContainerRef.value) return
  ensureSetup()
  registerDecorationStyles()

  const initial = props.modelValue ?? ''
  lastEmitted = initial
  model.value = createWorkflowModel(initial)

  editor.value = monaco.editor.create(editorContainerRef.value, {
    model: model.value,
    theme: isDark.value ? 'vs-dark' : 'vs',
    fontSize: 15,
    lineHeight: 26,
    minimap: { enabled: false },
    scrollbar: { vertical: 'auto', horizontal: 'auto' },
    renderLineHighlight: 'line',
    lineNumbers: 'off',
    roundedSelection: false,
    scrollBeyondLastLine: false,
    readOnly: props.readOnly,
    automaticLayout: true,
    padding: { top: 16, bottom: 16 },
    tabSize: 2,
    folding: false,
    glyphMargin: true,
    contextmenu: true,
    quickSuggestions: { other: true, comments: true, strings: true },
    suggestOnTriggerCharacters: true,
    wordWrap: 'off',
    bracketPairColorization: { enabled: false },
    // hover / suggest 等浮层改挂到 document.body 下,避免被父级 overflow:hidden
    // 裁剪(例如编辑页顶栏或侧栏 side-panel 的滚动区)
    fixedOverflowWidgets: true
  })

  editor.value.onDidChangeModelContent(() => {
    const value = editor.value?.getValue() ?? ''
    if (value === lastEmitted) return
    lastEmitted = value
    emit('update:modelValue', value)
  })

  // 光标位置:初始 (1,1),用户移动时实时冒泡。
  // 不本地存 ref —— Monaco 已是唯一真相源,我们只做"事件转发"
  emit('update:cursorLine', editor.value.getPosition()?.lineNumber ?? 1)
  editor.value.onDidChangeCursorPosition((e) => {
    emit('update:cursorLine', e.position.lineNumber)
  })

  updateDecorations()
})

// ── Watchers ──
// 父级回写时只在确实是新值时 setValue,避免无意义 echo
watch(
  () => props.modelValue,
  (newVal) => {
    const ed = editor.value
    if (!ed) return
    const current = ed.getValue()
    if (newVal === current) return
    // 标记为下一次 onDidChangeModelContent 的预期值,防止 emit 回环
    lastEmitted = newVal
    // 用 model.setValue 而非 editor.setValue,后者会重置撤销栈
    ed.getModel()?.setValue(newVal)
  }
)

watch(
  () => props.readOnly,
  (val) => {
    editor.value?.updateOptions({ readOnly: val })
  }
)

watch([() => props.lineStatuses, () => props.lineErrors], () => updateDecorations(), { deep: true })

watch(isDark, (dark) => {
  monaco.editor.setTheme(dark ? 'vs-dark' : 'vs')
})

watch(locale, () => refreshYamlSchema())

onUnmounted(() => {
  editor.value?.dispose()
  model.value?.dispose()
  editor.value = null
  model.value = null
})

/**
 * 跳到指定行:Monaco 原生的 revealLineInCenter + setPosition
 * 光标自动闪烁在目标行,这就是 VS Code Go-to-Line 的默认行为,不再叠加自定义高亮
 *
 * 注:setPosition 会触发 onDidChangeCursorPosition,光标行号自动通过
 * update:cursorLine emit 冒泡给父级 —— 这里不用手动再 emit
 */
function revealLine(line: number): void {
  const ed = editor.value
  if (!ed || line < 1) return
  ed.revealLineInCenter(line, monaco.editor.ScrollType.Smooth)
  ed.setPosition({ lineNumber: line, column: 1 })
  ed.focus()
}

defineExpose({
  /** 滚到指定行 + 光标定位(WorkflowSidePanel 的 view-yaml 跳转用) */
  revealLine
})
</script>

<style scoped>
.yaml-editor {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
