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
        <el-form-item label="名称" prop="name" class="form-item">
          <el-input
            v-model.trim="searchForm.name"
            placeholder="请输入名称"
            clearable
            class="search-input"
          />
        </el-form-item>
        <el-form-item label="地址" prop="host" class="form-item">
          <el-input
            v-model.trim="searchForm.host"
            placeholder="请输入地址"
            clearable
            class="search-input"
          />
        </el-form-item>
        <el-form-item class="form-item-actions">
          <el-button type="primary" :loading="loading" @click="handleSearch">
            <el-icon class="el-icon--left"><Search /></el-icon>
            查询
          </el-button>
          <el-button :loading="loading" @click="handleReset">
            <el-icon class="el-icon--left"><Refresh /></el-icon>
            重置
          </el-button>
          <el-button type="primary" @click="showAddDialog" plain>
            <el-icon class="el-icon--left"><Plus /></el-icon>
            添加代理
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
      >
      </VmosTable>
    </div>

    <!-- 添加/编辑代理弹窗 -->
    <ProxyDialog ref="proxyDialogRef" @success="loadProxies" />
  </div>
</template>

<script setup lang="tsx">
defineOptions({ name: 'Proxy' })
import { ref, computed, reactive, onMounted } from 'vue'
import { Plus, Search, Refresh, Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElForm, ElButton, ElTag, TableV2FixedDir } from 'element-plus'
import VmosTable from '@renderer/components/table/index.vue'
import ProxyDialog from './components/ProxyDialog.vue'
import { ipc } from '@renderer/core/ipc'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import type { Proxy } from '@shared/ipc/data.types'
import { formatTime } from '@shared/api'
import { CopyText } from '@renderer/components'

const loading = ref(false)
const proxyDialogRef = ref<InstanceType<typeof ProxyDialog>>()
const searchFormRef = ref<InstanceType<typeof ElForm>>()
const searchForm = reactive({
  name: '',
  host: ''
})

const proxyList = ref<Proxy[]>([])

// ==========================================
// 计算属性
// ==========================================

const filteredProxies = computed(() => {
  return proxyList.value
})

const columns = [
  {
    key: 'name',
    dataKey: 'name',
    title: '名称',
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'protocol',
    dataKey: 'protocol',
    title: '代理信息',
    width: 220,
    flexGrow: 1,
    cellRenderer: ({ cellData, rowData }) => {
      return (
        <div class="proxy-info">
          <span>协议: {cellData || '-'}</span>
          <span>
            地址: <CopyText text={rowData?.host} />
          </span>
          <span>端口: {rowData?.port || '-'}</span>
        </div>
      )
    }
  },
  {
    key: 'ip',
    dataKey: 'ip',
    title: '出口信息',
    width: 200,
    flexGrow: 1,
    cellRenderer: ({ cellData, rowData }) => {
      return (
        <div class="proxy-info">
          <span>
            IP: <CopyText text={cellData} />
          </span>
          <span>
            地区: <CopyText text={rowData?.country} />
          </span>
          <span>
            时区: <CopyText text={rowData?.timezone} />
          </span>
          <span>
            经纬度: <CopyText text={rowData?.loc} />
          </span>
        </div>
      )
    }
  },
  {
    key: 'lastCheckStatus',
    dataKey: 'lastCheckStatus',
    title: '上一次检测状态',
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) =>
      cellData ? (
        <ElTag effect="light" type={cellData === 'success' ? 'success' : 'danger'} round>
          {cellData === 'success' ? '正常' : '异常'}
        </ElTag>
      ) : (
        '-'
      )
  },
  {
    key: 'createTime',
    dataKey: 'createTime',
    title: '创建时间',
    width: 150,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={formatTime(cellData as number)} />
  },
  {
    key: 'format',
    dataKey: 'format',
    title: '格式化',
    width: 380,
    flexGrow: 1,
    cellRenderer: ({ rowData }) => <CopyText text={formatProxy(rowData)} />
  },
  {
    key: 'action',
    title: '操作',
    width: 200,
    flexGrow: 1,
    fixed: TableV2FixedDir.RIGHT,
    align: 'center' as const,
    cellRenderer: ({ rowData }) => (
      <div style="display: flex; justify-content: center;">
        <ElButton type="primary" size="small" icon={Edit} plain onClick={() => handleEdit(rowData)}>
          编辑
        </ElButton>
        <ElButton
          type="danger"
          size="small"
          plain
          icon={Delete}
          onClick={() => handleDelete(rowData)}
        >
          删除
        </ElButton>
      </div>
    )
  }
]

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
    await ElMessageBox.confirm(`确定要删除代理"${row.name}"吗？此操作不可恢复。`, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await ipc.invoke(PROXY_EVENTS.DELETE_PROXY, row.id)
    if (res.success) {
      ElMessage.success('删除成功')
      await loadProxies()
    } else {
      ElMessage.error(res.error || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || '删除失败')
    }
  }
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
      ElMessage.error(res.error || '加载代理列表失败')
      proxyList.value = []
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '加载代理列表失败')
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

onMounted(async () => {
  loadProxies()
})
</script>

<style scoped lang="scss">
.proxy-manage-container {
  height: 100%;
  padding: 20px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.operation-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  padding: 16px 20px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
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
    color: #303133;

    .el-icon {
      margin-right: 8px;
      color: #409eff;
      font-size: 18px;
    }
  }
}

.search-form-container {
  background: #fff;
  padding: 16px 20px;
  border-radius: 6px;
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
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
        color: #606266;
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
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
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
    color: #606266;
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
