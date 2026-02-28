<template>
  <div class="sms-record-container">
    <!-- 左侧：发送短信/新增记录表单 -->
    <div class="sms-form-panel">
      <!-- <div class="panel-header contact">
        <h3 class="panel-title">发送短信</h3>
      </div> -->
      <div class="form-tabs">
        <div
          class="tab-item"
          :class="{ active: activeFormTab === 'send' }"
          @click="activeFormTab = 'send'"
        >
          {{ t('phone.smsRecord.sendSms') }}
        </div>
        <div
          class="tab-item"
          :class="{ active: activeFormTab === 'add' }"
          @click="activeFormTab = 'add'"
        >
          {{ t('phone.smsRecord.addRecord') }}
        </div>
      </div>
      <div class="form-content">
        <el-form
          ref="formRef"
          :model="formData"
          :rules="formRules"
          label-width="auto"
          class="sms-form"
          label-position="top"
        >
          <el-form-item :label="t('phone.smsRecord.recipient')" prop="address" required>
            <el-autocomplete
              v-model="formData.address"
              :fetch-suggestions="queryContacts"
              :placeholder="t('phone.smsRecord.enterNumberOrSelectContact')"
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
                    <div class="autocomplete-name">{{ item.name }}</div>
                    <div class="autocomplete-phone">{{ item.phone }}</div>
                  </div>
                </div>
              </template>
            </el-autocomplete>
          </el-form-item>
          <!-- 新增记录时才显示类型和时间 -->
          <template v-if="activeFormTab === 'add'">
            <el-form-item :label="t('phone.smsRecord.selectType')" prop="type">
              <el-select v-model="formData.type" :placeholder="t('phone.battery.pleaseSelect')">
                <el-option :label="t('phone.smsRecord.type.received')" :value="1" />
                <el-option :label="t('phone.smsRecord.type.sent')" :value="2" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('phone.smsRecord.smsTime')" prop="date">
              <el-date-picker
                v-model="formData.date"
                type="datetime"
                :placeholder="t('phone.smsRecord.selectTime')"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="x"
                style="width: 100%"
              />
            </el-form-item>
          </template>
          <el-form-item :label="t('phone.smsRecord.smsContent')" prop="body" required>
            <el-input
              v-model.trim="formData.body"
              type="textarea"
              :rows="6"
              :placeholder="t('phone.smsRecord.enterSmsContent')"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
          <el-form-item class="submit-form-item">
            <el-button type="primary" @click="handleSubmit" :loading="submitting">
              <el-icon class="el-icon--left">
                <Message v-if="activeFormTab === 'send'" />
                <Plus v-else />
              </el-icon>
              {{
                activeFormTab === 'send'
                  ? t('phone.smsRecord.sendSms')
                  : t('phone.smsRecord.addRecord')
              }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 右侧：短信记录列表 -->
    <div class="sms-list-panel">
      <div class="panel-header">
        <h3 class="panel-title">{{ t('phone.smsRecord.smsRecord') }}</h3>
        <div class="header-actions">
          <el-button
            plain
            type="danger"
            text
            size="small"
            icon="Delete"
            @click="handleBatchDelete"
            :disabled="selectedIds.length === 0"
          >
            {{ t('phone.smsRecord.delete')
            }}{{ selectedIds.length > 0 ? `(${selectedIds.length})` : '' }}
          </el-button>
        </div>
      </div>
      <!-- 全选操作栏 -->
      <div v-if="smsList.length > 0" class="select-all-bar">
        <el-checkbox
          :model-value="isAllSelected"
          :indeterminate="isIndeterminate"
          @change="handleSelectAll"
          class="select-all-checkbox"
        >
          {{ t('phone.smsRecord.selectAll') }}
        </el-checkbox>
        <span class="selected-count">{{
          t('phone.smsRecord.selectedCount', { count: selectedIds.length })
        }}</span>
      </div>
      <div class="sms-list">
        <div class="sms-list-content">
          <div
            v-for="(sms, index) in smsList"
            :key="sms.id"
            class="sms-item"
            :class="{ selected: selectedIds.includes(sms.id) }"
          >
            <el-checkbox
              :model-value="selectedIds.includes(sms.id)"
              @change="handleSelectChange(sms.id, $event)"
              @click.stop
              class="sms-checkbox"
            />
            <div class="sms-content">
              <div class="sms-avatar">
                <el-avatar :size="36" :style="getAvatarStyle">
                  {{ (sms?.contact?.display_name ?? sms.address)?.charAt(0) || '?' }}
                </el-avatar>
              </div>
              <div class="sms-info">
                <!-- 第一行：电话和类型，左右布局 -->
                <div class="sms-header">
                  <div class="sms-name" :title="sms?.contact?.display_name ?? sms.address">
                    {{ sms?.contact?.display_name ?? sms.address }}
                  </div>
                  <el-tag
                    :type="getSmsTypeTag(sms.type)"
                    size="small"
                    effect="plain"
                    class="sms-type-tag"
                  >
                    {{ getSmsTypeText(sms.type) }}
                  </el-tag>
                </div>
                <!-- 第二行：时间 -->
                <div class="sms-time">{{ sms.formattedDate }}</div>
                <!-- 第三行：短信内容 -->
                <div class="sms-body">{{ sms.body }}</div>
              </div>
            </div>
            <div class="sms-divider" v-if="index < smsList.length - 1"></div>
          </div>
        </div>

        <div v-if="smsList.length === 0" class="empty-state">
          <el-empty :description="t('phone.smsRecord.noSmsRecord')" :image-size="100" />
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
  ElIcon
} from 'element-plus'
import { Message, Plus } from '@element-plus/icons-vue'

const { t } = useI18n()
import { request } from '@shared/api'
import { formatTime } from '@renderer/utils'
import {
  API_CONTROL_CONFIG,
  buildDeviceApiUrl,
  type SmsRecord,
  type SmsListApiResponse,
  type AddSmsRequest,
  type DeleteSmsListRequest,
  type Contact,
  type ContactListApiResponse,
  type SendSmsRequest
} from '@shared/api'
import { getErrorMessage } from '@shared/api'
import type { Device } from '@shared/ipc/data.types'

defineOptions({ name: 'SmsRecord' })

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

// 表单tab切换
const activeFormTab = ref<'send' | 'add'>('send')

// 联系人列表
const contactList = ref<Contact[]>([])
const loadingContacts = ref(false)

// 选中的短信ID列表
const selectedIds = ref<string[]>([])

// 短信列表
const smsList = ref<SmsRecord[]>([])
const loading = ref(false)

// 计算是否全选
const isAllSelected = computed(() => {
  return smsList.value.length > 0 && selectedIds.value.length === smsList.value.length
})

// 计算是否半选状态
const isIndeterminate = computed(() => {
  return selectedIds.value.length > 0 && selectedIds.value.length < smsList.value.length
})

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()
const submitting = ref(false)

// 表单初始值
const initialFormData: AddSmsRequest = {
  address: '',
  body: '',
  type: 1,
  date: undefined
}

// 表单数据
const formData = reactive<AddSmsRequest>({ ...initialFormData })

// 表单验证规则
const formRules = computed(() => ({
  address: [
    { required: true, message: t('phone.smsRecord.enterRecipientNumber'), trigger: 'blur' }
  ],
  type: [{ required: true, message: t('phone.smsRecord.selectTypeRequired'), trigger: 'change' }],
  body: [{ required: true, message: t('phone.smsRecord.enterSmsContentRequired'), trigger: 'blur' }]
}))

// 获取短信类型显示文本
const getSmsTypeText = (type: number) => {
  const map: Record<number, string> = {
    1: t('phone.smsRecord.type.received'),
    2: t('phone.smsRecord.type.sent'),
    3: t('phone.smsRecord.type.draft'),
    4: t('phone.smsRecord.type.outbox'),
    5: t('phone.smsRecord.type.failed'),
    6: t('phone.smsRecord.type.queued')
  }
  return map[type] || t('phone.smsRecord.type.unknown')
}

// 获取短信类型标签颜色
const getSmsTypeTag = (type: number) => {
  const map: Record<number, string> = {
    1: 'success',
    2: '',
    3: 'info',
    4: 'warning',
    5: 'danger',
    6: 'warning'
  }
  return map[type] || 'info'
}

// 获取头像样式
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
    ElMessage.error(getErrorMessage(error) || t('phone.smsRecord.getContactListFailed'))
  } finally {
    loadingContacts.value = false
  }
}

// 选择联系人（autocomplete）- 只填充手机号
const handleContactSelect = (item: Record<string, any>) => {
  formData.address = item.phone || item.value || ''
}

// 处理全选/取消全选
const handleSelectAll = (checked: boolean | string | number) => {
  if (checked) {
    selectedIds.value = smsList.value.map((sms) => sms.id)
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

// 获取短信列表
const loadSmsList = async () => {
  try {
    loading.value = true
    const { hostIp, dbId } = getDeviceInfo()

    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.GET_SMS_LIST)
    const response = await request.get<SmsListApiResponse>(
      url,
      { offset: 0, limit: 999 },
      { timeout: 5000 }
    )

    const list = response?.data?.list || response?.data?.sms_list

    if (list && Array.isArray(list)) {
      smsList.value = list.map(
        (sms): SmsRecord => ({
          id: String(sms._id),
          address: sms.address,
          body: sms.body,
          date: sms.date,
          type: sms.type,
          read: sms.read,
          seen: sms.seen,
          contact: sms.contact,
          formattedDate: formatTime(sms.date, 'yyyy-MM-dd HH:mm:ss')
        })
      )
    } else {
      smsList.value = []
    }
  } catch (error: any) {
    console.error('获取短信列表失败:', error)
    ElMessage.error(getErrorMessage(error) || t('phone.smsRecord.getSmsListFailed'))
  } finally {
    loading.value = false
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning(t('phone.smsRecord.selectSmsToDelete'))
    return
  }

  const selectedCount = selectedIds.value.length

  try {
    await ElMessageBox.confirm(
      t('phone.smsRecord.confirmDeleteSms', { count: selectedCount }),
      t('phone.smsRecord.confirmDelete'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    const { hostIp, dbId } = getDeviceInfo()

    // 使用批量删除 API
    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.DELETE_SMS_LIST)
    const deleteData: DeleteSmsListRequest = {
      ids: selectedIds.value.map((id) => Number(id))
    }

    const response = await request.post<{ data: number }>(url, deleteData)
    const deletedCount = response?.data || selectedIds.value.length

    selectedIds.value = []

    await loadSmsList()

    ElMessage.success(t('phone.smsRecord.successDeleteSms', { count: deletedCount }))
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除短信记录失败:', error)
      ElMessage.error(getErrorMessage(error) || t('phone.smsRecord.deleteSmsFailed'))
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  // 发送短信功能预留，暂不实现
  await formRef.value.validate(async (valid) => {
    if (!valid || submitting.value) return

    try {
      submitting.value = true
      const { hostIp, dbId } = getDeviceInfo()

      const url =
        activeFormTab.value === 'add'
          ? buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.ADD_SMS)
          : buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.SEND_SMS)
      const addSmsData: AddSmsRequest | SendSmsRequest =
        activeFormTab.value === 'add'
          ? {
              address: formData.address,
              body: formData.body,
              type: formData.type ?? 1,
              date: formData.date ?? Date.now(),
              read: true,
              seen: true
            }
          : {
              sender: formData.address,
              body: formData.body
            }
      await request.post(url, addSmsData)

      ElMessage.success(t('phone.multimedia.operationSuccess'))

      // 重置表单（使用官方方法）
      //formRef.value?.resetFields()

      // 重新加载列表
      setTimeout(() => {
        loadSmsList()
      }, 4000)
    } catch (error: any) {
      console.error('添加短信记录失败:', error)
      ElMessage.error(getErrorMessage(error) || t('phone.smsRecord.addSmsFailed'))
    } finally {
      submitting.value = false
    }
  })
}

// 定时器引用
let refreshTimer: NodeJS.Timeout | null = null

// 组件挂载时加载短信列表和联系人列表
onMounted(() => {
  loadSmsList()
  loadContactList()

  // 启动定时刷新，每3秒刷新一次短信记录
  refreshTimer = setInterval(() => {
    loadSmsList()
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
.sms-record-container {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
  box-sizing: border-box;
}

.sms-form-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;
}

.sms-list-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;

  .sms-list::-webkit-scrollbar {
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

.form-tabs {
  display: flex;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);

  .tab-item {
    flex: 1;
    padding: 8px 16px;
    text-align: center;
    cursor: pointer;
    font-size: 13px;
    color: var(--el-text-color-regular);
    transition: all 0.2s;
    border-bottom: 2px solid transparent;

    &:hover {
      color: var(--el-color-primary);
    }

    &.active {
      color: var(--el-color-primary);
      border-bottom-color: var(--el-color-primary);
      font-weight: 500;
    }
  }
}

.form-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.recipient-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
  margin-bottom: 16px;

  .recipient-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .recipient-details {
    flex: 1;
    min-width: 0;
  }

  .recipient-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    margin-bottom: 4px;
  }

  .recipient-phone {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .close-icon {
    cursor: pointer;
    color: var(--el-text-color-secondary);
    font-size: 18px;
    transition: color 0.2s;

    &:hover {
      color: var(--el-color-danger);
    }
  }
}

.sms-form {
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
}

.filter-bar {
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);

  .filter-tabs {
    display: flex;
    gap: 16px;

    .filter-tab {
      font-size: 12px;
      color: var(--el-text-color-regular);
      cursor: pointer;
      padding: 4px 0;
      transition: color 0.2s;

      &:hover {
        color: var(--el-color-primary);
      }

      &.active {
        color: var(--el-color-primary);
        font-weight: 500;
      }
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

.sms-list {
  flex: 1;
  overflow-y: auto;
  background: var(--el-bg-color);
}

.sms-list-content {
  padding: 0;
}

.sms-item {
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

  .sms-checkbox {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .sms-content {
    flex: 1;
    display: flex;
    gap: 12px;
    min-width: 0;
  }

  .sms-avatar {
    flex-shrink: 0;
  }

  .sms-info {
    flex: 1;
    min-width: 0;
  }

  .sms-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .sms-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sms-type-tag {
    font-weight: normal;
    height: 18px;
    padding: 0 4px;
    line-height: 16px;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .sms-time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 4px;
  }

  .sms-phone {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
  }

  .sms-body {
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .sms-divider {
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

.recipient-input-wrapper {
  width: 100%;
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
