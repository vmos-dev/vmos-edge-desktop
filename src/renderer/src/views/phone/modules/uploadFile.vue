<template>
  <div class="upload-file">
    <!-- 上传区域 -->
    <div class="upload-area">
      <div class="upload-header">
        <h3 class="upload-title">{{ title }}</h3>
      </div>

      <el-upload
        ref="uploadRef"
        class="upload-zone"
        drag
        :auto-upload="true"
        multiple
        :before-upload="beforeUpload"
        :http-request="customUploadRequest"
        :show-file-list="false"
        :accept="allowedExtensions?.map((ext) => `.${ext}`).join(',') || '*/*'"
      >
        <div class="upload-zone-content">
          <el-icon class="upload-icon"><upload-filled /></el-icon>
          <div class="upload-text">
            <p class="upload-primary-text">点击上传或拖拽文件到此处</p>
            <p class="upload-secondary-text">
              支持批量上传，支持文件格式：{{
                allowedExtensions?.map((ext) => `.${ext}`).join(', ') || '所有文件'
              }}
            </p>
          </div>
        </div>
        <template #tip>
          <div class="upload-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>最大支持同时上传 {{ concurrency }} 个文件</span>
          </div>
        </template>
      </el-upload>
    </div>

    <!-- 文件列表区域 -->
    <div class="file-list">
      <div class="file-list-header">
        <div class="header-left">
          <span class="list-title">文件列表</span>
          <div class="upload-stats">
            <span class="stats-item total">
              <el-icon><DocumentAdd /></el-icon>
              总计: {{ tasks.length }}
            </span>
            <span class="stats-item waiting" v-if="waitingCount > 0">
              <el-icon><Clock /></el-icon>
              等待: {{ waitingCount }}
            </span>
            <span class="stats-item uploading" v-if="uploadingCount > 0">
              <el-icon class="rotating"><Loading /></el-icon>
              进行中: {{ uploadingCount }}
            </span>
            <span class="stats-item success" v-if="successCount > 0">
              <el-icon><CircleCheck /></el-icon>
              成功: {{ successCount }}
            </span>
            <span class="stats-item error" v-if="errorCount > 0">
              <el-icon><CircleClose /></el-icon>
              失败: {{ errorCount }}
            </span>
          </div>
        </div>
        <el-button v-if="tasks.length > 0" link type="danger" size="small" @click="clearAll">
          清空全部
        </el-button>
      </div>

      <!-- 文件项展示 - 添加滚动容器 -->
      <div class="file-list-content">
        <div
          class="file-item"
          v-for="task in sortedTasks"
          :key="task.id"
          :class="{
            'status-uploading': task.status === 'uploading',
            'status-pushing': task.status === 'pushing',
            'status-success': task.status === 'success',
            'status-error': task.status === 'error',
            'status-waiting': task.status === 'waiting'
          }"
        >
          <!-- 背景进度条 - 移到最下层 -->
          <div
            class="progress-background"
            v-if="task.status === 'uploading' || task.status === 'pushing'"
            :style="{
              background: `linear-gradient(to right, 
                rgba(64, 158, 255, 0.15) 0%, 
                rgba(64, 158, 255, 0.25) ${task.progress * 100 * 0.5}%,
                rgba(64, 158, 255, 0.35) ${task.progress * 100}%, 
                transparent ${task.progress * 100}%)`
            }"
          ></div>

          <!-- 左侧：图标 + 文件名 + 文件大小 -->
          <div class="file-left">
            <div class="file-icon-wrapper">
              <el-icon class="file-icon" :class="getIconClass(task)">
                <component :is="getIconComponent(task)" />
              </el-icon>
            </div>
            <div class="file-info">
              <div class="file-name" :title="task.file.name">{{ task.file.name }}</div>
              <div class="file-size">{{ formatFileSize(task.file.size) }}</div>
            </div>
          </div>

          <!-- 右侧：状态 + 百分比 + 删除 -->
          <div class="file-right">
            <div class="status-info">
              <div class="status-line">
                <el-icon
                  v-if="task.status === 'uploading' || task.status === 'pushing'"
                  class="status-icon rotating"
                >
                  <Loading />
                </el-icon>
                <span v-if="task.status === 'uploading'" class="progress-text">
                  {{ (task.progress * 100).toFixed(0) }}%
                </span>
                <span v-else class="status-text" :class="`status-${task.status}`">
                  {{ getStatusText(task.status) }}
                  <el-tooltip
                    v-if="task.status === 'error'"
                    placement="left"
                    effect="dark"
                    trigger="click"
                  >
                    <template #content>
                      <div
                        class="error-info-content"
                        style="max-width: 300px; max-height: 200px; overflow-y: auto"
                      >
                        <p>{{ task.errorInfo || '未知错误' }}</p>
                      </div>
                    </template>
                    <el-icon class="error-info-icon"><InfoFilled /></el-icon>
                  </el-tooltip>
                </span>
              </div>
            </div>

            <!-- 只能删除等待中的任务 -->
            <el-icon
              v-if="task.status === 'waiting'"
              class="delete-btn"
              @click="removeTask(task.id)"
              title="删除"
            >
              <Delete />
            </el-icon>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="tasks.length === 0" class="empty-state">
          <el-empty description="暂无文件" :image-size="120" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  UploadFilled,
  DocumentAdd,
  CircleCheck,
  CircleClose,
  Loading,
  InfoFilled,
  Clock,
  Delete
} from '@element-plus/icons-vue'
import { UploadQueue, UploadTask, UploadStatus } from '@renderer/utils/upload'
import { ref, computed } from 'vue'
import { ElUpload } from 'element-plus'

const props = withDefaults(
  defineProps<{
    host: string
    deviceId: string
    allowedExtensions?: string[]
    concurrency?: number
    title?: string
    url: string
  }>(),
  {
    allowedExtensions: () => [],
    concurrency: () => 1,
    title: () => '应用上传'
  }
)

const uploadQueue = new UploadQueue({ concurrency: props.concurrency ?? 3 })
const tasks = ref<UploadTask[]>([])

const uploadRef = ref<InstanceType<typeof ElUpload>>()

// 获取状态优先级
const getStatusPriority = (status: UploadStatus): number => {
  switch (status) {
    case 'uploading':
    case 'pushing':
      return 1 // 最高优先级：进行中
    case 'waiting':
      return 2 // 等待中
    case 'error':
      return 3 // 失败
    case 'success':
      return 4 // 成功
    case 'cancelled':
      return 5 // 已取消
    default:
      return 6
  }
}

// 按状态排序的任务列表
const sortedTasks = computed(() => {
  return [...tasks.value].sort((a, b) => {
    const priorityA = getStatusPriority(a.status)
    const priorityB = getStatusPriority(b.status)
    // 如果优先级相同，按 id 排序（保持原有顺序）
    if (priorityA === priorityB) {
      return a.id - b.id
    }
    return priorityA - priorityB
  })
})

// 统计数据
const successCount = computed(() => tasks.value.filter((t) => t.status === 'success').length)
const uploadingCount = computed(
  () => tasks.value.filter((t) => t.status === 'uploading' || t.status === 'pushing').length
)
const waitingCount = computed(() => tasks.value.filter((t) => t.status === 'waiting').length)
const errorCount = computed(() => tasks.value.filter((t) => t.status === 'error').length)

const beforeUpload = (file: any) => {
  if (props.allowedExtensions && props.allowedExtensions.length > 0) {
    const fileName = file.name
    const fileExtension = fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase()
    if (!props.allowedExtensions.includes(fileExtension)) {
      return false
    }
  }
  return true
}

const removeTask = (id: number) => {
  uploadQueue.deleteTask(id)
  updateTasks()
}

const clearAll = () => {
  uploadQueue.clearAllTasks()
  updateTasks()
}

const customUploadRequest = (options: any) => {
  return new Promise<void>(() => {
    const { file, onProgress } = options
    const formData = new FormData()
    formData.append('file', file)
    formData.append('db_ids', props.deviceId)
    uploadQueue.add({
      url: props.url,
      hostIp: props.host,
      file,
      deviceId: props.deviceId,
      formData,
      onProgress: (percent) => {
        onProgress(percent)
      }
    })
    uploadRef.value?.clearFiles()
  })
}

// 更新任务列表
const updateTasks = () => {
  tasks.value = [...uploadQueue.getTasks()]
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 获取状态文本
const getStatusText = (status: UploadStatus): string => {
  const statusMap: Record<UploadStatus, string> = {
    waiting: '等待中',
    uploading: '上传中',
    pushing: '推送中',
    success: '成功',
    error: '失败',
    cancelled: '已取消'
  }
  return statusMap[status] || status
}

// 获取图标组件
const getIconComponent = (task: UploadTask) => {
  switch (task.status) {
    case 'uploading':
    case 'pushing':
      return Loading
    case 'success':
      return CircleCheck
    case 'error':
      return CircleClose
    case 'waiting':
      return Clock
    default:
      return DocumentAdd
  }
}

// 获取图标样式类
const getIconClass = (task: UploadTask) => {
  switch (task.status) {
    case 'uploading':
    case 'pushing':
      return 'icon-uploading'
    case 'success':
      return 'icon-success'
    case 'error':
      return 'icon-error'
    case 'waiting':
      return 'icon-waiting'
    default:
      return 'icon-default'
  }
}

uploadQueue.on('status', () => {
  updateTasks()
})

uploadQueue.on('finish', () => {
  updateTasks()
})
</script>

<style lang="scss" scoped>
.upload-file {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  overflow: hidden;
}

/* ==================== 上传区域 ==================== */
.upload-area {
  flex-shrink: 0;
  background: #ffffff;
  padding: 16px 20px;

  .upload-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .upload-title {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }

    .upload-stats {
      display: flex;
      gap: 16px;

      .stats-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #606266;

        .el-icon {
          font-size: 14px;

          &.rotating {
            animation: rotate 2s linear infinite;
          }
        }

        &:first-child .el-icon {
          color: #909399;
        }
        &:nth-child(2) .el-icon {
          color: #67c23a;
        }
        &:nth-child(3) .el-icon {
          color: #409eff;
        }
      }
    }
  }

  .upload-zone {
    .upload-zone-content {
      padding: 24px 20px;
      text-align: center;

      .upload-icon {
        font-size: 32px;
        color: #c0c4cc;
        margin-bottom: 12px;
        transition: all 0.3s ease;
      }

      .upload-text {
        .upload-primary-text {
          margin: 0 0 6px 0;
          font-size: 14px;
          color: #303133;
          font-weight: 500;
        }

        .upload-secondary-text {
          margin: 0;
          font-size: 11px;
          color: #909399;
        }
      }
    }

    :deep(.el-upload-dragger) {
      border: 2px dashed #dcdfe6;
      border-radius: 8px;
      background: #fafafa;
      transition: all 0.3s ease;
      padding: 20px 0;
      &:hover {
        border-color: #409eff;
        background: #ecf5ff;

        .upload-icon {
          color: #409eff;
          transform: scale(1.1);
        }
      }
    }

    .upload-tip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
      font-size: 12px;
      color: #909399;

      .el-icon {
        font-size: 14px;
      }
    }
  }

  .upload-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    justify-content: center;

    .el-button {
      min-width: 100px;
      padding: 6px 12px;
      font-size: 12px;
    }
  }
}
/* ==================== 文件列表 ==================== */
.file-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0px 20px 8px;
  overflow: hidden;

  .file-list-header {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f0f2f5;

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
      overflow: hidden;
    }

    .list-title {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
      white-space: nowrap;
    }

    .upload-stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;

      .stats-item {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        background: #f8f9fa;
        transition: all 0.3s ease;

        .el-icon {
          font-size: 14px;

          &.rotating {
            animation: rotate 1.5s linear infinite;
          }
        }

        &.total {
          color: #606266;
          background: #f4f4f5;
          .el-icon {
            color: #909399;
          }
        }

        &.waiting {
          color: #e6a23c;
          background: #fdf6ec;
          .el-icon {
            color: #e6a23c;
          }
        }

        &.uploading {
          color: #409eff;
          background: #ecf5ff;
          .el-icon {
            color: #409eff;
          }
        }

        &.success {
          color: #67c23a;
          background: #f0f9ff;
          .el-icon {
            color: #67c23a;
          }
        }

        &.error {
          color: #f56c6c;
          background: #fef0f0;
          .el-icon {
            color: #f56c6c;
          }
        }
      }
    }
  }

  .file-list-content {
    flex: 1;
    overflow-y: auto;
    padding: 5px;
  }
}

/* 每一行文件项卡片 */
.file-item {
  position: relative;
  padding: 5px 12px;
  background: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.25s ease;
  overflow: hidden;
  min-height: 42px;

  &:hover {
    border-color: #c6e2ff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &.status-uploading,
  &.status-pushing {
    border-color: #b3d8ff;
  }

  &.status-success {
    border-color: #c2e7b0;
    background: #f6ffed;
  }

  &.status-error {
    border-color: #fbc4c4;
    background: #fef2f2;
  }

  &.status-waiting {
    border-color: #f0c78a;
  }

  /* 背景进度条效果 - 增强可见度 */
  .progress-background {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 6px;
    animation: progress-shine 2s ease-in-out infinite;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

/* 左侧文件信息 */
.file-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;

  .file-icon-wrapper {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: #f8f9fa;

    .file-icon {
      font-size: 16px;
      transition: all 0.3s ease;

      &.icon-default {
        color: #409eff;
      }

      &.icon-uploading {
        color: #409eff;
        animation: pulse 1.5s infinite;
      }

      &.icon-success {
        color: #67c23a;
      }

      &.icon-error {
        color: #f56c6c;
      }

      &.icon-waiting {
        color: #e6a23c;
      }
    }
  }

  .file-info {
    flex: 1;
    min-width: 0;

    .file-name {
      font-size: 13px;
      font-weight: 500;
      color: #303133;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }

    .file-size {
      font-size: 11px;
      color: #909399;
      line-height: 1;
    }
  }
}

/* 右侧状态信息 */
.file-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;

  .status-info {
    text-align: right;
    min-width: 60px;

    .status-line {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;

      .status-icon {
        font-size: 14px;
        color: #409eff;

        &.rotating {
          animation: rotate 1.2s linear infinite;
        }
      }

      .progress-text {
        font-size: 12px;
        color: #409eff;
        font-weight: 600;
        line-height: 1;
      }

      .status-text {
        font-size: 11px;
        font-weight: 500;
        line-height: 1.3;

        &.status-waiting {
          color: #e6a23c;
        }

        &.status-uploading,
        &.status-pushing {
          color: #409eff;
        }

        &.status-success {
          color: #67c23a;
        }

        &.status-error {
          color: #f56c6c;
        }

        .error-info-icon {
          margin-left: 4px;
          cursor: pointer;
          font-size: 14px;
          vertical-align: text-bottom;
          outline: none;
        }
      }
    }
  }

  .delete-btn {
    color: #c0c4cc;
    cursor: pointer;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.2s ease;

    &:hover {
      color: #f56c6c;
      background: #fef2f2;
      transform: scale(1.1);
    }
  }
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 30px 20px;
  color: #909399;

  .empty-icon {
    font-size: 48px;
    color: #dcdfe6;
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 14px;
    margin: 0;
  }
}

/* ==================== 动画效果 ==================== */
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes progress-shine {
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.8;
  }
}
</style>
