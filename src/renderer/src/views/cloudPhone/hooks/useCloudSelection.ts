import { ref, computed, type Ref } from 'vue'
import { type Device } from '@shared/ipc/data.types'
import { DeviceType } from '@renderer/utils/constant'
import type { TreeNode } from './useCloudTree'

/**
 * handleCheckChange 的调用模式：
 * - 'check': 用户勾选树节点 → 基于差异更新有效选中集合（搜索时只添加匹配项）
 * - 'sync':  数据变更/模式切换 → 有效选中集合与树状态完全同步
 * - 'filter': 搜索/筛选条件变化 → 不修改有效选中集合，仅重新过滤表格
 */
export type CheckChangeMode = 'check' | 'sync' | 'filter'

export function useCloudSelection(
  treeRef: Ref<any>,
  deviceFilter: Ref<string[]>,
  deviceTypeFilter: Ref<string>,
  viewMode: Ref<'list' | 'grid'>,
  tableRef: Ref<any>, // VmosTable instance
  searchText: Ref<string>
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
  const handleCheckChange = (mode: CheckChangeMode = 'sync') => {
    if (!treeRef.value) return

    // 1. 获取所有被勾选的节点，同步 checkedKeys
    const checkedNodes = treeRef.value.getCheckedNodes()
    checkedKeys.value = checkedNodes?.map((node: TreeNode) => node.id) || []

    const checkedDeviceNodes =
      checkedNodes?.filter((node: TreeNode) => node.type === 'device') || []
    const treeDeviceIds = new Set<string>(
      checkedDeviceNodes.map((node: TreeNode) => (node.originalData as Device).id)
    )

    // 2. 根据模式更新有效选中集合
    if (mode === 'check') {
      // 用户勾选：基于差异更新，搜索状态下只添加匹配的新设备
      const prevIds = checkedDeviceIds.value
      const nextIds = new Set<string>()
      const queryText = searchText.value?.toLowerCase().trim() || ''

      // 保留之前有效且仍在树中勾选的设备
      for (const id of prevIds) {
        if (treeDeviceIds.has(id)) nextIds.add(id)
      }

      // 新增勾选的设备（搜索时只添加匹配项）
      for (const node of checkedDeviceNodes) {
        const device = node.originalData as Device
        if (!prevIds.has(device.id)) {
          if (queryText) {
            const name = (device.user_name || '').toLowerCase()
            if (name.includes(queryText)) nextIds.add(device.id)
          } else {
            nextIds.add(device.id)
          }
        }
      }

      checkedDeviceIds.value = nextIds
    } else if (mode === 'sync') {
      // 数据同步：直接与树状态对齐
      checkedDeviceIds.value = treeDeviceIds
    }
    // mode === 'filter'：不修改 checkedDeviceIds

    // 3. 清理 manuallyDeselectedIds（移除已不在有效集合中的条目）
    const nextManuallyDeselectedIds = new Set<string>(manuallyDeselectedIds.value)
    for (const id of manuallyDeselectedIds.value) {
      if (!checkedDeviceIds.value.has(id)) {
        nextManuallyDeselectedIds.delete(id)
      }
    }
    manuallyDeselectedIds.value = nextManuallyDeselectedIds

    // 4. 筛选条件
    const stateFilter = deviceFilter.value
    const typeFilter = deviceTypeFilter.value

    // 5. 设备筛选
    // 搜索文本只在 'check' 模式的入口处控制哪些设备进入 checkedDeviceIds，
    // 表格构建不再二次过滤搜索文本——搜索只影响树，不影响表格。
    const selectedDevices = checkedDeviceNodes.filter((node: TreeNode) => {
      const device = node.originalData as Device

      // 必须在有效选中集合中
      if (!checkedDeviceIds.value.has(device.id)) return false

      /**
       * 状态是否满足
       */
      const isStateMatch =
        stateFilter.length === 0 || (!!device.state && stateFilter.includes(device.state))

      /**
       * 类型是否满足
       */
      let isTypeMatch = true

      if (typeFilter === DeviceType.REAL) {
        isTypeMatch = !device.device_type || device.device_type === DeviceType.REAL
      } else if (typeFilter === DeviceType.VIRTUAL) {
        isTypeMatch = device.device_type === DeviceType.VIRTUAL
      }

      // 组合条件（AND）
      return isStateMatch && isTypeMatch
    })

    // 6. 更新表格数据源
    const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

    tableData.value = (selectedDevices?.map((n) => n.originalData as Device) || []).sort((a, b) =>
      collator.compare(a.user_name || '', b.user_name || '')
    )

    // 7. 左侧树勾选进入表格后默认选中；如果用户在表格中手动取消，则保持取消状态
    selectedRows.value = tableData.value.filter(
      (device) => !manuallyDeselectedIds.value.has(device.id)
    )
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
    checkedDeviceIds,
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
