<script setup lang="ts">
import { computed } from 'vue'
import type { FlowStepRecord } from '@shared/ipc/flowEngine.api.types'
import { parseStep, stepStatusClass, stepIcon, stepDuration } from '../utils/stepParsing'
import StepErrorCard from './StepErrorCard.vue'

const props = defineProps<{
  steps: FlowStepRecord[]
  loading: boolean
  nested?: boolean
  env?: Record<string, string>
}>()

const parsedSteps = computed(() =>
  props.steps.map((step) => ({ raw: step, parsed: parseStep(step, props.env) }))
)
</script>

<template>
  <div class="step-timeline" :class="{ nested }" v-loading="loading">
    <div v-if="steps.length === 0 && !loading" class="empty-hint">
      <el-empty :image-size="60" />
    </div>
    <div
      v-for="({ raw: step, parsed }, idx) in parsedSteps"
      :key="idx"
      class="step-row"
      :class="stepStatusClass(step.status)"
    >
      <!-- 左侧状态指示器 -->
      <div class="step-indicator">
        <div class="step-dot" :class="stepStatusClass(step.status)">
          <span class="dot-icon">{{ stepIcon(step.status) }}</span>
        </div>
        <div v-if="idx < parsedSteps.length - 1" class="step-connector" />
      </div>

      <!-- 右侧内容 -->
      <div class="step-body">
        <div class="step-card" :class="stepStatusClass(step.status)">
          <!-- 头部：序号 + 命令名 + 耗时 -->
          <div class="card-header">
            <span class="step-num">#{{ step.index + 1 }}</span>
            <span class="step-name">{{ parsed.label }}</span>
            <span v-if="stepDuration(step)" class="step-time">{{ stepDuration(step) }}</span>
          </div>

          <!-- 参数/选择器标签 -->
          <div v-if="parsed.params.length > 0" class="card-params">
            <span
              v-for="(p, pi) in parsed.params"
              :key="pi"
              class="param-chip"
              :class="{ accent: p.accent }"
            >
              <span class="chip-key">{{ p.key }}</span>
              <span class="chip-val">{{ p.value }}</span>
            </span>
          </div>

          <!-- Insight 提示 -->
          <div
            v-if="step.metadata?.insight?.message && step.metadata.insight.level !== 'NONE'"
            class="card-insight"
            :class="step.metadata.insight.level.toLowerCase()"
          >
            {{ step.metadata.insight.message }}
          </div>
        </div>

        <!-- 错误卡片 -->
        <StepErrorCard v-if="step.status === 'FAILED' && step.error" :step="step" />

        <!-- 嵌套子步骤 -->
        <div v-if="step.children && step.children.length > 0" class="step-nest">
          <StepTimeline :steps="step.children" :loading="false" nested :env="env" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-timeline {
  padding: 4px 0;
}

.step-timeline.nested {
  padding: 0;
}

.empty-hint {
  padding: 40px 0;
}

/* ── 行布局 ── */
.step-row {
  display: flex;
  gap: 14px;
}

/* ── 左侧指示器 ── */
.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 28px;
  padding-top: 2px;
}

.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.step-dot.completed {
  background: var(--el-color-success);
}
.step-dot.running {
  background: var(--el-color-primary);
  animation: dot-pulse 2s ease-in-out infinite;
}
.step-dot.failed {
  background: var(--el-color-danger);
}
.step-dot.warned {
  background: var(--el-color-warning);
}
.step-dot.skipped {
  background: var(--el-text-color-disabled);
}
.step-dot.pending {
  background: var(--el-border-color);
}

@keyframes dot-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 var(--el-color-primary-light-5);
  }
  50% {
    box-shadow: 0 0 0 5px transparent;
  }
}

.dot-icon {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.step-connector {
  width: 2px;
  flex: 1;
  min-height: 8px;
  background: var(--el-border-color-lighter);
  margin: 4px 0;
}

.step-row:last-child .step-connector {
  display: none;
}

/* ── 右侧内容 ── */
.step-body {
  flex: 1;
  min-width: 0;
  padding-bottom: 12px;
}

/* ── 步骤卡片 ── */
.step-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px 14px;
  transition: all 0.2s;
}

.step-card.running {
  border-color: var(--el-color-primary-light-5);
  background: color-mix(in srgb, var(--el-color-primary) 2%, var(--el-bg-color));
}

.step-card.failed {
  border-color: var(--el-color-danger-light-5);
  background: color-mix(in srgb, var(--el-color-danger) 2%, var(--el-bg-color));
}

.step-card.warned {
  border-color: var(--el-color-warning-light-5);
}

.step-card.pending,
.step-card.skipped {
  opacity: 0.6;
}

/* ── 卡片头部 ── */
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-num {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-disabled);
  font-family: 'SF Mono', 'Menlo', monospace;
  flex-shrink: 0;
}

.step-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-family: 'SF Mono', 'Menlo', monospace;
}

/* ── 参数标签 ── */
.card-params {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.param-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 5px;
  overflow: hidden;
  font-size: 11px;
  font-family: 'SF Mono', 'Menlo', monospace;
  line-height: 1;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.param-chip.accent {
  border-color: var(--el-color-primary-light-7);
}

.chip-key {
  padding: 4px 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.param-chip.accent .chip-key {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.chip-val {
  padding: 4px 8px;
  color: var(--el-text-color-primary);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Insight ── */
.card-insight {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  line-height: 1.5;
}

.card-insight.warning {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning-dark-2);
}

.card-insight.error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

/* ── 嵌套子步骤 ── */
.step-nest {
  margin-top: 8px;
  padding-left: 8px;
  border-left: 2px solid var(--el-border-color-extra-light);
  border-radius: 0 0 0 4px;
}
</style>
