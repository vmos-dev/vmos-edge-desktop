<template>
  <VmosDialog
    v-model="visible"
    :title="t('cloudPhone.updateDeviceName')"
    width="350px"
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
      <el-form-item :label="t('cloudPhone.newName')" prop="user_name">
        <el-input
          v-model.trim="form.user_name"
          :placeholder="t('cloudPhone.newNamePlaceholder')"
          maxlength="200"
          show-word-limit
          clearable
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleUpdateDeviceName">{{
        t('common.confirm')
      }}</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, toRaw, computed } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, Device } from '@shared/ipc/data.types'
import { ElForm, ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()

const rules = computed(() => ({
  user_name: [
    { required: true, message: t('cloudPhone.newNamePlaceholder'), trigger: 'blur' },
    { min: 2, max: 200, message: t('cloudPhone.nameLength'), trigger: 'blur' },
    {
      // 这个正则表达式的含义：允许由字母（大小写）、数字、下划线、点、短横线、@符号和中文字符组成，长度至少为1个字符，且可以是这些字符的任意组合。
      pattern: /^[a-zA-Z0-9_.@\-\u4e00-\u9fa5]+$/,
      message: t('cloudPhone.nameFormat'),
      trigger: 'blur'
    }
  ]
}))
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
        ElMessage.success(t('common.operationSuccess'))
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
