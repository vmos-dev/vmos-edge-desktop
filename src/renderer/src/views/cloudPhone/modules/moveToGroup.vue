<template>
  <VmosDialog
    v-model="visible"
    :title="t('cloudPhone.moveGroup')"
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
      <el-form-item :label="t('cloudPhone.targetGroup')" prop="groupId">
        <el-select
          v-model="form.groupId"
          :placeholder="t('cloudPhone.selectGroup')"
          style="width: 100%"
        >
          <el-option v-for="g in groups" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleConfirm">{{
        t('common.confirm')
      }}</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, computed, toRaw } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, type Group, type FlatData } from '@shared/ipc/data.types'
import { ElForm, ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  moved: []
}>()

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()
const mode = ref<'host' | 'device'>('host')
const ids = ref<string[]>([])

const rules = computed(() => ({
  groupId: [
    {
      required: true,
      message: t('cloudPhone.selectGroup'),
      trigger: 'change'
    }
  ]
}))

const form = ref({
  groupId: ''
})

const groups = ref<Group[]>([])

const loadGroups = async () => {
  const res = await ipc.invoke<FlatData>(DATA_EVENTS.GET_FLAT_DATA)
  if (res.success && res.data) {
    if (mode.value === 'host') {
      groups.value = res.data.groups.filter((g) => !g.type || g.type === 'host')
    } else {
      groups.value = res.data.groups.filter((g) => g.type === 'device')
    }
  }
}

const handleClose = () => {
  formRef.value?.resetFields()
  ids.value = []
}

const handleConfirm = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || loading.value) return

    try {
      loading.value = true

      let res
      if (mode.value === 'host') {
        res = await ipc.invoke<void>(DATA_EVENTS.MOVE_HOSTS, {
          groupId: form.value.groupId,
          hostIds: toRaw(ids.value)
        })
      } else {
        res = await ipc.invoke<void>(DATA_EVENTS.MOVE_DEVICES, {
          groupId: form.value.groupId,
          deviceIds: toRaw(ids.value)
        })
      }

      if (res.success) {
        ElMessage.success(t('common.operationSuccess'))
        visible.value = false
        emit('moved')
      } else {
        ElMessage.error(res.error)
      }
    } finally {
      loading.value = false
    }
  })
}

const init = (selectedIds: string[], currentMode: 'host' | 'device' = 'host') => {
  ids.value = [...selectedIds]
  mode.value = currentMode
  form.value.groupId = ''
  loadGroups()
  visible.value = true
}

defineExpose({
  init
})
</script>
