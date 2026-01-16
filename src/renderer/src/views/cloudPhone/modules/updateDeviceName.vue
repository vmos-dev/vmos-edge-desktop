<template>
  <VmosDialog v-model="visible" title="修改名称" width="350px" @closed="handleClose">
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="auto"
      label-position="top"
      @submit.prevent
    >
      <el-form-item label="新名称" prop="user_name">
        <el-input
          v-model.trim="form.user_name"
          placeholder="请输入新名称"
          maxlength="200"
          show-word-limit
          clearable
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleUpdateDeviceName">确定</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, toRaw } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, Device } from '@shared/ipc/data.types'
import { ElForm, ElMessage } from 'element-plus'

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()

const rules = ref({
  user_name: [
    { required: true, message: '请输入新名称', trigger: 'blur' },
    { min: 2, max: 200, message: '名称长度为2-200个字符', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9][a-zA-Z0-9\u4e00-\u9fa5_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
      message: '名称首尾字符必须是字母或数字，中间可包含中英文、数字、下划线和横线',
      trigger: 'blur'
    }
  ]
})
const form = ref({
  db_id: '',
  user_name: '',
  host_ip: ''
})

const handleClose = () => {
  formRef.value?.resetFields()
}

const handleUpdateDeviceName = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || loading.value) return
    try {
      loading.value = true
      const res = await ipc.invoke<Device>(DATA_EVENTS.UPDATE_DEVICE_NAME, toRaw(form.value))
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

const init = (device: Device) => {
  Object.assign(form.value, {
    db_id: device.db_id || '',
    user_name: device.user_name || '',
    host_ip: device.host_ip || ''
  })
  visible.value = true
}

defineExpose({
  init
})
</script>
