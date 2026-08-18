<script setup lang="ts">
/**
 * 候选列表(折叠式)
 *
 * 对齐 Maestro Studio:展示本次点击栈上所有 clickable / anchored 候选,
 * 让用户自行选定要操作的元素。算法**不推荐**任何候选(也不标星),
 * "当前激活"由用户点击决定,第一次默认 = hit(用户的原始点击位置)。
 *
 * 默认折叠,减少干扰。点击展开按钮显示完整列表。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import type { PickCandidate } from '@renderer/components/ui-inspector/pickResolver'
import type { UiNode } from '@renderer/components/ui-inspector/types'

interface Props {
  candidates: readonly PickCandidate[]
}

defineProps<Props>()
const activeId = defineModel<number>('activeId', { required: true })
const { t } = useI18n()

const expanded = ref(false)

// ─── 展示工具 ─────────────────────────────

function shortClassName(cls: string): string {
  const idx = cls.lastIndexOf('.')
  return idx >= 0 ? cls.slice(idx + 1) : cls
}

function shortId(rid: string): string {
  const idx = rid.lastIndexOf('/')
  return idx >= 0 ? rid.slice(idx + 1) : rid
}

function truncate(s: string, max = 32): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function nodeLabel(node: UiNode): string {
  return shortClassName(node.className) || 'View'
}

function selectorPreview(node: UiNode): string {
  const text = node.attrs['text']?.trim()
  if (text) return `text: ${truncate(text)}`
  const desc = node.attrs['content-desc']?.trim()
  if (desc) return `desc: ${truncate(desc)}`
  const rid = node.attrs['resource-id']?.trim()
  if (rid) return `id: ${shortId(rid)}`
  if (node.attrs['clickable'] === 'true') return t('workflow.candidatePicker.clickableArea')
  return t('workflow.candidatePicker.noAnchor')
}
</script>

<template>
  <div class="candidate-picker" :class="{ expanded }">
    <button type="button" class="toggle" :aria-expanded="expanded" @click="expanded = !expanded">
      <span class="label">{{ t('workflow.candidatePicker.label') }}</span>
      <span class="count">{{ candidates.length }}</span>
      <span class="chev" aria-hidden="true">
        <component :is="expanded ? ArrowUp : ArrowDown" />
      </span>
    </button>

    <p v-if="expanded" class="sort-hint">{{ t('workflow.candidatePicker.sortHint') }}</p>

    <ul v-if="expanded" class="list" role="list">
      <li
        v-for="c in candidates"
        :key="c.node.id"
        class="row"
        :class="{ active: c.node.id === activeId }"
      >
        <button
          type="button"
          class="row-btn"
          :title="selectorPreview(c.node)"
          @click="activeId = c.node.id"
        >
          <span class="mark" aria-hidden="true">
            <span v-if="c.node.id === activeId" class="dot">●</span>
          </span>
          <span class="labels">
            <span class="label-line">{{ nodeLabel(c.node) }}</span>
            <span class="preview">{{ selectorPreview(c.node) }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.candidate-picker {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 120ms;
}

.toggle:hover {
  background: var(--el-fill-color-light);
}

.label {
  font-weight: 600;
}

.count {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.chev {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
}

.chev :deep(svg) {
  width: 12px;
  height: 12px;
}

.sort-hint {
  margin: 0;
  padding: 0 14px 6px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--el-text-color-placeholder);
}

.list {
  list-style: none;
  padding: 0 10px 10px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 200px;
  overflow-y: auto;
}

.row-btn {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  column-gap: 8px;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 120ms,
    background-color 120ms;
}

.row-btn:hover {
  background: var(--el-fill-color-light);
}

.row.active .row-btn {
  border-color: color-mix(in srgb, var(--el-color-primary) 40%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--el-color-primary);
}

.labels {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.label-line {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}

.preview {
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'SF Mono', 'Menlo', monospace;
  line-height: 1.3;
}
</style>
