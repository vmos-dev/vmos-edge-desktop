<template>
  <VmosTable
    :data="data"
    :columns="columns"
    :selected-ids="selectedIds"
    border
    selectable
    row-key="id"
    :row-height="42"
    :header-height="45"
    @selection-change="handleSelectionChange"
  />
</template>

<script setup lang="tsx">
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { ElTag, ElButton, TableV2FixedDir } from 'element-plus'
import { CopyText } from '@renderer/components'
import { formatAndroidVersionLabel } from '@shared/constant/androidVersions'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export interface ImageItem {
  id: string
  name: string
  version: string
  androidVersion: string
  size: string
  importTime: string
}

defineProps<{
  data: ImageItem[]
  selectedIds?: string[]
}>()

const emit = defineEmits<{
  (e: 'delete', row: ImageItem): void
  (e: 'selection-change', rows: ImageItem[]): void
}>()

const handleSelectionChange = (rows: ImageItem[]) => {
  emit('selection-change', rows)
}

const columns = computed(() => [
  {
    key: 'name',
    dataKey: 'name',
    title: t('image.imageName'),
    width: 200,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'version',
    dataKey: 'version',
    title: t('image.imageVersion'),
    width: 220,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'androidVersion',
    dataKey: 'androidVersion',
    title: t('image.androidVersion'),
    width: 120,
    cellRenderer: ({ cellData }) => (
      <ElTag effect="light" round>
        {formatAndroidVersionLabel(cellData)}
      </ElTag>
    )
  },
  {
    key: 'size',
    dataKey: 'size',
    title: t('image.fileSize'),
    width: 120
  },
  {
    key: 'importTime',
    dataKey: 'importTime',
    title: t('image.importTime'),
    width: 180
  },
  {
    key: 'action',
    title: t('common.action'),
    width: 100,
    fixed: TableV2FixedDir.RIGHT,
    align: 'center' as const,
    cellRenderer: ({ rowData }) => (
      <ElButton
        type="danger"
        size="small"
        icon={Delete}
        plain
        onClick={() => emit('delete', rowData)}
      >
        {t('common.delete')}
      </ElButton>
    )
  }
])
</script>
