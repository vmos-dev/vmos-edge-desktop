<template>
  <vmos-dialog
    v-model="visible"
    title="云机详情"
    width="500px"
    :show-close="!loading"
    class="device-info-dialog"
    append-to-body
  >
    <div class="info-content" v-if="device">
      <el-form label-width="auto" label-position="right" class="device-info-form" @submit.prevent>
        <el-form-item label="云机ID：">
          <CopyText :text="device.db_id || device.id" />
        </el-form-item>

        <el-form-item label="云机名称：">
          <CopyText :text="device.user_name || ''"></CopyText>
        </el-form-item>

        <el-form-item label="镜像版本：">
          <CopyText :text="device?.image?.replace(/:latest$/, '')"></CopyText>
        </el-form-item>

        <el-form-item label="Android版本：">
          <CopyText :text="device.aosp_version ? `Android ${device.aosp_version}` : ''"></CopyText>
        </el-form-item>

        <el-form-item label="云机类型：">
          <CopyText
            :text="
              device.device_type === DeviceType.VIRTUAL
                ? DeviceTypeMap[DeviceType.VIRTUAL]
                : DeviceTypeMap[DeviceType.REAL]
            "
          ></CopyText>
        </el-form-item>

        <el-form-item label="品牌：" v-if="isReal">
          <CopyText :text="(device as any).brand"></CopyText>
        </el-form-item>

        <el-form-item label="机型：" v-if="isReal">
          <CopyText :text="(device as any).model_name || (device as any).model"></CopyText>
        </el-form-item>

        <el-form-item label="ADB：">
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

        <el-form-item label="局域网：">
          <div class="value-row" v-if="!isEditingIp">
            <span class="value-text">{{
              device.network_mode === 'macvlan' ? device.macvlan_ip : '-'
            }}</span>
            <el-icon
              v-if="device.network_mode === 'macvlan'"
              class="action-icon"
              title="修改"
              @click="startEditIp"
            >
              <EditPen />
            </el-icon>
          </div>
          <div class="value-row" v-else>
            <el-input
              v-model="editIpValue"
              size="small"
              placeholder="请输入IP"
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
      </el-form>
    </div>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Device } from '@shared/ipc/data.types'
import { EditPen, Check, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { request, getErrorMessage } from '@shared/api'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'
import { MacvlanPortMap, DeviceType, DeviceTypeMap } from '@renderer/utils/constant'

const visible = ref(false)
const device = ref<Device>()
const isEditingIp = ref(false)
const editIpValue = ref('')
const loading = ref(false)
const isReal = ref(false)

const init = (row: Device) => {
  device.value = row
  isReal.value = row.device_type === DeviceType.REAL || !row.device_type
  visible.value = true
  isEditingIp.value = false
  editIpValue.value = ''
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
    ElMessage.warning('IP格式不正确')
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

    ElMessage.success('修改成功，设备重启后生效')
    device.value.macvlan_ip = editIpValue.value
    isEditingIp.value = false
  } catch (e: any) {
    console.error(e)
    ElMessage.error(getErrorMessage(e) || '操作失败')
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
    color: #606266;
    font-weight: 500;
  }
}

.value-text {
  color: #303133;
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
  color: #409eff;
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
</style>
