<template>
  <VmosDialog v-model="visible" title="添加分组" width="350px" @closed="handleClose">
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="auto"
      label-position="top"
      @submit.prevent
    >
      <el-form-item label="分组名称" prop="name">
        <el-input
          v-model.trim="form.name"
          placeholder="请输入分组名称"
          maxlength="20"
          show-word-limit
          clearable
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleAddGroup">确定</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, Group } from '@shared/ipc/data.types'
import { ElForm, ElMessage } from 'element-plus'

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()

const rules = ref({
  name: [
    { required: true, message: '请输入分组名称', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/,
      message: '分组名称只能包含中英文、数字、下划线和横线',
      trigger: 'blur'
    }
  ]
})
const form = ref({
  name: ''
})

const handleClose = () => {
  formRef.value?.resetFields()
}

const handleAddGroup = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || loading.value) return
    try {
      loading.value = true
      const res = await ipc.invoke<Group>(DATA_EVENTS.ADD_GROUP, { name: form.value.name })
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

const init = () => {
  visible.value = true
}

defineExpose({
  init
})
</script>
