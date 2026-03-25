<template>
  <VmosDialog
    v-model="visible"
    :title="
      t('cloudPhone.moveToGroup', {
        type: mode === 'host' ? t('cloudPhone.host') : t('cloudPhone.cloudDevice'),
        group: groupName || ''
      })
    "
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
      <el-form-item
        :label="mode === 'host' ? t('host.title') : t('cloudPhone.deviceName')"
        prop="selectedIds"
      >
        <el-select
          v-model="form.selectedIds"
          multiple
          filterable
          collapse-tags
          :max-collapse-tags="2"
          :placeholder="mode === 'host' ? t('cloudPhone.selectHost') : t('cloudPhone.selectDevice')"
          clearable
        >
          <el-option
            v-for="item in candidates"
            :key="item.id"
            :label="item.label"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" :loading="loading" @click="handleMove">{{
        t('common.confirm')
      }}</el-button>
    </template>
  </VmosDialog>
</template>

<script setup lang="ts">
import { ref, toRaw, computed } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { DATA_EVENTS, Group, FlatData, DeviceState } from '@shared/ipc/data.types'
import { ElForm, ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()
const mode = ref<'host' | 'device'>('host')

const rules = computed(() => ({
  selectedIds: [
    {
      required: true,
      message: mode.value === 'host' ? t('cloudPhone.selectHost') : t('cloudPhone.selectDevice'),
      trigger: 'change'
    }
  ]
}))

const form = ref({
  groupId: '',
  selectedIds: [] as string[]
})
const groupName = ref('')
const candidates = ref<Array<{ id: string; label: string }>>([])

const compareText = (a: string, b: string) =>
  a.localeCompare(b, 'zh-CN', {
    numeric: true,
    sensitivity: 'base'
  })

const toIpv4Segments = (value: string) => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return null
  }

  const segments = value.split('.').map((item) => Number(item))
  if (segments.some((segment) => segment < 0 || segment > 255)) {
    return null
  }

  return segments
}

const compareIpOrText = (a: string, b: string) => {
  const aSegments = toIpv4Segments(a)
  const bSegments = toIpv4Segments(b)

  if (aSegments && bSegments) {
    for (let index = 0; index < 4; index += 1) {
      const diff = aSegments[index] - bSegments[index]
      if (diff !== 0) {
        return diff
      }
    }
    return 0
  }

  return compareText(a, b)
}

const getData = async () => {
  const res = await ipc.invoke<FlatData>(DATA_EVENTS.GET_FLAT_DATA)
  if (res.success && res.data) {
    const { groups, hosts, devices } = res.data
    const groupMap = new Map(groups.map((g) => [g.id, g.name]))

    if (mode.value === 'host') {
      candidates.value = hosts
        .filter((h) => h.groupId !== form.value.groupId)
        .map((h) => {
          const groupLabel = groupMap.get(h.groupId || 'default') || t('cloudPhone.defaultGroup')
          const ipOrName = h.ip || h.name || h.id

          return {
            id: h.id,
            groupSort: groupLabel,
            ipSort: ipOrName,
            label: `${ipOrName} (${groupLabel})`
          }
        })
        .sort((a, b) => {
          const groupCompare = compareText(a.groupSort, b.groupSort)
          if (groupCompare !== 0) {
            return groupCompare
          }
          return compareIpOrText(a.ipSort, b.ipSort)
        })
        .map(({ id, label }) => ({ id, label }))
    } else {
      const validHostIds = new Set(hosts.map((h) => h.id))
      const validHostIps = new Set(hosts.map((h) => h.ip).filter((ip) => !!ip))

      candidates.value = devices
        .filter((d) => {
          // 过滤逻辑：如果设备离线 且 找不到对应主机，则视为脏数据隐藏
          if (d.state === DeviceState.StateOffline) {
            const hasValidHost =
              (d.hostId && validHostIds.has(d.hostId)) || (d.host_ip && validHostIps.has(d.host_ip))
            if (!hasValidHost) {
              return false
            }
          }
          return (d.groupId || 'device_default') !== form.value.groupId
        })
        .map((d) => {
          const groupLabel =
            groupMap.get(d.groupId || 'device_default') || t('cloudPhone.defaultGroup')
          const name = d.user_name || d.id
          return {
            id: d.id,
            groupSort: groupLabel,
            nameSort: name,
            label: `${name} (${groupLabel})`
          }
        })
        .sort((a, b) => {
          const groupCompare = compareText(a.groupSort, b.groupSort)
          if (groupCompare !== 0) {
            return groupCompare
          }
          return compareText(a.nameSort, b.nameSort)
        })
        .map(({ id, label }) => ({ id, label }))
    }
  }
}

const handleClose = () => {
  formRef.value?.resetFields()
}

const handleMove = () => {
  formRef.value?.validate(async (valid) => {
    if (!valid || loading.value) return

    try {
      loading.value = true

      let res
      if (mode.value === 'host') {
        res = await ipc.invoke<void>(DATA_EVENTS.MOVE_HOSTS, {
          groupId: form.value.groupId,
          hostIds: toRaw(form.value.selectedIds)
        })
      } else {
        res = await ipc.invoke<void>(DATA_EVENTS.MOVE_DEVICES, {
          groupId: form.value.groupId,
          deviceIds: toRaw(form.value.selectedIds)
        })
      }

      if (res.success) {
        ElMessage.success(t('common.operationSuccess'))
        visible.value = false
      } else {
        ElMessage.error(res.error)
      }
      loading.value = false
    } catch {
      loading.value = false
    }
  })
}

const init = (group: Group, currentMode: 'host' | 'device' = 'host') => {
  form.value.groupId = group.id
  form.value.selectedIds = []
  groupName.value = group.name
  mode.value = currentMode
  getData()
  visible.value = true
}

defineExpose({
  init
})
</script>
