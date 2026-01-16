<template>
  <VmosDialog
    v-model="visible"
    :title="`移动主机到分组(${groupName || ''})`"
    width="400px"
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
      <el-form-item label="主机" prop="hostIds">
        <el-select
          v-model="form.hostIds"
          multiple
          filterable
          collapse-tags
          :max-collapse-tags="2"
          placeholder="请选择主机"
          clearable
        >
          <el-option
            v-for="item in hosts"
            :key="item.id"
            :label="`${item.ip}(${item.groupName})`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleMoveHosts">确定</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, toRaw } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, Group, Host } from '@shared/ipc/data.types'
import { ElForm, ElMessage } from 'element-plus'

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()

const rules = ref({
  hostIds: [{ required: true, message: '请选择主机', trigger: 'change' }]
})
const form = ref({
  groupId: '',
  hostIds: []
})
const groupName = ref('')
const hosts = ref<(Host & { groupName: string | null })[]>([])

const getHosts = async () => {
  const res = await ipc.invoke<(Host & { groupName: string | null })[]>(DATA_EVENTS.GET_HOSTS)
  if (res.success) {
    hosts.value = res.data?.filter((item) => item.groupId !== form.value.groupId) ?? []
  }
}

const handleClose = () => {
  formRef.value?.resetFields()
}

const handleMoveHosts = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || loading.value) return

    try {
      loading.value = true

      const res = await ipc.invoke<void>(DATA_EVENTS.MOVE_HOSTS, {
        groupId: form.value.groupId,
        hostIds: toRaw(form.value.hostIds)
      })
      console.log(res)
      if (res.success) {
        ElMessage.success('操作成功')
        visible.value = false
      } else {
        ElMessage.error(res.error)
      }
      loading.value = false
    } catch (err) {
      loading.value = false
    }
  })
}

const init = (group: Group) => {
  form.value.groupId = group.id
  groupName.value = group.name
  getHosts()
  visible.value = true
}

defineExpose({
  init
})
</script>
