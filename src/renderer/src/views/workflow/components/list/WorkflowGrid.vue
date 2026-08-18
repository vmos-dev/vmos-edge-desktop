<script setup lang="ts">
/**
 * 工作流内容区 · loading / empty / no-match / 分组 section 四态
 *
 * 渲染策略:
 *  - 单应用选中时,隐藏 section 头(section 头部等同侧边栏当前选中)
 *  - 全部时,各 section 显头,垂直堆叠
 */
import { useI18n } from 'vue-i18n'
import { ElButton, ElIcon } from 'element-plus'
import { Plus, Search, Connection, EditPen, Setting, Monitor } from '@element-plus/icons-vue'
import type { WorkflowGroupItem } from '../../composables/useWorkflowGroups'
import WorkflowGroupSection from './WorkflowGroupSection.vue'

interface Props {
  groups: readonly WorkflowGroupItem[]
  loading: boolean
  isEmpty: boolean
  noMatch: boolean
  keyword: string
  showSectionHeader: boolean
}

interface Emits {
  (e: 'open', id: string): void
  (e: 'delete', id: string): void
  (e: 'new'): void
  (e: 'clear-keyword'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5]
</script>

<template>
  <div class="wf-grid-wrap">
    <div class="wf-grid-shell">
      <!-- 加载态 -->
      <div v-if="loading" class="wf-skel-grid">
        <div v-for="k in SKELETON_KEYS" :key="`sk-${k}`" class="wf-skel">
          <div class="sk-head">
            <div class="sk-row" style="width: 40px; height: 40px; border-radius: 10px" />
          </div>
          <div class="sk-lines">
            <div class="sk-row" style="width: 68%; height: 14px" />
            <div class="sk-row" style="width: 44%; height: 12px; margin-top: 6px" />
          </div>
          <div class="sk-foot-row">
            <div class="sk-row" style="width: 48%; height: 12px" />
            <div class="sk-row" style="width: 36px; height: 18px; border-radius: 999px" />
          </div>
        </div>
      </div>

      <!-- 空态 -->
      <div v-else-if="isEmpty" class="wf-empty">
        <div class="empty-hero">
          <div class="hero-orb">
            <ElIcon :size="32"><Connection /></ElIcon>
          </div>
        </div>
        <h2 class="empty-title">{{ t('workflow.grid.emptyTitle') }}</h2>
        <p class="empty-desc">
          {{ t('workflow.grid.emptyDesc') }}
        </p>
        <ElButton class="empty-cta" type="primary" :icon="Plus" size="large" @click="emit('new')">
          {{ t('workflow.grid.emptyCreate') }}
        </ElButton>
        <div class="empty-features">
          <div class="feat-card">
            <div class="feat-icon">
              <ElIcon :size="15"><EditPen /></ElIcon>
            </div>
            <div class="feat-info">
              <div class="feat-name" :title="t('workflow.grid.featSteps')">
                {{ t('workflow.grid.featSteps') }}
              </div>
              <div class="feat-desc" :title="t('workflow.grid.featStepsDesc')">
                {{ t('workflow.grid.featStepsDesc') }}
              </div>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon">
              <ElIcon :size="15"><Setting /></ElIcon>
            </div>
            <div class="feat-info">
              <div class="feat-name" :title="t('workflow.grid.featParams')">
                {{ t('workflow.grid.featParams') }}
              </div>
              <div class="feat-desc" :title="t('workflow.grid.featParamsDesc')">
                {{ t('workflow.grid.featParamsDesc') }}
              </div>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon">
              <ElIcon :size="15"><Monitor /></ElIcon>
            </div>
            <div class="feat-info">
              <div class="feat-name" :title="t('workflow.grid.featBatch')">
                {{ t('workflow.grid.featBatch') }}
              </div>
              <div class="feat-desc" :title="t('workflow.grid.featBatchDesc')">
                {{ t('workflow.grid.featBatchDesc') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 搜索无结果 -->
      <div v-else-if="noMatch" class="wf-empty">
        <div class="empty-hero no-result">
          <div class="hero-orb">
            <ElIcon :size="26"><Search /></ElIcon>
          </div>
        </div>
        <h2 class="empty-title">{{ t('workflow.grid.noMatchTitle', { keyword }) }}</h2>
        <p class="empty-desc">{{ t('workflow.grid.noMatchDesc') }}</p>
        <div class="empty-actions">
          <ElButton @click="emit('clear-keyword')">{{ t('workflow.grid.clearSearch') }}</ElButton>
          <ElButton type="primary" :icon="Plus" @click="emit('new')">{{
            t('workflow.grid.newScript')
          }}</ElButton>
        </div>
      </div>

      <!-- 正常列表 -->
      <div v-else class="wf-group-stack">
        <WorkflowGroupSection
          v-for="group in groups"
          :key="group.id"
          :group="group"
          :show-header="showSectionHeader"
          @open="(id) => emit('open', id)"
          @delete="(id) => emit('delete', id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wf-grid-wrap {
  height: 100%;
  overflow-y: auto;
  padding: 24px 32px 48px;
}

.wf-grid-shell {
  max-width: 1440px;
  margin: 0 auto;
}

.wf-group-stack {
  display: flex;
  flex-direction: column;
  gap: 36px;
}

.wf-skel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.wf-skel {
  min-height: 120px;
  padding: 16px;
  border: 1px solid var(--wf-hairline);
  border-radius: 12px;
  background: var(--wf-surface);
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 12px;
}

.sk-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.sk-lines {
  min-width: 0;
}

.sk-foot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--wf-hairline);
}

.sk-row {
  background: linear-gradient(
    90deg,
    var(--el-fill-color-light) 0%,
    var(--el-fill-color) 50%,
    var(--el-fill-color-light) 100%
  );
  background-size: 200% 100%;
  border-radius: 4px;
  animation: shimmer 1.4s linear infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk-row {
    animation: none;
  }
}

/* ── Empty / No-match States ─────────────────── */
.wf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72px 32px 60px;
  text-align: center;
}

.empty-hero {
  margin-bottom: 28px;
}

.hero-orb {
  width: 80px;
  height: 80px;
  border-radius: 22px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--el-color-primary) 14%, var(--el-bg-color)),
    color-mix(in srgb, var(--el-color-primary) 6%, var(--el-bg-color))
  );
  border: 1.5px solid color-mix(in srgb, var(--el-color-primary) 28%, transparent);
  box-shadow:
    0 0 0 8px color-mix(in srgb, var(--el-color-primary) 5%, transparent),
    0 16px 40px color-mix(in srgb, var(--el-color-primary) 10%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
  animation: wf-float 4s ease-in-out infinite;
}

.no-result .hero-orb {
  background: var(--el-fill-color-light);
  border-color: var(--el-border-color-lighter);
  box-shadow: none;
  color: var(--el-text-color-placeholder);
  animation: none;
}

@keyframes wf-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

.empty-title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}

.empty-desc {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--el-text-color-secondary);
  max-width: 380px;
}

.empty-cta {
  border-radius: 10px;
  font-weight: 600;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--el-color-primary) 28%, transparent);
  margin-bottom: 40px;
}

.empty-features {
  display: flex;
  gap: 10px;
}

.feat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  text-align: left;
}

.feat-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.feat-info {
  min-width: 0;
}

.feat-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feat-desc {
  font-size: 10.5px;
  color: var(--el-text-color-placeholder);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-actions {
  display: flex;
  gap: 10px;
}

@media (prefers-reduced-motion: reduce) {
  .hero-orb {
    animation: none;
  }
}

@media (max-width: 900px) {
  .wf-grid-wrap {
    padding: 16px 18px 36px;
  }

  .empty-features {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 320px;
  }
}
</style>
