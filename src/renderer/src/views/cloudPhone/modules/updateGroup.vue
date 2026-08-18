<template>
  <VmosDialog
    v-model="visible"
    :title="t('cloudPhone.updateGroup')"
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
      <el-form-item :label="t('cloudPhone.groupName')" prop="name">
        <el-input
          v-model.trim="form.name"
          :placeholder="t('cloudPhone.groupNamePlaceholder')"
          clearable
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleAddGroup">{{
        t('common.confirm')
      }}</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, Group } from '@shared/ipc/data.types'
import { ElForm, ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()

const rules = computed(() => ({
  name: [
    { required: true, message: t('cloudPhone.enterGroupName'), trigger: 'blur' },
    { min: 1, max: 20, message: t('cloudPhone.groupNameLength'), trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/,
      message: t('cloudPhone.groupNameFormat'),
      trigger: 'blur'
    }
  ]
}))
const form = ref({
  id: '',
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
      const res = await ipc.invoke<Group>(DATA_EVENTS.UPDATE_GROUP, {
        id: form.value.id,
        name: form.value.name
      })
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

const init = (group: Group) => {
  form.value.id = group.id
  form.value.name = group.name
  visible.value = true
}

defineExpose({
  init
})
</script>
