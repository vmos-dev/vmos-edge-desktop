<template>
  <div class="adi-container">
    <!-- 头部区域 -->
    <div class="header-section">
      <div class="header-content">
        <div class="header-title">机型列表</div>
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

// 数据
const adis = ref<Adi[]>([])
const activeFilter = ref<string | number>('all')

// 筛选选项
const filters = [
  { label: '全部', value: 'all' },
  { label: 'Android 10', value: 10 },
  { label: 'Android 13', value: 13 },
  { label: 'Android 14', value: 14 },
  { label: 'Android 15', value: 15 }
]

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
const columns: Column<Adi>[] = [
  {
    key: 'brand',
    dataKey: 'brand',
    title: '品牌',
    width: 150,
    flexGrow: 1
  },
  {
    key: 'model_name',
    dataKey: 'model_name',
    title: '机型',
    width: 200,
    flexGrow: 1
  },
  {
    key: 'layout',
    dataKey: 'layout',
    title: '屏幕分辨率',
    width: 200,
    flexGrow: 1
  },
  {
    key: 'asopVersion',
    dataKey: 'asopVersion',
    title: 'Android版本',
    width: 150,
    cellRenderer: ({ cellData }: { cellData: any }) => (
      <ElTag effect="light" round>
        <ElLink type="primary" underline={false}>
          Android {cellData}
        </ElLink>
      </ElTag>
    )
  }
]

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
    ElMessage.error(res.error || '获取机型列表失败')
  }
}

getAdis()
</script>

<style scoped lang="scss">
.adi-container {
  height: 100%;
  padding: 20px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.header-section {
  background: #fff;
  padding: 16px 20px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
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
  color: #303133;
  white-space: nowrap;
  display: flex;
  align-items: center;
  &::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 22px;
    background: #409eff;
    margin-right: 8px;
    border-radius: 2px;
  }
}

.filter-buttons {
  display: flex;
  gap: 0;
  align-items: center;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 4px;
}

.filter-btn {
  padding: 8px 20px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  white-space: nowrap;
  user-select: none;
  font-weight: normal;

  &:hover:not(.active) {
    color: #409eff;
    background-color: rgba(64, 158, 255, 0.08);
  }

  &.active {
    color: #fff;
    background-color: #409eff;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(64, 158, 255, 0.2);
  }
}

.table-container {
  flex: 1;
  min-height: 0;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
