<template>
  <vmos-dialog
    v-model="visible"
    title="修改镜像"
    width="500px"
    @closed="handleClose"
    class="update-edit-dialog"
  >
    <div class="update-edit-content">
      <div class="info-section">
        <div class="info-item">
          <span class="label">云机名称:</span>
          <span class="value">{{ device?.user_name }}</span>
        </div>
        <div class="info-item">
          <span class="label">云机ID:</span>
          <span class="value">{{ device?.db_id }}</span>
        </div>
        <div class="info-item">
          <span class="label">镜像版本:</span>
          <span class="value">{{ device?.image?.replace(/:latest$/, '') }}</span>
        </div>
        <div class="info-item">
          <span class="label">Android版本:</span>
          <span class="value">Android {{ device?.aosp_version }}</span>
        </div>
        <div class="info-item">
          <span class="label">云机类型:</span>
          <span class="value">{{
            device?.device_type === DeviceType.VIRTUAL
              ? DeviceTypeMap[DeviceType.VIRTUAL]
              : DeviceTypeMap[DeviceType.REAL]
          }}</span>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="auto"
        class="update-image-form"
        label-position="top"
        @submit.prevent
      >
        <!-- Select Image -->
        <el-form-item prop="image_repository" class="image-select-item">
          <template #label>
            <div class="label-row">
              <div><span style="color: #f56c6c">*</span> 选择镜像</div>
            </div>
          </template>
          <ImageSelect
            v-if="visible"
            v-model="form.image_repository"
            v-model:android-version="currentAndroidVersion"
            :host-ip="host?.ip"
            :exclude-version="device?.image?.replace(/:latest$/, '')"
            @change="handleImageChange"
            ref="imageSelectRef"
          />
        </el-form-item>

        <template v-if="isNeedAdi">
          <div class="section-title">机型设置</div>
          <el-form-item>
            <el-radio-group v-model="machineMode">
              <el-radio label="random">随机</el-radio>
              <el-radio label="custom">自定义</el-radio>
            </el-radio-group>
          </el-form-item>

          <template v-if="machineMode === 'custom'">
            <!-- Specify Model -->
            <div class="section-title">指定机型</div>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="品牌" prop="brand">
                  <el-select
                    v-model="form.brand"
                    @change="handleBrandChange"
                    filterable
                    placeholder="请选择品牌"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in brandOptions"
                      :key="item.brand"
                      :label="item.brand"
                      :value="item.brand"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="机型" prop="adiID">
                  <el-select
                    v-model="form.adiID"
                    filterable
                    placeholder="请选择机型"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in modelOptions"
                      :key="item.id"
                      :label="`${item.model_name}${item.isUploaded ? '(已上传)' : ''}`"
                      :value="item.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </template>
        </template>
      </el-form>

      <!-- Warning -->
      <div class="warning-box">
        <el-icon class="warning-icon"><Warning /></el-icon>
        <div class="warning-content">
          <div class="warning-title">注意事项：</div>
          <div class="warning-list">
            <div>1、升级到相同 Android 版本时，将保留现有数据。</div>
            <div class="danger-text">2、升级到不同 Android 版本时，将清除所有数据。</div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">确定</el-button>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, toRaw, onUnmounted, watch, computed } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { Device, Host, Image } from '@shared/ipc/data.types'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import { Adi, ADI_EVENTS } from '@shared/ipc/adi.types'
import { ElForm, ElMessage, ElLoading } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api/request'
import { getErrorMessage } from '@shared/api'
import { ElMessageBox } from 'element-plus'
import { DeviceType, DeviceTypeMap } from '@renderer/utils/constant'
import ImageSelect from '../components/ImageSelect.vue'

const visible = ref(false)
const loading = ref(false)
const formRef = ref<InstanceType<typeof ElForm>>()
const device = ref<Device>()
const host = ref<Host>()

// const imageOptions = ref<(Image & { isUploaded: boolean })[]>([]) // Unused
const brandOptions = ref<any>([])
const modelOptions = ref<any>([])
const allAvailableModels = ref<(Adi & { isUploaded: boolean })[]>([]) // 用于随机选择
let loadingInstance: { close: () => void; setText: (text: string) => void } | null = null

const form = reactive<any>({
  image_repository: '',
  brand: '',
  adiID: ''
})

const machineMode = ref('random') // 'random' | 'custom'

const rules = computed(() => {
  const baseRules = {
    image_repository: [{ required: true, message: '请选择镜像', trigger: 'change' }]
  }

  if (isNeedAdi.value && machineMode.value === 'custom') {
    return {
      ...baseRules,
      brand: [{ required: true, message: '请选择品牌', trigger: 'change' }],
      adiID: [{ required: true, message: '请选择机型', trigger: 'change' }]
    }
  }

  return baseRules
})

const isReal = ref(false)

// 当前选中的安卓版本 (绑定到 ImageSelect)
const currentAndroidVersion = ref('')

// 设备的安卓版本
const deviceAndroidVersion = computed(() => {
  return device.value?.aosp_version
})

// 是否需要adi
const isNeedAdi = computed(() => {
  return (
    isReal.value &&
    currentAndroidVersion.value != deviceAndroidVersion.value &&
    currentAndroidVersion.value
  )
})

const handleClose = () => {
  brandOptions.value = []
  modelOptions.value = []
  currentAndroidVersion.value = ''
  formRef.value?.resetFields()
  form.image_repository = ''
  form.brand = ''
  form.adiID = ''
  machineMode.value = 'random'
  allAvailableModels.value = []
}

const imageSelectRef = ref()

// Logic from CreateCloud.vue
const handleImageChange = (image: Image & { isUploaded: boolean }) => {
  if (image) {
    getBrandOptions(image.androidVersion)
  }
}
// Removed duplicated getImageOptions declaration
// const getImageOptions = async () => { ... } is replaced by the one below

const getImageOptions = async () => {
  await imageSelectRef.value?.getImageOptions()
}

const handleBrandChange = (value: string) => {
  form.adiID = ''
  const brand = brandOptions.value.find((item: any) => item.brand === value)
  if (brand) {
    modelOptions.value = brand.list
    form.adiID = modelOptions.value?.[0]?.id ?? ''
  }
}

const filterAndGroupByBrand = (data: Adi[], asopVersion: string, adiIds: number[]) => {
  const brandMap = new Map<string, Adi[]>()

  data.forEach((item: Adi) => {
    // ① 查询条件：镜像版本
    if (item.asopVersion !== asopVersion) return

    // ② 品牌分组
    if (!brandMap.has(item.brand)) {
      brandMap.set(item.brand, [])
    }

    brandMap.get(item.brand)!.push(item)
  })

  return Array.from(brandMap.entries()).map(([brand, list]) => ({
    brand,
    list:
      list.map((item: Adi) => ({
        ...item,
        isUploaded: (adiIds as any[]).includes(item.id)
      })) || ([] as Adi[])
  }))
}

const getBrandOptions = async (asopVersion: string) => {
  if (!asopVersion || !isReal.value) return

  try {
    const res = await ipc.invoke<Adi[]>(ADI_EVENTS.GET_ADIS)

    if (res.success) {
      // 获取主机机型模板列表
      const adiList = await request.get(
        buildApiUrl(host.value?.ip || '', API_CONFIG.PATHS.GET_HOST_ADI_TEMPLATE_LIST)
      )
      const adiIds = adiList?.data?.list?.map((item: any) => Number(item.adiID)) || []

      // 1. 筛选并保存所有可用机型（用于随机）
      const filteredAdis = (res.data || []).filter((item: Adi) => item.asopVersion === asopVersion)
      allAvailableModels.value = filteredAdis.map((item: Adi) => ({
        ...item,
        isUploaded: adiIds.includes(Number(item.id))
      })) as any[]

      // 2. 分组显示（用于自定义）
      const options = filterAndGroupByBrand(res.data || [], asopVersion, adiIds)

      brandOptions.value = options

      // Default selection if not set or invalid
      if (!form.brand || !options.find((o) => o.brand === form.brand)) {
        form.brand = options?.[0]?.brand ?? ''
      }

      const currentBrand = options.find((item) => item.brand === form.brand)
      const modelOptionsData = currentBrand?.list ?? options?.[0]?.list ?? []

      modelOptions.value = modelOptionsData

      if (!form.adiID || !modelOptionsData.find((m: any) => m.id === form.adiID)) {
        form.adiID = modelOptionsData?.[0]?.id ?? ''
      }
    }
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error, '获取主机机型模板列表失败'))
  }
}

// const getImageOptions = async () => { ... } removed

const createLoading = () => {
  const target = document.querySelector('.update-edit-dialog') as HTMLElement
  if (target) {
    loadingInstance = ElLoading.service({
      target,
      lock: true,
      text: '处理中...',
      background: 'rgba(255, 255, 255, 0.7)'
    })
  }
}

watch(
  () => visible.value,
  (val) => {
    let offs: any = null
    if (val) {
      offs = [
        ipc.on<number>(ADI_EVENTS.UPLOAD_ADI_TO_HOST_PROGRESS, handleUploadAdiProgress),
        ipc.on<number>(IMAGES_EVENTS.UPLOAD_IMAGE_TO_HOST_PROGRESS, handleUploadImageProgress)
      ]
    } else {
      offs?.forEach((off) => off())
    }
  }
)

const handleUploadAdiProgress = (percent: number) => {
  loadingInstance?.setText(`上传机型模板：${percent.toFixed(0)}%`)
}
const handleUploadImageProgress = (percent: number) => {
  loadingInstance?.setText(`上传镜像：${percent.toFixed(0)}%`)
  if (percent == 100) {
    loadingInstance?.setText('首次加载镜像约需 3–5 分钟…')
  }
}

onUnmounted(() => {
  loadingInstance?.close()
  loadingInstance = null
})

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  const submit = async () => {
    try {
      createLoading()

      // Determine ADI
      let targetAdi: any = null
      let targetAdiID = ''

      if (isNeedAdi.value) {
        if (machineMode.value === 'random') {
          if (allAvailableModels.value.length === 0) {
            throw new Error('当前镜像版本下暂无可用机型模板，无法随机')
          }
          const idx = Math.floor(Math.random() * allAvailableModels.value.length)
          targetAdi = allAvailableModels.value[idx]
          targetAdiID = targetAdi.id
        } else {
          // Custom
          targetAdi = modelOptions.value.find((item: any) => item.id === form.adiID)
          targetAdiID = form.adiID
        }
      } else {
        // Not needed
        targetAdiID = ''
      }

      // Check uploads
      const uploads: {
        adi?: Adi
        image?: Image
      } = {}

      if (targetAdi && !targetAdi.isUploaded) {
        uploads.adi = targetAdi
      }

      const image = imageSelectRef.value?.getSelectedImage()
      // const image = imageOptions.value.find((item: any) => item.version === form.image_repository)
      if (image && !image.isUploaded) {
        uploads.image = image
      }

      // Upload ADI
      if (uploads.adi) {
        loadingInstance?.setText(`上传机型模板到主机中...`)
        const res = await ipc.invoke<Adi>(ADI_EVENTS.UPLOAD_ADI_TO_HOST, {
          adi: toRaw(uploads.adi),
          host: toRaw(host.value)
        })
        if (!res.success) {
          throw new Error(res.error || '上传机型模板到主机失败')
        }
      }

      // Upload Image
      if (uploads.image) {
        loadingInstance?.setText(`上传镜像到主机中...`)
        const res = await ipc.invoke<Image>(IMAGES_EVENTS.UPLOAD_IMAGE_TO_HOST, {
          image: toRaw(uploads.image),
          host: toRaw(host.value)
        })
        if (!res.success) {
          throw new Error(res.error || '上传镜像到主机失败')
        }
      }

      loadingInstance?.setText(`正在修改镜像...`)

      // Call update API
      await request.post(
        buildApiUrl(host.value?.ip || '', API_CONFIG.PATHS.UPDATE_CLOUD_PHONE_IMAGE),
        {
          db_ids: [device.value?.db_id],
          repository: form.image_repository,
          adiName: targetAdi?.name,
          adiPass: targetAdi?.pwd,
          adiID: targetAdiID
        },
        {
          timeout: 60 * 1000
        }
      )

      ElMessage.success('操作成功，请稍后查看结果')
      visible.value = false
    } catch (error: any) {
      ElMessage.error(getErrorMessage(error, '修改镜像失败'))
    } finally {
      loadingInstance?.close()
      loadingInstance = null
      try {
        await getImageOptions()
      } catch (e) {
        console.error(e)
      }
    }
  }

  if (currentAndroidVersion.value != deviceAndroidVersion.value) {
    ElMessageBox.confirm('当前跨版本升级，将清除所有数据，是否继续操作？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      submit()
    })
    return
  }
  submit()
}

const init = (row: Device, hostData?: Host) => {
  device.value = row
  host.value = hostData
  isReal.value = row.device_type === DeviceType.REAL || !row.device_type
  // getImageOptions() // Handled by component

  visible.value = true
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
.update-edit-content {
  padding: 0 10px;
}

.info-section {
  margin-bottom: 15px;
}

.info-item {
  display: flex;
  margin-bottom: 5px;
  font-size: 14px;

  .label {
    width: 100px;
    color: #606266;
  }

  .value {
    color: #606266;
  }
}

.section-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 8px;
  color: #606266;
}

.warning-box {
  background-color: #fdf6ec;
  padding: 8px 12px;
  border-radius: 4px;
  display: flex;
  gap: 10px;
  margin-top: 10px;

  .warning-icon {
    color: #e6a23c;
    font-size: 16px;
    margin-top: 2px;
  }

  .warning-content {
    font-size: 12px;
    color: #e6a23c;

    .warning-title {
      font-weight: bold;
      margin-bottom: 2px;
    }

    .danger-text {
      color: #f56c6c;
      font-weight: bold;
    }
  }
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.image-select-item {
  :deep(.el-form-item__label) {
    width: 100% !important;
    &::before {
      display: none;
    }
  }
}
</style>
