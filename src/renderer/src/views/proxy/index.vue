<template>
  <div class="proxy-manage-container">
    <!-- 查询表单 -->
    <div class="search-form-container" v-loading="loading">
      <el-form
        ref="searchFormRef"
        :model="searchForm"
        inline
        class="search-form"
        @submit.prevent
        @keyup.enter="handleSearch"
      >
        <el-form-item :label="t('proxy.name')" prop="name" class="form-item">
          <el-input
            v-model.trim="searchForm.name"
            :placeholder="t('proxy.namePlaceholder')"
            clearable
            class="search-input"
          />
        </el-form-item>
        <el-form-item :label="t('proxy.host')" prop="host" class="form-item">
          <el-input
            v-model.trim="searchForm.host"
            :placeholder="t('proxy.hostPlaceholder')"
            clearable
            class="search-input"
          />
        </el-form-item>
        <el-form-item class="form-item-actions">
          <el-button type="primary" :loading="loading" @click="handleSearch">
            <el-icon class="el-icon--left"><Search /></el-icon>
            {{ t('common.search') }}
          </el-button>
          <el-button :loading="loading" @click="handleReset">
            <el-icon class="el-icon--left"><Refresh /></el-icon>
            {{ t('common.reset') }}
          </el-button>

          <el-button type="primary" @click="triggerImport" plain>
            <el-icon class="el-icon--left"><Upload /></el-icon>
            {{ t('proxy.importProxy') }}
          </el-button>
          <el-button type="primary" @click="showAddDialog" plain>
            <el-icon class="el-icon--left"><Plus /></el-icon>
            {{ t('proxy.addProxy') }}
          </el-button>
          <el-button type="danger" plain :loading="deleteLoading" @click="handleBatchDelete">
            <el-icon class="el-icon--left"><Delete /></el-icon>
            {{ t('proxy.batchDelete') }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 代理列表表格 -->
    <div class="table-container">
      <VmosTable
        :data="filteredProxies"
        :columns="columns"
        class="proxy-table"
        border
        :row-height="95"
        :header-height="45"
        selectable
        row-key="id"
        @selection-change="handleSelectionChange"
      >
      </VmosTable>
    </div>

    <!-- 添加/编辑代理弹窗 -->
    <ProxyDialog ref="proxyDialogRef" @success="loadProxies" />
    <ImportProxyDialog ref="importDialogRef" @success="loadProxies" />
  </div>
</template>

<script setup lang="tsx">
defineOptions({ name: 'Proxy' })
import { ref, computed, reactive, onMounted } from 'vue'
import { Plus, Search, Refresh, Delete, Edit, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElForm, ElButton, ElTag, TableV2FixedDir } from 'element-plus'
import VmosTable from '@renderer/components/table/index.vue'
import ProxyDialog from './components/ProxyDialog.vue'
import ImportProxyDialog from './components/ImportProxyDialog.vue'
import { ipc } from '@renderer/core/ipc'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import type { Proxy } from '@shared/ipc/data.types'
import { formatTime } from '@shared/api'
import { CopyText } from '@renderer/components'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const loading = ref(false)
const proxyDialogRef = ref<InstanceType<typeof ProxyDialog>>()
const importDialogRef = ref<InstanceType<typeof ImportProxyDialog>>()
const searchFormRef = ref<InstanceType<typeof ElForm>>()
const searchForm = reactive({
  name: '',
  host: ''
})

const proxyList = ref<Proxy[]>([])
const selection = ref<Proxy[]>([])
const deleteLoading = ref(false)

// ==========================================
// 计算属性
// ==========================================

const filteredProxies = computed(() => {
  return proxyList.value
})

const columns = computed(() => [
  {
    key: 'name',
    dataKey: 'name',
    title: t('proxy.columnName'),
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'protocol',
    dataKey: 'protocol',
    title: t('proxy.columnProxyInfo'),
    width: 220,
    flexGrow: 1,
    cellRenderer: ({ cellData, rowData }) => {
      return (
        <div class="proxy-info">
          <span>{t('proxy.protocol')}: {cellData || '-'}</span>
          <span>
            {t('proxy.host')}: <CopyText text={rowData?.host} />
          </span>
          <span>{t('proxy.port')}: {rowData?.port || '-'}</span>
        </div>
      )
    }
  },
  {
    key: 'ip',
    dataKey: 'ip',
    title: t('proxy.columnExitInfo'),
    width: 200,
    flexGrow: 1,
    cellRenderer: ({ cellData, rowData }) => {
      return (
        <div class="proxy-info">
          <span>
            {t('proxy.ip')}: <CopyText text={cellData} />
          </span>
          <span>
            {t('proxy.country')}: <CopyText text={rowData?.country} />
          </span>
          <span>
            {t('proxy.timezone')}: <CopyText text={rowData?.timezone} />
          </span>
          <span>
            {t('proxy.loc')}: <CopyText text={rowData?.loc} />
          </span>
        </div>
      )
    }
  },
  {
    key: 'lastCheckStatus',
    dataKey: 'lastCheckStatus',
    title: t('proxy.columnLastCheckStatus'),
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) =>
      cellData ? (
        <ElTag effect="light" type={cellData === 'success' ? 'success' : 'danger'} round>
          {cellData === 'success' ? t('proxy.statusNormal') : t('proxy.statusAbnormal')}
        </ElTag>
      ) : (
        '-'
      )
  },
  {
    key: 'createTime',
    dataKey: 'createTime',
    title: t('proxy.columnCreateTime'),
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={formatTime(cellData as number)} />
  },
  {
    key: 'format',
    dataKey: 'format',
    title: t('proxy.columnFormat'),
    width: 380,
    flexGrow: 1,
    cellRenderer: ({ rowData }) => <CopyText text={formatProxy(rowData)} />
  },
  {
    key: 'action',
    title: t('proxy.columnAction'),
    width: 200,
    flexGrow: 1,
    fixed: TableV2FixedDir.RIGHT,
    align: 'center' as const,
    cellRenderer: ({ rowData }) => (
      <div style="display: flex; justify-content: center;">
        <ElButton type="primary" size="small" icon={Edit} plain onClick={() => handleEdit(rowData)}>
          {t('common.edit')}
        </ElButton>
        <ElButton
          type="danger"
          size="small"
          plain
          icon={Delete}
          onClick={() => handleDelete(rowData)}
        >
          {t('common.delete')}
        </ElButton>
      </div>
    )
  }
])

// ==========================================
// 方法
// ==========================================

const formatProxy = (proxy: Proxy) => {
  const auth = proxy.username ? `${proxy.username}:${proxy.password}@` : ''

  switch (proxy.protocol) {
    case 'http':
      return `http://${auth}${proxy.host}:${proxy.port}`
    case 'https':
      return `https://${auth}${proxy.host}:${proxy.port}`
    case 'socks5':
      return `socks5://${auth}${proxy.host}:${proxy.port}`
    case 'vmess':
    case 'ss':
    case 'ssr':
    case 'vless':
      return proxy.rawLink
    default:
      return `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`
  }
}
const showAddDialog = () => {
  proxyDialogRef.value?.init(null, 'add')
}

const handleEdit = (row: Proxy) => {
  proxyDialogRef.value?.init(row, 'edit')
}

const handleDelete = async (row: Proxy) => {
  try {
    await ElMessageBox.confirm(
      t('proxy.deleteConfirmMessage', { name: row.name }),
      t('proxy.deleteConfirm'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )

    const res = await ipc.invoke(PROXY_EVENTS.DELETE_PROXY, row.id)
    if (res.success) {
      ElMessage.success(t('common.deleteSuccess'))
      await loadProxies()
    } else {
      ElMessage.error(res.error || t('common.deleteFailed'))
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || t('common.deleteFailed'))
    }
  }
}

/**
 * 批量删除
 */
const handleBatchDelete = () => {
  if (!selection.value.length) return ElMessage.warning(t('proxy.batchDeleteSelectWarning'))

  if (deleteLoading.value) return

  return ElMessageBox.confirm(
    t('proxy.batchDeleteMessage', { count: selection.value.length }),
    t('proxy.batchDeleteConfirm'),
    {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      deleteLoading.value = true

      let successCount = 0
      let failCount = 0

      // 循环调用删除接口
      for (const item of selection.value) {
        try {
          const res = await ipc.invoke(PROXY_EVENTS.DELETE_PROXY, item.id)
          if (res.success) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }
      }

      if (failCount === 0) {
        ElMessage.success(t('proxy.batchDeleteSuccess', { count: successCount }))
      } else {
        ElMessage.warning(t('proxy.batchDeletePartial', { success: successCount, fail: failCount }))
      }

      selection.value = [] // 清空选择
      loadProxies()
    } finally {
      deleteLoading.value = false
    }
  })
}

const handleSelectionChange = (val: Proxy[]) => {
  selection.value = val
}

/**
 * 加载代理列表
 */
const loadProxies = async () => {
  loading.value = true
  try {
    const options: { name?: string; host?: string } = {}

    // 如果有搜索关键词，添加到查询条件
    if (searchForm.name.trim()) {
      options.name = searchForm.name.trim()
    }

    // 如果有IP地址过滤，添加到查询条件
    if (searchForm.host.trim()) {
      options.host = searchForm.host.trim()
    }

    const res = await ipc.invoke<Proxy[]>(PROXY_EVENTS.QUERY_PROXIES, options)
    if (res.success && res.data) {
      proxyList.value = res.data
    } else {
      ElMessage.error(res.error || t('common.loadFailed'))
      proxyList.value = []
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t('common.loadFailed'))
    proxyList.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 查询
 */
const handleSearch = () => {
  loadProxies()
}

/**
 * 重置查询条件
 */
const handleReset = () => {
  searchFormRef.value?.resetFields()
  loadProxies()
}

/**
 * 导入代理
 */
const triggerImport = () => {
  importDialogRef.value?.init()
}

onMounted(async () => {
  loadProxies()
})
</script>

<style scoped lang="scss">
.proxy-manage-container {
  height: 100%;
  padding: 20px;
  background-color: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.operation-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--el-bg-color);
  padding: 16px 20px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid var(--el-border-color);
  flex-shrink: 0;

  .action-buttons {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 4px;
  flex-shrink: 0;

  .list-title {
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);

    .el-icon {
      margin-right: 8px;
      color: var(--el-color-primary);
      font-size: 18px;
    }
  }
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
.proxy-table {
  :deep(.proxy-info) {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    min-width: 0;
    gap: 2px;
    color: var(--el-text-color-regular);
    span {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex-shrink: 0;
      .copy-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
        max-width: 100%;
        display: inline-block;
      }
    }
  }
}
</style>
