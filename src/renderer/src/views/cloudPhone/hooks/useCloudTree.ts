import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { debounce } from 'lodash-es'
import { ipc } from '@renderer/core/ipc'
import {
  DATA_EVENTS,
  type Group,
  type Host,
  type Device,
  type FlatData,
  DeviceState
} from '@shared/ipc/data.types'

export interface TreeNode {
  id: string
  type: 'group' | 'host' | 'device'
  children?: TreeNode[]
  originalData?: Group | Host | Device
  parent?: TreeNode
}

export const defaultProps = {
  value: 'id',
  label: 'label',
  children: 'children'
}

export function useCloudTree(onDataChanged?: () => void) {
  const treeRef = ref()
  const treeData = ref<TreeNode[]>([])
  const isTreeDataLoaded = ref(false)
  const expandedKeys = ref<string[]>([])
  const searchText = ref('')

  // 使用 Map 替代递归查找 (O(1) 访问)
  // nodeMap: 存储所有节点的引用 (GroupId -> Node, HostId -> Node, DeviceId -> Node)
  const nodeMap = new Map<string, TreeNode>()
  // hostIpMap: 存储 Host IP 到 Host 节点的映射，用于设备上报 IP 时快速找到父节点
  const hostIpMap = new Map<string, TreeNode>()

  /**
   * 获取节点状态对应的样式类名
   * @param node 树节点
   */
  const getNodeStatusClass = (node: TreeNode) => {
    if (node.type === 'host') {
      return (node.originalData as Host).status === 'online' ? 'online' : 'offline'
    }
    if (node.type === 'device') {
      const state = (node.originalData as Device).state
      if (state === DeviceState.StateStopped) {
        return 'stopped'
      }
      if (state === DeviceState.StateFailed || state === DeviceState.StateOffline) {
        return 'offline'
      }
      return 'online'
    }
    return ''
  }

  /**
   * 格式化树节点显示文本
   * 不同类型的节点展示不同的字段
   */
  const formatTreeLabel = (node: TreeNode) => {
    const labelMapp = {
      group: () => (node.originalData as Group).name || '',
      host: () => (node.originalData as Host).ip || '',
      device: () => (node.originalData as Device).user_name || ''
    }
    return labelMapp[node.type as keyof typeof labelMapp]()
  }

  // 搜索与筛选
  const onQueryChanged = (query: string) => {
    treeRef.value!.filter(query)
  }

  /**
   * 树节点过滤逻辑
   * 1. 文本搜索：匹配节点名称
   */
  const filterMethod = (query: string, node: TreeNode) => {
    const queryText = query?.toLowerCase() || ''
    const labelMatches = formatTreeLabel(node).toLowerCase().includes(queryText)
    return labelMatches
  }

  /**
   * 过滤后的展示数据
   * 直接返回 treeData，不再根据状态筛选树节点
   */
  const displayTreeData = computed(() => {
    return treeData.value
  })

  // 数据构建逻辑
  /**
   * 重建 Map 映射
   * 必须在树数据更新（引用变化）后调用，确保 Map 指向最新的响应式对象
   */
  const rebuildMaps = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      nodeMap.set(node.id, node)
      if (node.type === 'host' && (node.originalData as Host).ip) {
        hostIpMap.set((node.originalData as Host).ip, node)
      }
      if (node.children && node.children.length > 0) {
        rebuildMaps(node.children)
      }
    }
  }

  /**
   * 辅助函数：对节点列表按名称排序 (仅处理 Device 节点)
   */
  // 使用统一的排序规则
  const collator = new Intl.Collator('zh-CN')

  const sortDeviceNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === 'device' && b.type === 'device') {
        const nameA = (a.originalData as Device).user_name || ''
        const nameB = (b.originalData as Device).user_name || ''
        return collator.compare(nameA, nameB)
      }
      return 0
    })
  }

  /**
   * 将后端扁平数据转换为树形结构
   * 层级：Group -> Host -> Device
   */
  const buildTreeFromFlatData = (flatData: FlatData): TreeNode[] => {
    const { groups, hosts, devices } = flatData

    // 1. 按 GroupId 分组 Host
    const hostsByGroup = new Map<string, Host[]>()
    hosts.forEach((host) => {
      const groupId = host.groupId || 'default'
      if (!hostsByGroup.has(groupId)) {
        hostsByGroup.set(groupId, [])
      }
      hostsByGroup.get(groupId)!.push(host)
    })

    // 2. 按 HostIp 分组 Device
    const devicesByHostIp = new Map<string, Device[]>()
    devices.forEach((device) => {
      const hostIp = device.host_ip || ''
      if (!hostIp) return
      if (!devicesByHostIp.has(hostIp)) {
        devicesByHostIp.set(hostIp, [])
      }
      devicesByHostIp.get(hostIp)!.push(device)
    })

    // 3. 递归构建树
    return groups.map((group) => {
      const groupNode: TreeNode = {
        id: group.id,
        type: 'group' as const,
        originalData: group,
        children: []
      }

      const groupHosts = hostsByGroup.get(group.id) || []

      const hostNodes: TreeNode[] = groupHosts.map((host) => {
        const hostNode: TreeNode = {
          id: host.id,
          type: 'host' as const,
          originalData: host,
          children: [],
          parent: groupNode
        }

        const hostDevices = devicesByHostIp.get(host.ip || '') || []

        const deviceNodes: TreeNode[] = hostDevices.map((device) => {
          return {
            id: device.id,
            type: 'device',
            originalData: device,
            parent: hostNode
          }
        })

        // 对设备节点按名称排序
        sortDeviceNodes(deviceNodes)

        hostNode.children = deviceNodes
        return hostNode
      })

      groupNode.children = hostNodes
      return groupNode
    })
  }

  /**
   * 初始化加载全量数据
   */
  const loadTree = async () => {
    try {
      const res = await ipc.invoke(DATA_EVENTS.GET_FLAT_DATA)
      if (res.success && res.data) {
        const flatData = res.data as FlatData
        const newTreeData = buildTreeFromFlatData(flatData)
        treeData.value = newTreeData

        // 重建映射表
        nodeMap.clear()
        hostIpMap.clear()
        rebuildMaps(treeData.value)

        // 默认展开所有分组和主机
        if (expandedKeys.value.length === 0) {
          expandedKeys.value = [...(flatData.groups.map((group) => group.id) || [])]
        }
        isTreeDataLoaded.value = true
      }
    } catch (e) {
      console.error('Failed to load tree', e)
    }
  }

  // 实时更新逻辑
  /**
   * 删除节点通用逻辑
   * 处理父子关系断开、Map 清理以及 TreeData 更新
   */
  const deleteNode = (id: string) => {
    const node = nodeMap.get(id)
    if (node) {
      if (node.parent && node.parent.children) {
        const idx = node.parent.children.indexOf(node)
        if (idx > -1) node.parent.children.splice(idx, 1)
      } else if (node.type === 'group') {
        const idx = treeData.value.indexOf(node)
        if (idx > -1) treeData.value.splice(idx, 1)
      }

      // 递归清理 Map 防止内存泄漏
      const cleanupMap = (n: TreeNode) => {
        nodeMap.delete(n.id)
        if (n.type === 'host' && (n.originalData as Host).ip) {
          hostIpMap.delete((n.originalData as Host).ip)
        }
        if (n.children) {
          n.children.forEach(cleanupMap)
        }
      }
      cleanupMap(node)
    }
  }

  /**
   * 监听数据变更事件
   * 包含防抖刷新机制
   */
  const listenerDataUpdated = () => {
    const unsubs: Array<() => void> = []

    // 视图刷新防抖：合并短时间内的大量更新（如批量开机）
    // 延迟 100ms 执行，避免 UI 卡顿
    const refreshView = debounce(async () => {
      if (searchText.value) {
        await nextTick()
        treeRef.value?.filter(searchText.value) // 仅当有搜索文本时才重新触发筛选
      }
      onDataChanged?.() // 通知外部同步表格数据
    }, 100)

    const sub = (event: string, handler: (payload: any) => void | Promise<void>) => {
      const unsub = ipc.on(event, async (payload) => {
        await handler(payload)
      })
      unsubs.push(unsub)
    }

    // --- Group Events (分组) ---
    sub(DATA_EVENTS.GROUP_ADDED, (group: Group) => {
      const newNode: TreeNode = {
        id: group.id,
        type: 'group',
        originalData: group,
        children: []
      }
      treeData.value = [...treeData.value, newNode]
      const reactiveNode = treeData.value[treeData.value.length - 1]
      nodeMap.set(group.id, reactiveNode)
    })

    sub(DATA_EVENTS.GROUP_UPDATED, (group: Group) => {
      const node = nodeMap.get(group.id)
      if (node && node.originalData) {
        Object.assign(node.originalData, group)
      }
    })

    sub(DATA_EVENTS.GROUP_DELETED, ({ id }) => {
      deleteNode(id)
      treeData.value = [...treeData.value]
    })

    // --- Host Events (主机) ---
    sub(DATA_EVENTS.HOST_ADDED, (host: Host) => {
      const groupNode = nodeMap.get(host.groupId)
      if (groupNode && groupNode.children) {
        const newNode: TreeNode = {
          id: host.id,
          type: 'host',
          originalData: host,
          children: [],
          parent: groupNode
        }
        groupNode.children.push(newNode)
        treeData.value = [...treeData.value]
        const reactiveNode = groupNode.children[groupNode.children.length - 1]
        nodeMap.set(host.id, reactiveNode)
        if (host.ip) hostIpMap.set(host.ip, reactiveNode)
      } else {
        loadTree()
      }
    })

    sub(DATA_EVENTS.HOST_UPDATED, (host: Host) => {
      const node = nodeMap.get(host.id)
      if (node && node.originalData) {
        Object.assign(node.originalData, host)
        if (host.ip) hostIpMap.set(host.ip, node)
      }
    })

    sub(DATA_EVENTS.HOST_DELETED, ({ id }) => {
      deleteNode(id)
      treeData.value = [...treeData.value]
    })

    // 批量移动主机
    sub(
      DATA_EVENTS.HOSTS_MOVED,
      async ({ hostIds, groupId }: { hostIds: string[]; groupId: string }) => {
        const newGroupNode = nodeMap.get(groupId)
        if (!newGroupNode) {
          loadTree()
          return
        }

        let changed = false
        const movedNodes: TreeNode[] = []

        hostIds.forEach((hostId) => {
          const node = nodeMap.get(hostId)
          if (node && node.parent && node.parent.children) {
            const idx = node.parent.children.indexOf(node)
            if (idx !== -1) {
              node.parent.children.splice(idx, 1)
              if (node.originalData) (node.originalData as Host).groupId = groupId
              node.parent = newGroupNode
              newGroupNode.children = newGroupNode.children || []
              newGroupNode.children.push(node)
              changed = true
              movedNodes.push(node)
            }
          }
        })

        if (changed) {
          // 处理选中状态继承：如果目标分组已选中（全选状态），则新移入的主机也自动选中
          const tree = treeRef.value
          if (tree) {
            const checkedKeys = tree.getCheckedKeys() || []
            if (checkedKeys.includes(groupId)) {
              const idsToSelect: string[] = []
              const collectIds = (nodes: TreeNode[]) => {
                nodes.forEach((n) => {
                  idsToSelect.push(n.id)
                  if (n.children) collectIds(n.children)
                })
              }
              collectIds(movedNodes)

              // 使用 Set 去重合并
              const newCheckedKeys = Array.from(new Set([...checkedKeys, ...idsToSelect]))
              tree.setCheckedKeys(newCheckedKeys)
            }
          }

          treeData.value = [...treeData.value]
          nextTick(() => {
            onDataChanged?.()
          })
        }
      }
    )

    // --- Device Events (设备/云机) ---
    sub(DATA_EVENTS.DEVICE_ADDED, async (devices: Device[]) => {
      let hasChanges = false
      // 使用 Set 收集受影响的主机节点，避免重复排序
      const affectedHosts = new Set<TreeNode>()

      devices.forEach((device) => {
        const hostNode = hostIpMap.get(device.host_ip || '')
        if (hostNode) {
          if (!hostNode.children) hostNode.children = []
          const newNode: TreeNode = {
            id: device.id,
            type: 'device',
            originalData: device,
            parent: hostNode
          }
          hostNode.children.push(newNode)
          hasChanges = true
          const reactiveNode = hostNode.children[hostNode.children.length - 1]
          nodeMap.set(device.id, reactiveNode)

          affectedHosts.add(hostNode)
        }
      })

      // 对受影响的主机节点下的设备重新排序
      affectedHosts.forEach((hostNode) => {
        if (hostNode.children) {
          sortDeviceNodes(hostNode.children)
        }
      })

      if (hasChanges) {
        treeData.value = [...treeData.value]
        await refreshView()
      }
    })

    sub(DATA_EVENTS.DEVICE_UPDATED, async (devices: Device[]) => {
      // 收集受影响的父节点（主机），用于重新排序
      const affectedHosts = new Set<TreeNode>()

      devices.forEach((device) => {
        // 优先使用 id，这是树节点的唯一标识
        const key = device.id || device.db_id || ''
        const node = nodeMap.get(key)
        if (node && node.originalData) {
          const oldName = (node.originalData as Device).user_name

          // 仅更新数据属性，保持节点对象引用不变，Vue 会自动响应
          Object.assign(node.originalData, device)

          const newName = (node.originalData as Device).user_name

          // 如果节点有父节点，且名称发生了变化，记录下来以便重新排序
          if (node.parent && oldName !== newName) {
            affectedHosts.add(node.parent)
          }
        }
      })

      // 对受影响的主机节点下的设备重新排序
      affectedHosts.forEach((hostNode) => {
        if (hostNode.children) {
          sortDeviceNodes(hostNode.children)
        }
      })

      await refreshView() // 状态变更可能导致节点显示/隐藏（如"运行中"筛选）
    })

    sub(DATA_EVENTS.DEVICE_DELETED, (devices: Device[]) => {
      let hasChanges = false
      devices.forEach((device) => {
        const key = device.id || device.db_id || ''
        deleteNode(key)
        hasChanges = true
      })
      if (hasChanges) {
        treeData.value = [...treeData.value]
        // 确保 Vue 更新了 treeData 后再通知外部重新计算选中状态
        nextTick(() => {
          onDataChanged?.()
        })
      }
    })

    return () => unsubs.forEach((u) => u())
  }
  let removeListener: () => void

  onMounted(async () => {
    await loadTree()
    removeListener = listenerDataUpdated()
  })
  onUnmounted(() => removeListener())

  return {
    treeRef,
    treeData,
    displayTreeData,
    searchText,
    isTreeDataLoaded,
    expandedKeys,
    nodeMap,
    hostIpMap,
    loadTree,
    onQueryChanged,
    filterMethod,
    getNodeStatusClass,
    formatTreeLabel,
    deleteNode // Exported for useCloudSelection if needed for cleanup
  }
}
