import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
// import { useI18n } from 'vue-i18n'
import { debounce } from 'lodash-es'
import { ipc } from '@renderer/core/ipc'
import store from 'store'
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
  // const { t } = useI18n()
  const treeRef = ref()
  const treeData = ref<TreeNode[]>([])
  const isTreeDataLoaded = ref(false)
  const expandedKeys = ref<string[]>([])
  const searchText = ref('')
  const groupingMode = ref<'host' | 'device'>(store.get('groupingMode') || 'host')

  watch(
    () => groupingMode.value,
    (newVal) => {
      store.set('groupingMode', newVal)
    }
  )

  // 使用 Map 替代递归查找 (O(1) 访问)
  // nodeMap: 存储所有节点的引用 (GroupId -> Node, HostId -> Node, DeviceId -> Node)
  const nodeMap = new Map<string, TreeNode>()
  // hostIpMap: 存储 Host IP 到 Host 节点的映射，用于设备上报 IP 时快速找到父节点
  const hostIpMap = new Map<string, TreeNode>()
  // hostIdMap: 存储 Host ID 到 Host 节点的映射
  const hostIdMap = new Map<string, TreeNode>()
  // allHostsMap: 存储所有 Host 数据，用于 device 模式下查找 Group
  const allHostsMap = new Map<string, Host>()

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
      group: () => {
        const group = node.originalData as Group
        // if (group.id === 'default' || group.id === 'device_default') {
        //   return t('cloudPhone.defaultGroup')
        // }
        return group.name || ''
      },
      host: () => (node.originalData as Host).ip || '',
      device: () => (node.originalData as Device).user_name || ''
    }
    return labelMapp[node.type as keyof typeof labelMapp]()
  }

  // 搜索与筛选
  const onQueryChanged = (query: string) => {
    treeRef.value?.filter?.(query)
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
      if (node.type === 'host') {
        const host = node.originalData as Host
        // 建立双重索引
        if (host.id) hostIdMap.set(host.id, node)
        if (host.ip) hostIpMap.set(host.ip, node)
      }
      if (node.children && node.children.length > 0) {
        rebuildMaps(node.children)
      }
    }
  }

  /**
   * 辅助函数：对节点列表按IP排序 (仅处理 Host 节点)
   * 优化说明：
   * 1. 预处理 IP 为数字元组，避免每次比较都 parse
   * 2. 缓存转换结果，O(N) 转换 + O(N log N) 排序
   */
  const sortHostNodes = (nodes: TreeNode[]) => {
    // 如果节点数少于 50，直接用 localeCompare 即可，无需优化
    if (nodes.length < 50) {
      nodes.sort((a, b) => {
        if (a.type === 'host' && b.type === 'host') {
          const ipA = (a.originalData as Host).ip || ''
          const ipB = (b.originalData as Host).ip || ''
          return ipA.localeCompare(ipB, undefined, { numeric: true, sensitivity: 'base' })
        }
        return 0
      })
      return
    }

    // 大数据量排序优化
    const ipCache = new Map<string, number[]>()

    // IP 转数字数组辅助函数 (缓存版)
    const getIpParts = (ip: string): number[] => {
      if (ipCache.has(ip)) return ipCache.get(ip)!
      const parts = ip.split('.').map((p) => parseInt(p, 10) || 0)
      // 补齐 4 位，非标准 IP 也尽量处理
      while (parts.length < 4) parts.push(0)
      ipCache.set(ip, parts)
      return parts
    }

    nodes.sort((a, b) => {
      if (a.type !== 'host' || b.type !== 'host') return 0

      const ipA = (a.originalData as Host).ip || ''
      const ipB = (b.originalData as Host).ip || ''

      const partsA = getIpParts(ipA)
      const partsB = getIpParts(ipB)

      for (let i = 0; i < 4; i++) {
        if (partsA[i] !== partsB[i]) {
          return partsA[i] - partsB[i]
        }
      }
      return 0
    })
  }

  /**
   * 辅助函数：对节点列表按名称排序 (仅处理 Device 节点)
   */
  // 使用统一的排序规则
  const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

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
   * 按主机分组构建树 (Group -> Host -> Device)
   */
  const buildHostTree = (flatData: FlatData): TreeNode[] => {
    const { groups, hosts, devices } = flatData

    // 过滤出主机分组 (type 为空或 host)
    const hostGroups = groups.filter((g) => !g.type || g.type === 'host')
    const hostGroupIds = new Set(hostGroups.map((g) => g.id))

    // 1. 按 GroupId 分组 Host
    const hostsByGroup = new Map<string, Host[]>()

    hosts.forEach((host) => {
      const groupId = host.groupId || 'default'
      if (hostGroupIds.has(groupId)) {
        if (!hostsByGroup.has(groupId)) {
          hostsByGroup.set(groupId, [])
        }
        hostsByGroup.get(groupId)!.push(host)
      }
    })

    // 2. 按 HostIp/HostId 分组 Device
    const devicesByHostId = new Map<string, Device[]>()
    const devicesByHostIp = new Map<string, Device[]>()

    devices.forEach((device) => {
      // 优先使用 hostId
      if (device.hostId) {
        if (!devicesByHostId.has(device.hostId)) {
          devicesByHostId.set(device.hostId, [])
        }
        devicesByHostId.get(device.hostId)!.push(device)
        return
      }

      // 降级使用 host_ip
      const hostIp = device.host_ip || ''
      if (!hostIp) return
      if (!devicesByHostIp.has(hostIp)) {
        devicesByHostIp.set(hostIp, [])
      }
      devicesByHostIp.get(hostIp)!.push(device)
    })

    // 3. 递归构建树
    const nodes = hostGroups.map((group) => {
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

        // 合并 ID 匹配和 IP 匹配的设备
        const byId = devicesByHostId.get(host.id) || []
        const byIp = devicesByHostIp.get(host.ip || '') || []
        const hostDevices = [...byId, ...byIp]

        const deviceNodes: TreeNode[] = hostDevices.map((device) => {
          return {
            id: device.id,
            type: 'device',
            originalData: device,
            parent: hostNode
          }
        })

        sortDeviceNodes(deviceNodes)

        hostNode.children = deviceNodes
        return hostNode
      })

      // 对 Host 节点进行排序
      sortHostNodes(hostNodes)

      groupNode.children = hostNodes
      return groupNode
    })

    return nodes
  }

  /**
   * 按设备分组构建树 (Group -> Device)
   * 忽略 Host 层级，直接将设备展示在分组下
   */
  const buildDeviceTree = (flatData: FlatData): TreeNode[] => {
    const { groups, devices, hosts } = flatData

    // 0. 准备主机查找表 (用于过滤孤儿设备)
    const validHostIds = new Set(hosts.map((h) => h.id))
    const validHostIps = new Set(hosts.map((h) => h.ip).filter((ip) => !!ip))

    // 1. 过滤出设备分组 (type === 'device')
    const deviceGroups = groups.filter((g) => g.type === 'device')
    const deviceGroupIds = new Set(deviceGroups.map((g) => g.id))

    // 2. 按 GroupId 分组 Device
    const devicesByGroup = new Map<string, Device[]>()
    const defaultGroupId = 'device_default'

    devices.forEach((device) => {
      // 过滤逻辑：如果设备离线 且 找不到对应主机，则视为脏数据隐藏
      if (device.state === DeviceState.StateOffline) {
        const hasValidHost =
          (device.hostId && validHostIds.has(device.hostId)) ||
          (device.host_ip && validHostIps.has(device.host_ip))

        if (!hasValidHost) {
          return
        }
      }

      // 优先使用设备分组ID，若为空则归入默认设备分组
      const groupId = device.groupId || defaultGroupId

      if (deviceGroupIds.has(groupId)) {
        if (!devicesByGroup.has(groupId)) {
          devicesByGroup.set(groupId, [])
        }
        devicesByGroup.get(groupId)!.push(device)
      }
    })

    // 3. 构建树
    const nodes = deviceGroups.map((group) => {
      const groupNode: TreeNode = {
        id: group.id,
        type: 'group' as const,
        originalData: group,
        children: []
      }

      const groupDevices = devicesByGroup.get(group.id) || []

      const deviceNodes: TreeNode[] = groupDevices.map((device) => {
        return {
          id: device.id,
          type: 'device',
          originalData: device,
          parent: groupNode
        }
      })

      sortDeviceNodes(deviceNodes)
      groupNode.children = deviceNodes
      return groupNode
    })

    return nodes
  }

  /**
   * 将后端扁平数据转换为树形结构
   */
  const buildTreeFromFlatData = (flatData: FlatData): TreeNode[] => {
    if (groupingMode.value === 'device') {
      return buildDeviceTree(flatData)
    }
    return buildHostTree(flatData)
  }

  /**
   * 初始化加载全量数据
   */
  const loadTree = async () => {
    try {
      const res = await ipc.invoke(DATA_EVENTS.GET_FLAT_DATA)
      if (res.success && res.data) {
        const flatData = res.data as FlatData

        // 缓存所有 Host 数据，用于 device 模式查找
        allHostsMap.clear()
        flatData.hosts.forEach((host) => {
          if (host.ip) allHostsMap.set(host.ip, host)
        })

        const newTreeData = buildTreeFromFlatData(flatData)
        treeData.value = newTreeData

        // 重建映射表
        nodeMap.clear()
        hostIpMap.clear()
        hostIdMap.clear()
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
        if (n.type === 'host') {
          const host = n.originalData as Host
          if (host.ip) hostIpMap.delete(host.ip)
          if (host.id) hostIdMap.delete(host.id)
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
      // 更新缓存
      if (host.ip) allHostsMap.set(host.ip, host)

      if (groupingMode.value === 'device') {
        // device 模式下，主机新增可能不直接影响树（除非有设备关联），但为了一致性，或者如果设备随后到来
        // 这里暂时不刷新，因为没有设备。等到 DEVICE_ADDED 时会查找 allHostsMap
        return
      }

      // 防重检查：如果节点已存在，则转为更新操作
      if (nodeMap.has(host.id)) {
        const existingNode = nodeMap.get(host.id)
        if (existingNode && existingNode.originalData) {
          const oldIp = (existingNode.originalData as Host).ip
          if (oldIp && host.ip && oldIp !== host.ip) {
            hostIpMap.delete(oldIp)
          }
          Object.assign(existingNode.originalData, host)
          if (host.ip) hostIpMap.set(host.ip, existingNode)
        }
        return
      }

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
        if (host.id) hostIdMap.set(host.id, reactiveNode)
      } else {
        loadTree()
      }
    })

    sub(DATA_EVENTS.HOST_UPDATED, async (host: Host) => {
      if (host.ip) allHostsMap.set(host.ip, host)

      if (groupingMode.value === 'device') return

      const node = nodeMap.get(host.id)
      if (node && node.originalData) {
        const oldHostData = node.originalData as Host
        const oldGroupId = oldHostData.groupId
        const newGroupId = host.groupId

        // 清理旧 IP 缓存，防止 IP 变更后旧 IP 仍指向该节点
        const oldIp = oldHostData.ip
        if (oldIp && host.ip && oldIp !== host.ip) {
          hostIpMap.delete(oldIp)
        }

        Object.assign(node.originalData, host)
        if (host.ip) hostIpMap.set(host.ip, node)
        if (host.id) hostIdMap.set(host.id, node)

        // 检查分组是否变更
        if (newGroupId && oldGroupId !== newGroupId) {
          const oldParent = node.parent
          const newParent = nodeMap.get(newGroupId)

          if (newParent) {
            // 1. 从旧父节点移除
            if (oldParent && oldParent.children) {
              const idx = oldParent.children.indexOf(node)
              if (idx > -1) {
                oldParent.children.splice(idx, 1)
              }
            }

            // 2. 添加到新父节点
            if (!newParent.children) newParent.children = []
            newParent.children.push(node)
            node.parent = newParent

            // 3. 对新分组下的主机重新排序
            sortHostNodes(newParent.children)

            // 4. 触发视图更新
            treeData.value = [...treeData.value]
            await refreshView()
          } else {
            // 如果找不到新分组（极少见），重新加载整棵树
            await loadTree()
          }
        }
      }
    })

    sub(DATA_EVENTS.HOST_DELETED, ({ id }) => {
      // Cleanup cache? Hard to find IP by ID without iterating or secondary map.
      // Ignore cleanup for now, or rebuild map on loadTree.

      if (groupingMode.value === 'device') {
        loadTree()
        return
      }

      deleteNode(id)
      treeData.value = [...treeData.value]
    })

    // 批量移动主机
    sub(
      DATA_EVENTS.HOSTS_MOVED,
      async ({ hostIds, groupId }: { hostIds: string[]; groupId: string }) => {
        if (groupingMode.value === 'device') {
          loadTree()
          return
        }

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

    // 批量移动云机
    sub(
      DATA_EVENTS.DEVICES_MOVED,
      async ({ deviceIds, groupId }: { deviceIds: string[]; groupId: string }) => {
        // 仅在设备模式下处理
        if (groupingMode.value !== 'device') return

        const newGroupNode = nodeMap.get(groupId)
        if (!newGroupNode) {
          loadTree()
          return
        }

        let changed = false
        const movedNodes: TreeNode[] = []

        deviceIds.forEach((deviceId) => {
          const node = nodeMap.get(deviceId)
          if (node && node.parent && node.parent.children) {
            const idx = node.parent.children.indexOf(node)
            if (idx !== -1) {
              node.parent.children.splice(idx, 1)
              if (node.originalData) (node.originalData as Device).groupId = groupId
              node.parent = newGroupNode
              newGroupNode.children = newGroupNode.children || []
              newGroupNode.children.push(node)
              changed = true
              movedNodes.push(node)
            }
          }
        })

        if (changed) {
          // 处理选中状态继承
          const tree = treeRef.value
          if (tree) {
            const checkedKeys = tree.getCheckedKeys() || []
            if (checkedKeys.includes(groupId)) {
              const idsToSelect: string[] = []
              movedNodes.forEach((n) => idsToSelect.push(n.id))
              const newCheckedKeys = Array.from(new Set([...checkedKeys, ...idsToSelect]))
              tree.setCheckedKeys(newCheckedKeys)
            }
          }

          if (newGroupNode.children) {
            sortDeviceNodes(newGroupNode.children)
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
      if (groupingMode.value === 'device') {
        loadTree()
        return
      }

      let hasChanges = false
      // 使用 Set 收集受影响的主机节点，避免重复排序
      const affectedHosts = new Set<TreeNode>()

      devices.forEach((device) => {
        // 防重检查：如果设备节点已存在，则转为更新
        if (nodeMap.has(device.id)) {
          const existingNode = nodeMap.get(device.id)
          if (existingNode && existingNode.originalData) {
            // 更新数据
            Object.assign(existingNode.originalData, device)

            // 检查父节点是否变更（迁移）- 暂不处理复杂的迁移逻辑，因为通常会有 MOVED 事件
            // 这里主要关注属性更新

            // 收集受影响的父节点以便重排序（如果名字变了）
            if (existingNode.parent) {
              affectedHosts.add(existingNode.parent)
            }
          }
          return // 跳过新增逻辑
        }

        // 优先尝试通过 hostId 查找主机节点
        let hostNode: TreeNode | undefined
        if (device.hostId) {
          hostNode = hostIdMap.get(device.hostId)
        }
        // 降级：如果没找到或没有 hostId，尝试通过 ip 查找
        if (!hostNode && device.host_ip) {
          hostNode = hostIpMap.get(device.host_ip)
        }

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

      if (hasChanges || affectedHosts.size > 0) {
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

      if (affectedHosts.size > 0) {
        await refreshView() // 名称变更时才需要重新过滤（filterMethod 只匹配名称）
      } else {
        onDataChanged?.() // 仅状态变更，直接通知外部同步，不重新过滤避免树节点被强制展开
      }
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

  /**
   * 获取节点筛选后的子节点数量
   * 无搜索文本时返回全部子节点数，有搜索文本时返回匹配筛选条件的子节点数
   */
  const getFilteredChildCount = (node: TreeNode): number => {
    if (!node.children || node.children.length === 0) return 0
    if (!searchText.value) return node.children.length

    const query = searchText.value.toLowerCase()
    return node.children.filter((child) => {
      // 子节点自身匹配
      if (formatTreeLabel(child).toLowerCase().includes(query)) return true
      // 子节点的后代匹配（如 host 下有匹配的 device）
      if (child.children && child.children.length > 0) {
        return child.children.some((grandChild) =>
          formatTreeLabel(grandChild).toLowerCase().includes(query)
        )
      }
      return false
    }).length
  }

  /**
   * 获取指定 Host IP 下运行中的云机数量
   */
  const getRunningCountByHostIp = (ip: string): number => {
    // 1. Host 模式：直接从树节点统计 (性能最优)
    if (groupingMode.value === 'host') {
      const hostNode = hostIpMap.get(ip)
      if (!hostNode || !hostNode.children) return 0
      return hostNode.children.filter((childNode) => {
        const device = childNode.originalData as Device
        return device.state !== DeviceState.StateStopped && device.state !== DeviceState.StateFailed
      }).length
    }

    // 2. Device 模式：遍历所有节点统计
    // 由于 nodeMap 包含所有当前展示的节点，直接遍历即可
    let count = 0
    for (const node of nodeMap.values()) {
      if (node.type === 'device') {
        const device = node.originalData as Device
        if (device.host_ip === ip) {
          if (
            device.state !== DeviceState.StateStopped &&
            device.state !== DeviceState.StateFailed &&
            device.state !== DeviceState.StateOffline
          ) {
            count++
          }
        }
      }
    }
    return count
  }

  return {
    treeRef,
    treeData,
    displayTreeData,
    searchText,
    isTreeDataLoaded,
    expandedKeys,
    nodeMap,
    hostIpMap,
    hostIdMap,
    allHostsMap,
    loadTree,
    onQueryChanged,
    filterMethod,
    getNodeStatusClass,
    formatTreeLabel,
    deleteNode, // Exported for useCloudSelection if needed for cleanup
    groupingMode,
    setGroupingMode: async (mode: 'host' | 'device') => {
      if (groupingMode.value !== mode) {
        groupingMode.value = mode

        // 切换模式时：取消订阅 -> 重载数据 -> 重新订阅
        // 保证数据监听逻辑与当前视图模式完全匹配，避免干扰
        if (removeListener) {
          removeListener()
        }

        treeData.value = [] // 清空当前视图

        await loadTree()

        removeListener = listenerDataUpdated()
      }
    },
    getRunningCountByHostIp,
    getFilteredChildCount
  }
}
