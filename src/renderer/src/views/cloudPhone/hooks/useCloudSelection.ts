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
  const checkedDeviceIds = ref<Set<string>>(new Set())
  const manuallyDeselectedIds = ref<Set<string>>(new Set())

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

  const syncManualDeselectedIds = (selectedIdSet: Set<string>) => {
    const nextManuallyDeselectedIds = new Set<string>(manuallyDeselectedIds.value)

    for (const device of tableData.value) {
      if (selectedIdSet.has(device.id)) {
        nextManuallyDeselectedIds.delete(device.id)
      } else {
        nextManuallyDeselectedIds.add(device.id)
      }
    }

    manuallyDeselectedIds.value = nextManuallyDeselectedIds
  }

  // 树节点选中状态变化时，更新表格数据
  // 此方法在树节点勾选状态变更、或筛选条件变化时调用
  const handleCheckChange = () => {
    if (!treeRef.value) return

    // 1. 同步选中键值
    checkedKeys.value = treeRef.value.getCheckedKeys()

    // 2. 获取所有被勾选的节点（包括半选）
    const checkedNodes = treeRef.value.getCheckedNodes()
    const checkedDeviceNodes =
      checkedNodes?.filter((node: TreeNode) => node.type === 'device') || []
    const nextCheckedDeviceIds = new Set<string>(
      checkedDeviceNodes.map((node: TreeNode) => (node.originalData as Device).id)
    )

    const nextManuallyDeselectedIds = new Set<string>(manuallyDeselectedIds.value)
    for (const id of checkedDeviceIds.value) {
      if (!nextCheckedDeviceIds.has(id)) {
        nextManuallyDeselectedIds.delete(id)
      }
    }
    manuallyDeselectedIds.value = nextManuallyDeselectedIds
    checkedDeviceIds.value = nextCheckedDeviceIds

    // 当前筛选条件
    const stateFilter = deviceFilter.value
    const typeFilter = deviceTypeFilter.value

    // 设备筛选
    const selectedDevices = checkedDeviceNodes.filter((node: TreeNode) => {
      const device = node.originalData as Device

      /**
       * 1. 状态是否满足
       * - 未选择状态：全部满足
       * - 选择状态：必须完全匹配
       */
      const isStateMatch =
        stateFilter.length === 0 || (!!device.state && stateFilter.includes(device.state))

      /**
       * 2. 类型是否满足
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

      // 3. 组合条件（AND）
      return isStateMatch && isTypeMatch
    })
    // 4. 更新表格数据源
    const collator = new Intl.Collator('zh-CN')

    tableData.value = (selectedDevices?.map((n) => n.originalData as Device) || []).sort((a, b) =>
      collator.compare(a.user_name || '', b.user_name || '')
    )

    // 5. 左侧树勾选进入表格后默认选中；如果用户在表格中手动取消，则保持取消状态
    selectedRows.value = tableData.value.filter((device) => !manuallyDeselectedIds.value.has(device.id))
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
        syncManualDeselectedIds(new Set(selectedRows.value.map((d) => d.id)))
      }
    } else {
      if (viewMode.value === 'list' && tableRef.value) {
        tableRef.value.clearSelection()
      } else {
        selectedRows.value = []
        syncManualDeselectedIds(new Set())
      }
    }
  }

  const handleSelectionChange = (rows: Device[]) => {
    selectedRows.value = rows
    syncManualDeselectedIds(new Set(rows.map((row) => row.id)))
  }

  const handleInvertSelection = () => {
    if (viewMode.value === 'list' && tableRef.value) {
      tableRef.value.invertSelection()
    } else {
      const currentIds = new Set(selectedRows.value.map((d) => d.id))
      selectedRows.value = tableData.value.filter((d) => !currentIds.has(d.id))
      syncManualDeselectedIds(new Set(selectedRows.value.map((d) => d.id)))
    }
  }

  const handleCancelSelection = () => {
    if (viewMode.value === 'list' && tableRef.value) {
      tableRef.value.clearSelection()
    } else {
      selectedRows.value = []
      syncManualDeselectedIds(new Set())
    }
  }

  const handleGridSelectionChange = (ids: string[]) => {
    const idSet = new Set(ids)
    selectedRows.value = tableData.value.filter((d) => idSet.has(d.id))
    syncManualDeselectedIds(idSet)
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
