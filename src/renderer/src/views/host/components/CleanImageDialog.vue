<template>
  <VmosDialog
    v-model="visible"
    :title="`${t('host.cleanImage')} - ${hostIp}`"
    width="640px"
    :show-close="!deleting"
    @closed="handleClosed"
  >
    <div v-loading="loading" class="clean-image">
      <!-- 加载失败 -->
      <div v-if="loadError" class="load-error">
        <el-icon :size="40" color="var(--el-color-danger)"><WarningFilled /></el-icon>
        <span>{{ loadError }}</span>
        <el-button type="primary" size="small" @click="loadImages">
          {{ t('common.retry') }}
        </el-button>
      </div>

      <!-- 空 -->
      <el-empty
        v-else-if="!loading && images.length === 0"
        :description="t('host.noUnusedImage')"
      />

      <!-- 未使用镜像列表（多选） -->
      <div v-else class="image-table-wrap">
        <VmosTable
          :data="images"
          :columns="columns"
          :selected-ids="selectedIds"
          border
          selectable
          row-key="image_id"
          :row-height="42"
          :header-height="45"
          @selection-change="handleSelectionChange"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span class="selected-count">
          {{ t('host.selectedImageCount', { count: selectedIds.length }) }}
        </span>
        <div class="footer-spacer" />
        <el-button :disabled="deleting" @click="visible = false">
          {{ t('common.cancel') }}
        </el-button>
        <el-button
          type="danger"
          :loading="deleting"
          :disabled="selectedIds.length === 0 || loading"
          @click="handleClean"
        >
          {{ t('common.confirm') }}
        </el-button>
      </div>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import { CopyText } from '@renderer/components'
import { useI18n } from 'vue-i18n'
import { API_CONFIG, buildApiUrl, request } from '@shared/api'

defineOptions({ name: 'CleanImageDialog' })

interface HostImageItem {
  repository: string
  image_id: string
}

const { t } = useI18n()

const visible = ref(false)
const loading = ref(false)
const loadError = ref('')
const deleting = ref(false)
const hostIp = ref('')
const images = ref<HostImageItem[]>([])
const selectedRows = ref<HostImageItem[]>([])

const selectedIds = computed(() => selectedRows.value.map((row) => row.image_id))

const columns = computed(() => [
  {
    key: 'repository',
    dataKey: 'repository',
    title: t('host.imageRepository'),
    width: 320,
    flexGrow: 1,
    cellRenderer: ({ cellData }: { cellData: string }) => h(CopyText, { text: cellData })
  },
  {
    key: 'image_id',
    dataKey: 'image_id',
    title: t('host.imageId'),
    width: 220,
    cellRenderer: ({ cellData }: { cellData: string }) => h(CopyText, { text: cellData })
  }
])

const handleSelectionChange = (rows: HostImageItem[]) => {
  selectedRows.value = rows
}

// 查未使用镜像（get_img_list?unused=true，只返回未被容器引用、可独立删除的顶层镜像）
const loadImages = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const url = buildApiUrl(hostIp.value, API_CONFIG.PATHS.GET_HOST_IMG_LIST)
    const resp = await request.get(url, { unused: true })
    images.value = Array.isArray(resp?.data) ? resp.data : []
    selectedRows.value = []
  } catch {
    loadError.value = t('host.imageListLoadFailed')
  } finally {
    loading.value = false
  }
}

// 删选中镜像（prune_images?image=id1,id2）；被容器占用的会被后端拒绝，重拉列表后仍会在
const handleClean = async () => {
  const ids = selectedIds.value
  if (ids.length === 0) return

  try {
    await ElMessageBox.confirm(
      t('host.cleanImageSelectedConfirm', { count: ids.length }),
      t('common.tips'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
  } catch {
    return
  }

  deleting.value = true
  try {
    // 逗号分隔、逐个编码（保留逗号作分隔符），与后端 image=id1,id2 约定一致
    const imageParam = ids.map((id) => encodeURIComponent(id)).join(',')
    const url = buildApiUrl(hostIp.value, API_CONFIG.PATHS.CLEAN_IMAGE)
    await request.get(`${url}?image=${imageParam}`)
    ElMessage.success(t('host.cleanImageSuccess'))
    await loadImages()
  } catch (error: any) {
    ElMessage.error(error?.message || t('common.operationFailed'))
  } finally {
    deleting.value = false
  }
}

const handleClosed = () => {
  images.value = []
  selectedRows.value = []
  loadError.value = ''
  hostIp.value = ''
}

const init = (ip: string) => {
  hostIp.value = ip
  visible.value = true
  loadImages()
}

defineExpose({ init })
</script>

<style scoped lang="scss">
.clean-image {
  min-height: 220px;
}

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.image-table-wrap {
  height: 360px;
}

.dialog-footer {
  display: flex;
  align-items: center;
}

.footer-spacer {
  flex: 1;
}

.selected-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
