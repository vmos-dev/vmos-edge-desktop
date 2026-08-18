<script setup lang="ts">
import type { SelectorStrategyRow } from './types'

defineProps<{
  rows: SelectorStrategyRow[]
}>()

/** 给每条 row 生成稳定 key —— fields 拼接,避免重复 label/key 时 Vue 警告 */
function rowKey(row: SelectorStrategyRow): string {
  return `${row.label}#${row.fields.map((f) => `${f.key}:${f.value}`).join(',')}`
}
</script>

<template>
  <div class="strategy-list">
    <div
      v-for="row in rows"
      :key="rowKey(row)"
      class="strategy-card"
      :class="{ primary: row.isPrimary }"
    >
      <div class="header">
        <span class="label">{{ row.label }}</span>
        <span class="score" :class="row.level">{{ row.score }}</span>
      </div>

      <!-- 结构化字段表:每个键独立一行,index 等关键字段一目了然 -->
      <dl class="fields">
        <div v-for="f in row.fields" :key="f.key" class="field">
          <dt class="field-key" :title="f.key">{{ f.key }}</dt>
          <dd class="field-val">{{ f.value }}</dd>
        </div>
      </dl>

      <div class="reason">{{ row.reasonText }}</div>
    </div>
  </div>
</template>

<style scoped>
.strategy-card {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter); /* 恢复细腻的浅色边框 */
  background: var(--el-bg-color);
  transition: all 0.2s ease;
  border-radius: 10px;
  cursor: default;
  margin-bottom: 8px; /* 增加项之间的间距 */
}

.strategy-card:hover {
  /* 统一悬停效果：使用一致的品牌淡蓝色和边框色 */
  border-color: var(--el-color-primary-light-3);
  background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
  transform: translateX(4px);
}

/* 选中项默认状态 */
.strategy-card.primary {
  border-color: color-mix(in srgb, var(--el-color-primary) 30%, transparent);
  background: color-mix(in srgb, var(--el-color-primary) 4%, transparent);
}

/* 移除选中项单独的 hover 覆盖，使其继承统一的 .strategy-card:hover */
.strategy-card.primary:hover {
  border-color: var(--el-color-primary);
  background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.label {
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  font-family: 'SF Mono', 'Menlo', monospace;
}

.score.ok {
  background: color-mix(in srgb, var(--el-color-success) 12%, transparent);
  color: var(--el-color-success);
}

.score.warn {
  background: color-mix(in srgb, var(--el-color-warning) 12%, transparent);
  color: var(--el-color-warning);
}

.score.bad {
  background: color-mix(in srgb, var(--el-color-danger) 12%, transparent);
  color: var(--el-color-danger);
}

.fields {
  margin: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: 'SF Mono', 'Menlo', monospace;
  font-size: 11px;
}
.field {
  display: flex;
  gap: 8px;
}
.field-key {
  margin: 0;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 40px;
  max-width: 100px;
}
.field-val {
  margin: 0;
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.reason {
  margin-top: 4px;
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
}
</style>
