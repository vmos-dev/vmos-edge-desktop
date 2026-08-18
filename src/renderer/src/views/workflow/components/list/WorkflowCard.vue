<script setup lang="ts">
/**
 * 工作流卡 · 苹果克制风(工具型产品尺度,非营销页)
 *
 * 布局:
 *  - 顶部:48×48 app icon(左)/ hover 浮出删除(右上)
 *  - 中部:工作流名(16/600)+ 应用名 · 版本(12/soft, a 包名走 title tooltip)
 *  - hairline 分隔
 *  - 底部:左侧元数据"N 小时前更新 · M月D日创建"(c 并显)/ 右侧 stepCount chip
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Delete } from '@element-plus/icons-vue'
import type { WorkflowListItem } from '@shared/ipc/workflow.types'

interface Props {
  workflow: WorkflowListItem
}

interface Emits {
  (e: 'open', id: string): void
  (e: 'delete', id: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const iconFallback = computed(() => {
  const text = props.workflow.appName?.trim() || props.workflow.name?.trim() || 'W'
  return text.slice(0, 1).toUpperCase()
})

const isDraft = computed(() => props.workflow.stepCount === 0)

const updatedRelative = computed(() => {
  const ts = props.workflow.updatedAt
  if (!ts) return '—'
  const diffMs = Date.now() - ts
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diffMs < 2 * min) return t('workflow.card.justNowUpdated')
  if (diffMs < hour)
    return t('workflow.card.minutesAgoUpdated', { count: Math.floor(diffMs / min) })
  if (diffMs < day) return t('workflow.card.hoursAgoUpdated', { count: Math.floor(diffMs / hour) })
  if (diffMs < 7 * day)
    return t('workflow.card.daysAgoUpdated', { count: Math.floor(diffMs / day) })

  const date = new Date(ts)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return sameYear
    ? t('workflow.card.dateUpdated', { month: date.getMonth() + 1, day: date.getDate() })
    : t('workflow.card.dateYearUpdated', {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      })
})

const createdAbsolute = computed(() => {
  const ts = props.workflow.createdAt
  if (!ts) return null
  const date = new Date(ts)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return sameYear
    ? t('workflow.card.dateCreated', { month: date.getMonth() + 1, day: date.getDate() })
    : t('workflow.card.dateYearCreated', {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      })
})

const showCreated = computed(() => {
  if (!props.workflow.createdAt || !props.workflow.updatedAt) return false
  return props.workflow.updatedAt - props.workflow.createdAt > 60_000
})

const appLineTitle = computed(() => {
  const v = props.workflow.appVersion ? ` · v${props.workflow.appVersion}` : ''
  return `${props.workflow.appName}${v} · ${props.workflow.appId}`
})

function handleOpen(): void {
  emit('open', props.workflow.id)
}

function handleDelete(event: MouseEvent): void {
  event.stopPropagation()
  emit('delete', props.workflow.id)
}
</script>

<template>
  <article
    class="wf-card"
    :class="{ draft: isDraft }"
    role="button"
    tabindex="0"
    :aria-label="t('workflow.card.openScript', { name: workflow.name })"
    @click="handleOpen"
    @keydown.enter.prevent="handleOpen"
    @keydown.space.prevent="handleOpen"
  >
    <div class="card-head">
      <div class="icon" aria-hidden="true">
        <img v-if="workflow.appIcon" :src="workflow.appIcon" :alt="workflow.appName" />
        <span v-else class="icon-fallback">{{ iconFallback }}</span>
      </div>

      <button
        type="button"
        class="delete-btn"
        :aria-label="t('workflow.card.delete')"
        @click="handleDelete"
      >
        <Delete />
      </button>
    </div>

    <div class="card-body">
      <h3 class="name" :title="workflow.name">{{ workflow.name }}</h3>
      <p class="app-line" :title="appLineTitle">
        <span class="app-name">{{ workflow.appName }}</span>
        <span v-if="workflow.appVersion" class="app-version"> · v{{ workflow.appVersion }} </span>
      </p>
    </div>

    <div class="card-foot">
      <span class="meta">
        <span>{{ updatedRelative }}</span>
        <template v-if="showCreated">
          <span class="dot-sep" aria-hidden="true">·</span>
          <span>{{ createdAbsolute }}</span>
        </template>
      </span>

      <span v-if="isDraft" class="step-chip draft-chip">{{ t('workflow.card.draft') }}</span>
      <span v-else class="step-chip">
        <span class="step-num">{{ workflow.stepCount }}</span>
        <span class="step-unit">{{ t('workflow.card.stepUnit') }}</span>
      </span>
    </div>
  </article>
</template>

<style scoped>
.wf-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 12px;
  padding: 16px;
  background: var(--wf-surface);
  border: 1px solid var(--wf-hairline);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  outline: none;
  text-align: left;
  min-height: 120px;
  transition:
    border-color 200ms ease,
    box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 250ms cubic-bezier(0.4, 0, 0.2, 1),
    background-color 200ms ease;
}

.wf-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow:
    0 10px 20px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
  background: var(--wf-surface-hover);
}

.wf-card:active {
  transform: translateY(0) scale(0.98);
}

.wf-card:focus-visible {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-8);
}

/* ── Head ───────────────────────── */

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--wf-surface-tint);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  transition: transform 250ms ease;
}

.wf-card:hover .icon {
  transform: scale(1.05);
}

.icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-fallback {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.9);
  flex-shrink: 0;
  transition:
    opacity 200ms ease,
    transform 200ms ease,
    color 200ms ease,
    background-color 200ms ease;
}

.delete-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

.delete-btn:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  transform: scale(1);
}

.wf-card:hover .delete-btn,
.wf-card:focus-within .delete-btn {
  opacity: 1;
  transform: scale(1);
}

@media (hover: none) {
  .delete-btn {
    opacity: 1;
    transform: scale(1);
  }
}

/* ── Body ───────────────────────── */

.card-body {
  min-width: 0;
}

.name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.app-line {
  margin: 6px 0 0;
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0;
}

.app-version {
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
  margin-left: 4px;
  font-size: 11px;
}

/* ── Foot ───────────────────────── */

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--wf-hairline);
}

.meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  min-width: 0;
}

.dot-sep {
  opacity: 0.5;
}

.step-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.step-num {
  letter-spacing: -0.01em;
}

.step-unit {
  font-size: 10px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  opacity: 0.8;
}

.draft-chip {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

@media (prefers-reduced-motion: reduce) {
  .wf-card,
  .delete-btn,
  .icon {
    transition: none;
  }
}
</style>
