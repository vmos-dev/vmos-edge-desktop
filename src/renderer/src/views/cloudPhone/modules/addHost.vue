<template>
  <VmosDialog v-model="visible" :title="t('cloudPhone.addHost')" :show-close="!loading" width="500px"
    @closed="handleClose">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" label-position="top" @submit.prevent>
      <el-form-item :label="t('cloudPhone.selectHostGroup')" prop="groupId">
        <el-select v-model="form.groupId" :placeholder="t('cloudPhone.selectHostGroupPlaceholder')" style="width: 100%">
          <el-option v-for="group in groups" :key="group.id" :label="group.name" :value="group.id" />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('cloudPhone.hostIp')" prop="ips">
        <el-input v-model="form.ips" type="textarea" :rows="4" :placeholder="t('cloudPhone.hostIpPlaceholder')"
          clearable />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false" :disabled="loading">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleAddHost">{{ t('common.confirm') }}</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, Group } from '@shared/ipc/data.types'
import { API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api'
import { ElForm, ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()
const groups = ref<Group[]>([])

const ipv4Reg = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const ipv6Reg = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$/

const validateIPs = (_rule: any, value: string, callback: any) => {
  if (!value) {
    return callback(new Error(t('cloudPhone.enterHostIp')))
  }
  const ips = value
    .split(/[,\n]/)
    .map((ip) => ip.trim())
    .filter((ip) => ip)
  if (ips.length === 0) {
    return callback(new Error(t('cloudPhone.enterHostIp')))
  }

  const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/
  const invalidIps = ips.filter(ip => !ipv4Reg.test(ip) && !ipv6Reg.test(ip) && !domainRegex.test(ip))

  if (invalidIps.length > 0) {
    return callback(new Error(t('cloudPhone.invalidIpFormat', { ips: invalidIps.join(', ') })))
  }
  callback()
}

const rules = computed(() => ({
  groupId: [{ required: true, message: t('cloudPhone.selectGroup'), trigger: 'change' }],
  ips: [{ required: true, validator: validateIPs, trigger: 'blur' }]
}))

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
      groups.value = res.data?.filter((group) => !group.type || group.type === 'host') ?? []
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
      let ipsArr = form.value.ips.split(/[,\n]/)
      let ips: string[] = []
      for (let ip of ipsArr) {
        const ipOrDomain = ip.trim()
        if (!ipOrDomain) continue
        if (ipv4Reg.test(ipOrDomain) || ipv6Reg.test(ipOrDomain)) {
          ips.push(ipOrDomain)
        } else {
          try {
            const res = await ipc.invoke<string>(DATA_EVENTS.RESOLVE_DOMAIN, ipOrDomain)
            if (res.success && res.data) {
              ips.push(res.data)
            }
          } catch (e) { }
        }
      }

      console.log(ips)
      if (!ips?.length) {
        ElMessage.warning(t('cloudPhone.enterValidHostAddress'))
        return
      }


      // 单次最多20个IP
      if (ips.length > 20) {
        ElMessage.warning(t('cloudPhone.max20Hosts'))
        return
      }

      // Heartbeat check
      const results = await checkHeartbeat(ips)
      const failed = results.filter((r) => !r.success)
      const success = results.filter((r) => r.success)
      if (failed.length > 0) {
        const failedIps = failed.map((r) => r.ip).join(', ')
        ElMessage.error(t('cloudPhone.hostCheckFailed', { ips: failedIps }))
        return
      }

      const res = await ipc.invoke(DATA_EVENTS.ADD_HOST, {
        groupId: form.value.groupId,
        hosts: success
      })

      if (res.success) {
        ElMessage.success(t('common.operationSuccess'))
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
