<script setup lang="ts">
/**
 * 顶栏的工作流切换下拉
 *
 * 点击触发器 → 弹出已有工作流列表;选另一项 emit('select', id);
 * 底部「新建工作流」入口等价于列表页的新建按钮。搜索框只在 >5 个时显示。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElDropdown, ElDropdownMenu, ElIcon, ElInput } from 'element-plus'
import { ArrowDown, Plus, Check, Search } from '@element-plus/icons-vue'
import type { WorkflowListItem } from '@shared/ipc/workflow.types'

interface Props {
  /** 当前工作流(可能是新建草稿,id 不在 items 里) */
  currentName: string
  currentId: string | null
  items: readonly WorkflowListItem[]
  loading?: boolean
}

interface Emits {
  (e: 'select', id: string): void
  (e: 'new'): void
  (e: 'dblclick-name'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const keyword = ref('')
const SHOW_SEARCH_THRESHOLD = 5

const showSearch = computed(() => props.items.length > SHOW_SEARCH_THRESHOLD)

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return props.items
  return props.items.filter(
    (w) =>
      w.name.toLowerCase().includes(q) ||
      w.appName.toLowerCase().includes(q) ||
      w.appId.toLowerCase().includes(q)
  )
})

function handleSelect(id: string): void {
  if (id === props.currentId) return
  emit('select', id)
}
</script>

<template>
  <ElDropdown
    trigger="click"
    placement="bottom-start"
    :hide-on-click="true"
    @visible-change="(v) => !v && (keyword = '')"
  >
    <button type="button" class="trigger" :title="currentName">
      <span class="trigger-name" @dblclick.stop.prevent="emit('dblclick-name')">{{
        currentName
      }}</span>
      <ElIcon class="trigger-caret"><ArrowDown /></ElIcon>
    </button>

    <template #dropdown>
      <ElDropdownMenu class="switcher-menu">
        <div v-if="showSearch" class="search-wrap" @click.stop>
          <ElInput
            v-model="keyword"
            :prefix-icon="Search"
            :placeholder="t('workflow.switcher.search')"
            size="small"
            clearable
          />
        </div>

        <div class="list">
          <div v-if="loading" class="placeholder">{{ t('workflow.switcher.loading') }}</div>
          <div v-else-if="filtered.length === 0" class="placeholder">
            {{ keyword ? t('workflow.switcher.noMatch') : t('workflow.switcher.empty') }}
          </div>
          <button
            v-for="wf in filtered"
            :key="wf.id"
            type="button"
            class="list-item"
            :class="{ active: wf.id === currentId }"
            @click="handleSelect(wf.id)"
          >
            <div class="item-titles">
              <span class="item-name">{{ wf.name }}</span>
              <span class="item-app">{{ wf.appName }}</span>
            </div>
            <span class="item-meta">
              <span class="item-step">{{
                t('workflow.switcher.steps', { count: wf.stepCount })
              }}</span>
              <ElIcon v-if="wf.id === currentId" class="check-icon"><Check /></ElIcon>
            </span>
          </button>
        </div>

        <div class="footer">
          <button type="button" class="new-btn" @click="emit('new')">
            <ElIcon><Plus /></ElIcon>
            <span>{{ t('workflow.switcher.newScript') }}</span>
          </button>
        </div>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>

<style scoped>
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  max-width: 280px;
  transition: all 0.15s ease;
}
.trigger:hover {
  background: var(--el-fill-color-lighter);
  border-color: var(--el-border-color-lighter);
}
.trigger:focus-visible {
  outline: none;
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-8);
}
.trigger-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trigger-caret {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* dropdown content */
:deep(.switcher-menu) {
  min-width: 320px;
  max-width: 400px;
  padding: 0;
}

.search-wrap {
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.list {
  max-height: 360px;
  overflow-y: auto;
  padding: 4px;
}
.placeholder {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.list-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.12s ease;
  margin: 1px 0;
}
.list-item:hover,
.list-item:focus-visible {
  background: var(--el-fill-color);
  outline: none;
}
.list-item.active {
  background: var(--el-color-primary-light-9);
}

.item-titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-app {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.item-step {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  font-family: 'SF Mono', 'Menlo', monospace;
}
.check-icon {
  color: var(--el-color-primary);
  font-size: 14px;
}

.footer {
  border-top: 1px solid var(--el-border-color-lighter);
  padding: 4px;
}
.new-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  transition: background 0.12s ease;
}
.new-btn:hover,
.new-btn:focus-visible {
  background: var(--el-color-primary-light-9);
  outline: none;
}
</style>
