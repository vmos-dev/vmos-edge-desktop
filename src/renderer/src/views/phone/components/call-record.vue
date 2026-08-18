<template>
  <div class="call-record-container">
    <!-- 左侧：新增通话记录表单 -->
    <div class="call-form-panel">
      <div class="panel-header contact">
        <h3 class="panel-title">{{ t('phone.callRecord.addCallRecord') }}</h3>
      </div>
      <div class="form-content">
        <el-form
          ref="formRef"
          :model="formData"
          :rules="formRules"
          label-width="auto"
          class="call-form"
          label-position="top"
        >
          <el-form-item :label="t('phone.callRecord.phoneNumber')" prop="number" required>
            <el-autocomplete
              v-model="formData.number"
              :fetch-suggestions="queryContacts"
              :placeholder="t('phone.callRecord.enterNumberOrSelectContact')"
              clearable
              value-key="phone"
              @select="handleContactSelect as any"
              style="width: 100%"
            >
              <template #default="{ item }">
                <div class="autocomplete-item">
                  <el-avatar :size="24" :style="getAvatarStyle">
                    {{ item.name?.charAt(0) || '?' }}
                  </el-avatar>
                  <div class="autocomplete-info">
                    <div class="autocomplete-name" :title="item.name">
                      {{ item.name }}
                    </div>
                    <div class="autocomplete-phone" :title="item.phone">{{ item.phone }}</div>
                  </div>
                </div>
              </template>
            </el-autocomplete>
          </el-form-item>
          <el-form-item :label="t('phone.callRecord.callType')" prop="type" required>
            <el-select
              v-model="formData.type"
              :placeholder="t('phone.callRecord.selectCallType')"
              style="width: 100%"
            >
              <el-option :label="t('phone.callRecord.type.incoming')" :value="1">
                <div class="call-type-option">
                  <el-icon class="call-type-icon incoming">
                    <Phone />
                  </el-icon>
                  <span>{{ t('phone.callRecord.type.incoming') }}</span>
                </div>
              </el-option>
              <el-option :label="t('phone.callRecord.type.outgoing')" :value="2">
                <div class="call-type-option">
                  <el-icon class="call-type-icon outgoing">
                    <PhoneFilled />
                  </el-icon>
                  <span>{{ t('phone.callRecord.type.outgoing') }}</span>
                </div>
              </el-option>
              <el-option :label="t('phone.callRecord.type.missed')" :value="3">
                <div class="call-type-option">
                  <el-icon class="call-type-icon missed">
                    <Phone />
                  </el-icon>
                  <span>{{ t('phone.callRecord.type.missed') }}</span>
                </div>
              </el-option>
              <el-option :label="t('phone.callRecord.type.rejected')" :value="5">
                <div class="call-type-option">
                  <el-icon class="call-type-icon rejected">
                    <Close />
                  </el-icon>
                  <span>{{ t('phone.callRecord.type.rejected') }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item :label="t('phone.callRecord.callTime')" prop="date" required>
            <el-date-picker
              v-model="formData.date"
              type="datetime"
              :placeholder="t('phone.callRecord.selectTime')"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="x"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item :label="t('phone.callRecord.callDuration')" prop="duration">
            <el-input-number
              v-model="formData.duration"
              :min="0"
              :max="86400"
              :placeholder="t('phone.callRecord.enterCallDuration')"
              style="width: 100%"
            />
            <div class="form-tip">{{ t('phone.callRecord.durationTip') }}</div>
          </el-form-item>
          <el-form-item class="submit-form-item">
            <el-button type="primary" @click="handleSubmit" :loading="submitting">
              <el-icon class="el-icon--left">
                <Plus />
              </el-icon>
              {{ t('phone.callRecord.addRecord') }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 右侧：通话记录列表 -->
    <div class="call-list-panel">
      <div class="panel-header">
        <h3 class="panel-title">{{ t('phone.callRecord.callRecord') }}</h3>
        <div class="header-actions">
          <!-- <el-button plain type="warning" text size="small" icon="Delete" @click="handleClearAll"
            :disabled="callLogList.length === 0">
            清空
          </el-button> -->
          <el-button
            plain
            type="danger"
            text
            size="small"
            icon="Delete"
            @click="handleBatchDelete"
            :disabled="selectedIds.length === 0"
          >
            {{ t('phone.callRecord.delete')
            }}{{ selectedIds.length > 0 ? `(${selectedIds.length})` : '' }}
          </el-button>
        </div>
      </div>
      <!-- 全选操作栏 -->
      <div v-if="callLogList.length > 0" class="select-all-bar">
        <el-checkbox
          :model-value="isAllSelected"
          :indeterminate="isIndeterminate"
          @change="handleSelectAll"
          class="select-all-checkbox"
        >
          {{ t('phone.callRecord.selectAll') }}
        </el-checkbox>
        <span class="selected-count">{{
          t('phone.callRecord.selectedCount', { count: selectedIds.length })
        }}</span>
      </div>
      <div class="call-list">
        <div class="call-list-content">
          <div
            v-for="(callLog, index) in callLogList"
            :key="callLog.id"
            class="call-item"
            :class="{ selected: selectedIds.includes(callLog.id) }"
          >
            <el-checkbox
              :model-value="selectedIds.includes(callLog.id)"
              @change="handleSelectChange(callLog.id, $event)"
              @click.stop
              class="call-checkbox"
            />
            <div class="call-content">
              <div class="call-avatar">
                <el-avatar :size="36" :style="getAvatarStyle">
                  {{ (callLog?.contact?.display_name ?? callLog.number)?.charAt(0) || '?' }}
                </el-avatar>
              </div>
              <div class="call-info">
                <!-- 第一行：电话（左）和类型（右） -->
                <div class="call-header">
                  <div class="call-name" :title="callLog?.contact?.display_name ?? callLog.number">
                    {{ callLog?.contact?.display_name ?? callLog.number }}
                  </div>
                  <div class="call-type-badge" :class="getCallTypeClass(callLog.type)">
                    <el-icon class="call-type-icon-small">
                      <Phone v-if="callLog.type === 1 || callLog.type === 3" />
                      <PhoneFilled v-else-if="callLog.type === 2" />
                      <Close v-else-if="callLog.type === 5" />
                    </el-icon>
                    <span>{{ callLog.typeText }}</span>
                  </div>
                </div>
                <!-- 第二行：接听时间（左）和电话时间（右） -->
                <div class="call-time-row">
                  <div class="call-duration" v-if="callLog.duration > 0">
                    <el-icon class="duration-icon">
                      <Timer />
                    </el-icon>
                    <span>{{ callLog.formattedDuration }}</span>
                  </div>
                  <div v-else class="call-duration-placeholder"></div>
                  <div class="call-time">{{ callLog.formattedDate }}</div>
                </div>
              </div>
            </div>
            <div class="call-divider" v-if="index < callLogList.length - 1"></div>
          </div>
        </div>

        <div v-if="callLogList.length === 0" class="empty-state">
          <el-empty :description="t('phone.callRecord.noCallRecord')" :image-size="100" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, onUnmounted, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElMessage,
  ElMessageBox,
  ElForm,
  ElFormItem,
  ElSelect,
  ElOption,
  ElDatePicker,
  ElAutocomplete,
  ElIcon,
  ElInputNumber
} from 'element-plus'
import { Phone, PhoneFilled, Plus, Close, Timer } from '@element-plus/icons-vue'

const { t } = useI18n()
import { request } from '@shared/api'
import { formatTime } from '@renderer/utils'
import {
  API_CONTROL_CONFIG,
  buildDeviceApiUrl,
  type CallLogRecord,
  type CallLogListApiResponse,
  type AddCallLogRequest,
  type DeleteCallLogListRequest,
  type Contact,
  type ContactListApiResponse,
  CallLogType
} from '@shared/api'
import { getErrorMessage } from '@shared/api'
import type { Device } from '@shared/ipc/data.types'

defineOptions({ name: 'CallRecord' })

// 从父组件获取设备信息（通过 inject）
const phoneDevice = inject<Ref<Device | undefined>>('phoneDevice')
const deviceIdRef = inject<Ref<string>>('deviceId')

// 获取设备信息
const getDeviceInfo = () => {
  const device = phoneDevice?.value
  if (!device) {
    throw new Error(t('phone.multimedia.deviceInfoUnavailable'))
  }

  const hostIp = device.host_ip || ''
  const dbId = device.db_id || deviceIdRef?.value || ''

  if (!hostIp || !dbId) {
    throw new Error(t('phone.multimedia.deviceIpOrIdUnavailable'))
  }

  return { hostIp, dbId }
}

// 联系人列表
const contactList = ref<Contact[]>([])
const loadingContacts = ref(false)

// 选中的通话记录ID列表
const selectedIds = ref<string[]>([])

// 通话记录列表
const callLogList = ref<CallLogRecord[]>([])
const loading = ref(false)

// 计算是否全选
const isAllSelected = computed(() => {
  return callLogList.value.length > 0 && selectedIds.value.length === callLogList.value.length
})

// 计算是否半选状态
const isIndeterminate = computed(() => {
  return selectedIds.value.length > 0 && selectedIds.value.length < callLogList.value.length
})

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()
const submitting = ref(false)

// 表单初始值
const initialFormData: AddCallLogRequest = {
  number: '',
  type: CallLogType.INCOMING,
  date: Date.now(),
  duration: 0
}

// 表单数据
const formData = reactive<AddCallLogRequest>({ ...initialFormData })

// 表单验证规则
const formRules = computed(() => ({
  number: [{ required: true, message: t('phone.callRecord.enterPhoneNumber'), trigger: 'blur' }],
  type: [
    { required: true, message: t('phone.callRecord.selectCallTypeRequired'), trigger: 'change' }
  ],
  date: [
    { required: true, message: t('phone.callRecord.selectCallTimeRequired'), trigger: 'change' }
  ]
}))

// 获取头像样式
const getRandomColor = () => {
  const r = Math.floor(Math.random() * 200 + 30)
  const g = Math.floor(Math.random() * 200 + 30)
  const b = Math.floor(Math.random() * 200 + 30)
  return { r, g, b }
}

const getAvatarStyle = () => {
  const { r, g, b } = getRandomColor()
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    color: `rgb(${r}, ${g}, ${b})`,
    fontWeight: 600,
    fontSize: '16px'
  }
}

// 获取通话类型样式类
const getCallTypeClass = (type: number) => {
  const typeMap: Record<number, string> = {
    1: 'type-incoming', // 来电
    2: 'type-outgoing', // 去电
    3: 'type-missed', // 未接
    5: 'type-rejected' // 拒接
  }
  return typeMap[type] || 'type-incoming'
}

// 格式化通话时长（秒 -> HH:mm:ss）
const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// 获取通话类型文本
const getCallTypeText = (type: number): string => {
  const typeMap: Record<number, string> = {
    1: t('phone.callRecord.type.incoming'),
    2: t('phone.callRecord.type.outgoing'),
    3: t('phone.callRecord.type.missed'),
    4: t('phone.callRecord.type.voicemail'),
    5: t('phone.callRecord.type.rejected')
  }
  return typeMap[type] || t('phone.callRecord.type.unknown')
}

// 查询联系人（用于 autocomplete）
const queryContacts = (
  queryString: string,
  cb: (results: Array<{ name: string; phone: string; value: string }>) => void
) => {
  const results = contactList.value
    .filter((contact) => {
      if (!queryString) return true
      const keyword = queryString.toLowerCase()
      return contact.name.toLowerCase().includes(keyword) || contact.phone.includes(keyword)
    })
    .map((contact) => ({
      name: contact.name,
      phone: contact.phone,
      value: contact.phone
    }))
  cb(results)
}

// 加载联系人列表
const loadContactList = async () => {
  try {
    loadingContacts.value = true
    const { hostIp, dbId } = getDeviceInfo()

    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.GET_CONTACT_LIST)
    const response = await request.get<ContactListApiResponse>(
      url,
      { offset: 0, limit: 999 },
      { timeout: 5000 }
    )

    const list = response?.data?.list || response?.data?.contacts
    if (list && Array.isArray(list)) {
      contactList.value = list.map(
        (contact): Contact => ({
          id: String(contact._id),
          name: contact.display_name || '',
          phone: contact.phones?.[0] || '',
          phones: contact.phones
        })
      )
    } else {
      contactList.value = []
    }
  } catch (error: any) {
    console.error('获取联系人列表失败:', error)
    ElMessage.error(getErrorMessage(error) || t('phone.callRecord.getContactListFailed'))
  } finally {
    loadingContacts.value = false
  }
}

// 选择联系人（autocomplete）- 只填充手机号
const handleContactSelect = (item: Record<string, any>) => {
  formData.number = item.phone || item.value || ''
}

// 处理全选/取消全选
const handleSelectAll = (checked: boolean | string | number) => {
  if (checked) {
    selectedIds.value = callLogList.value.map((callLog) => callLog.id)
  } else {
    selectedIds.value = []
  }
}

// 处理选择变化
const handleSelectChange = (id: string, checked: boolean | string | number) => {
  if (checked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
  } else {
    const index = selectedIds.value.indexOf(id)
    if (index > -1) {
      selectedIds.value.splice(index, 1)
    }
  }
}

// 获取通话记录列表
const loadCallLogList = async () => {
  try {
    loading.value = true
    const { hostIp, dbId } = getDeviceInfo()

    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.GET_CALL_LOG_LIST)
    const response = await request.get<CallLogListApiResponse>(
      url,
      { offset: 0, limit: 999 },
      { timeout: 5000 }
    )

    const list = response?.data?.list || response?.data?.calllog_list

    if (list && Array.isArray(list)) {
      callLogList.value = list.map(
        (callLog): CallLogRecord => ({
          id: String(callLog._id),
          number: callLog.number,
          type: callLog.type,
          date: callLog.date,
          duration: callLog.duration || 0,
          contact: callLog.contact,
          formattedDate: formatTime(callLog.date, 'yyyy-MM-dd HH:mm:ss'),
          formattedDuration: formatDuration(callLog.duration || 0),
          typeText: getCallTypeText(callLog.type)
        })
      )
    } else {
      callLogList.value = []
    }
  } catch (error: any) {
    console.error('获取通话记录列表失败:', error)
    ElMessage.error(getErrorMessage(error) || t('phone.callRecord.getCallListFailed'))
  } finally {
    loading.value = false
  }
}

// 清空所有通话记录
// const handleClearAll = async () => {
//   if (callLogList.value.length === 0) {
//     ElMessage.warning('没有可清空的通话记录')
//     return
//   }

//   try {
//     await ElMessageBox.confirm(
//       `确定要清空所有 ${callLogList.value.length} 条通话记录吗？此操作不可恢复！`,
//       '确认清空',
//       {
//         confirmButtonText: '确定',
//         cancelButtonText: '取消',
//         type: 'warning',
//         confirmButtonClass: 'el-button--danger'
//       }
//     )

//     const { hostIp, dbId } = getDeviceInfo()
//     const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.CLEAR_CALL_LOG)
//     const response = await request.post(url)

//     const deletedCount = response?.data || 0
//     await loadCallLogList()

//     ElMessage.success(`成功清空 ${deletedCount} 条通话记录`)
//   } catch (error: any) {
//     if (error !== 'cancel') {
//       console.error('清空通话记录失败:', error)
//       ElMessage.error(getErrorMessage(error) || '清空通话记录失败')
//     }
//   }
// }

// 批量删除
const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning(t('phone.callRecord.selectCallToDelete'))
    return
  }

  const selectedCount = selectedIds.value.length

  try {
    await ElMessageBox.confirm(
      t('phone.callRecord.confirmDeleteCall', { count: selectedCount }),
      t('phone.callRecord.confirmDelete'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    const { hostIp, dbId } = getDeviceInfo()

    // 使用批量删除 API
    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.DELETE_CALL_LOG_LIST)
    const deleteData: DeleteCallLogListRequest = {
      ids: selectedIds.value.map((id) => Number(id))
    }

    const response = await request.post<{ data: number }>(url, deleteData)
    const deletedCount = response?.data || selectedIds.value.length

    selectedIds.value = []

    await loadCallLogList()

    ElMessage.success(t('phone.callRecord.successDeleteCall', { count: deletedCount }))
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除通话记录失败:', error)
      ElMessage.error(getErrorMessage(error) || t('phone.callRecord.deleteCallFailed'))
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid || submitting.value) return

    try {
      submitting.value = true
      const { hostIp, dbId } = getDeviceInfo()

      const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.ADD_CALL_LOG)
      const addCallLogData: AddCallLogRequest = {
        number: formData.number,
        type: formData.type ?? CallLogType.INCOMING,
        date: formData.date ?? Date.now(),
        duration: formData.duration ?? 0
      }
      await request.post(url, addCallLogData)

      ElMessage.success(t('phone.multimedia.operationSuccess'))

      // 重新加载列表
      await loadCallLogList()
    } catch (error: any) {
      console.error('添加通话记录失败:', error)
      ElMessage.error(getErrorMessage(error) || t('phone.callRecord.addCallFailed'))
    } finally {
      submitting.value = false
    }
  })
}

// 定时器引用
let refreshTimer: NodeJS.Timeout | null = null

// 组件挂载时加载通话记录列表和联系人列表
onMounted(() => {
  loadCallLogList()
  loadContactList()

  // 启动定时刷新，每3秒刷新一次通话记录
  refreshTimer = setInterval(() => {
    loadCallLogList()
  }, 5000)
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped lang="scss">
.call-record-container {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
  box-sizing: border-box;
}

.call-form-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;
}

.call-list-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;

  .call-list::-webkit-scrollbar {
    width: 0;
    background: transparent;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 9px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color-page);
  min-height: 32px;
  box-sizing: border-box;
  padding-right: 0px;

  .header-actions {
    display: flex;
    align-items: center;
  }
}

.panel-header.contact {
  padding: 9px;
}

.panel-title {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-primary);
  line-height: 1.5;
}

.form-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.call-form {
  :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--el-text-color-regular);
    font-weight: 500;
    padding-right: 12px;
  }

  :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  .submit-form-item {
    :deep(.el-form-item__content) {
      display: flex;
      justify-content: flex-end;
    }
  }

  .form-tip {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
  }
}

.call-type-option {
  display: flex;
  align-items: center;
  gap: 8px;

  .call-type-icon {
    font-size: 16px;

    &.incoming {
      color: var(--el-color-success);
    }

    &.outgoing {
      color: var(--el-color-primary);
    }

    &.missed {
      color: var(--el-color-warning);
    }

    &.rejected {
      color: var(--el-color-danger);
    }
  }
}

.select-all-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 16px;
  background: var(--el-bg-color-page);
  border-bottom: 1px solid var(--el-border-color);
  flex-shrink: 0;
  min-height: 32px;

  .select-all-checkbox {
    :deep(.el-checkbox__label) {
      font-size: 12px;
      color: var(--el-text-color-regular);
      font-weight: 500;
    }
  }

  .selected-count {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}

.call-list {
  flex: 1;
  overflow-y: auto;
  background: var(--el-bg-color);
}

.call-list-content {
  padding: 0;
}

.call-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  transition: background-color 0.15s ease;
  background: var(--el-bg-color);
  box-sizing: border-box;

  &:hover:not(.selected) {
    background: var(--el-bg-color-page);
  }

  &.selected {
    background: var(--el-color-primary-light-9);
  }

  .call-checkbox {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .call-content {
    flex: 1;
    display: flex;
    gap: 12px;
    min-width: 0;
  }

  .call-avatar {
    flex-shrink: 0;
  }

  .call-info {
    flex: 1;
    min-width: 0;
  }

  .call-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
    gap: 8px;
  }

  .call-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .call-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;

    &.type-incoming {
      background: var(--el-color-success-light-9);
      color: var(--el-color-success);
    }

    &.type-outgoing {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }

    &.type-missed {
      background: var(--el-color-warning-light-9);
      color: var(--el-color-warning);
    }

    &.type-rejected {
      background: var(--el-color-danger-light-9);
      color: var(--el-color-danger);
    }

    .call-type-icon-small {
      font-size: 12px;
    }
  }

  .call-time-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .call-time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .call-number {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
  }

  .call-duration {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    flex-shrink: 0;

    .duration-icon {
      font-size: 12px;
    }
  }

  .call-duration-placeholder {
    flex: 1;
  }

  .call-divider {
    position: absolute;
    left: 64px;
    right: 0;
    bottom: 0;
    height: 0.5px;
    background: var(--el-fill-color-lighter);
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
}

// 优化下拉框样式
:deep(.el-autocomplete-suggestion) {
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--app-shadow-hover-color, var(--el-box-shadow-light));
  border: 1px solid var(--el-border-color);
  padding: 4px 0;
  max-height: 300px;

  .el-autocomplete-suggestion__list {
    padding: 0;
  }

  .el-autocomplete-suggestion__wrap {
    padding: 0;
  }
}

.autocomplete-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-bg-color-page);
  }

  .autocomplete-info {
    flex: 1;
    min-width: 0;
  }

  .autocomplete-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 2px;
    line-height: 1.3;
  }

  .autocomplete-phone {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.3;
  }
}
</style>
