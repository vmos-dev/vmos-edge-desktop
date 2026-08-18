<script setup lang="ts">
/**
 * StepYamlPreview · 单步 body 的实时 YAML 预览
 *
 * 默认折叠 — 不抢戏。展开后显示纯文本 YAML(只读),建立"我刚做的事 = YAML"信任感。
 *
 * 不直接写到主文档。主 YAML 编辑器在右栏的 YAML tab。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElIcon } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { stringify as yamlStringify } from 'yaml'

interface Props {
  action: string
  body: unknown
}

const props = defineProps<Props>()
const { t } = useI18n()
const open = ref(false)

const yamlText = computed(() => {
  const item = props.body === undefined ? props.action : { [props.action]: props.body }
  try {
    return yamlStringify([item], {
      lineWidth: 0,
      defaultKeyType: 'PLAIN',
      defaultStringType: 'PLAIN'
    }).trimEnd()
  } catch {
    return t('workflow.yamlPreview.noPreview')
  }
})
</script>

<template>
  <div class="yaml-preview" :class="{ open }">
    <button type="button" class="toggle" @click="open = !open">
      <ElIcon class="toggle-arrow" :class="{ open }" :size="13">
        <ArrowDown />
      </ElIcon>
      <span>{{
        open ? t('workflow.yamlPreview.collapse') : t('workflow.yamlPreview.expand')
      }}</span>
    </button>

    <pre v-if="open" class="code">{{ yamlText }}</pre>
  </div>
</template>

<style scoped>
.yaml-preview {
  padding-top: 12px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  letter-spacing: 0.04em;
}
.toggle:hover {
  color: var(--el-color-primary);
}

.toggle-arrow {
  transition: transform 0.18s ease;
}
.toggle-arrow.open {
  transform: rotate(180deg);
}

.code {
  margin: 8px 0 0;
  padding: 10px 12px;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  white-space: pre;
  overflow-x: auto;
  font-variant-numeric: tabular-nums;
}
</style>
