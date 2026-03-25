<template>
  <VmosDialog
    v-model="visible"
    :title="t('adi.importSettings')"
    width="500px"
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
          <div class="section-title">{{ t('adi.selectAdiFile') }}</div>

          <!-- 文件选择区域 -->
          <div
            class="file-select-area"
            :class="{ 'has-file': !!form.filePath, 'is-dragover': isDragOver }"
            @click="handleBrowseFile"
          >
            <template v-if="!form.filePath">
              <el-icon class="upload-icon"><Download /></el-icon>
              <div class="upload-text">
                {{ t('adi.clickToBrowse') }}
                <span class="link-text">{{ t('adi.browseFile') }}</span>
              </div>
              <div class="upload-tip">
                {{ t('adi.supportedFormat') }}
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
                <div class="re-select-tip">{{ t('adi.clickToReselect') }}</div>
              </div>
            </template>
          </div>
        </div>
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
import { ref, reactive, computed } from 'vue'
import { Download, Document } from '@element-plus/icons-vue'
import { ElMessage, ElForm } from 'element-plus'
import { ipc } from '@renderer/core/ipc'
import { SHARED_EVENTS } from '@shared/ipc/shared.types'
import { ADI_EVENTS } from '@shared/ipc/adi.types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits(['success'])
const visible = ref(false)
const isDragOver = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()
const loading = ref(false)

const form = reactive({
  filePath: ''
})

const rules = computed(() => ({
  filePath: [{ required: true, message: t('adi.selectAdiFileRequired'), trigger: 'blur' }]
}))

const handleBrowseFile = async () => {
  if (loading.value) return
  try {
    const result = await ipc.invoke(SHARED_EVENTS.SELECT_FILE, {
      filters: [{ extensions: ['zip'], name: 'Zip Archive' }]
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
      const result = await ipc.invoke<any>(ADI_EVENTS.IMPORT_CUSTOM_ADI, {
        filePath: form.filePath
      })

      if (result.success) {
        ElMessage.success(t('common.importSuccess'))
        visible.value = false
        emit('success')
      } else {
        ElMessage.error(result.error || t('common.importFailed'))
      }
    } finally {
      loading.value = false
    }
  })
}

const handleClose = () => {
  formRef.value?.resetFields()
  form.filePath = ''
}

const init = () => {
  visible.value = true
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
:deep(.el-dialog__body) {
  padding: 20px;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-form-item__content) {
  width: 100%;
}

:deep(.el-input) {
  width: 100%;
}

.import-content {
  width: 100%;
  padding: 0;
  overflow: hidden;
  box-sizing: border-box;

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
    min-width: 0;
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
      width: 100%;
      max-width: 100%;

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
}
</style>
