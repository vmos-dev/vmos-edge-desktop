<template>
  <vmos-dialog
    v-model="visible"
    :title="`克隆云机 (不限创建总数)`"
    width="500px"
    class="device-clone-dialog"
    append-to-body
    @closed="handleClose"
  >
    <div class="info-content" v-if="device">
      <div class="host-info">
        <span class="label">主机地址：</span>
        <span class="value link">{{ device.host_ip }}</span>
        <span class="sub-info">(同时运行上限 12 台)</span>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="auto"
        label-position="top"
        class="device-clone-form"
      >
        <el-form-item label="基础信息：">
          <div class="base-info-row">
            <div class="info-item">
              <span class="label">云机名称：</span>
              <span class="value">{{ device.user_name || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="label">镜像版本：</span>
              <span class="value">{{ device.image || '-' }}</span>
            </div>
            <div class="info-item">
              <span class="label">安卓版本：</span>
              <span class="value">{{
                device.aosp_version ? `Android ${device.aosp_version}` : '-'
              }}</span>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="克隆名称前缀" prop="user_name">
          <el-input
            v-model="form.user_name"
            minlength="2"
            maxlength="100"
            show-word-limit
            placeholder="请输入克隆名称前缀"
            clearable
          />
        </el-form-item>

        <el-form-item label="云机数量">
          <div class="count-control">
            <el-input-number v-model="form.count" :min="1" :max="12" step-strictly />
            <span class="tip-text">单次可克隆云机数量不超过 12 台</span>
          </div>
          <div class="preview-text" v-if="form.user_name">
            将按前缀自动编号生成 {{ form.count }} 个云机：
            <div class="name-preview-list">
              <span v-for="(name, index) in previewNames" :key="index" class="name-item">{{
                name
              }}</span>
            </div>
          </div>
        </el-form-item>
        <div class="form-footer-switch">
          <span>修改云机参数</span>
          <el-switch v-model="form.update_prop" />
        </div>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleConfirm">确定</el-button>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Device, Host } from '@shared/ipc/data.types'
import { ElMessage, FormInstance, FormRules } from 'element-plus'
import { request, getErrorMessage } from '@shared/api'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'

const visible = ref(false)
const loading = ref(false)
const device = ref<Device>()
const host = ref<Host>()
const formRef = ref<FormInstance>()

const form = reactive({
  db_id: '',
  user_name: '',
  count: 1,
  update_prop: true
})

const rules: FormRules = {
  user_name: [
    { required: true, message: '请输入克隆名称前缀', trigger: 'blur' },
    { min: 2, max: 100, message: '克隆名称前缀长度为2-100个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9]+$/, message: '克隆名称前缀只能输入英文和数字', trigger: 'blur' }
  ]
}

const init = (row: Device, hostData?: Host) => {
  form.db_id = row.db_id || ''
  device.value = row
  host.value = hostData
  // 默认无值
  form.user_name = ''
  form.count = 1
  form.update_prop = true
  visible.value = true
}

const handleClose = () => {
  formRef.value?.resetFields()
  loading.value = false
}

const previewNames = computed(() => {
  if (!form.user_name) return []
  const names: string[] = []
  // 从 1 开始编号，总是带 3 位数字后缀 (例如 -001)
  // 如果数量为 1，通常也建议带编号以保持一致性，或者根据需求不带
  // 根据反馈 "vmos-clone-001..." 格式，应该总是带编号
  for (let i = 1; i <= form.count; i++) {
    const suffix = String(i).padStart(3, '0')
    names.push(`${form.user_name}-clone-${suffix}`)
  }
  return names
})

const handleConfirm = async () => {
  if (!formRef.value || !device.value || loading.value) return

  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        const baseUrl = buildApiUrl(device.value!.host_ip || '', API_CONFIG.PATHS.CLONE_DEVICE)

        await request.post(baseUrl, form)
        ElMessage.success('操作成功，请稍后查看结果')
        visible.value = false
        // 可能需要通知父组件刷新列表
      } catch (error: any) {
        ElMessage.error(getErrorMessage(error) || '克隆失败')
      } finally {
        // 等关闭弹窗动画完成后，再设置 loading 为 false
        setTimeout(() => {
          loading.value = false
        }, 300)
      }
    }
  })
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.info-content {
  padding: 0 10px;
  overflow: hidden;
}

.host-info {
  margin-bottom: 16px;
  font-size: 13px;
  color: #606266;
  background-color: #f5f7fa;
  padding: 8px 12px;
  border-radius: 4px;
  display: flex;
  align-items: center;

  .label {
    font-weight: 500;
    margin-right: 8px;
  }

  .link {
    color: #409eff;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-weight: 500;
    margin-right: 12px;
  }

  .sub-info {
    color: #909399;
    font-size: 12px;
  }
}

.device-clone-form {
  .el-form-item {
    margin-bottom: 16px;
  }

  :deep(.el-form-item__label) {
    padding-bottom: 4px;
    color: #606266;
    line-height: 1.2;
  }
}

.base-info-row {
  display: flex;
  flex-direction: column; /* 换行 */
  align-items: flex-start;
  gap: 8px; /* 行间距 */
  font-size: 13px;
  line-height: 1.4;
  color: #606266;
  width: 100%;

  .info-item {
    display: flex; /* 表格内容一行展示 */
    align-items: center;
    width: 100%;

    .label {
      color: #909399;
      width: 70px; /* 固定标签宽度，对齐 */
      flex-shrink: 0;
    }
    .value {
      color: #303133;
      font-weight: 500;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  /* 隐藏之前的分割线 */
  :deep(.el-divider) {
    display: none;
  }
}

.count-control {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px; /* 增加与下方预览文本的间距 */

  .tip-text {
    font-size: 12px;
    color: #909399;
  }
}

.preview-text {
  /* margin-top: 8px;  移除顶部 margin，由上方元素控制间距 */
  font-size: 12px;
  color: #606266;
  line-height: 1.5; /* 增加行高 */

  .name-preview-list {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    overflow: hidden;
    max-height: 100px;
    overflow-y: auto;
  }

  .name-item {
    white-space: normal;
    word-break: break-word;
    overflow-wrap: break-word;
    color: #409eff;
    font-family: monospace;
    background-color: #ecf5ff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
}

.form-footer-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;

  span {
    font-size: 13px;
    font-weight: 500;
    color: #303133;
  }
}
</style>
