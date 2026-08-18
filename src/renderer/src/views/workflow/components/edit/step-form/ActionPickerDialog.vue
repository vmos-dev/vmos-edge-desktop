<script setup lang="ts">
/**
 * ActionPickerDialog · 手动添加步骤 · 选 action 弹窗
 *
 * 视觉灵感:Apple Shortcuts action gallery —— 类别色圆 icon + 简洁卡 + 顺滑 hover。
 *
 * 职责:
 *  - 列出 ACTION_REGISTRY 全部 action,按 category tab 分组
 *  - 提供搜索框(label / id / description 模糊匹配)
 *  - 用户点一张卡 → emit('pick', actionId) + 自动关
 *
 * 不知道"插哪儿":父级在拿到 pick 事件后,根据自己上下文选 doc.addStep 的目标。
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElIcon, ElInput, ElTabPane, ElTabs } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import {
  actionsByCategory,
  CATEGORY_IDS,
  categoryLabel,
  actionLabel as getLabel,
  actionDescription as getDesc,
  type ActionCategory,
  type ActionDefinition
} from '../../../utils/actionRegistry'
import { categoryStyle } from '../../../utils/actionCategoryStyle'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', value: boolean): void
  (e: 'pick', actionId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const keyword = ref('')
const activeCategory = ref<ActionCategory>(CATEGORY_IDS[0])

// 打开时清状态
watch(
  () => props.open,
  (now) => {
    if (now) {
      keyword.value = ''
      activeCategory.value = CATEGORY_IDS[0]
    }
  }
)

const grouped = computed(() => actionsByCategory())
const searching = computed(() => keyword.value.trim().length > 0)

const matchedFlat = computed<ActionDefinition[]>(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return []
  const out: ActionDefinition[] = []
  for (const list of grouped.value.values()) {
    for (const def of list) {
      if (
        getLabel(def.id).toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q) ||
        getDesc(def.id).toLowerCase().includes(q)
      ) {
        out.push(def)
      }
    }
  }
  return out
})

function handlePick(actionId: string): void {
  emit('pick', actionId)
  emit('update:open', false)
}
function handleClose(): void {
  emit('update:open', false)
}
</script>

<template>
  <VmosDialog
    class="action-picker-dialog"
    :model-value="open"
    :title="t('workflow.actionPicker.title')"
    width="min(760px, calc(100vw - 32px))"
    :close-on-click-modal="true"
    :show-close="true"
    @update:model-value="(v) => emit('update:open', v)"
    @close="handleClose"
  >
    <div class="header-section">
      <h2 class="dialog-title">{{ t('workflow.actionPicker.heading') }}</h2>
      <p class="subtitle">{{ t('workflow.actionPicker.subtitle') }}</p>
    </div>

    <div class="search-section">
      <ElInput
        v-model="keyword"
        class="search-input"
        :prefix-icon="Search"
        :placeholder="t('workflow.actionPicker.searchPlaceholder')"
        clearable
      />
    </div>

    <!-- 搜索模式:平铺所有匹配 -->
    <div v-if="searching" class="results-container custom-scrollbar">
      <div v-if="matchedFlat.length === 0" class="empty-wrap">
        <div class="empty-icon">🔍</div>
        <p class="empty-text">{{ t('workflow.actionPicker.noResult', { keyword }) }}</p>
      </div>
      <div v-else class="action-grid">
        <button
          v-for="def in matchedFlat"
          :key="def.id"
          type="button"
          class="action-card"
          @click="handlePick(def.id)"
        >
          <div
            class="card-icon-box"
            :style="{
              '--cat-color-500': categoryStyle(def.category).c500,
              '--cat-color-700': categoryStyle(def.category).c700
            }"
          >
            <ElIcon :size="18" class="action-icon">
              <component :is="categoryStyle(def.category).icon" />
            </ElIcon>
          </div>
          <div class="card-content">
            <div class="card-label">{{ getLabel(def.id) }}</div>
            <div class="card-desc">{{ getDesc(def.id) }}</div>
          </div>
        </button>
      </div>
    </div>

    <!-- 分类模式:tabs -->
    <ElTabs v-else v-model="activeCategory" class="category-tabs">
      <ElTabPane v-for="catId in CATEGORY_IDS" :key="catId" :name="catId">
        <template #label>
          <div class="tab-item">
            <span class="tab-icon-dot" :style="{ background: categoryStyle(catId).c500 }" />
            <span class="tab-text">{{ categoryLabel(catId) }}</span>
          </div>
        </template>
        <div class="action-grid-wrapper custom-scrollbar">
          <div class="action-grid">
            <button
              v-for="def in grouped.get(catId) ?? []"
              :key="def.id"
              type="button"
              class="action-card"
              @click="handlePick(def.id)"
            >
              <div
                class="card-icon-box"
                :style="{
                  '--cat-color-500': categoryStyle(def.category).c500,
                  '--cat-color-700': categoryStyle(def.category).c700
                }"
              >
                <ElIcon :size="18" class="action-icon">
                  <component :is="categoryStyle(def.category).icon" />
                </ElIcon>
              </div>
              <div class="card-content">
                <div class="card-label">{{ getLabel(def.id) }}</div>
                <div class="card-desc">{{ getDesc(def.id) }}</div>
              </div>
            </button>
          </div>
        </div>
      </ElTabPane>
    </ElTabs>
  </VmosDialog>
</template>

<style scoped>
:deep(.action-picker-dialog) {
  max-height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
}

:deep(.action-picker-dialog .el-dialog__header) {
  display: none;
}

:deep(.action-picker-dialog .el-dialog__body) {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 24px 28px;
  gap: 20px;
}

.header-section {
  flex-shrink: 0;
}

.dialog-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  opacity: 0.8;
}

.search-section {
  flex-shrink: 0;
}

:deep(.search-input .el-input__wrapper) {
  border-radius: 12px;
  min-height: 42px;
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
  background: var(--el-fill-color-lighter);
  padding: 0 14px;
  transition: all 0.2s ease;
}

:deep(.search-input .el-input__wrapper.is-focus) {
  background: var(--el-bg-color);
  box-shadow:
    0 0 0 1px var(--el-color-primary) inset,
    0 0 0 4px var(--el-color-primary-light-8);
}

/* ─── Tabs ─── */
.category-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

:deep(.category-tabs .el-tabs__header) {
  margin-bottom: 12px;
}

:deep(.category-tabs .el-tabs__nav-wrap::after) {
  display: none;
}

:deep(.category-tabs .el-tabs__active-bar) {
  height: 3px;
  border-radius: 3px;
}

:deep(.category-tabs .el-tabs__item) {
  font-size: 13px;
  font-weight: 600;
  padding: 0 16px;
  height: 36px;
  line-height: 36px;
  color: var(--el-text-color-placeholder);
  transition: all 0.2s ease;
}

:deep(.category-tabs .el-tabs__item.is-active) {
  color: var(--el-color-primary);
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-icon-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

:deep(.category-tabs .el-tabs__content) {
  flex: 1;
  min-height: 0;
}

:deep(.category-tabs .el-tab-pane) {
  height: 100%;
}

.action-grid-wrapper,
.results-container {
  height: 100%;
  overflow-y: auto;
  padding: 4px;
}

/* ─── Grid & Cards ─── */
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  padding-bottom: 12px;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 72px;
  width: 100%;
}

.action-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
  background: var(--el-fill-color-blank);
}

.action-card:active {
  transform: translateY(0) scale(0.98);
}

.card-icon-box {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--cat-color-500, #409eff), var(--cat-color-700, #005cb2));
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  transition: transform 0.25s ease;
}

.action-icon {
  color: #ffffff;
}

:deep(.dark) .action-icon {
  color: rgba(255, 255, 255, 0.85);
}

.action-card:hover .card-icon-box {
  transform: scale(1.1) rotate(-5deg);
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
  letter-spacing: -0.01em;
}

.card-desc {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  opacity: 0.8;
}

.empty-wrap {
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-placeholder);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--el-border-color-lighter);
  border-radius: 10px;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
}
</style>
