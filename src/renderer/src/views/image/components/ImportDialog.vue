<template>
  <VmosDialog
    v-model="visible"
    title="导入镜像"
    width="650px"
    :show-close="!loading"
    :close-on-click-modal="false"
    :draggable="true"
    @closed="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="auto"
      label-position="top"
      @submit.prevent
    >
      <el-form-item prop="filePath">
        <div class="import-content">
          <div class="section-title">选择镜像文件</div>

          <!-- 文件选择区域 -->
          <div
            class="file-select-area"
            :class="{ 'has-file': !!form.filePath, 'is-dragover': isDragOver }"
            @click="handleBrowseFile"
          >
            <template v-if="!form.filePath">
              <el-icon class="upload-icon"><Download /></el-icon>
              <div class="upload-text">点击此处 <span class="link-text">浏览文件</span></div>
              <div class="upload-tip">
                支持导入官方发布的 .tar.zst 格式文件，文件大小不得超过 5GB
              </div>
            </template>
            <template v-else>
              <el-icon class="file-icon"><Document /></el-icon>
              <div class="file-info">
                <el-tooltip :content="form.filePath" placement="top">
                  <div class="file-path" :disabled="loading">
                    {{ form.filePath }}
                  </div>
                </el-tooltip>
                <div class="re-select-tip">点击重新选择</div>
              </div>
            </template>
          </div>

          <div class="warning-tip">
            <el-icon><InfoFilled /></el-icon>
            <span
              >温馨提示：请确认上传文件为 VMOS Edge
              官方发布下载镜像，导入过程需要进行完整性及签名校验，请耐心等待！</span
            >
          </div>
          <!-- <div class="warning-tip error-tip">
            <span
              >仅支持时间 ≥
              {{ imageSupportVersionTime }} 的镜像版本，请参考镜像历史发布文档获取最新镜像，<a
                class="primary-link"
                href="https://help.vmosedge.com/zh/productupdates/image-release-history.html"
                target="_blank"
                >前往下载最新镜像</a
              ></span
            >
          </div> -->

          <!-- 进度条 -->
          <div v-if="loading" class="progress-area">
            <div class="progress-info">
              <span>正在导入...</span>
              <span>{{ progress }}%</span>
            </div>
            <el-progress :percentage="progress" :stroke-width="8" :show-text="false" />
          </div>
        </div>
      </el-form-item>

      <el-form-item label="镜像名称" prop="name">
        <el-input
          v-model="form.name"
          :disabled="loading"
          placeholder="输入镜像名称"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" :loading="loading" @click="handleImport" block>
          {{ loading ? '导入中' : '开始导入' }}
        </el-button>
      </div>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, reactive, toRaw, watch } from 'vue'
import { Download, Document, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage, ElForm } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'

// const imageSupportVersionTime = __IMAGE_SUPPORT_VERSION_TIME__

const emit = defineEmits(['success'])
const visible = ref(false)
const isDragOver = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()
const loading = ref(false)
const progress = ref(0)
const form = reactive({
  filePath: '',
  name: ''
})
const rules = ref({
  filePath: [{ required: true, message: '请选择镜像文件', trigger: 'blur' }]
})
// const handleDragOver = () => {
//   isDragOver.value = true
// }

// const handleDragLeave = () => {
//   isDragOver.value = false
// }

// const handleDrop = async (e: DragEvent) => {
//   isDragOver.value = false

//   const files = e.dataTransfer?.files
//   if (files && files.length > 0) {
//     const file = files[0]
//     // Electron 环境下，File 对象有 path 属性
//     const filePath = (file as any).path
//     if (filePath && filePath.endsWith('.tar.zst')) {
//       form.filePath = filePath
//     } else {
//       ElMessage.warning('请选择 .tar.zst 格式的镜像文件')
//     }
//   }
// }

// 监听解压镜像进度
const handleExtractProgress = (percent: number) => {
  progress.value = percent
}
let off: any = null
watch(
  () => visible.value,
  (newVal) => {
    if (newVal) {
      off = ipc.on<number>(IMAGES_EVENTS.IMAGE_EXTRACT_PROGRESS, handleExtractProgress)
    } else {
      off?.()
    }
  }
)

const handleBrowseFile = async () => {
  if (loading.value) return
  try {
    const result = await ipc.invoke(SHARED_EVENTS.SELECT_FILE, {
      filters: [{ extensions: ['tar.zst'], name: 'ZST Archive' }]
    })
    if (result.success && result.data) {
      form.filePath = result.data as string
    }
  } catch (error) {}
}

const handleImport = async () => {
  formRef.value?.validate().then(async (valid) => {
    if (!valid || loading.value) return

    loading.value = true
    try {
      const result = await ipc.invoke<string>(IMAGES_EVENTS.UPLOAD_IMAGE, toRaw(form))

      if (result.success) {
        ElMessage.success('操作成功')
        emit('success')
        visible.value = false
      } else {
        ElMessage.error(result.error || '导入失败')
      }
    } finally {
      loading.value = false
    }
  })
}

const handleClose = () => {
  formRef.value?.resetFields()
  progress.value = 0
}
const init = () => {
  visible.value = true
}
defineExpose({
  init
})
</script>

<style scoped lang="scss">
.import-content {
  padding: 0 10px;
  overflow: hidden;

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 16px;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: #409eff;
      margin-right: 8px;
      border-radius: 2px;
    }
  }

  .file-select-area {
    width: 100%;
    height: 180px;
    border: 2px dashed #dcdfe6;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s;
    background-color: #fafafa;
    margin-bottom: 24px;
    box-sizing: border-box;

    &:hover {
      border-color: #409eff;
      background-color: #f0f7ff;

      .upload-icon,
      .link-text {
        color: #409eff;
      }
    }

    &.has-file {
      border-style: solid;
      background-color: #f0f9eb;
      border-color: #67c23a;

      &:hover {
        background-color: #f0f9eb;
        opacity: 0.9;
      }

      .file-icon {
        color: #67c23a;
      }
    }

    &.is-dragover {
      border-color: #409eff;
      background-color: #ecf5ff;
      transform: scale(1.02);
    }

    .upload-icon {
      font-size: 56px;
      color: #c0c4cc;
      margin-bottom: 16px;
      transition: color 0.3s;
    }

    .file-icon {
      font-size: 56px;
      color: #67c23a;
      margin-bottom: 16px;
    }

    .upload-text {
      font-size: 15px;
      color: #606266;
      margin-bottom: 8px;

      .link-text {
        color: #409eff;
        font-weight: 500;
        margin-left: 4px;
        text-decoration: underline;
      }
    }

    .upload-tip {
      font-size: 13px;
      color: #909399;
    }

    .file-info {
      text-align: center;
      width: 85%;

      .file-path {
        font-size: 13px;
        color: #303133;
        font-weight: 600;
        margin-bottom: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: rgba(255, 255, 255, 0.6);
        padding: 4px 8px;
        border-radius: 4px;
      }

      .re-select-tip {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
    }
  }

  .warning-tip {
    background: #fdf6ec;
    padding: 12px 16px;
    border-radius: 6px;
    border: 1px solid #faecd8;
    display: flex;
    align-items: flex-start;
    gap: 5px;
    margin-bottom: 10px;

    .el-icon {
      color: #e6a23c;
      margin-top: 3px;
      font-size: 16px;
    }

    span {
      font-size: 13px;
      color: #e6a23c;
      line-height: 1.6;
    }
  }
  .error-tip {
    background: #fef0f0;
    border: 1px solid #f56c6c;
    margin-top: 0px;
    span {
      color: #f56c6c;
    }
    .primary-link {
      color: #409eff;
      text-decoration: underline;
      // 下划线去除默认样式
      text-decoration-style: dotted;
      text-decoration-color: #409eff;
      text-decoration-thickness: 1px;
      cursor: pointer;
      &:hover {
        color: #409eff;
      }
    }
  }

  .form-item {
    margin-bottom: 24px;

    .form-label {
      font-size: 14px;
      font-weight: 500;
      color: #606266;
      margin-bottom: 8px;
    }
  }

  .progress-area {
    margin-bottom: 10px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 8px;

    .progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #606266;
      margin-bottom: 8px;
    }
  }
}
</style>
