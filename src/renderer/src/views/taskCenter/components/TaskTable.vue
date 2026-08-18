<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'
import type { BatchTask, BatchTaskSummary } from '@shared/ipc/batchTask.types'

type TaskRow = BatchTask & { summary: BatchTaskSummary }

defineProps<{
  tasks: TaskRow[]
  loading: boolean
}>()

const emit = defineEmits<{
  detail: [id: string]
  cancel: [id: string]
  delete: [id: string]
}>()

const { t } = useI18n()

function statusClass(status: string): string {
  switch (status) {
    case 'RUNNING':
      return 'running'
    case 'DONE':
      return 'done'
    case 'CANCELLED':
      return 'cancelled'
    default:
      return ''
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'RUNNING':
      return t('taskCenter.status.running')
    case 'DONE':
      return t('taskCenter.status.done')
    case 'CANCELLED':
      return t('taskCenter.status.cancelled')
    default:
      return status
  }
}

function successPercent(row: TaskRow): number {
  if (row.totalDevices === 0) return 0
  return (row.summary.completed / row.totalDevices) * 100
}

function failPercent(row: TaskRow): number {
  if (row.totalDevices === 0) return 0
  const failed = row.summary.failed + row.summary.submitFailed
  return (failed / row.totalDevices) * 100
}

function cancelledPercent(row: TaskRow): number {
  if (row.totalDevices === 0) return 0
  return (row.summary.cancelled / row.totalDevices) * 100
}

function progressText(row: TaskRow): string {
  const done =
    row.summary.completed + row.summary.failed + row.summary.cancelled + row.summary.submitFailed
  return `${done}/${row.totalDevices}`
}

function hasFailed(row: TaskRow): boolean {
  return row.summary.failed + row.summary.submitFailed > 0
}

function allSucceeded(row: TaskRow): boolean {
  return row.status === 'DONE' && !hasFailed(row) && row.summary.cancelled === 0
}

function elapsedText(row: TaskRow): string {
  const ms = Date.now() - row.createdAt
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function formatDuration(row: TaskRow): string {
  if (!row.completedAt) return '-'
  const ms = row.completedAt - row.createdAt
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (diff < 2 * min) return t('taskCenter.time.justNow')
  if (diff < hour) return t('taskCenter.time.minutesAgo', { count: Math.floor(diff / min) })
  if (diff < day) return t('taskCenter.time.hoursAgo', { count: Math.floor(diff / hour) })
  if (diff < 7 * day) return t('taskCenter.time.daysAgo', { count: Math.floor(diff / day) })
  const d = new Date(ts)
  return d.getFullYear() === new Date().getFullYear()
    ? `${d.getMonth() + 1}/${d.getDate()}`
    : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function summaryTooltip(row: TaskRow): string {
  const parts: string[] = []
  if (row.summary.completed) parts.push(`✓ ${row.summary.completed}`)
  if (row.summary.failed + row.summary.submitFailed)
    parts.push(`✗ ${row.summary.failed + row.summary.submitFailed}`)
  if (row.summary.running) parts.push(`⟳ ${row.summary.running}`)
  if (row.summary.pending) parts.push(`◦ ${row.summary.pending}`)
  if (row.summary.cancelled) parts.push(`— ${row.summary.cancelled}`)
  return parts.join('  ')
}

function confirmCancel(e: MouseEvent, id: string) {
  e.stopPropagation()
  ElMessageBox.confirm(t('taskCenter.confirm.cancelTask'), { type: 'warning' })
    .then(() => emit('cancel', id))
    .catch(() => {})
}

function confirmDelete(e: MouseEvent, id: string) {
  e.stopPropagation()
  ElMessageBox.confirm(t('taskCenter.confirm.deleteTask'), { type: 'warning' })
    .then(() => emit('delete', id))
    .catch(() => {})
}
</script>

<template>
  <div class="task-grid" v-loading="loading">
    <div v-if="tasks.length === 0 && !loading" class="task-empty">
      <el-empty :image-size="80" />
    </div>

    <article
      v-for="row in tasks"
      :key="row.id"
      class="task-card"
      :class="[statusClass(row.status), { 'all-success': allSucceeded(row) }]"
      role="button"
      tabindex="0"
      @click="emit('detail', row.id)"
      @keydown.enter.prevent="emit('detail', row.id)"
    >
      <div class="card-head">
        <span class="status-badge" :class="statusClass(row.status)">
          <span class="status-dot" />
          {{ statusLabel(row.status) }}
        </span>
        <button
          v-if="row.status === 'RUNNING'"
          class="action-btn"
          :title="t('taskCenter.table.cancel')"
          @click="confirmCancel($event, row.id)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
        <button
          v-else
          class="action-btn"
          :title="t('taskCenter.table.delete')"
          @click="confirmDelete($event, row.id)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            />
          </svg>
        </button>
      </div>

      <div class="card-body">
        <h3 class="task-name" :title="row.name">{{ row.name }}</h3>
        <p class="task-workflow">{{ row.workflowName }}</p>
      </div>

      <!-- 分段进度条 -->
      <div class="card-progress" :title="summaryTooltip(row)">
        <div class="progress-track" :class="{ shimmer: row.status === 'RUNNING' }">
          <div class="seg seg-success" :style="{ width: successPercent(row) + '%' }" />
          <div
            v-if="hasFailed(row)"
            class="seg seg-fail"
            :style="{ width: failPercent(row) + '%' }"
          />
          <div
            v-if="row.summary.cancelled > 0"
            class="seg seg-cancel"
            :style="{ width: cancelledPercent(row) + '%' }"
          />
        </div>
      </div>

      <div class="card-foot">
        <span class="foot-meta">
          <template v-if="row.status === 'RUNNING'">
            <span class="elapsed">{{ elapsedText(row) }}</span>
          </template>
          <template v-else>
            <span>{{ timeAgo(row.createdAt) }}</span>
            <template v-if="row.completedAt">
              <span class="dot-sep">·</span>
              <span>{{ formatDuration(row) }}</span>
            </template>
          </template>
        </span>
        <span
          class="device-chip"
          :class="{ 'chip-success': allSucceeded(row), 'chip-warn': hasFailed(row) }"
        >
          <span class="chip-num">{{ progressText(row) }}</span>
          <span class="chip-unit">{{ t('taskCenter.table.devices') }}</span>
        </span>
      </div>
    </article>
  </div>
</template>

<style scoped>
.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  min-height: 200px;
}

.task-empty {
  grid-column: 1 / -1;
  padding: 60px 0;
}

/* ── 卡片 ── */
.task-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  gap: 12px;
  padding: 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  outline: none;
  min-height: 120px;
  transition:
    border-color 200ms ease,
    box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
}

.task-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow:
    0 10px 20px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.04);
  transform: translateY(-2px);
}

.task-card:active {
  transform: translateY(0) scale(0.98);
}

.task-card:focus-visible {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-8);
}

.task-card.running {
  border-color: var(--el-color-primary-light-7);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 0 0 1px var(--el-color-primary-light-8);
}

.task-card.running:hover {
  border-color: var(--el-color-primary-light-3);
  box-shadow:
    0 10px 20px rgba(0, 0, 0, 0.08),
    0 0 0 1px var(--el-color-primary-light-6);
}

.task-card.all-success {
  border-color: var(--el-color-success-light-7);
}

.task-card.all-success:hover {
  border-color: var(--el-color-success-light-3);
}

/* ── 头部 ── */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 8px;
  line-height: 1;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-badge.running {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.status-badge.running .status-dot {
  background: var(--el-color-primary);
  animation: dot-pulse 1.5s ease-in-out infinite;
}

.status-badge.done {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.status-badge.done .status-dot {
  background: var(--el-color-success);
}

.status-badge.cancelled {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
}

.status-badge.cancelled .status-dot {
  background: var(--el-text-color-disabled);
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}

.action-btn {
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

.action-btn svg {
  width: 14px;
  height: 14px;
}

.action-btn:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  transform: scale(1);
}

.task-card:hover .action-btn,
.task-card:focus-within .action-btn {
  opacity: 1;
  transform: scale(1);
}

@media (hover: none) {
  .action-btn {
    opacity: 1;
    transform: scale(1);
  }
}

/* ── 主体 ── */
.card-body {
  min-width: 0;
}

.task-name {
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

.task-workflow {
  margin: 6px 0 0;
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 分段进度条 ── */
.card-progress {
  padding: 0;
}

.progress-track {
  display: flex;
  height: 4px;
  border-radius: 2px;
  background: var(--el-fill-color-light);
  overflow: hidden;
  position: relative;
}

.progress-track.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer 2s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.seg {
  height: 100%;
  transition: width 0.4s ease;
  flex-shrink: 0;
}

.seg-success {
  background: var(--el-color-success);
}

.seg-fail {
  background: var(--el-color-danger);
}

.seg-cancel {
  background: var(--el-text-color-disabled);
}

/* ── 底栏 ── */
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-extra-light);
}

.foot-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
  min-width: 0;
}

.elapsed {
  color: var(--el-color-primary);
  font-weight: 500;
}

.dot-sep {
  opacity: 0.5;
}

.device-chip {
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
  transition:
    background-color 200ms ease,
    color 200ms ease;
}

.chip-success {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.chip-warn {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.chip-num {
  letter-spacing: -0.01em;
}

.chip-unit {
  font-size: 10px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  opacity: 0.8;
}

.chip-success .chip-unit,
.chip-warn .chip-unit {
  color: inherit;
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .task-card,
  .action-btn {
    transition: none;
  }
  .progress-track.shimmer::after {
    animation: none;
  }
  .status-badge.running .status-dot {
    animation: none;
  }
}
</style>
