<template>
  <div class="adi-container">
    <!-- 头部区域 -->
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
        :data="filteredAdis"
        :columns="columns"
        :row-height="42"
        :header-height="45"
        row-key="id"
        border
      />
    </div>
  </div>
</template>

<script setup lang="tsx">
defineOptions({ name: 'Adi' })
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { Column } from 'element-plus'
import { Adi } from '@shared/ipc/adi.types'
import { ipc } from '@renderer/core/ipc'
import { ADI_EVENTS } from '@shared/ipc/adi.types'
import { ElTag, ElLink } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 数据
const adis = ref<Adi[]>([])
const activeFilter = ref<string | number>('all')

// 筛选选项
const filters = computed(() => [
  { label: t('adi.all'), value: 'all' },
  { label: t('adi.android10'), value: 10 },
  { label: t('adi.android13'), value: 13 },
  { label: t('adi.android14'), value: 14 },
  { label: t('adi.android15'), value: 15 }
])

// 筛选后的数据
const filteredAdis = computed(() => {
  if (activeFilter.value === 'all') {
    return adis.value
  }
  // 直接匹配数字
  return adis.value.filter((item) => {
    const version = Number(item.asopVersion)
    return version === activeFilter.value
  })
})

// 表格列定义
const columns = computed<Column<Adi>[]>(() => [
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
        <ElLink type="primary" underline={false}>
          Android {cellData}
        </ElLink>
      </ElTag>
    )
  },
])

// 筛选变化
const handleFilterChange = (value: string | number) => {
  activeFilter.value = value
}

// 获取数据
const getAdis = async () => {
  const res = await ipc.invoke<any>(ADI_EVENTS.GET_ADIS)
  if (res.success) {
    adis.value = res.data || []
  } else {
    ElMessage.error(res.error || t('common.loadFailed'))
  }
}

getAdis()
</script>

<style scoped lang="scss">
.adi-container {
  height: 100%;
  padding: 20px;
  background-color: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
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
