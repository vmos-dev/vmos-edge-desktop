import { ref, computed, type Ref } from 'vue'
import { type Device } from '@shared/ipc/data.types'
import { DeviceType } from '@renderer/utils/constant'
import type { TreeNode } from './useCloudTree'

export function useCloudSelection(
  treeRef: Ref<any>,
  deviceFilter: Ref<string[]>,
  deviceTypeFilter: Ref<string>,
  viewMode: Ref<'list' | 'grid'>,
  tableRef: Ref<any> // VmosTable instance
) {
  const tableData = ref<Device[]>([])
  const selectedRows = ref<Device[]>([])
  const checkedKeys = ref<string[]>([])

  const selectedCount = computed(() => selectedRows.value.length)
  const selectedIds = computed(() => selectedRows.value.map((d) => d.id))

  const isIndeterminate = computed(() => {
    return selectedRows.value.length > 0 && selectedRows.value.length < tableData.value.length
  })

  // 全选框逻辑
  const selectAll = computed({
    get: () => tableData.value.length > 0 && selectedRows.value.length === tableData.value.length,
    set: (val) => handleToolbarSelectAll(val)
  })

  // 树节点选中状态变化时，更新表格数据
  // 此方法在树节点勾选状态变更、或筛选条件变化时调用
  const handleCheckChange = () => {
    if (!treeRef.value) return

    // 1. 同步选中键值
    checkedKeys.value = treeRef.value.getCheckedKeys()

    // 2. 获取所有被勾选的节点（包括半选）
    const checkedNodes = treeRef.value.getCheckedNodes()

    // 当前筛选条件
    const stateFilter = deviceFilter.value
    const typeFilter = deviceTypeFilter.value

    // 设备筛选
    const selectedDevices = checkedNodes?.filter((node: TreeNode) => {
      // 1. 只处理设备节点
      if (node.type !== 'device') return false

      const device = node.originalData as Device

      /**
       * 2. 状态是否满足
       * - 未选择状态：全部满足
       * - 选择状态：必须完全匹配
       */
      const isStateMatch =
        stateFilter.length === 0 || (!!device.state && stateFilter.includes(device.state))

      /**
       * 3. 类型是否满足
       * - 未选择类型：全部满足
       * - 真机：
       *    - device_type === 'real'
       *    - device_type 为空 / undefined
       * - 虚拟机：
       *    - device_type === 'virtual'
       */
      let isTypeMatch = true

      if (typeFilter === DeviceType.REAL) {
        isTypeMatch = !device.device_type || device.device_type === DeviceType.REAL
      } else if (typeFilter === DeviceType.VIRTUAL) {
        isTypeMatch = device.device_type === DeviceType.VIRTUAL
      }

      // 4. 组合条件（AND）
      return isStateMatch && isTypeMatch
    })
    // 4. 更新表格数据源
    const collator = new Intl.Collator('zh-CN')

    tableData.value = (selectedDevices?.map((n) => n.originalData as Device) || []).sort((a, b) =>
      collator.compare(a.user_name || '', b.user_name || '')
    )

    // 5. 同步更新选中行（SelectedRows）：移除那些不再在 tableData 中的行
    // 同时更新 selectedRows 中的对象引用为 tableData 中的最新对象
    const currentDataMap = new Map(tableData.value.map((d) => [d.id, d]))
    selectedRows.value = selectedRows.value
      .filter((d) => currentDataMap.has(d.id))
      .map((d) => currentDataMap.get(d.id)!)
  }

  // 监听表格数据变化，确保 treeRef.value.getCheckedKeys() 返回的值也是最新的
  // 当删除节点时，需要确保它从 checkedKeys 中移除，防止脏数据残留
  const syncCheckedKeys = () => {
    if (treeRef.value) {
      checkedKeys.value = treeRef.value.getCheckedKeys()
    }
  }

  // 全选/取消全选逻辑
  const handleToolbarSelectAll = (val: any) => {
    if (val) {
      if (viewMode.value === 'list' && tableRef.value) {
        if (selectedRows.value.length !== tableData.value.length) {
          tableRef.value.toggleAllSelection()
        }
      } else {
        selectedRows.value = [...tableData.value]
      }
    } else {
      if (viewMode.value === 'list' && tableRef.value) {
        tableRef.value.clearSelection()
      } else {
        selectedRows.value = []
      }
    }
  }

  const handleSelectionChange = (rows: Device[]) => {
    selectedRows.value = rows
  }

  const handleInvertSelection = () => {
    if (viewMode.value === 'list' && tableRef.value) {
      tableRef.value.invertSelection()
    } else {
      const currentIds = new Set(selectedRows.value.map((d) => d.id))
      selectedRows.value = tableData.value.filter((d) => !currentIds.has(d.id))
    }
  }

  const handleCancelSelection = () => {
    if (viewMode.value === 'list' && tableRef.value) {
      tableRef.value.clearSelection()
    } else {
      selectedRows.value = []
    }
  }

  const handleGridSelectionChange = (ids: string[]) => {
    const idSet = new Set(ids)
    selectedRows.value = tableData.value.filter((d) => idSet.has(d.id))
  }

  return {
    tableData,
    selectedRows,
    checkedKeys,
    selectedCount,
    selectedIds,
    selectAll,
    isIndeterminate,
    handleCheckChange,
    handleSelectionChange,
    handleToolbarSelectAll,
    handleInvertSelection,
    handleCancelSelection,
    handleGridSelectionChange,
    syncCheckedKeys
  }
}
