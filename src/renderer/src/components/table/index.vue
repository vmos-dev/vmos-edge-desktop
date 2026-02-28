<script setup lang="tsx">
import { ref, computed, watch } from 'vue'
import { ElTableV2, ElAutoResizer, ElCheckbox } from 'element-plus'
import type { Column, CheckboxValueType } from 'element-plus'

defineOptions({
  name: 'VmosTable'
})

const props = withDefaults(
  defineProps<{
    data: any[]
    columns: Column<any>[]
    rowKey?: string
    selectable?: boolean
    rowHeight?: number
    headerHeight?: number
    selectedIds?: string[] // 新增：接收外部传入的选中ID
  }>(),
  {
    rowKey: 'id',
    selectable: false,
    rowHeight: 50,
    headerHeight: 50,
    selectedIds: () => []
  }
)

const emit = defineEmits<{
  (e: 'selection-change', selection: any[]): void
}>()

// 初始化选中状态
const selectedKeys = ref<Set<string | number>>(new Set(props.selectedIds))

// 监听外部 selectedIds 变化，同步到内部状态
watch(
  () => props.selectedIds,
  (newIds) => {
    // 避免不必要的更新循环
    if (!newIds) return
    const newSet = new Set(newIds)
    // 简单的长度和内容检查，或者直接赋值（Set构建很快）
    if (
      newSet.size !== selectedKeys.value.size ||
      [...newSet].some((id) => !selectedKeys.value.has(id))
    ) {
      selectedKeys.value = newSet
    }
  },
  { deep: true, immediate: true }
)

// 监听 data 变化，清理不再存在的数据的选中状态，并更新选中对象的最新状态
watch(
  () => props.data,
  (newData) => {
    // 获取当前所有数据的 ID 集合
    const validIds = new Set(newData.map((item) => item[props.rowKey]))

    // 找出所有需要保留的选中项 ID
    const newSelectedKeys = new Set<string | number>()
    let keysChanged = false

    selectedKeys.value.forEach((key) => {
      if (validIds.has(key)) {
        newSelectedKeys.add(key)
      } else {
        keysChanged = true
      }
    })

    // 如果选中项有变化（被过滤掉了），则更新内部状态
    if (keysChanged) {
      selectedKeys.value = newSelectedKeys
    }

    // 只要有选中项，无论 ID 集合是否变化，都触发事件
    // 确保父组件能接收到基于新数据的对象列表（例如状态从 offline 变更为 online）
    if (selectedKeys.value.size > 0) {
      emitChange()
    }
  },
  { deep: true } // 如果 props.data 引用可能没变但内容变了，深度监听更保险
)

const isAllSelected = computed(() => {
  return props.data.length > 0 && selectedKeys.value.size === props.data.length
})

const isIndeterminate = computed(() => {
  return selectedKeys.value.size > 0 && selectedKeys.value.size < props.data.length
})

const handleSelectAll = (val: CheckboxValueType) => {
  if (val) {
    props.data.forEach((row) => selectedKeys.value.add(row[props.rowKey]))
  } else {
    selectedKeys.value.clear()
  }
  emitChange()
}

const handleSelectRow = (row: any, val: CheckboxValueType) => {
  const key = row[props.rowKey]
  if (val) {
    selectedKeys.value.add(key)
  } else {
    selectedKeys.value.delete(key)
  }
  emitChange()
}

const emitChange = () => {
  const selection = props.data.filter((item) => selectedKeys.value.has(item[props.rowKey]))
  emit('selection-change', selection)
}

const selectionColumn = {
  key: 'selection',
  width: 50,
  align: 'center' as const,
  headerCellRenderer: () => {
    return (
      <ElCheckbox
        modelValue={isAllSelected.value}
        indeterminate={isIndeterminate.value}
        onChange={handleSelectAll}
      />
    )
  },
  cellRenderer: ({ rowData }) => {
    return (
      <ElCheckbox
        modelValue={selectedKeys.value.has(rowData[props.rowKey])}
        onChange={(val) => handleSelectRow(rowData, val)}
      />
    )
  }
}

const generateAdaptiveColumns = (containerWidth: number) => {
  const allColumns = props.selectable ? [selectionColumn, ...props.columns] : props.columns

  let totalFixedWidth = 0
  let totalFlexGrow = 0

  allColumns.forEach((col: any) => {
    totalFixedWidth += col.width || 0
    if (col.flexGrow) {
      totalFlexGrow += col.flexGrow
    }
  })

  // 如果容器宽度大于总固定宽度，且有弹性列，则分配剩余空间
  if (containerWidth > totalFixedWidth && totalFlexGrow > 0) {
    const extraWidth = containerWidth - totalFixedWidth
    return allColumns.map((col: any) => {
      if (col.flexGrow) {
        // 计算增加的宽度
        const addedWidth = Math.floor((extraWidth * col.flexGrow) / totalFlexGrow)
        // 返回新列对象，宽度 = 基础宽度 + 增加宽度
        return { ...col, width: (col.width || 0) + addedWidth }
      }
      return col
    })
  }

  return allColumns
}

defineExpose({
  clearSelection: () => {
    selectedKeys.value.clear()
    emitChange()
  },
  toggleAllSelection: () => {
    if (isAllSelected.value) {
      selectedKeys.value.clear()
    } else {
      props.data.forEach((row) => selectedKeys.value.add(row[props.rowKey]))
    }
    emitChange()
  },
  toggleRowSelection: (row: any, selected?: boolean) => {
    const key = row[props.rowKey]
    const isSelected = selectedKeys.value.has(key)
    if (typeof selected === 'boolean') {
      if (selected && !isSelected) selectedKeys.value.add(key)
      if (!selected && isSelected) selectedKeys.value.delete(key)
    } else {
      if (isSelected) selectedKeys.value.delete(key)
      else selectedKeys.value.add(key)
    }
    emitChange()
  },
  invertSelection: () => {
    // 批量反转选中状态，避免多次触发 selection-change
    props.data.forEach((row) => {
      const key = row[props.rowKey]
      if (selectedKeys.value.has(key)) {
        selectedKeys.value.delete(key)
      } else {
        selectedKeys.value.add(key)
      }
    })
    // 更新完成后只触发一次变更事件
    emitChange()
  }
})
</script>

<template>
  <ElAutoResizer>
    <template #default="{ height, width }">
      <ElTableV2
        :columns="generateAdaptiveColumns(width)"
        class="vmos-table"
        :data="data"
        :width="width"
        :height="height"
        :row-key="rowKey"
        :row-height="rowHeight"
        :header-height="headerHeight"
        fixed
        v-bind="$attrs"
      />
    </template>
  </ElAutoResizer>
</template>
<style scoped lang="scss">
.vmos-table {
  :deep(.el-table-v2__cell-text) {
    color: var(--el-text-color-regular);
  }

  :deep(.el-table-v2__right) {
    box-shadow: none !important;
  }
}
</style>
