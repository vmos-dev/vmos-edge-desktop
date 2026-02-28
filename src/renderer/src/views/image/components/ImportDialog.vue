<template>
  <VmosDialog
    v-model="visible"
    :title="t('image.importImageTitle')"
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
          <div class="section-title">{{ t('image.selectImageFile') }}</div>

          <!-- 文件选择区域 -->
          <div
            class="file-select-area"
            :class="{ 'has-file': !!form.filePath, 'is-dragover': isDragOver }"
            @click="handleBrowseFile"
          >
            <template v-if="!form.filePath">
              <el-icon class="upload-icon"><Download /></el-icon>
              <div class="upload-text">{{ t('image.clickToBrowse') }} <span class="link-text">{{ t('image.browseFile') }}</span></div>
              <div class="upload-tip">
                {{ t('image.supportedFormat') }}
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
                <div class="re-select-tip">{{ t('image.clickToReselect') }}</div>
              </div>
            </template>
          </div>

          <div class="warning-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>{{ t('image.importTip') }}</span>
          </div>
          <!-- <div class="warning-tip error-tip">
            <span
              >{{ t('image.supportVersionNote', { time: imageSupportVersionTime }) }}<a
                class="primary-link"
                href="https://help.vmosedge.com/zh/productupdates/image-release-history.html"
                target="_blank"
                >{{ t('image.downloadLatestImage') }}</a
              ></span
            >
          </div> -->

          <!-- 进度条 -->
          <div v-if="loading" class="progress-area">
            <div class="progress-info">
              <span>{{ t('image.importing') }}</span>
              <span>{{ progress }}%</span>
            </div>
            <el-progress :percentage="progress" :stroke-width="8" :show-text="false" />
          </div>
        </div>
      </el-form-item>

      <el-form-item :label="t('image.imageNameLabel')" prop="name">
        <el-input
          v-model="form.name"
          :disabled="loading"
          :placeholder="t('image.imageNamePlaceholder')"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" :loading="loading" @click="handleImport" block>
          {{ loading ? t('image.importingStatus') : t('image.startImport') }}
        </el-button>
      </div>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, reactive, toRaw, watch, computed } from 'vue'
import { Download, Document, InfoFilled } from '@element-plus/icons-vue'
import { ElMessage, ElForm } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
const rules = computed(() => ({
  filePath: [{ required: true, message: t('image.selectImageFileRequired'), trigger: 'blur' }]
}))
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
        ElMessage.success(t('common.operationSuccess'))
        emit('success')
        visible.value = false
      } else {
        ElMessage.error(result.error || t('image.importFailed'))
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
    color: var(--el-text-color-primary);
    margin-bottom: 16px;
    display: flex;
    align-items: center;

    &::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 16px;
      background: var(--el-color-primary);
      margin-right: 8px;
      border-radius: 2px;
    }
  }

  .file-select-area {
    width: 100%;
    height: 180px;
    border: 2px dashed var(--el-border-color);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s;
    background-color: var(--el-bg-color-page);
    margin-bottom: 24px;
    box-sizing: border-box;

    &:hover {
      border-color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);

      .upload-icon,
      .link-text {
        color: var(--el-color-primary);
      }
    }

    &.has-file {
      border-style: solid;
      background-color: var(--el-color-success-light-9);
      border-color: var(--el-color-success);

      &:hover {
        background-color: var(--el-color-success-light-9);
        opacity: 0.9;
      }

      .file-icon {
        color: var(--el-color-success);
      }
    }

    &.is-dragover {
      border-color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
      transform: scale(1.02);
    }

    .upload-icon {
      font-size: 56px;
      color: var(--el-text-color-placeholder);
      margin-bottom: 16px;
      transition: color 0.3s;
    }

    .file-icon {
      font-size: 56px;
      color: var(--el-color-success);
      margin-bottom: 16px;
    }

    .upload-text {
      font-size: 15px;
      color: var(--el-text-color-regular);
      margin-bottom: 8px;

      .link-text {
        color: var(--el-color-primary);
        font-weight: 500;
        margin-left: 4px;
        text-decoration: underline;
      }
    }

    .upload-tip {
      font-size: 13px;
      color: var(--el-text-color-secondary);
    }

    .file-info {
      text-align: center;
      width: 85%;

      .file-path {
        font-size: 13px;
        color: var(--el-text-color-primary);
        font-weight: 600;
        margin-bottom: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        background: var(--el-mask-color-extra-light);
        padding: 4px 8px;
        border-radius: 4px;
      }

      .re-select-tip {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        margin-top: 4px;
      }
    }
  }

  .warning-tip {
    background: var(--el-color-warning-light-9);
    padding: 12px 16px;
    border-radius: 6px;
    border: 1px solid var(--el-color-warning-light-8);
    display: flex;
    align-items: flex-start;
    gap: 5px;
    margin-bottom: 10px;

    .el-icon {
      color: var(--el-color-warning);
      margin-top: 3px;
      font-size: 16px;
    }

    span {
      font-size: 13px;
      color: var(--el-color-warning);
      line-height: 1.6;
    }
  }
  .error-tip {
    background: var(--el-color-danger-light-9);
    border: 1px solid var(--el-color-danger);
    margin-top: 0px;
    span {
      color: var(--el-color-danger);
    }
    .primary-link {
      color: var(--el-color-primary);
      text-decoration: underline;
      // 下划线去除默认样式
      text-decoration-style: dotted;
      text-decoration-color: var(--el-color-primary);
      text-decoration-thickness: 1px;
      cursor: pointer;
      &:hover {
        color: var(--el-color-primary);
      }
    }
  }

  .form-item {
    margin-bottom: 24px;

    .form-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-regular);
      margin-bottom: 8px;
    }
  }

  .progress-area {
    margin-bottom: 10px;
    padding: 16px;
    background: var(--el-bg-color-page);
    border-radius: 8px;

    .progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--el-text-color-regular);
      margin-bottom: 8px;
    }
  }
}
</style>
