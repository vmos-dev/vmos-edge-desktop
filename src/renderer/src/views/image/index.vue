<template>
  <div class="image-manage-container">
    <!-- 顶部功能区 & 存储路径 -->
    <div class="operation-panel">
      <div class="path-section">
        <div class="path-label">
          <el-icon class="folder-icon"><Folder /></el-icon>
          <span>镜像存储路径：</span>
        </div>
        <div
          class="path-value"
          :class="{ 'path-invalid': !isPathValid }"
          :title="storagePath || '路径未设置'"
        >
          <span v-if="storagePath">{{ storagePath }}</span>
          <span v-else class="path-empty">路径未设置</span>
          <el-tooltip
            v-if="!isPathValid"
            content="镜像存储路径不存在，请点击「设置路径」按钮设置有效的存储路径"
            placement="top"
          >
            <el-icon class="warning-icon"><Warning /></el-icon>
          </el-tooltip>
        </div>
        <el-button
          link
          :type="!isPathValid ? 'warning' : 'primary'"
          class="change-path-btn"
          :class="{ 'path-warning-btn': !isPathValid }"
          @click="changeStoragePath"
        >
          {{ !isPathValid ? '设置路径' : '更改路径' }}
        </el-button>
      </div>

      <div class="action-buttons">
        <el-button plain @click="openOfficialDownload">
          <el-icon class="el-icon--left"><Download /></el-icon>
          官方镜像下载
        </el-button>
        <el-button type="primary" @click="handleImportClick">
          <el-icon class="el-icon--left"><Download /></el-icon>
          导入镜像
        </el-button>
      </div>
    </div>

    <!-- 列表控制栏 -->
    <div class="list-header">
      <div class="list-title">
        <el-icon><List /></el-icon>
        <span>镜像列表</span>
        <div class="path-tip">
          <el-icon><Warning /></el-icon>
          <span
            >建议选择空间充足的非根目录作为存储路径（如
            D:\VMOSData），禁止选择磁盘根目录，以避免镜像解压过程中的路径逃逸风险。</span
          >
        </div>
      </div>
    </div>

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
        <el-form-item label="镜像名称" prop="name" class="form-item">
          <el-input
            v-model.trim="searchForm.name"
            placeholder="请输入镜像名称"
            clearable
            class="search-input"
          />
        </el-form-item>
        <el-form-item label="Android版本" prop="androidVersion" class="form-item">
          <el-select
            v-model="searchForm.androidVersion"
            placeholder="请选择Android版本"
            clearable
            filterable
            class="search-select"
          >
            <el-option label="Android 15" value="15" />
            <el-option label="Android 14" value="14" />
            <el-option label="Android 13" value="13" />
            <el-option label="Android 10" value="10" />
          </el-select>
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
        </el-form-item>
      </el-form>
    </div>

    <!-- 镜像列表表格 -->
    <div class="table-container">
      <ImageTable :data="filteredImages" @delete="handleDelete" />
    </div>

    <!-- 导入镜像弹窗 -->
    <ImportDialog ref="importDialogRef" @success="loadImages" />
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Image' })
import { ref, computed, reactive, onMounted } from 'vue'
import { Download, Folder, Warning, List, Search, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElForm, ElTooltip } from 'element-plus'
import ImageTable, { ImageItem } from './components/ImageTable.vue'
import ImportDialog from './components/ImportDialog.vue'
import { ipc } from '@renderer/core/ipc'
import { CONFIG_EVENTS } from '@shared/ipc/config.types'
import { CONFIG_KEYS } from '@shared/constant'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import type { Image } from '@shared/ipc/data.types'

const storagePath = ref<string>('')
const isPathValid = ref<boolean>(true) // 路径是否有效
const importDialogRef = ref<InstanceType<typeof ImportDialog>>()
const loading = ref(false)

const searchFormRef = ref<InstanceType<typeof ElForm>>()
const searchForm = reactive({
  name: '',
  androidVersion: ''
})

const imageList = ref<ImageItem[]>([])

// ==========================================
// 工具函数
// ==========================================

/**
 * 格式化文件大小
 */
function formatSize(bytes?: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * 格式化时间戳
 */
function formatTime(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 将 Image 转换为 ImageItem
 */
function convertImageToItem(image: Image): ImageItem {
  return {
    id: image.id,
    name: image.name,
    version: image.version,
    androidVersion: image.androidVersion || '',
    size: formatSize(image.size),
    importTime: formatTime(image.importTime)
  }
}

// ==========================================
// 计算属性
// ==========================================

const filteredImages = computed(() => {
  return imageList.value
})

// ==========================================
// 方法
// ==========================================

const openOfficialDownload = () => {
  ipc.send(
    SHARED_EVENTS.OPEN_BROWSER_WINDOW,
    'https://help.vmosedge.com/zh/productupdates/image-release-history.html'
  )
}

const changeStoragePath = async () => {
  try {
    const res = await ipc.invoke(IMAGES_EVENTS.CHANGE_STORAGE_PATH)
    if (res.success) {
      getConfig()
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '更改路径失败')
  }
}

const handleDelete = async (row: ImageItem) => {
  try {
    await ElMessageBox.confirm(`确定要删除镜像“${row.name}”吗？此操作不可恢复。`, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await ipc.invoke(IMAGES_EVENTS.DELETE_IMAGE, row.id)
    if (res.success) {
      ElMessage.success('删除成功')
      await loadImages()
    } else {
      ElMessage.error(res.error || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error?.message || '删除失败')
    }
  }
}

const showImportDialog = () => {
  importDialogRef.value?.init()
}

/**
 * 处理导入镜像点击事件
 * 如果路径无效，提示用户先设置路径
 */
const handleImportClick = () => {
  if (!isPathValid.value) {
    ElMessageBox.confirm('镜像存储路径不存在，请先设置有效的存储路径后再导入镜像。', '提示', {
      confirmButtonText: '立即设置',
      cancelButtonText: '取消',
      type: 'warning',
      distinguishCancelAndClose: true
    })
      .then(() => {
        changeStoragePath()
      })
      .catch(() => {
        // 用户取消，不做任何操作
      })
  } else {
    showImportDialog()
  }
}

const getConfig = async () => {
  const config = await ipc.invoke<string>(CONFIG_EVENTS.GET_CONFIGS, CONFIG_KEYS.IMAGE_STORAGE_PATH)
  if (config.success) {
    storagePath.value = config.data || ''
    // 获取配置后立即检查路径有效性
    checkStoragePath()
  }
}

/**
 * 加载镜像列表
 */
const loadImages = async () => {
  loading.value = true
  try {
    const options: { name?: string; androidVersion?: string } = {}

    // 如果有搜索关键词，添加到查询条件
    if (searchForm.name.trim()) {
      options.name = searchForm.name.trim()
    }

    // 如果有版本过滤，添加到查询条件
    if (searchForm.androidVersion) {
      options.androidVersion = searchForm.androidVersion
    }

    const res = await ipc.invoke<Image[]>(IMAGES_EVENTS.QUERY_IMAGES, options)
    if (res.success && res.data) {
      imageList.value = res.data.map(convertImageToItem)
    } else {
      ElMessage.error(res.error || '加载镜像列表失败')
      imageList.value = []
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '加载镜像列表失败')
    imageList.value = []
  } finally {
    loading.value = false
  }
}

/**
 * 查询
 */
const handleSearch = () => {
  loadImages()
}

/**
 * 重置查询条件
 */
const handleReset = () => {
  searchFormRef.value?.resetFields()
  loadImages()
}

/**
 * 检查镜像存储路径是否存在
 * 静默检查，不显示消息提示，只更新状态
 */
const checkStoragePath = async () => {
  try {
    const res = await ipc.invoke<boolean>(IMAGES_EVENTS.CHECK_STORAGE_PATH)
    if (res.success) {
      isPathValid.value = !!res.data
    } else {
      isPathValid.value = false
    }
  } catch (error: any) {
    isPathValid.value = false
  }
}

onMounted(() => {
  getConfig()
  loadImages()
})
</script>

<style scoped lang="scss">
.image-manage-container {
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

  .path-section {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    margin-right: 24px;

    .path-label {
      display: flex;
      align-items: center;
      color: #303133;
      font-weight: 600;
      font-size: 14px;
      white-space: nowrap;

      .folder-icon {
        font-size: 18px;
        color: #409eff;
        margin-right: 8px;
      }
    }

    .path-value {
      font-weight: 600;
      color: #606266;
      background: #fff;
      padding: 6px 12px;
      border-radius: 4px;
      margin: 0 12px;
      max-width: 500px;
      min-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      border: 1px solid #dcdfe6;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.3s ease;
      position: relative;
      padding-right: 30px;

      &.path-invalid {
        border-color: #f56c6c;
        background-color: #fef0f0;
        color: #f56c6c;

        .path-empty {
          color: #f56c6c;
          font-style: italic;
        }

        .warning-icon {
          color: #f56c6c;
          font-size: 16px;
          flex-shrink: 0;
          cursor: help;
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          cursor: help;
        }
      }
    }

    .change-path-btn {
      transition: all 0.3s ease;

      &.path-warning-btn {
        font-weight: 600;
        color: #e6a23c;

        &:hover {
          color: #f56c6c;
        }
      }
    }
  }

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

    .path-tip {
      margin-left: 16px;
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #909399;
      font-weight: normal;
      background: #f4f4f5;
      padding: 4px 8px;
      border-radius: 4px;

      .el-icon {
        margin-right: 4px;
        font-size: 14px;
        color: #e6a23c;
      }
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
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
