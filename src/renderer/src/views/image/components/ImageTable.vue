<template>
  <VmosTable :data="data" :columns="columns" border :row-height="42" :header-height="45">
  </VmosTable>
</template>

<script setup lang="tsx">
import { Delete } from '@element-plus/icons-vue'
import { ElTag, ElButton, TableV2FixedDir } from 'element-plus'
import { CopyText } from '@renderer/components'

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
}>()

const emit = defineEmits<{
  (e: 'delete', row: ImageItem): void
}>()

const columns = [
  {
    key: 'name',
    dataKey: 'name',
    title: '镜像名称',
    width: 200,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'version',
    dataKey: 'version',
    title: '镜像版本',
    width: 220,
    flexGrow: 1,
    cellRenderer: ({ cellData }) => <CopyText text={cellData} />
  },
  {
    key: 'androidVersion',
    dataKey: 'androidVersion',
    title: 'Android版本',
    width: 120,
    cellRenderer: ({ cellData }) => (
      <ElTag effect="light" round>
        Android {cellData}
      </ElTag>
    )
  },
  {
    key: 'size',
    dataKey: 'size',
    title: '文件大小',
    width: 120
  },
  {
    key: 'importTime',
    dataKey: 'importTime',
    title: '导入时间',
    width: 180
  },
  {
    key: 'action',
    title: '操作',
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
        删除
      </ElButton>
    )
  }
]
</script>
