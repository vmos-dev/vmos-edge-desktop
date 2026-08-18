<script setup lang="ts">
/**
 * 工作流列表 · 路由视图
 *
 * 布局:
 *  - 顶栏(title + 总计 + 搜索 + 新建 + 刷新)
 *  - 下半部:侧边栏(应用分组)+ 主区(卡片)
 *
 * 状态:
 *  - selectedGroupId: string | null —— null 表示"全部"
 *    当过滤后该 group 不存在(搜索时),自动回落到 null
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Device } from '@shared/ipc/data.types'
import type { AppInfo } from '@shared/ipc/workflow.types'

import WorkflowListHeader from './components/list/WorkflowListHeader.vue'
import WorkflowGrid from './components/list/WorkflowGrid.vue'
import AppFilterBar from './components/list/AppFilterBar.vue'
import DeviceAppSelectorDialog from './components/dialogs/DeviceAppSelectorDialog.vue'

import { useWorkflowList } from './composables/useWorkflowList'
import { useWorkflowRepository } from './composables/useWorkflowRepository'
import { useWorkflowGroups } from './composables/useWorkflowGroups'
import { useDeviceSelection } from './composables/useDeviceSelection'
import { setPendingNewWorkflowSeed } from './composables/useWorkflowDocument'
import { useOnboardingGuide } from './composables/useOnboardingGuide'
import { getListViewSteps, LIST_GUIDE_ID } from './guide/steps'

defineOptions({ name: 'WorkflowList' })

const router = useRouter()
const { t } = useI18n()
const repository = useWorkflowRepository()
const list = useWorkflowList(repository)
const deviceSel = useDeviceSelection()

const pageGroups = useWorkflowGroups(list.items)
const filteredGroups = useWorkflowGroups(list.filtered)

const listGuide = useOnboardingGuide(LIST_GUIDE_ID, getListViewSteps())

const selectedGroupId = ref<string | null>(null)

watch(
  () => filteredGroups.groups.value.map((group) => group.id),
  (ids) => {
    if (selectedGroupId.value && !ids.includes(selectedGroupId.value)) {
      selectedGroupId.value = null
    }
  }
)

const visibleGroups = computed(() => {
  if (!selectedGroupId.value) return filteredGroups.groups.value
  return filteredGroups.groups.value.filter((group) => group.id === selectedGroupId.value)
})

const showSectionHeader = computed(() => selectedGroupId.value === null)

onMounted(() => {
  void list.refreshIfNeeded()
  listGuide.tryAutoStart()
})

function goToEdit(id: string): void {
  void router.push({ name: 'WorkflowEdit', params: { id } })
}

function handleNew(): void {
  deviceSel.openForNew()
}

async function handleDelete(id: string): Promise<void> {
  const wf = list.items.value.find((w) => w.id === id)
  if (!wf) return
  try {
    await ElMessageBox.confirm(
      t('workflow.listView.deleteConfirm', { name: wf.name }),
      t('workflow.listView.deleteTitle'),
      {
        type: 'warning',
        confirmButtonText: t('workflow.listView.deleteBtn'),
        cancelButtonText: t('workflow.listView.cancelBtn'),
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch {
    return
  }

  const ok = await list.remove(id)
  if (ok) {
    ElMessage.success(t('workflow.listView.deleted'))
  } else {
    ElMessage.error(list.error.value ?? t('workflow.listView.deleteFailed'))
  }
}

async function handleDeviceAppConfirm(payload: {
  device: Device
  app: AppInfo
  name?: string
}): Promise<void> {
  const result = deviceSel.confirm(payload)
  if (result.kind !== 'start-new') return

  setPendingNewWorkflowSeed(result.seed)
  await router.push({ name: 'WorkflowEdit', params: { id: 'new' } })
}

function clearFilters(): void {
  list.keyword.value = ''
}

function handleNavigateGroup(id: string | null): void {
  selectedGroupId.value = id
}
</script>

<template>
  <div class="wf-list-view">
    <WorkflowListHeader
      v-model:keyword="list.keyword.value"
      :summary="pageGroups.summary.value"
      :loading="list.loading.value"
      @new="handleNew"
      @refresh="list.refresh"
    />

    <main class="wf-list-body" :class="{ 'wf-list-body--compact': list.isEmpty.value }">
      <AppFilterBar
        v-if="!list.isEmpty.value"
        class="wf-sidebar-slot"
        :items="filteredGroups.navItems.value"
        :active-id="selectedGroupId"
        :total="list.filtered.value.length"
        @navigate="handleNavigateGroup"
      />

      <div class="wf-main-slot">
        <WorkflowGrid
          :groups="visibleGroups"
          :loading="list.loading.value"
          :is-empty="list.isEmpty.value"
          :no-match="list.noMatch.value"
          :keyword="list.keyword.value"
          :show-section-header="showSectionHeader"
          @open="goToEdit"
          @delete="handleDelete"
          @new="handleNew"
          @clear-keyword="clearFilters"
        />

        <p v-if="list.error.value && !list.loading.value" class="load-error">
          {{ t('workflow.listView.loadFailed') }}: {{ list.error.value }}
        </p>
      </div>
    </main>

    <DeviceAppSelectorDialog
      v-model:open="deviceSel.dialogOpen.value"
      :require-name="true"
      @confirm="handleDeviceAppConfirm"
    />
  </div>
</template>

<style scoped>
.wf-list-view {
  /* 主题 tokens —— 全部桥接到 Element Plus 变量,明暗由 EP 自动切换,
     也跟随用户自定义主题色(--el-color-primary-*)。 */
  --wf-page-bg: var(--el-bg-color);
  --wf-topbar-surface: var(--el-bg-color);
  --wf-sidebar-surface: var(--el-bg-color);
  /* primary-light-9 项目里恒用白混,dark 下过亮;这里用 color-mix 做叠加
     自动跟着明暗上下文走 */
  --wf-sidebar-active-bg: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  --wf-sidebar-active-bg-hover: color-mix(in srgb, var(--el-color-primary) 18%, transparent);
  --wf-sidebar-active-text: var(--el-color-primary);
  --wf-surface: var(--el-bg-color);
  --wf-surface-hover: var(--el-fill-color-light);
  --wf-surface-tint: var(--el-fill-color);
  --wf-hairline: var(--el-border-color-lighter);
  --wf-hairline-strong: var(--el-border-color);
  --wf-accent: var(--el-color-primary);
  --wf-shadow-rest: none;
  --wf-shadow-hover: 0 1px 2px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.06);

  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--wf-page-bg);
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    sans-serif;
}

.wf-list-body {
  position: relative;
  min-height: 0;
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  overflow: hidden;
}

.wf-list-body--compact {
  grid-template-columns: minmax(0, 1fr);
}

.wf-sidebar-slot {
  min-height: 0;
}

.wf-main-slot {
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.load-error {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 12px;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  border: 1px solid var(--el-color-danger-light-7);
  border-radius: 8px;
  font-size: 12px;
  margin: 0;
}

@media (max-width: 900px) {
  .wf-list-body {
    grid-template-columns: 180px minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .wf-list-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .wf-sidebar-slot {
    display: none;
  }
}
</style>
