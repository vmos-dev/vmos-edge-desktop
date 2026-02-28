<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.deviceInfo')"
    width="500px"
    :show-close="!loading"
    class="device-info-dialog"
    append-to-body
  >
    <div class="info-content" v-if="device">
      <el-form label-width="auto" label-position="right" class="device-info-form" @submit.prevent>
        <el-form-item :label="t('cloudPhone.deviceIdLabel')">
          <CopyText :text="device.db_id || device.id" />
        </el-form-item>

        <el-form-item :label="t('cloudPhone.deviceNameLabel')">
          <CopyText :text="device.user_name || ''"></CopyText>
        </el-form-item>

        <el-form-item :label="t('cloudPhone.imageVersion')">
          <CopyText :text="device?.image?.replace(/:latest$/, '')"></CopyText>
        </el-form-item>

        <el-form-item :label="t('cloudPhone.androidVersionLabel')">
          <CopyText :text="device.aosp_version ? `Android ${device.aosp_version}` : ''"></CopyText>
        </el-form-item>

        <el-form-item :label="t('cloudPhone.deviceTypeLabel')">
          <CopyText
            :text="
              device.device_type === DeviceType.VIRTUAL
                ? DeviceTypeMap[DeviceType.VIRTUAL]
                : DeviceTypeMap[DeviceType.REAL]
            "
          ></CopyText>
        </el-form-item>

        <el-form-item :label="t('cloudPhone.brand') + '：'" v-if="isReal">
          <CopyText :text="(device as any).brand"></CopyText>
        </el-form-item>

        <el-form-item :label="t('cloudPhone.model') + '：'" v-if="isReal">
          <CopyText :text="(device as any).model_name || (device as any).model"></CopyText>
        </el-form-item>

        <el-form-item :label="t('cloudPhone.hostIp') + '：'" v-if="device.host_ip">
          <CopyText :text="device.host_ip"></CopyText>
        </el-form-item>

        <el-form-item :label="t('cloudPhone.cloudAdb') + '：'">
          <div class="value-row">
            <CopyText
              :text="
                device.network_mode === 'macvlan'
                  ? device.ip + ':' + MacvlanPortMap.adb
                  : device.host_ip + ':' + device.adb
              "
            ></CopyText>
          </div>
        </el-form-item>

        <el-form-item :label="t('cloudPhone.lanIp') + '：'">
          <div class="value-row" v-if="!isEditingIp">
            <span class="value-text">{{
              device.network_mode === 'macvlan' ? device.macvlan_ip : '-'
            }}</span>
            <el-icon
              v-if="device.network_mode === 'macvlan'"
              class="action-icon"
              :title="t('common.modify')"
              @click="startEditIp"
            >
              <EditPen />
            </el-icon>
          </div>
          <div class="value-row" v-else>
            <el-input
              v-model="editIpValue"
              size="small"
              :placeholder="t('cloudPhone.enterIp')"
              style="width: 150px"
            />
            <el-button
              type="primary"
              link
              :icon="Check"
              size="large"
              :loading="loading"
              @click="confirmEditIp"
            />
            <el-button
              type="info"
              style="margin-left: 0px"
              link
              size="large"
              v-if="!loading"
              :icon="Close"
              @click="cancelEditIp"
            />
          </div>
        </el-form-item>

        <el-form-item label="Control API：">
          <div class="value-row">
            <span v-if="apiVersionLoading" class="value-text">
              <el-icon class="is-loading"><Loading /></el-icon>
            </span>
            <span v-else-if="apiVersionInfo" class="value-text api-version-text" @click="openSupportedApiList">
              {{ apiVersionInfo.version_name }} ({{ apiVersionInfo.version_code }})
              <el-icon class="view-icon"><View /></el-icon>
            </span>
            <span v-else-if="apiVersionError === 'unknown'" class="value-text">{{ t('cloudPhone.apiVersionUnknown') }}</span>
            <span v-else-if="apiVersionError === 'failed'" class="value-text error-text">{{ t('cloudPhone.getFailed') }}</span>
            <span v-else class="value-text">-</span>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- 支持的 API 列表弹窗 -->
    <vmos-dialog
      v-model="showSupportedApiDialog"
      :title="`${t('cloudPhone.supportedApiList')} (${totalApiCount})`"
      width="500px"
      append-to-body
    >
      <div class="supported-api-container">
        <el-input
          v-model="apiSearchKeyword"
          :placeholder="t('common.search')"
          clearable
          :prefix-icon="Search"
          class="api-search-input"
        />
        <div class="supported-api-tree">
          <el-collapse v-model="expandedModules" class="borderless-collapse">
            <el-collapse-item
              v-for="(apis, moduleName) in groupedApiList"
              :key="moduleName"
              :name="moduleName"
            >
              <template #title>
                <span class="module-title">
                  <el-icon><Folder /></el-icon>
                  {{ moduleName }}
                  <el-tag size="small" type="info" class="module-count">{{ apis.length }}</el-tag>
                </span>
              </template>
              <div class="api-items">
                <div v-for="api in apis" :key="api" class="api-item">
                  <el-icon><Document /></el-icon>
                  <span class="api-path">{{ api }}</span>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
          <el-empty v-if="filteredApiCount === 0" :description="t('common.noData')" />
        </div>
      </div>
    </vmos-dialog>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Device } from '@shared/ipc/data.types'
import { EditPen, Check, Close, Loading, View, Folder, Document, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { request, getErrorMessage } from '@shared/api'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'
import { API_CONTROL_CONFIG, buildDeviceApiUrl } from '@shared/api/controlConfig'
import { MacvlanPortMap, DeviceType } from '@renderer/utils/constant'
import { getDeviceTypeText } from '@renderer/utils/i18n-maps'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 响应式的设备类型映射（根据当前语言动态生成）
const DeviceTypeMap = computed(() => {
  return {
    [DeviceType.VIRTUAL]: getDeviceTypeText(DeviceType.VIRTUAL),
    [DeviceType.REAL]: getDeviceTypeText(DeviceType.REAL)
  }
})

const visible = ref(false)
const device = ref<Device>()
const isEditingIp = ref(false)
const editIpValue = ref('')
const loading = ref(false)
const isReal = ref(false)

// Control API 版本信息
interface ApiVersionInfo {
  version_name: string
  version_code: number
  supported_list: string[]
}
const apiVersionInfo = ref<ApiVersionInfo | null>(null)
const apiVersionLoading = ref(false)
const apiVersionError = ref<'unknown' | 'failed' | null>(null) // 404为未知，其他错误为获取失败
const showSupportedApiDialog = ref(false)
const expandedModules = ref<string[]>([])
const apiSearchKeyword = ref('')

// 将 API 列表按模块分组（树结构），支持搜索过滤，按模块名排序
const groupedApiList = computed(() => {
  if (!apiVersionInfo.value?.supported_list) return {}
  const groups: Record<string, string[]> = {}
  const keyword = apiSearchKeyword.value.toLowerCase().trim()
  
  for (const api of apiVersionInfo.value.supported_list) {
    // 搜索过滤
    if (keyword && !api.toLowerCase().includes(keyword)) {
      continue
    }
    // 解析模块名：忽略第一段（如 api），取第二段作为模块名
    const parts = api.split('/')
    // 如果有多个部分，第二段是模块名（忽略第一段如 api）
    let moduleName = 'other'
    if (parts.length >= 2) {
      moduleName = parts[1] // 第二段是模块名
    } else if (parts.length === 1) {
      moduleName = parts[0] // 只有一段时用它作为模块名
    }
    if (!groups[moduleName]) {
      groups[moduleName] = []
    }
    groups[moduleName].push(api)
  }
  
  // 按模块名排序
  const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b))
  const sortedGroups: Record<string, string[]> = {}
  for (const key of sortedKeys) {
    sortedGroups[key] = groups[key]
  }
  return sortedGroups
})

// 默认展开所有模块
const activeModules = computed(() => Object.keys(groupedApiList.value))

// 总接口数量
const totalApiCount = computed(() => apiVersionInfo.value?.supported_list?.length || 0)

// 过滤后的接口数量
const filteredApiCount = computed(() => {
  return Object.values(groupedApiList.value).reduce((sum, apis) => sum + apis.length, 0)
})

// 搜索时自动展开所有匹配的模块
watch(apiSearchKeyword, () => {
  expandedModules.value = activeModules.value
})

const init = (row: Device) => {
  device.value = row
  isReal.value = row.device_type === DeviceType.REAL || !row.device_type
  visible.value = true
  isEditingIp.value = false
  editIpValue.value = ''
  // 获取 Control API 版本
  fetchApiVersion(row)
}

// 获取 Control API 版本信息
const fetchApiVersion = async (row: Device) => {
  apiVersionInfo.value = null
  apiVersionLoading.value = true
  apiVersionError.value = null
  try {
    const url = buildDeviceApiUrl(
      row.host_ip || '',
      row.id || '',
      API_CONTROL_CONFIG.PATHS.GET_API_VERSION
    )
    const res = await request.get(url)
    if (res?.data) {
      apiVersionInfo.value = res.data
    }
  } catch (e: any) {
    console.error('获取 Control API 版本失败:', e)
    // 404 表示未知，其他错误表示获取失败
    if (e?.code === 404 || e?.response?.status === 404) {
      apiVersionError.value = 'unknown'
    } else {
      apiVersionError.value = 'failed'
    }
  } finally {
    apiVersionLoading.value = false
  }
}

// 打开支持的 API 列表弹窗
const openSupportedApiList = () => {
  if (apiVersionInfo.value?.supported_list?.length) {
    // 清空搜索关键词
    apiSearchKeyword.value = ''
    // 默认展开所有模块
    expandedModules.value = activeModules.value
    showSupportedApiDialog.value = true
  }
}

const startEditIp = () => {
  if (!device.value) return
  editIpValue.value = device.value.macvlan_ip || ''
  isEditingIp.value = true
}

const cancelEditIp = () => {
  isEditingIp.value = false
  editIpValue.value = ''
}

const confirmEditIp = async () => {
  if (!device.value) return

  const ipPattern =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

  if (!ipPattern.test(editIpValue.value)) {
    ElMessage.warning(t('cloudPhone.invalidIpFormat'))
    return
  }

  if (editIpValue.value === device.value.macvlan_ip) {
    cancelEditIp()
    return
  }

  loading.value = true
  try {
    const url = buildApiUrl(device.value.host_ip || '', API_CONFIG.PATHS.SET_DEVICE_IP)
    await request.post(
      url,
      {
        db_id: device.value.db_id,
        ip: editIpValue.value
      },
      {
        timeout: 60 * 1000
      }
    )

    ElMessage.success(t('cloudPhone.modifyIpSuccess'))
    device.value.macvlan_ip = editIpValue.value
    isEditingIp.value = false
  } catch (e: any) {
    console.error(e)
    ElMessage.error(getErrorMessage(e) || t('common.operationFailed'))
  } finally {
    loading.value = false
  }
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.info-content {
  padding: 0px 10px;
}

.device-info-form {
  :deep(.el-form-item) {
    margin-bottom: 5px; // Reduce spacing between items
  }

  :deep(.el-form-item__label) {
    color: var(--el-text-color-regular);
    font-weight: 500;
  }
}

.value-text {
  color: var(--el-text-color-primary);
  word-break: break-all;
  line-height: 32px; // Match standard form item height
}

.value-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.action-icon {
  cursor: pointer;
  color: var(--el-color-primary);
  font-size: 16px;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
}

.dialog-footer {
  text-align: right;
  padding-top: 10px;
}

.api-version-text {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-primary);

  &:hover {
    opacity: 0.8;
  }

  .view-icon {
    font-size: 14px;
  }
}

.error-text {
  color: var(--el-color-danger);
}

.supported-api-container {
  .api-search-input {
    margin-bottom: 12px;
  }
}

.supported-api-tree {
  max-height: 400px;
  overflow-y: auto;

  .borderless-collapse {
    border: none;

    :deep(.el-collapse-item__header) {
      border-bottom: none;
      height: 32px;
      line-height: 32px;
      padding: 0 8px;
    }

    :deep(.el-collapse-item__wrap) {
      border-bottom: none;
    }

    :deep(.el-collapse-item__content) {
      padding-bottom: 4px;
      padding-top: 0;
    }
  }

  .module-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;

    .module-count {
      margin-left: 4px;
    }
  }

  .api-items {
    padding-left: 10px;

    .api-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
      line-height: 1.4;

      &:hover {
        background-color: var(--el-fill-color-light);
      }

      .api-path {
        color: var(--el-text-color-regular);
      }
    }
  }
}
</style>
