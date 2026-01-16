<template>
  <div class="upload-cert-container">
    <!-- 已上传状态 -->
    <div v-if="modelValue" class="uploaded-state">
      <div class="cert-info">
        <el-icon class="cert-icon"><Key /></el-icon>
        <div class="cert-detail">
          <div class="cert-label">证书 (Hash)</div>
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
          <el-button type="primary" link size="small" :loading="uploadLoading">覆盖</el-button>
        </el-upload>
        <el-divider direction="vertical" />
        <el-button type="danger" link size="small" @click="handleRemove">删除</el-button>
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
          >点击上传证书</el-button
        >
      </el-upload>
      <div class="upload-tip">支持 {{ acceptTypes }} 格式，未上传时将使用系统默认证书</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Key } from '@element-plus/icons-vue'
import { ElMessage, ElUpload } from 'element-plus'
import { request } from '@shared/api/request'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { getErrorMessage } from '@shared/api'

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
    ElMessage.error(`不支持的文件格式，请上传 ${acceptTypes}`)
    return false
  }

  // 限制不能超过 1mb
  if (file.size && file.size > 1024 * 1024) {
    ElMessage.error('证书文件大小不能超过 1MB')
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
      ElMessage.error(getErrorMessage(error, '上传证书失败'))
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
  border: 1px solid #e4e7ed;
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
  color: #909399;
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
  color: #909399;
}

.cert-hash {
  color: #606266;
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
  color: #909399;
  line-height: 1.4;
}
</style>
