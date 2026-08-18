<template>
  <div class="contact-container">
    <!-- 右侧：新增联系人表单 -->
    <div class="contact-form-panel">
      <div class="panel-header contact">
        <h3 class="panel-title">{{ t('phone.contact.addContact') }}</h3>
      </div>
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="auto"
        class="contact-form"
        label-position="top"
      >
        <el-form-item :label="t('phone.contact.name')" prop="name" required>
          <el-input
            v-model.trim="formData.name"
            :placeholder="t('phone.contact.enter')"
            maxlength="50"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('phone.contact.phoneNumber')" prop="phone" required>
          <el-input
            v-model.trim="formData.phone"
            :placeholder="t('phone.contact.enter')"
            maxlength="20"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('phone.contact.email')" prop="email">
          <el-input
            v-model.trim="formData.email"
            :placeholder="t('phone.contact.enter')"
            maxlength="100"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('phone.contact.organization')" prop="organization">
          <el-input
            v-model.trim="formData.organization"
            :placeholder="t('phone.contact.enter')"
            maxlength="100"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('phone.contact.title')" prop="title">
          <el-input
            v-model.trim="formData.title"
            :placeholder="t('phone.contact.enter')"
            maxlength="100"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('phone.contact.note')" prop="note">
          <el-input
            v-model.trim="formData.note"
            type="textarea"
            :rows="2"
            :placeholder="t('phone.contact.enter')"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ t('phone.contact.confirm') }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <!-- 左侧：联系人列表 -->
    <div class="contact-list-panel">
      <div class="panel-header">
        <h3 class="panel-title">{{ t('phone.contact.contactList') }}</h3>
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
            {{ t('phone.contact.delete')
            }}{{ selectedIds.length > 0 ? `(${selectedIds.length})` : '' }}
          </el-button>
        </div>
      </div>
      <!-- 全选操作栏 - 固定在头部下方 -->
      <div v-if="contactList.length > 0" class="select-all-bar">
        <el-checkbox
          :model-value="isAllSelected"
          :indeterminate="isIndeterminate"
          @change="handleSelectAll"
          class="select-all-checkbox"
        >
          {{ t('phone.contact.selectAll') }}
        </el-checkbox>
        <span class="selected-count">{{
          t('phone.contact.selectedCount', { count: selectedIds.length })
        }}</span>
      </div>
      <div class="contact-list">
        <div class="contact-list-content">
          <div
            v-for="(contact, index) in contactList"
            :key="contact.id"
            class="contact-item"
            :class="{ selected: selectedIds.includes(contact.id) }"
          >
            <el-checkbox
              :model-value="selectedIds.includes(contact.id)"
              @change="handleSelectChange(contact.id, $event)"
              @click.stop
              class="contact-checkbox"
            />
            <div class="contact-content" @click="handleContactClick(contact)">
              <div class="contact-avatar">
                <el-avatar :size="36" :style="getAvatarStyle">
                  {{ contact.name?.charAt(0) || '?' }}
                </el-avatar>
              </div>
              <div class="contact-info">
                <div class="contact-name">{{ contact.name }}</div>
                <div class="contact-phone">{{ contact.phone }}</div>
              </div>
            </div>
            <div class="contact-divider" v-if="index < contactList.length - 1"></div>
          </div>
        </div>

        <div v-if="contactList.length === 0" class="empty-state">
          <el-empty :description="t('phone.contact.noContact')" :image-size="100" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, onUnmounted, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox, ElForm, ElFormItem } from 'element-plus'

const { t } = useI18n()
import { request } from '@shared/api'
import {
  API_CONTROL_CONFIG,
  buildDeviceApiUrl,
  type Contact,
  type ContactListApiResponse,
  type AddContactRequest,
  type DeleteContactListRequest
} from '@shared/api'
import { getErrorMessage } from '@shared/api'
import type { Device } from '@shared/ipc/data.types'

defineOptions({ name: 'Contact' })

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

// 选中的联系人ID列表
const selectedIds = ref<string[]>([])

// 联系人列表
const contactList = ref<Contact[]>([])
const loading = ref(false)

// 计算是否全选
const isAllSelected = computed(() => {
  return contactList.value.length > 0 && selectedIds.value.length === contactList.value.length
})

// 计算是否半选状态
const isIndeterminate = computed(() => {
  return selectedIds.value.length > 0 && selectedIds.value.length < contactList.value.length
})

// 表单引用
const formRef = ref<InstanceType<typeof ElForm>>()
const submitting = ref(false)

// 表单数据
const formData = reactive<AddContactRequest>({
  name: '',
  phone: '',
  email: undefined,
  organization: undefined,
  title: undefined,
  note: undefined
})

// 表单验证规则
const formRules = {
  name: [{ required: true, message: t('phone.contact.enterName'), trigger: 'blur' }],
  phone: [{ required: true, message: t('phone.contact.enterPhoneNumber'), trigger: 'blur' }],
  email: [{ type: 'email' as const, message: t('phone.contact.enterValidEmail'), trigger: 'blur' }]
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
// 处理联系人点击
const handleContactClick = (contact: Contact) => {
  // 点击联系人时，填充表单用于编辑
  Object.assign(formData, contact)
}

// 处理全选/取消全选
const handleSelectAll = (checked: boolean | string | number) => {
  if (checked) {
    selectedIds.value = contactList.value.map((contact) => contact.id)
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

// 获取联系人列表
const loadContactList = async () => {
  try {
    loading.value = true
    const { hostIp, dbId } = getDeviceInfo()

    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.GET_CONTACT_LIST)
    const response = await request.get<ContactListApiResponse>(
      url,
      { offset: 0, limit: 999 },
      { timeout: 5000 }
    )

    // 拦截器返回的是整个响应对象（包含 code、data、msg）
    const list = response?.data?.list || response?.data?.contacts
    if (list && Array.isArray(list)) {
      // 转换API返回的数据格式为组件使用的格式
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
    ElMessage.error(getErrorMessage(error) || t('phone.contact.getContactListFailed'))
  } finally {
    loading.value = false
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning(t('phone.contact.selectContactToDelete'))
    return
  }

  const selectedCount = selectedIds.value.length

  try {
    await ElMessageBox.confirm(
      t('phone.contact.confirmDeleteContact', { count: selectedCount }),
      t('phone.contact.confirmDelete'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    const { hostIp, dbId } = getDeviceInfo()

    // 使用批量删除 API
    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.DELETE_CONTACT_LIST)
    const deleteData: DeleteContactListRequest = {
      ids: selectedIds.value.map((id) => Number(id))
    }

    const response = await request.post<{ data: number }>(url, deleteData)
    const deletedCount = response?.data || selectedIds.value.length

    selectedIds.value = []

    // 重新加载列表
    await loadContactList()

    ElMessage.success(t('phone.contact.successDeleteContact', { count: deletedCount }))
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除联系人失败:', error)
      ElMessage.error(getErrorMessage(error) || t('phone.contact.deleteContactFailed'))
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

      const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.ADD_CONTACT)

      await request.post(url, formData)

      ElMessage.success(t('phone.multimedia.operationSuccess'))

      // 重置表单
      // formRef.value?.resetFields()

      // 重新加载列表
      await loadContactList()
    } catch (error: any) {
      console.error('添加联系人失败:', error)
      ElMessage.error(getErrorMessage(error) || t('phone.contact.addContactFailed'))
    } finally {
      submitting.value = false
    }
  })
}

// 定时器引用
let refreshTimer: NodeJS.Timeout | null = null

// 组件挂载时加载联系人列表
onMounted(() => {
  loadContactList()

  refreshTimer = setInterval(() => {
    loadContactList()
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
.contact-container {
  width: 100%;
  height: 100%;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
  box-sizing: border-box;
}

.contact-list-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;

  // 滚动条样式
  .contact-list::-webkit-scrollbar {
    width: 0;
    background: transparent;
  }
}

.contact-form-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
  overflow: hidden;
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

.contact-list {
  flex: 1;
  overflow-y: auto;
  background: var(--el-bg-color);
}

.contact-list-content {
  padding: 0;
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

.contact-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  background: var(--el-bg-color);
  min-height: 48px;
  box-sizing: border-box;

  &:active:not(.selected) {
    background: var(--el-bg-color-page);
  }

  &:hover:not(.selected) {
    background: var(--el-bg-color-page);
  }

  &.selected {
    background: var(--el-color-primary-light-9);
  }

  .contact-checkbox {
    flex-shrink: 0;
    margin-right: 4px;
  }

  .contact-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    min-width: 0;
  }

  .contact-avatar {
    flex-shrink: 0;
  }

  .contact-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
  }

  .contact-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .contact-phone {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .contact-divider {
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

.contact-form {
  flex: 1;
  padding: 10px;
  overflow-y: auto;

  :deep(.el-form-item__label) {
    font-size: 12px;
    color: var(--el-text-color-regular);
    font-weight: 500;
    padding-right: 12px;
  }

  :deep(.el-form-item.is-required .el-form-item__label::before) {
    content: '*';
    color: var(--el-color-danger);
    margin-right: 4px;
  }

  :deep(.el-input__wrapper) {
    border-radius: 4px;
  }

  :deep(.el-textarea__inner) {
    border-radius: 4px;
  }

  :deep(.el-button) {
    width: 100%;
    border-radius: 4px;
    font-size: 14px;
    padding: 10px 20px;
  }
}
</style>
