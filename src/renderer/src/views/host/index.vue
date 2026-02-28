<template>
  <div class="host-manage-container">
    <!-- 查询表单 -->
    <div class="search-form-container">
      <el-form
        ref="searchFormRef"
        :model="searchForm"
        inline
        class="search-form"
        @submit.prevent
        @keyup.enter="handleSearch"
      >
        <el-form-item :label="t('host.hostIdIp')" prop="keyword" class="form-item">
          <el-input
            v-model.trim="searchForm.keyword"
            :placeholder="t('host.hostIdIpPlaceholder')"
            clearable
            class="search-input"
          />
        </el-form-item>
        <el-form-item :label="t('host.hostStatus')" prop="status" class="form-item">
          <el-select
            v-model="searchForm.status"
            :placeholder="t('host.hostStatusPlaceholder')"
            clearable
            filterable
            class="search-select"
          >
            <el-option :label="t('common.online')" value="online" />
            <el-option :label="t('common.offline')" value="offline" />
          </el-select>
        </el-form-item>
        <el-form-item class="form-item-actions">
          <el-button type="primary" @click="handleSearch">
            <el-icon class="el-icon--left"><Search /></el-icon>
            {{ t('host.query') }}
          </el-button>
          <el-button @click="handleReset">
            <el-icon class="el-icon--left"><Refresh /></el-icon>
            {{ t('common.reset') }}
          </el-button>
          <el-button @click="handleUpdate('kernel')">
            <svg-icon name="kernel" />&nbsp; {{ t('host.upgradeKernel') }}
          </el-button>
          <el-button @click="handleUpdate('cbs')" style="margin-right: 10px">
            <svg-icon name="cbs" />&nbsp; {{ t('host.upgradeCbs') }}
          </el-button>
          <el-dropdown @command="handleBatchOperation">
            <el-button>
              <el-icon class="el-icon--left"><Operation /></el-icon>
              {{ t('host.batchOperation') }}
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="restart">{{ t('host.restart') }}</el-dropdown-item>
                <el-dropdown-item command="reset">{{ t('host.resetHost') }}</el-dropdown-item>
                <el-dropdown-item command="clean-image">{{
                  t('host.cleanImage')
                }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-form-item>
      </el-form>
    </div>

    <!-- 主机列表表格 -->
    <div class="table-container" v-loading="loading">
      <VmosTable
        :data="hostList"
        :columns="columns"
        :selectable="true"
        border
        :row-height="42"
        :header-height="45"
        @selection-change="handleSelectionChange"
      />
    </div>

    <!-- 主机详情对话框 -->
    <HostDetail ref="hostDetailRef" />
    <Update ref="updateRef" />
  </div>
</template>

<script setup lang="tsx">
defineOptions({ name: 'Host' })
import { ref, reactive, onMounted, onUnmounted, toRaw, computed } from 'vue'
import {
  Search,
  Operation,
  Refresh,
  RefreshRight,
  View,
  Delete,
  Document
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElForm, ElTag, ElButton, TableV2FixedDir } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS } from '@shared/ipc/data.types'
import type { Host } from '@shared/ipc/data.types'
import { formatTime } from '@renderer/utils/index'
import HostDetail from './components/detail.vue'
import { CopyText } from '@renderer/components'
import Update from './components/update.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const searchFormRef = ref<InstanceType<typeof ElForm>>()
const updateRef = ref<InstanceType<typeof Update>>()
const searchForm = reactive({
  keyword: '',
  status: '' as 'online' | 'offline' | 'unknown' | ''
})
const loading = ref(false)
const hostList = ref<Host[]>([])
const selectedHosts = ref<Host[]>([])
const hostDetailRef = ref<InstanceType<typeof HostDetail>>()
let requestCounter = 0 // 请求计数器，用于确保只处理最后一次查询的结果

// 为每个主机维护一个简单的 loading 状态
// 格式: Map<hostId, boolean> - 只要主机有任何操作在进行，就是 true
const operationLoadingStates = ref<Map<string, boolean>>(new Map())

/**
 * 获取指定主机的 loading 状态（只要有任何操作在进行就返回 true）
 */
const getOperationLoading = (hostId: string): boolean => {
  return operationLoadingStates.value.get(hostId) ?? false
}

/**
 * 设置指定主机的 loading 状态
 */
const setOperationLoading = (hostId: string, loading: boolean) => {
  if (loading) {
    operationLoadingStates.value.set(hostId, true)
  } else {
    operationLoadingStates.value.delete(hostId)
  }
}

/**
 * 批量升级CBS
 */
const handleUpdate = (type: 'cbs' | 'kernel') => {
  // 在线的主机
  const onlineHosts = selectedHosts.value.filter((host) => host.status === 'online')
  if (onlineHosts.length === 0) {
    ElMessage.warning(
      t('host.selectOnlineHosts', { type: type === 'cbs' ? 'CBS' : t('host.upgradeKernel') })
    )
    return
  }
  updateRef.value?.init(onlineHosts, type)
}

// ==========================================
// 工具函数
// ==========================================

// 表格列定义
const columns = computed(() => [
  {
    key: 'id',
    dataKey: 'id',
    title: t('host.columnHostId'),
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'ip',
    dataKey: 'ip',
    title: t('host.columnHostIp'),
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => (
      <div style="display: flex; align-items: center; gap: 8px;">
        <CopyText text={cellData} />
      </div>
    )
  },
  {
    key: 'status',
    dataKey: 'status',
    title: t('host.columnStatus'),
    width: 80,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => {
      const statusMap = {
        online: { text: t('common.online'), type: 'success' },
        offline: { text: t('common.offline'), type: 'danger' }
      }
      const status = statusMap[cellData as keyof typeof statusMap]
      return <ElTag type={status.type}>{status.text}</ElTag>
    }
  },
  {
    key: 'deviceCount',
    dataKey: 'deviceCount',
    title: t('host.columnInstanceCount'),
    width: 100,
    flexGrow: 1,
    align: 'center' as const
  },
  {
    key: 'lastActiveTime',
    dataKey: 'lastActiveTime',
    title: t('host.columnUpdateTime'),
    width: 180,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => {
      return <span style="color: var(--el-text-color-regular);">{formatTime(cellData)}</span>
    }
  },
  {
    key: 'action',
    title: t('host.columnAction'),
    fixed: TableV2FixedDir.RIGHT,
    align: 'left' as const,
    width: 520,
    flexGrow: 1,
    cellRenderer: ({ rowData }) => {
      return (
        <div style="display: flex; gap: 8px; justify-content: center;">
          <ElButton
            type="primary"
            size="small"
            icon={View}
            disabled={rowData.status === 'offline'}
            link
            onClick={() => handleDetail(rowData)}
          >
            {t('common.detail')}
          </ElButton>
          <ElButton
            type="primary"
            size="small"
            link
            icon={Document}
            onClick={() => handleOpenHostApi(rowData.ip)}
          >
            {t('host.apiDoc')}
          </ElButton>
          <ElButton
            type="warning"
            size="small"
            loading={getOperationLoading(rowData.id)}
            icon={RefreshRight}
            disabled={rowData.status === 'offline'}
            link
            onClick={() => handleRestart(rowData)}
          >
            {t('host.restart')}
          </ElButton>
          <ElButton
            type="warning"
            loading={getOperationLoading(rowData.id)}
            size="small"
            icon={Refresh}
            disabled={rowData.status === 'offline'}
            link
            onClick={() => handleResetHost(rowData)}
          >
            {t('host.resetHost')}
          </ElButton>
          <ElButton
            type="danger"
            loading={getOperationLoading(rowData.id)}
            size="small"
            disabled={rowData.status === 'offline'}
            icon={Delete}
            link
            onClick={() => handleCleanImage(rowData)}
          >
            {t('host.cleanImage')}
          </ElButton>
          {rowData.status === 'offline' && (
            <ElButton
              type="danger"
              size="small"
              loading={getOperationLoading(rowData.id)}
              disabled={getOperationLoading(rowData.id)}
              icon={Delete}
              link
              onClick={() => handleDeleteHost(rowData)}
            >
              {t('common.delete')}
            </ElButton>
          )}
        </div>
      )
    }
  }
])

// ==========================================
// 方法
// ==========================================

/**
 * 打开主机API详情
 */
const handleOpenHostApi = (ip: string) => {
  ipc.invoke(DATA_EVENTS.HOST_OPEN_API_DETAIL, [{ host_ip: ip }])
}

/**
 * 加载主机列表
 * 使用请求计数器确保只处理最后一次查询的结果
 *
 * 逻辑说明：
 * 1. 每次调用时递增 requestCounter，并保存当前请求编号
 * 2. 当响应返回时，检查当前请求编号是否等于最新的 requestCounter
 * 3. 如果不相等，说明有新的请求已发出，忽略这个旧的结果
 * 4. 如果相等，说明这是最后一次请求，处理结果并更新 UI
 */
const loadHosts = async () => {
  // 递增请求计数器并保存当前请求编号
  const currentRequest = ++requestCounter

  // 设置 loading 状态（如果这是最新的请求）
  if (currentRequest === requestCounter) {
    loading.value = true
  }

  try {
    const res = await ipc.invoke<Host & { deviceCount: number }[]>(
      DATA_EVENTS.SEARCH_HOSTS_BY_IDENTIFIER_AND_STATUS_WITH_DEVICE_COUNT,
      {
        keyword: searchForm.keyword,
        status: searchForm.status
      }
    )

    // 只处理最后一次请求的结果
    // 如果 currentRequest !== requestCounter，说明有新的请求已经发出，忽略这个旧的结果
    if (currentRequest !== requestCounter) {
      console.log(
        `[Host] loadHosts: ignore old request result, currentRequest=${currentRequest}, requestCounter=${requestCounter}`
      )
      return // 忽略旧的请求结果
    }

    // 这是最后一次请求，处理结果
    if (res.success && res.data) {
      hostList.value = res.data as unknown as Host[]
    } else {
      ElMessage.error(res.error || t('host.loadFailed'))
      hostList.value = []
    }
  } catch (error: any) {
    // 只处理最后一次请求的错误
    // 如果 currentRequest !== requestCounter，说明有新的请求已经发出，忽略这个旧的错误
    if (currentRequest !== requestCounter) {
      return // 忽略旧的请求错误
    }

    // 这是最后一次请求，处理错误
    ElMessage.error(error?.message || t('host.loadFailed'))
    hostList.value = []
  } finally {
    // 只有当前请求是最后一次时才更新 loading 状态
    // 这样可以确保当所有请求都完成时，loading 状态正确更新
    if (currentRequest === requestCounter) {
      loading.value = false
    }
  }
}

/**
 * 查询
 */
const handleSearch = () => {
  loadHosts()
}

/**
 * 重置查询条件
 */
const handleReset = () => {
  searchFormRef.value?.resetFields()
  loadHosts()
}

/**
 * 选择变化
 */
const handleSelectionChange = (selection: Host[]) => {
  selectedHosts.value = selection
}

/**
 * 批量操作
 */
const handleBatchOperation = async (command: string) => {
  // 选中的主机
  const selected = selectedHosts.value

  // 正在执行操作的主机
  const loadingHosts = selected.filter((host) => getOperationLoading(host.id))

  // 可操作的在线主机
  const onlineHosts = selected.filter(
    (host) => host.status === 'online' && !getOperationLoading(host.id)
  )

  // 没有可操作主机
  if (!onlineHosts.length) {
    if (loadingHosts.length > 0) {
      ElMessage.warning(t('host.selectOperatingHosts', { count: loadingHosts.length }))
    } else {
      ElMessage.warning(t('host.selectOnlineHostsToOperate'))
    }
    return
  }

  // 批量上限校验
  if (onlineHosts.length > 50) {
    ElMessage.warning(t('host.maxBatchOperation'))
    return
  }

  // 有部分被排除时，给一次合并提示
  if (loadingHosts.length) {
    ElMessage.warning(
      t('host.excludedOperatingHosts', {
        excludedCount: loadingHosts.length,
        remainingCount: onlineHosts.length
      })
    )
  }

  // 根据command 映射 IPC 事件
  const ipcEventMap: Record<string, string> = {
    restart: DATA_EVENTS.RESTART_HOST,
    reset: DATA_EVENTS.RESET_HOST,
    'clean-image': DATA_EVENTS.CLEAN_HOST_IMAGE
  }

  // 映射操作名称
  const operationNameMap: Record<string, string> = {
    restart: t('host.restart'),
    reset: t('host.resetHost'),
    'clean-image': t('host.cleanImage')
  }

  try {
    await ElMessageBox.confirm(
      t('host.confirmOperation', {
        operation: operationNameMap[command],
        count: onlineHosts.length
      }),
      t('common.tips'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )

    // 为每个主机设置 loading 状态
    onlineHosts.forEach((host) => {
      setOperationLoading(host.id, true)
    })

    const promiseList = onlineHosts.map((host) => {
      return ipc.invoke(ipcEventMap[command], toRaw(host))
    })

    // 并发执行
    const res = await Promise.allSettled(promiseList)
    const { successCount, errorCount } = res.reduce(
      (acc, item) => {
        if (item.status === 'fulfilled' && (item.value as any).success) {
          acc.successCount++
        } else {
          acc.errorCount++
        }
        return acc
      },
      { successCount: 0, errorCount: 0 }
    )
    ElMessage.success(
      t('host.operationSent', {
        operation: operationNameMap[command],
        success: successCount,
        fail: errorCount
      })
    )
    loadHosts()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  } finally {
    // 清除所有主机的 loading 状态
    onlineHosts.forEach((host) => {
      setOperationLoading(host.id, false)
    })
  }
}

/**
 * 删除主机
 */
const handleDeleteHost = async (row: Host) => {
  await ElMessageBox.confirm(
    t('host.deleteHostConfirm', { ip: row.ip }),
    t('host.operationConfirm'),
    {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  )
  if (getOperationLoading(row.id)) {
    return
  }
  setOperationLoading(row.id, true)
  try {
    const res = await ipc.invoke(DATA_EVENTS.HOST_DELETED, toRaw(row))
    if (res.success) {
      ElMessage.success(t('common.operationSuccess'))
      loadHosts()
    } else {
      ElMessage.error(res.error || t('host.deleteFailed'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || t('common.operationFailed'))
    }
  } finally {
    setOperationLoading(row.id, false)
  }
}

/**
 * 查看详情
 */
const handleDetail = (row: Host) => {
  hostDetailRef.value?.init(row)
}

/**
 * 重启主机
 */
const handleRestart = async (row: Host) => {
  if (getOperationLoading(row.id)) {
    return
  }
  await ElMessageBox.confirm(t('host.restartHostConfirm', { ip: row.ip }), t('common.tips'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  })
  setOperationLoading(row.id, true)
  try {
    const res = await ipc.invoke(DATA_EVENTS.RESTART_HOST, toRaw(row))
    if (res.success) {
      ElMessage.success(t('host.restartSent'))
      loadHosts()
    } else {
      ElMessage.error(res.error || t('common.operationFailed'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || t('common.operationFailed'))
    }
  } finally {
    setOperationLoading(row.id, false)
  }
}

/**
 * 重置主机
 */
const handleResetHost = async (row: Host) => {
  if (getOperationLoading(row.id)) {
    return
  }
  await ElMessageBox.confirm(t('host.resetHostConfirm', { ip: row.ip }), t('common.tips'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  })
  setOperationLoading(row.id, true)
  try {
    const res = await ipc.invoke(DATA_EVENTS.RESET_HOST, toRaw(row))
    if (res.success) {
      ElMessage.success(t('host.resetSent'))
      loadHosts()
    } else {
      ElMessage.error(res.error || t('common.operationFailed'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || t('common.operationFailed'))
    }
  } finally {
    setOperationLoading(row.id, false)
  }
}

/**
 * 清理镜像
 */
const handleCleanImage = async (row: Host) => {
  if (getOperationLoading(row.id)) {
    return
  }
  await ElMessageBox.confirm(t('host.cleanImageConfirm', { ip: row.ip }), t('common.tips'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning'
  })
  setOperationLoading(row.id, true)
  try {
    const res = await ipc.invoke(DATA_EVENTS.CLEAN_HOST_IMAGE, toRaw(row))
    if (res.success) {
      ElMessage.success(t('host.cleanImageSent'))
    } else {
      ElMessage.error(res.error || t('common.operationFailed'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || t('common.operationFailed'))
    }
  } finally {
    setOperationLoading(row.id, false)
  }
}
let refreshTimer: NodeJS.Timeout

onMounted(async () => {
  await loadHosts()

  // 定时器 5秒刷一次
  refreshTimer = setInterval(() => {
    loadHosts()
  }, 5000)
})

onUnmounted(() => {
  clearInterval(refreshTimer)
})
</script>

<style scoped lang="scss">
.host-manage-container {
  height: 100%;
  padding: 20px;
  background-color: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.search-form-container {
  background: var(--el-bg-color);
  padding: 16px 20px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color);
  flex-shrink: 0;

  .search-form {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 16px;

    .form-item {
      margin-bottom: 0;
      margin-right: 0;

      :deep(.el-form-item__label) {
        font-weight: normal;
        color: var(--el-text-color-regular);
        font-size: 14px;
        padding-right: 8px;
        width: auto;
      }

      :deep(.el-form-item__content) {
        margin-left: 0 !important;
      }
    }

    .form-item-actions {
      margin-left: auto;
      margin-bottom: 0;
      margin-right: 0;

      :deep(.el-form-item__content) {
        margin-left: 0 !important;
        display: flex;
        gap: 8px;
      }
    }

    .search-input {
      width: 200px;
    }

    .search-select {
      width: 200px;
    }

    :deep(.el-button) {
      padding: 8px 16px;
      font-size: 14px;
    }
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
