<template>
  <VmosDialog
    v-model="visible"
    title="添加主机"
    :show-close="!loading"
    width="500px"
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
      <el-form-item label="选择分组" prop="groupId">
        <el-select v-model="form.groupId" placeholder="请选择分组" style="width: 100%">
          <el-option
            v-for="group in groups"
            :key="group.id"
            :label="group.name"
            :value="group.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="主机IP" prop="ips">
        <el-input
          v-model="form.ips"
          type="textarea"
          :rows="4"
          placeholder="请输入主机IP，多个IP请用逗号隔开"
          clearable
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false" :disabled="loading">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleAddHost">确定</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, Group, Host } from '@shared/ipc/data.types'
import { API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api'
import { ElForm, ElMessage } from 'element-plus'

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()
const groups = ref<Group[]>([])

const validateIPs = (_rule: any, value: string, callback: any) => {
  if (!value) {
    return callback(new Error('请输入主机IP'))
  }
  const ips = value
    .split(/[,\n]/)
    .map((ip) => ip.trim())
    .filter((ip) => ip)
  if (ips.length === 0) {
    return callback(new Error('请输入主机IP'))
  }

  const ipRegex =
    /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  const invalidIps = ips.filter((ip) => !ipRegex.test(ip))

  if (invalidIps.length > 0) {
    return callback(new Error(`以下IP格式不正确: ${invalidIps.join(', ')}`))
  }
  callback()
}

const rules = ref({
  groupId: [{ required: true, message: '请选择分组', trigger: 'change' }],
  ips: [{ required: true, validator: validateIPs, trigger: 'blur' }]
})

const form = ref({
  groupId: '',
  ips: ''
})

const handleClose = () => {
  formRef.value?.resetFields()
  form.value = { groupId: '', ips: '' }
}

const fetchGroups = async () => {
  try {
    const res = await ipc.invoke<Group[]>(DATA_EVENTS.GET_GROUPS)
    if (res.success && res.data) {
      groups.value = res.data
      // 默认选中第一个分组
      if (groups.value.length > 0 && !form.value.groupId) {
        form.value.groupId = groups.value[0].id
      }
    }
  } catch (err) {
    console.error(err)
  }
}

const checkHeartbeat = async (ips: string[]) => {
  const checkPromises = ips.map(async (ip) => {
    try {
      const url = `http://${ip}:${API_CONFIG.DEFAULT_PORT}${API_CONFIG.PATHS.GET_HARDWARE_CFG}`
      const res = await request.get(url, null, { timeout: 3000 })

      if (!res?.data?.device_id) {
        return { ip, id: null, success: false }
      }

      return { ip, id: res?.data?.device_id, success: true }
    } catch (error) {
      return { ip, id: null, success: false }
    }
  })

  const results = await Promise.all(checkPromises)
  return results
}

const handleAddHost = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || loading.value) return
    try {
      loading.value = true
      let ips = form.value.ips
        .split(/[,\n]/)
        .map((ip) => ip.trim())
        .filter((ip) => ip)

      // 过滤已存在主机
      const existingHosts = await ipc.invoke<Host[]>(DATA_EVENTS.GET_HOSTS)
      if (existingHosts.success) {
        const existingIps = existingHosts.data?.map((host) => host.ip) ?? []

        ips = ips.filter((ip) => !existingIps.includes(ip))
      } else {
        ElMessage.error(existingHosts.error)
        return
      }

      if (!ips?.length) {
        ElMessage.warning('请勿重复添加主机')
        return
      }

      // 单次最多20个IP
      if (ips.length > 20) {
        ElMessage.warning('单次最多添加20个主机')
        return
      }

      // Heartbeat check
      const results = await checkHeartbeat(ips)
      const failed = results.filter((r) => !r.success)
      const success = results.filter((r) => r.success)
      if (failed.length > 0) {
        const failedIps = failed.map((r) => r.ip).join(', ')
        ElMessage.error(`以下主机检测失败(无法获取硬件配置)，无法添加: ${failedIps}`)
        return
      }

      const res = await ipc.invoke(DATA_EVENTS.ADD_HOST, {
        groupId: form.value.groupId,
        hosts: success
      })

      if (res.success) {
        ElMessage.success('操作成功')
        visible.value = false
      } else {
        ElMessage.error(res.error)
      }
    } finally {
      loading.value = false
    }
  })
}

const init = () => {
  visible.value = true
  fetchGroups()
}

defineExpose({
  init
})
</script>
