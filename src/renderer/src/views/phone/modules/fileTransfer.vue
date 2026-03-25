<template>
  <div class="file-transfer">
    <el-tabs v-model="activeTab" class="file-transfer-tabs">
      <el-tab-pane :label="t('phone.fileUpload')" name="upload">
        <upload-file
          :host="host"
          :device-id="deviceId"
          :title="t('phone.fileUpload')"
          :url="uploadUrl"
        />
      </el-tab-pane>
      <el-tab-pane :label="t('phone.downloadToLocal')" name="download">
        <download-to-local :device="device" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Device } from '@shared/ipc/data.types'
import { useI18n } from 'vue-i18n'
import uploadFile from './uploadFile.vue'
import downloadToLocal from './downloadToLocal.vue'

defineProps<{
  host: string
  deviceId: string
  device?: Device
  uploadUrl: string
}>()

const { t } = useI18n()

const activeTab = ref('upload')
</script>

<style scoped lang="scss">
.file-transfer {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.file-transfer-tabs {
  height: 100%;

  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0 20px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
  }

  :deep(.el-tabs__nav-wrap::after) {
    background-color: transparent;
  }

  :deep(.el-tabs__content) {
    height: calc(100% - 40px);
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}
</style>
