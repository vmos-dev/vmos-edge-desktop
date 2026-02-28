<template>
  <div class="upload-cert-container">
    <!-- 已上传状态 -->
    <div v-if="modelValue" class="uploaded-state">
      <div class="cert-info">
        <el-icon class="cert-icon"><Key /></el-icon>
        <div class="cert-detail">
          <div class="cert-label">{{ t('common.certHash') }}</div>
          <div class="cert-hash" :title="modelValue">{{ modelValue }}</div>
        </div>
      </div>
      <div class="cert-actions">
        <el-upload
          ref="uploadRef"
          action="#"
          :show-file-list="false"
          :disabled="uploadLoading"
          :accept="acceptTypes"
          :http-request="customUploadRequest"
          :before-upload="handleBeforeUpload"
        >
          <el-button type="primary" link size="small" :loading="uploadLoading">{{ t('common.overwrite') }}</el-button>
        </el-upload>
        <el-divider direction="vertical" />
        <el-button type="danger" link size="small" @click="handleRemove">{{ t('common.delete') }}</el-button>
      </div>
    </div>

    <!-- 未上传状态 -->
    <div v-else class="upload-state">
      <el-upload
        action="#"
        :show-file-list="false"
        :disabled="uploadLoading"
        :accept="acceptTypes"
        :http-request="customUploadRequest"
        :before-upload="handleBeforeUpload"
      >
        <el-button type="primary" icon="UploadFilled" plain :loading="uploadLoading"
          >{{ t('common.clickUploadCert') }}</el-button
        >
      </el-upload>
      <div class="upload-tip">{{ t('common.certUploadTip', { formats: acceptTypes }) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Key } from '@element-plus/icons-vue'
import { ElMessage, ElUpload } from 'element-plus'
import { request } from '@shared/api/request'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { getErrorMessage } from '@shared/api'

const { t } = useI18n()

const props = defineProps<{
  hostIp: string
}>()

const modelValue = defineModel<string>('modelValue')
const uploadLoading = defineModel<boolean>('uploadLoading')
const uploadRef = ref<InstanceType<typeof ElUpload>>()
const acceptTypes = '.crt,.pem,.cer,.cert,.key,.prop,.xml'

const handleBeforeUpload = async (file: File) => {
  const fileName = file.name
  const fileExtension = fileName.slice(((fileName.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase()

  // 校验扩展名
  const allowedExtensions = acceptTypes.split(',').map((ext) => ext.replace('.', ''))
  if (!allowedExtensions.includes(fileExtension)) {
    ElMessage.error(t('common.unsupportedFileFormat', { formats: acceptTypes }))
    return false
  }

  // 限制不能超过 1mb
  if (file.size && file.size > 1024 * 1024) {
    ElMessage.error(t('common.certFileSizeExceeded'))
    return false
  }

  return true
}

const handleRemove = () => {
  modelValue.value = ''
}

const customUploadRequest = (options: any) => {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const { file } = options

      // file 多个文件
      const formData = new FormData()
      formData.append('file', file)
      formData.append('filename', file.name)

      uploadLoading.value = true
      const res = await request.post(
        buildApiUrl(props.hostIp, API_CONFIG.PATHS.UPLOAD_CERT_BATCH),
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )
      modelValue.value = res?.data?.results?.[0]?.cert_hash ?? ''
      uploadRef.value?.clearFiles()
      resolve()
    } catch (error) {
      reject(error)
      ElMessage.error(getErrorMessage(error, t('common.uploadCertFailed')))
      modelValue.value = ''
    } finally {
      uploadLoading.value = false
    }
  })
}
</script>

<style scoped>
.upload-cert-container {
  width: 100%;
}

.uploaded-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.cert-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  overflow: hidden;
  line-height: 20px;
}

.cert-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.cert-detail {
  display: flex;
  flex-direction: column;
  justify-content: center;

  overflow: hidden;
}

.cert-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cert-hash {
  color: var(--el-text-color-regular);
  font-size: 12px;

  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cert-actions {
  display: flex;
  align-items: center;
  margin-left: 16px;
  flex-shrink: 0;
}

.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>
