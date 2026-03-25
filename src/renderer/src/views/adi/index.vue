<template>
  <div class="adi-container">
    <el-tabs v-model="activeTab" class="adi-tabs" @tab-change="handleTabChange">
      <el-tab-pane :label="t('adi.generalModels')" name="general">
        <div class="header-section">
          <div class="header-content">
            <div class="header-title">{{ t('adi.deviceList') }}</div>
            <!-- 筛选按钮 -->
            <div class="filter-buttons">
              <div
                v-for="filter in filters"
                :key="filter.value"
                :class="['filter-btn', { active: activeFilter === filter.value }]"
                @click="handleFilterChange(filter.value)"
              >
                {{ filter.label }}
              </div>
            </div>
          </div>
        </div>

        <!-- 表格区域 -->
        <div class="table-container">
          <VmosTable
            :data="filteredGeneralAdis"
            :columns="generalColumns"
            :row-height="42"
            :header-height="45"
            row-key="id"
            border
          />
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('adi.customModels')" name="custom">
        <div class="header-section">
          <div class="header-content">
            <div class="header-title">{{ t('adi.customModels') }}</div>
            <!-- 筛选按钮 -->
            <div class="filter-buttons">
              <div
                v-for="filter in filters"
                :key="filter.value"
                :class="['filter-btn', { active: activeFilter === filter.value }]"
                @click="handleFilterChange(filter.value)"
              >
                {{ filter.label }}
              </div>
            </div>
            <div class="header-actions">
              <el-button @click="handleOpenCollectionTool">
                {{ t('adi.getCollectionTool') }}
              </el-button>
              <el-button type="primary" @click="handleImport">
                {{ t('adi.importSettings') }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- 表格区域 -->
        <div class="table-container">
          <VmosTable
            :data="filteredCustomAdis"
            :columns="customColumns"
            :row-height="42"
            :header-height="45"
            row-key="id"
            border
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <ImportAdiDialog ref="importAdiDialogRef" @success="getCustomAdis" />
  </div>
</template>

<script setup lang="tsx">
defineOptions({ name: 'Adi' })
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElTag, ElLink, ElButton } from 'element-plus'
import type { Column } from 'element-plus'
import { Adi, CustomAdi, ADI_EVENTS } from '@shared/ipc/adi.types'
import { ipc } from '@renderer/core/ipc'
import {
  ANDROID_VERSION_OPTIONS,
  formatAndroidVersionLabel
} from '@shared/constant/androidVersions'
import { useI18n } from 'vue-i18n'
import ImportAdiDialog from './components/ImportAdiDialog.vue'

const { t, locale } = useI18n()

// 状态
const activeTab = ref('general')
const generalAdis = ref<Adi[]>([])
const customAdis = ref<CustomAdi[]>([])
const activeFilter = ref('all')
const importAdiDialogRef = ref<InstanceType<typeof ImportAdiDialog>>()
const collectionToolDocUrl = computed(() =>
  locale.value === 'zh-CN'
    ? 'https://help.vmosedge.com/zh/operationguides/model-settings'
    : 'https://help.vmosedge.com/en/operationguides/model-settings'
)

// 筛选选项
const filters = computed(() => [{ label: t('adi.all'), value: 'all' }, ...ANDROID_VERSION_OPTIONS])

// 筛选后的通用机型数据
const filteredGeneralAdis = computed(() => {
  if (activeFilter.value === 'all') {
    return generalAdis.value
  }
  return generalAdis.value.filter((item) => item.asopVersion === activeFilter.value)
})

// 筛选后的自定义机型数据
const filteredCustomAdis = computed(() => {
  if (activeFilter.value === 'all') {
    return customAdis.value
  }
  return customAdis.value.filter((item) => item.asopVersion == activeFilter.value)
})

// 通用列定义
const commonColumns = computed(() => [
  {
    key: 'brand',
    dataKey: 'brand',
    title: t('adi.brand'),
    width: 150,
    flexGrow: 1
  },
  {
    key: 'model_name',
    dataKey: 'model_name',
    title: t('adi.model'),
    width: 200,
    flexGrow: 1
  },
  {
    key: 'layout',
    dataKey: 'layout',
    title: t('adi.screenResolution'),
    width: 200,
    flexGrow: 1
  },
  {
    key: 'asopVersion',
    dataKey: 'asopVersion',
    title: t('adi.androidVersion'),
    width: 150,
    cellRenderer: ({ cellData }: { cellData: any }) => (
      <ElTag effect="light" round>
        <ElLink type="primary" underline="never">
          {formatAndroidVersionLabel(cellData)}
        </ElLink>
      </ElTag>
    )
  }
])

// 通用机型表格列
const generalColumns = computed<Column<Adi>[]>(() => [...commonColumns.value])

// 自定义机型表格列
const customColumns = computed<Column<CustomAdi>[]>(() => [
  ...commonColumns.value,
  {
    key: 'actions',
    title: t('common.action'),
    width: 100,
    align: 'center',
    cellRenderer: ({ rowData }: { rowData: CustomAdi }) => (
      <ElButton type="danger" link onClick={() => handleDelete(rowData)}>
        {t('common.delete')}
      </ElButton>
    )
  }
])

// 标签页切换
const handleTabChange = (name: any) => {
  if (name === 'general' && generalAdis.value.length === 0) {
    getGeneralAdis()
  } else if (name === 'custom' && customAdis.value.length === 0) {
    getCustomAdis()
  }
}

// 筛选变化
const handleFilterChange = (value: string) => {
  activeFilter.value = value
}

// 获取通用机型数据
const getGeneralAdis = async () => {
  const res = await ipc.invoke<any>(ADI_EVENTS.GET_ADIS)
  if (res.success) {
    generalAdis.value = res.data || []
  } else {
    ElMessage.error(res.error || t('common.loadFailed'))
  }
}

// 获取自定义机型数据
const getCustomAdis = async () => {
  const res = await ipc.invoke<any>(ADI_EVENTS.GET_CUSTOM_ADIS)
  if (res.success) {
    customAdis.value = res.data || []
  } else {
    ElMessage.error(res.error || t('common.loadFailed'))
  }
}

// 导入设置
const handleImport = () => {
  importAdiDialogRef.value?.init()
}

const handleOpenCollectionTool = () => {
  window.open(collectionToolDocUrl.value, '_blank')
}

// 删除自定义机型
const handleDelete = async (row: CustomAdi) => {
  try {
    await ElMessageBox.confirm(t('common.deleteConfirm'), t('common.warning'), {
      type: 'warning'
    })
    const res = await ipc.invoke<any>(ADI_EVENTS.DELETE_CUSTOM_ADI, row.id)
    if (res.success) {
      ElMessage.success(t('common.deleteSuccess'))
      getCustomAdis()
    } else {
      ElMessage.error(res.error || t('common.deleteFailed'))
    }
  } catch {
    // ignore
  }
}

onMounted(() => {
  getGeneralAdis()
})
</script>

<style scoped lang="scss">
.adi-container {
  height: 100%;
  padding: 0 20px 20px;
  background-color: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;

  :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }

  :deep(.el-tabs__content) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .el-tab-pane {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  }
}

.adi-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header-section {
  background: var(--el-bg-color);
  padding: 16px 20px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color);
  flex-shrink: 0;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  display: flex;
  align-items: center;
  &::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 22px;
    background: var(--el-color-primary);
    margin-right: 8px;
    border-radius: 2px;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.filter-buttons {
  display: flex;
  gap: 0;
  align-items: center;
  background: var(--el-bg-color-page);
  border-radius: 6px;
  padding: 4px;
}

.filter-btn {
  padding: 8px 20px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  white-space: nowrap;
  user-select: none;
  font-weight: normal;

  &:hover:not(.active) {
    color: var(--el-color-primary);
    background-color: var(--el-color-primary-alpha-1);
  }

  &.active {
    color: var(--el-bg-color);
    background-color: var(--el-color-primary);
    font-weight: 500;
    box-shadow: 0 2px 4px var(--el-color-primary-alpha-2);
  }
}

.table-container {
  flex: 1;
  min-height: 0;
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
