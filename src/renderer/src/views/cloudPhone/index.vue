<template>
  <div class="cloud-phone-page">
    <!-- 左侧边栏 -->
    <aside class="cloud-phone-sidebar">
      <!-- 搜索框 -->
      <div class="sidebar-search">
        <el-input
          v-model="searchText"
          @input="onQueryChanged"
          placeholder="请输入名称"
          :prefix-icon="Search"
          clearable
        />
      </div>

      <!-- 操作按钮 -->
      <div class="sidebar-actions">
        <el-button text :icon="Plus" @click="addGroupRef?.init()"> 添加分组 </el-button>
        <el-button text :icon="Plus" @click="addHostRef?.init()"> 添加主机 </el-button>
      </div>

      <!-- 设备树 -->
      <div class="sidebar-tree" ref="sidebarTreeRef">
        <el-tree-v2
          ref="treeRef"
          :height="treeHeight"
          :data="displayTreeData"
          v-if="isTreeDataLoaded"
          :props="defaultProps"
          :default-expanded-keys="expandedKeys"
          :filter-method="filterMethod"
          @node-expand="handleNodeExpand"
          @node-collapse="handleNodeCollapse"
          show-checkbox
          :indent="6"
          :item-size="44"
          @check="handleCheckChange"
        >
          <template #default="{ data }">
            <div class="tree-node">
              <span
                v-if="data.type !== 'group'"
                class="status-dot"
                :class="getNodeStatusClass(data)"
              ></span>
              <el-icon v-if="data.type === 'group'" class="node-icon group-icon">
                <Folder />
              </el-icon>
              <el-icon v-else-if="data.type === 'host'" class="node-icon host-icon">
                <Monitor />
              </el-icon>

              <div class="node-label" :title="formatTreeLabel(data)">
                <template v-if="data.type === 'group'">
                  <span class="label-text"
                    >{{ formatTreeLabel(data) }} ({{ data.children?.length || 0 }})</span
                  >
                </template>
                <template v-else-if="data.type === 'host'">
                  <span class="label-text"
                    >{{ formatTreeLabel(data) }} ({{ data.children?.length || 0 }})</span
                  >
                </template>
                <template v-else-if="data.type === 'device'">
                  <div class="label-device">
                    <div class="label-device-content">
                      <span class="label-text">{{ formatTreeLabel(data) }}</span>
                      <span
                        v-if="getDeviceIpAdb(data.originalData as Device)"
                        class="label-subtext"
                        :title="getDeviceIpAdb(data.originalData as Device)"
                        @click.stop="handleCopyIpAdb(data.originalData as Device)"
                      >
                        {{ getDeviceIpAdb(data.originalData as Device) }}
                      </span>
                    </div>
                    <div class="node-label-tool" @click.stop>
                      <el-dropdown
                        v-if="(data.originalData as Device).state !== DeviceState.StateOffline"
                        trigger="click"
                        @command="(command) => handleDeviceDropdownClick(command, [data.originalData as Device])"
                      >
                        <el-icon class="tool-icon" size="14"><MoreFilled /></el-icon>
                        <template #dropdown>
                          <el-dropdown-menu class="device-actions-menu">
                            <el-dropdown-item
                              v-for="item in getDeviceMenuItems(data.originalData as Device)"
                              :key="item.command"
                              :command="item.command"
                              :divided="item.divided"
                              >{{ item.label }}</el-dropdown-item
                            >
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>
                  </div>
                </template>

                <div class="node-label-tool" @click.stop v-if="data.type !== 'device'">
                  <template v-if="data.type === 'group'">
                    <el-icon
                      class="tool-icon"
                      size="14"
                      title="添加主机到分组"
                      @click="moveGroupRef?.init(data.originalData as Group)"
                      ><Plus
                    /></el-icon>
                    <el-icon
                      class="tool-icon"
                      size="14"
                      title="编辑分组"
                      @click="updateGroupRef?.init(data.originalData as Group)"
                      ><Edit
                    /></el-icon>
                    <el-icon
                      class="tool-icon"
                      size="14"
                      title="删除分组"
                      v-if="data.originalData.id !== 'default'"
                      @click="handleDeleteGroup(data.originalData as Group)"
                      ><Delete
                    /></el-icon>
                  </template>
                  <template
                    v-else-if="data.type === 'host' && (data.originalData as Host).status === HostState.Online"
                  >
                    <el-icon
                      class="tool-icon"
                      v-if="(data.originalData as Host).status === HostState.Online"
                      size="14"
                      title="重启"
                      @click="handleShutdownHost(data.originalData as Host)"
                    >
                      <RefreshRight />
                    </el-icon>
                    <el-icon
                      class="tool-icon"
                      size="14"
                      title="创建云机"
                      @click="createCloudRef?.init(data.originalData as Host)"
                      ><Plus
                    /></el-icon>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </el-tree-v2>
      </div>
    </aside>

    <!-- 右侧主内容区 -->
    <div class="cloud-phone-main">
      <!-- 顶部操作栏 -->
      <div class="page-toolbar">
        <div class="toolbar-left">
          <el-checkbox
            v-model="selectAll"
            :indeterminate="isIndeterminate"
            @change="handleToolbarSelectAll"
            >全选</el-checkbox
          >
          <el-button text @click="handleInvertSelection">反选</el-button>
          <span class="selected-count">{{ selectedCount }} 已选</span>
          <el-button text @click="handleCancelSelection">取消选择</el-button>

          <el-button text :class="{ 'is-active': isBatchPanelExpanded }" @click="toggleBatchPanel">
            <el-icon><Operation /></el-icon>&nbsp;批量操作
            <el-icon class="expand-icon" :class="{ 'is-expanded': isBatchPanelExpanded }">
              <ArrowDown />
            </el-icon>
          </el-button>

          <div class="group-control-switch" :class="{ 'is-active': isGroupControl }">
            <el-icon class="group-control-icon"><Connection /></el-icon>
            <span class="group-control-label">群控</span>
            <el-switch :model-value="isGroupControl" size="small" @change="setGroupControl" />
          </div>

          <el-divider direction="vertical" />
          <el-select
            v-model="deviceTypeFilter"
            placeholder="类型筛选"
            style="width: 120px"
            size="small"
            clearable
          >
            <template #prefix>
              <el-icon><Filter /></el-icon>
            </template>
            <el-option
              v-for="(value, key) in DeviceTypeMap"
              :key="key"
              :label="value"
              :value="key"
            />
          </el-select>
          <el-select
            v-model="deviceFilter"
            placeholder="状态筛选"
            style="width: 160px"
            size="small"
            clearable
          >
            <template #prefix>
              <el-icon><Filter /></el-icon>
            </template>
            <el-option
              v-for="(label, state) in DeviceStateMap"
              :key="state"
              :label="label"
              :value="state"
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  width: 100%;
                "
              >
                <span>{{ label }}</span>
                <el-tag
                  :style="{ backgroundColor: DeviceStateColorMap[state] }"
                  effect="dark"
                  round
                  style="width: 6px; height: 6px; padding: 0; border: none"
                />
              </div>
            </el-option>
          </el-select>
        </div>

        <div class="toolbar-right">
          <el-button :icon="Refresh" circle @click="handleRefresh" />
          <el-dropdown trigger="click" @command="handleViewModeCommand">
            <el-button :icon="Grid" circle />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="list">
                  <el-icon v-if="viewMode === 'list'"><Check /></el-icon> 列表模式
                </el-dropdown-item>
                <el-dropdown-item command="grid">
                  <el-icon v-if="viewMode === 'grid'"><Check /></el-icon> 窗口模式
                </el-dropdown-item>
                <template v-if="viewMode === 'grid'">
                  <el-dropdown-item command="grid-landscape" divided>
                    <el-icon v-if="gridOrientation === 'landscape'"><Check /></el-icon> 横屏
                  </el-dropdown-item>
                  <el-dropdown-item command="grid-portrait">
                    <el-icon v-if="gridOrientation === 'portrait'"><Check /></el-icon> 竖屏
                  </el-dropdown-item>
                  <el-dropdown-item command="grid-large" divided>
                    <el-icon v-if="gridSize === 'large'"><Check /></el-icon> 大视图
                  </el-dropdown-item>
                  <el-dropdown-item command="grid-medium">
                    <el-icon v-if="gridSize === 'medium'"><Check /></el-icon> 中视图
                  </el-dropdown-item>
                  <el-dropdown-item command="grid-small">
                    <el-icon v-if="gridSize === 'small'"><Check /></el-icon> 小视图
                  </el-dropdown-item>
                </template>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <!-- 批量操作面板 -->
        <div
          ref="batchPanelRef"
          class="batch-operations-panel"
          :class="{ 'is-expanded': isBatchPanelExpanded }"
        >
          <div class="batch-operations-content">
            <template
              v-for="(item, index) in getBatchOperationItems(selectedRows as Device[])"
              :key="item.command"
            >
              <el-divider v-if="item.divided && index > 0" direction="vertical" />
              <el-button
                text
                @click="handleDeviceDropdownClick(item.command, selectedRows as Device[])"
                class="batch-operation-btn"
              >
                <svg-icon :name="item.command" v-if="item.command" style="margin-right: 3px" />
                {{ item.label }}
              </el-button>
            </template>
          </div>
        </div>
      </div>

      <!-- 数据表格 -->
      <div
        class="page-content"
        :style="{
          transform: isBatchPanelExpanded ? `translateY(${batchPanelHeight}px)` : 'translateY(0)',
          paddingBottom: isBatchPanelExpanded ? `${batchPanelHeight}px` : '0px'
        }"
      >
        <VmosTable
          v-if="viewMode === 'list'"
          ref="tableRef"
          :data="tableData"
          :columns="columns"
          selectable
          :row-height="40"
          :header-height="45"
          row-key="id"
          :selected-ids="selectedIds"
          @selection-change="handleSelectionChange"
        />
        <CloudGrid
          v-else
          :data="tableData"
          :selected-ids="selectedIds"
          :size="gridSize"
          :orientation="gridOrientation"
          :get-menu-items="getDeviceMenuItems"
          :is-group-control="isGroupControl"
          @selection-change="handleGridSelectionChange"
          @command="handleGridCommand"
          @open-window="handleOpenGroupWindow"
        />
      </div>
    </div>

    <!-- 弹窗组件 -->
    <AddGroup ref="addGroupRef" />
    <AddHost ref="addHostRef" />
    <UpdateGroup ref="updateGroupRef" />
    <MoveGroup ref="moveGroupRef" />
    <UpdateDeviceName ref="updateDeviceNameRef" />
    <UpdateImage ref="updateImageRef" />
    <NewMachine ref="newMachineRef" />
    <DeviceClone ref="deviceCloneRef" />
    <CreateCloud ref="createCloudRef" />
    <DeviceInfo ref="deviceInfoRef" />
    <SetProxy ref="setProxyRef" />
    <SetTimeZoneLanguage ref="setTimeZoneLanguageRef" />
    <ExecCommand ref="execCommandRef" />
    <BatchInstall ref="batchInstallRef" />
    <ModifyPosition ref="modifyPositionRef" />
  </div>
</template>

<script setup lang="tsx">
import { ref, computed, watch, onUnmounted, nextTick, toRaw } from 'vue'
import {
  Refresh,
  Grid,
  Search,
  Plus,
  Folder,
  MoreFilled,
  Iphone,
  Monitor,
  VideoPlay,
  Operation,
  Check,
  RefreshRight,
  ArrowDown,
  Filter,
  Connection
} from '@element-plus/icons-vue'
import {
  ElButton,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElIcon,
  ElTag,
  TableV2FixedDir,
  ElMessage,
  ElMessageBox,
  ElSelect,
  ElOption
} from 'element-plus'
import VmosTable from '@renderer/components/table/index.vue'
import CloudGrid from './components/CloudGrid.vue'
import { CLOUD_CLOSE } from '@renderer/core/ipc'
import { useResizeObserver } from '@renderer/hooks/useResizeObserver'
import { type Group, type Device, DeviceState, type Host, HostState } from '@shared/ipc/data.types'
import { DeviceStateMap, DeviceStateColorMap } from '@renderer/utils/constant'
import AddGroup from './modules/addGroup.vue'
import AddHost from './modules/addHost.vue'
import UpdateGroup from './modules/updateGroup.vue'
import MoveGroup from './modules/moveGroup.vue'
import UpdateDeviceName from './modules/updateDeviceName.vue'
import UpdateImage from './modules/updateImage.vue'
import NewMachine from './modules/newMachine.vue'
import DeviceClone from './modules/deviceClone.vue'
import CreateCloud from './components/CreateCloud.vue'
import BatchInstall from './modules/batchInstall.vue'
import SetProxy from './modules/setProxy.vue'
import { copyToClipboard } from '@renderer/utils/index'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS } from '@shared/ipc/data.types'
// Hooks
import { useCloudTree, defaultProps, type TreeNode } from './hooks/useCloudTree'
import { useCloudSelection } from './hooks/useCloudSelection'
import { useCloudOperations } from './hooks/useCloudOperations'
import { useGroupControl } from './hooks/useGroupControl'
import { CopyText } from '@renderer/components'
import DeviceInfo from './modules/deviceInfo.vue'
import SetTimeZoneLanguage from './modules/setTimeZoneLanguage.vue'
import ExecCommand from './modules/execCommand.vue'
import { MacvlanPortMap, DeviceType, DeviceTypeMap } from '@renderer/utils/constant'
import { useModeView } from './hooks/useModeView'
import ModifyPosition from './modules/modifyPosition.vue'

defineOptions({ name: 'Cloud' })

// ==========================================
// 状态与引用 (Refs)
// ==========================================

// 弹窗组件引用
const addGroupRef = ref<InstanceType<typeof AddGroup>>()
const addHostRef = ref<InstanceType<typeof AddHost>>()
const updateGroupRef = ref<InstanceType<typeof UpdateGroup>>()
const moveGroupRef = ref<InstanceType<typeof MoveGroup>>()
const updateDeviceNameRef = ref<InstanceType<typeof UpdateDeviceName>>()
const updateImageRef = ref<InstanceType<typeof UpdateImage>>()
const newMachineRef = ref<InstanceType<typeof NewMachine>>()
const deviceCloneRef = ref<InstanceType<typeof DeviceClone>>()
const createCloudRef = ref<InstanceType<typeof CreateCloud>>()
const deviceInfoRef = ref<InstanceType<typeof DeviceInfo>>()
const setProxyRef = ref<InstanceType<typeof SetProxy>>()
const modifyPositionRef = ref<InstanceType<typeof ModifyPosition>>()
const setTimeZoneLanguageRef = ref<InstanceType<typeof SetTimeZoneLanguage>>()

const execCommandRef = ref<InstanceType<typeof ExecCommand>>()
const batchInstallRef = ref<InstanceType<typeof BatchInstall>>()
// 表格引用
const tableRef = ref<InstanceType<typeof VmosTable>>()
const sidebarTreeRef = ref<HTMLElement>()
const batchPanelRef = ref<HTMLElement>()
const { viewMode, gridSize, gridOrientation } = useModeView()

const deviceFilter = ref<string>('')
const deviceTypeFilter = ref<string>('')
const treeHeight = ref(500)
const isBatchPanelExpanded = ref(false)
const batchPanelHeight = ref(0)

// ==========================================
// Hooks 初始化
// ==========================================

const onDataChangedHandler = ref<() => void>()
const {
  treeRef,
  displayTreeData,
  searchText,
  isTreeDataLoaded,
  expandedKeys,
  hostIpMap,
  loadTree,
  onQueryChanged,
  filterMethod,
  getNodeStatusClass,
  formatTreeLabel
} = useCloudTree(() => onDataChangedHandler.value?.())

// 监听节点展开/折叠，同步 expandedKeys，防止数据刷新时重置为初始状态
const handleNodeExpand = (data: TreeNode) => {
  if (data?.id && !expandedKeys.value.includes(data.id)) {
    expandedKeys.value.push(data.id)
  }
}

const handleNodeCollapse = (data: TreeNode) => {
  if (data?.id) {
    const index = expandedKeys.value.indexOf(data.id)
    if (index > -1) {
      expandedKeys.value.splice(index, 1)
    }
  }
}

const {
  tableData,
  selectedRows,
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
} = useCloudSelection(treeRef, deviceFilter, deviceTypeFilter, viewMode, tableRef)

// 连接回调：当 Tree 数据变更（如实时更新、删除）时触发
// 1. handleCheckChange: 重新计算 tableData，确保表格显示正确
// 2. syncCheckedKeys: 确保 Tree 内部选中状态与 checkedKeys 同步
onDataChangedHandler.value = () => {
  nextTick(() => {
    handleCheckChange()
    syncCheckedKeys()
  })
}

const {
  handleCommand,
  handleDeviceDropdownClick,
  handleOpenWindow,
  getDeviceMenuItems,
  getBatchOperationItems
} = useCloudOperations(hostIpMap, {
  updateDeviceNameRef,
  deviceInfoRef,
  updateImageRef,
  newMachineRef,
  deviceCloneRef,
  setProxyRef,
  setTimeZoneLanguageRef,
  execCommandRef,
  batchInstallRef,
  modifyPositionRef
})

const { isGroupControl } = useGroupControl(selectedRows)

const setGroupControl = (value: boolean) => {
  if (value) {
    ElMessageBox.confirm(
      '开启群控后，系统将自动关闭当前所有云机窗口。首次打开的云机将作为主控设备，仅支持控制已选中的运行中设备。',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => {
      // 调用一键关闭
      ipc.send(CLOUD_CLOSE, { closeAll: true })
      // 通知后端开启群控
      ipc.send(DATA_EVENTS.SET_GROUP_CONTROL, true)
      isGroupControl.value = true
    })
  } else {
    // 通知后端关闭群控
    ipc.send(DATA_EVENTS.SET_GROUP_CONTROL, false)
    isGroupControl.value = false
  }
}

// ==========================================
// 剩余逻辑 (UI交互)
// ==========================================

// 监听筛选条件变化，重新触发过滤和表格更新
watch(
  () => deviceFilter.value,
  () => {
    handleCheckChange()
  }
)

watch(
  () => deviceTypeFilter.value,
  () => {
    handleCheckChange()
  }
)

const handleRefresh = () => {
  loadTree()
}

const handleOpenGroupWindow = (device: Device) => {
  if (isGroupControl.value) {
    handleOpenWindow(device)
  } else {
    handleOpenWindow(device)
  }
}

const handleDeleteGroup = (group: Group) => {
  ElMessageBox.confirm(
    `确定要删除分组 “${group.name}” 吗？，删除后该分组下的所有主机将会移动到默认分组`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    const res = await ipc.invoke(DATA_EVENTS.DELETE_GROUP, group.id)
    if (res.success) {
      ElMessage.success('操作成功')
    } else {
      ElMessage.error(res.error || '删除分组失败')
    }
  })
}

const handleGridCommand = (command: string, device: Device) => {
  handleCommand(command, [device])
}

const toggleBatchPanel = () => {
  isBatchPanelExpanded.value = !isBatchPanelExpanded.value
}

const handleViewModeCommand = (command: string) => {
  if (command === 'list') {
    viewMode.value = 'list'
  } else if (command === 'grid') {
    viewMode.value = 'grid'
  } else if (command === 'grid-portrait') {
    gridOrientation.value = 'portrait'
  } else if (command === 'grid-landscape') {
    gridOrientation.value = 'landscape'
  } else if (command === 'grid-large') {
    gridSize.value = 'large'
  } else if (command === 'grid-medium') {
    gridSize.value = 'medium'
  } else if (command === 'grid-small') {
    gridSize.value = 'small'
  }
}

const handleShutdownHost = async (host: Host) => {
  try {
    await ElMessageBox.confirm(
      `确定要重启主机 "${host.ip}" 吗？ 重启后运行中的设备将会中断并关机。`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const res = await ipc.invoke(DATA_EVENTS.RESTART_HOST, toRaw(host))
    if (res.success) {
      ElMessage.success('重启指令已下发，请稍后查看结果')
      loadTree()
    } else {
      ElMessage.error(res.error || '操作失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || '操作失败')
    }
  }
}

/**
 * 获取设备的IP和ADB显示文本
 */
const getDeviceIpAdb = (device: Device): string => {
  if (!device) return ''

  if (device.network_mode === 'macvlan') {
    if (device.state !== DeviceState.StateRunning) {
      return '-'
    }
    const ip = device.ip || ''
    const adbPort = MacvlanPortMap.adb
    return ip && adbPort ? `${ip}:${adbPort}` : ''
  } else {
    const hostIp = device.host_ip || ''
    const adb = device.adb
    return hostIp && adb ? `${hostIp}:${adb}` : ''
  }
}

/**
 * 复制设备的IP和ADB信息
 */
const handleCopyIpAdb = (device: Device) => {
  const text = getDeviceIpAdb(device)
  if (text) {
    copyToClipboard(text, () => ElMessage.success('复制成功'))
  }
}
// 使用封装的 hook 监听高度变化
const { cleanup: cleanupTreeObserver } = useResizeObserver(sidebarTreeRef, {
  throttleTime: 100,
  onResize: (entry) => {
    treeHeight.value = entry.contentRect.height
  }
})

// 监听批量操作面板高度变化，动态计算表格偏移
const { cleanup: cleanupPanelObserver } = useResizeObserver(batchPanelRef, {
  throttleTime: 50,
  onResize: (entry) => {
    // 只有当面板展开时才更新高度
    if (isBatchPanelExpanded.value) {
      batchPanelHeight.value = entry.contentRect.height
    }
  }
})

// 监听展开状态变化，立即更新高度
watch(
  isBatchPanelExpanded,
  (expanded) => {
    if (expanded && batchPanelRef.value) {
      // 使用 nextTick 确保 DOM 已更新
      nextTick(() => {
        const height = batchPanelRef.value?.offsetHeight || 0
        batchPanelHeight.value = height
      })
    } else {
      batchPanelHeight.value = 0
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  cleanupTreeObserver()
  cleanupPanelObserver()
})

// 表格列定义
const columns = computed(() => [
  {
    key: 'db_id',
    dataKey: 'db_id',
    title: '云机ID',
    width: 180,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'user_name',
    dataKey: 'user_name',
    title: '云机名称',
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'device_type',
    dataKey: 'device_type',
    title: '云机类型',
    width: 80,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => (
      <CopyText
        text={
          cellData === DeviceType.VIRTUAL
            ? DeviceTypeMap[DeviceType.VIRTUAL]
            : DeviceTypeMap[DeviceType.REAL]
        }
        color={cellData === DeviceType.VIRTUAL ? '#409eff' : '#67c23a'}
      />
    )
  },
  {
    key: 'adb',
    dataKey: 'adb',
    title: 'ADB端口',
    width: 160,
    // @ts-ignore
    cellRenderer: ({ cellData, rowData }: { cellData: string; rowData: Device }) => (
      <CopyText text={getDeviceIpAdb(rowData)} color="#409eff" />
    )
  },

  {
    key: 'state',
    dataKey: 'state',
    title: '状态',
    width: 80,
    flexGrow: 1,
    cellRenderer: ({ cellData }: { cellData: DeviceState }) => (
      <CopyText text={DeviceStateMap[cellData]} color={DeviceStateColorMap[cellData]} />
    )
  },
  {
    key: 'aosp_version',
    dataKey: 'aosp_version',
    title: 'Android版本',
    width: 120,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={`Android ${cellData}`} color="#409eff" />
  },
  {
    key: 'image',
    dataKey: 'image',
    title: '镜像版本',
    width: 290,
    cellRenderer: ({ cellData }) => <CopyText text={cellData.replace(/:latest$/, '')} />
  },
  {
    key: 'created',
    dataKey: 'created',
    title: '创建时间',
    width: 180,
    flexGrow: 1
  },
  {
    key: 'operations',
    title: '操作',
    width: 150,
    fixed: TableV2FixedDir.RIGHT,
    cellRenderer: ({ rowData }: { rowData: Device }) => {
      if (rowData.state === DeviceState.StateOffline) {
        return <span style="color: #909399; font-size: 13px;">-</span>
      }
      return (
        <div style="display: flex; align-items: center; gap: 12px;">
          <ElButton
            type="primary"
            link
            icon={rowData.state === DeviceState.StateStopped ? VideoPlay : Iphone}
            disabled={
              rowData.state !== DeviceState.StateStopped &&
              rowData.state !== DeviceState.StateRunning
            }
            onClick={() =>
              rowData.state === DeviceState.StateStopped
                ? handleCommand('start', [rowData])
                : handleOpenGroupWindow(rowData)
            }
            style="font-size: 13px;"
          >
            {rowData.state === DeviceState.StateStopped ? '开机' : '打开窗口'}
          </ElButton>
          <ElDropdown
            trigger="click"
            onCommand={(command: string) => handleDeviceDropdownClick(command, [rowData])}
          >
            {{
              default: () => (
                <ElButton text circle style="width: 24px; height: 24px; min-height: 24px;">
                  <ElIcon color="#909399" size={16}>
                    <MoreFilled />
                  </ElIcon>
                </ElButton>
              ),
              dropdown: () => (
                <ElDropdownMenu class="device-actions-menu">
                  {getDeviceMenuItems(rowData).map((item) => (
                    <ElDropdownItem command={item.command} divided={item.divided}>
                      {item.label}
                    </ElDropdownItem>
                  ))}
                </ElDropdownMenu>
              )
            }}
          </ElDropdown>
        </div>
      )
    }
  }
])
</script>

<style scoped lang="scss">
/* 保持原有样式 */
.cloud-phone-page {
  width: 100%;
  height: 100%;
  display: flex;
  background: #fff;

  /* 禁用页面内所有复选框动画，提升大批量操作流畅度 */
  :deep(.el-checkbox) {
    .el-checkbox__input,
    .el-checkbox__inner,
    .el-checkbox__inner::after {
      transition: none !important;
      animation: none !important;
    }
  }
}

/* ... 来自原有的样式 ... */
/* 侧边栏样式 */
.cloud-phone-sidebar {
  width: 300px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  overflow: hidden;
}

.sidebar-search {
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
}

.sidebar-actions {
  display: flex;
  gap: 8px;
  padding: 3px 0px;
  border-bottom: 1px solid #e4e7ed;
}

.sidebar-actions .el-button {
  flex: 1;
  font-size: 13px;
}

.sidebar-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  padding: 6px 8px; /* 增加内边距，让间距更大 */
  width: 100%; /* Ensure full width */
  overflow: hidden; /* Prevent overflow */
}

.node-icon {
  color: #909399;
  font-size: 16px;
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 4px; /* Add some space */
}

.status-dot.online {
  background-color: #67c23a;
  animation: breathing 2s infinite ease-in-out;
}

@keyframes breathing {
  0% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
  }
  50% {
    box-shadow: 0 0 6px 2px rgba(103, 194, 58, 0.4);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.7);
  }
}

.status-dot.offline {
  background-color: #f56c6c;
}

.status-dot.stopped {
  background-color: #909399;
}

.node-label {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden; /* For text ellipsis */
  min-width: 0; /* Flexbox trick for ellipsis */
  box-sizing: border-box;
}

.label-text {
  display: block; /* 很重要 */
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-width: 0;
  font-size: 14px;
}

.label-device-content .label-text {
  font-size: 12px;
}

.label-device {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  gap: 6px;
}

.label-device:hover {
  border-color: #c0c4cc;
  background-color: #f5f7fa;
}

.label-device-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.label-device .node-label-tool {
  opacity: 1;
  flex-shrink: 0;
}

.label-subtext {
  font-size: 10px;
  color: #606266;
  border-radius: 3px;
  background-color: transparent;
  border: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-block;
  width: fit-content;
  max-width: 100%;
  line-height: 1.4;
}

.label-subtext:hover {
  color: #409eff;
}

.node-label-tool {
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.tree-node:hover .node-label-tool {
  opacity: 1;
}

.tool-icon {
  cursor: pointer;
  color: #409eff;
  margin: 2px;
}

.tool-icon:hover {
  background-color: #e6e8eb;
  color: #409eff;
}

.node-count {
  font-size: 14px;
}

:deep(.el-tree-node__content) {
  height: 44px;
  padding: 0 8px;
}

:deep(.el-tree-node__content:hover) {
  background-color: #f5f7fa;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background-color: #ecf5ff;
  color: #409eff;
}

/* 主内容区样式 */
.cloud-phone-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e4e7ed;
  position: relative;
  z-index: 1;
}

.toolbar-left .el-button.is-active {
  color: #409eff;
  background-color: #ecf5ff;
}

.expand-icon {
  margin-left: 4px;
  transition: transform 0.3s ease;
  font-size: 12px;
}

.expand-icon.is-expanded {
  transform: rotate(180deg);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selected-count {
  color: #409eff;
  font-size: 14px;
  flex-shrink: 0;
  font-weight: 500;
}

/* 群控开关样式 */
.group-control-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  font-size: 14px;
  color: #606266;
  background-color: transparent;
  border: 1px solid transparent;
  height: 32px;
  box-sizing: border-box;
}

.group-control-switch:hover {
  background-color: #f5f7fa;
  color: #409eff;
}

.group-control-switch.is-active {
  color: #409eff;
  background-color: #ecf5ff;
  border-color: #b3d8ff;
}

.group-control-switch.is-active:hover {
  background-color: #d9ecff;
  border-color: #a0cfff;
}

.group-control-icon {
  font-size: 16px;
  transition: color 0.2s ease;
  flex-shrink: 0;
}

.group-control-switch:hover .group-control-icon,
.group-control-switch.is-active .group-control-icon {
  color: #409eff;
}

.group-control-label {
  font-size: 14px;
  white-space: nowrap;
  transition: color 0.2s ease;
  font-weight: 400;
  line-height: 1;
}

.group-control-switch.is-active .group-control-label {
  font-weight: 500;
}

/* 调整开关样式以匹配整体风格 */
// .group-control-switch :deep(.el-switch) {
//   margin-left: 0;
// }

// .group-control-switch :deep(.el-switch__core) {
//   width: 36px;
//   height: 20px;
// }

// .group-control-switch :deep(.el-switch__core::after) {
//   width: 16px;
//   height: 16px;
// }

/* 批量操作面板样式 - 使用绝对定位脱离文档流，避免影响表格布局计算 */
.batch-operations-panel {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  border-bottom: 1px solid #e4e7ed;
  z-index: 10;
  overflow: hidden;
  /* 使用 transform 和 opacity 做动画，不触发重排 */
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}

.batch-operations-panel.is-expanded {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.batch-operations-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 3.5px 8px;
  box-sizing: border-box;
}

.batch-operation-btn {
  font-size: 12px;
}

.batch-operation-btn:hover {
  color: #409eff;
}

.page-content {
  flex: 1;
  overflow: hidden;
  /* 使用 transform 偏移，不触发重排，避免表格重新计算 */
  transform: translateY(0);
  transition: transform 0.3s ease;
  padding: 5px;
  box-sizing: border-box;
}

/* 偏移量通过内联样式动态设置，不再使用 CSS 类 */

.more-icon {
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  transition: color 0.3s;
}

.more-icon:hover {
  color: #409eff;
}
</style>

<style lang="scss">
.device-actions-menu {
  max-height: 45vh;
  overflow-y: auto;
}
</style>
