<template>
  <div style="width: 100%">
    <el-select
      v-model="modelValue"
      filterable
      placeholder="请选择镜像"
      style="width: 100%"
      @change="handleChange"
      :loading="loading"
    >
      <el-option
        v-for="item in imageOptions"
        :key="item.version"
        :label="`${item.version} ${item.isUploaded ? '(已上传)' : ''}`"
        :value="item.version"
      />
    </el-select>
    <!-- <div class="image-select-tip">
      仅支持时间 ≥ {{ imageSupportVersionTime }} 的镜像和 CBS 版本， <strong>最新镜像</strong> 和
      <strong>最新 CBS 版本</strong>。 请参考镜像历史发布文档获取最新镜像并确保 CBS 已升级。
      使用旧镜像或旧 CBS 版本可能导致失败或窗口无画面。
      <a
        class="primary-link"
        href="https://help.vmosedge.com/zh/productupdates/image-release-history.html"
        target="_blank"
      >
        前往获取最新镜像和CBS版本
      </a>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ipc } from '@renderer/core/ipc'
import { IMAGES_EVENTS } from '@shared/ipc/images.types'
import { Image } from '@shared/ipc/data.types'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { request } from '@shared/api/request'
import { ElMessage } from 'element-plus'
import { getErrorMessage } from '@shared/api'

// const imageSupportVersionTime = __IMAGE_SUPPORT_VERSION_TIME__

// 使用 defineModel
const modelValue = defineModel<string>('modelValue')
const androidVersion = defineModel<string>('androidVersion')

// 定义 Props
const props = defineProps<{
  // 主机信息，用于获取远端镜像列表
  hostIp?: string
  // 需要排除的镜像版本（例如当前正在使用的）
  excludeVersion?: string
}>()

// 定义 Emits
const emits = defineEmits<{
  (e: 'change', image: Image & { isUploaded: boolean }): void
}>()

const imageOptions = ref<(Image & { isUploaded: boolean })[]>([])
const loading = ref(false)

// 暴露给父组件的数据
const getSelectedImage = () => {
  return imageOptions.value.find((item) => item.version === modelValue.value)
}

// 解析版本号帮助函数
const parseAndroidVersion = (name: string): string => {
  const match = name.match(/android(\d+)/i)
  return match ? match[1] : ''
}

// const parseImageDate = (version: string): number => {
//   const match = version.match(/(\d{8})/i)
//   return match ? Number(match[1]) : 0
// }

const getImageOptions = async () => {
  if (!props.hostIp) return

  loading.value = true
  try {
    // 1. 获取本地镜像列表
    const res = await ipc.invoke<Image[]>(IMAGES_EVENTS.QUERY_IMAGES)
    if (!res.success) {
      throw new Error(res.error || '获取本地镜像列表失败')
    }

    const localImages =
      res.data?.map((image: Image) => ({
        ...image,
        isUploaded: false
      })) || []

    // 2. 获取远端镜像列表
    const url = buildApiUrl(props.hostIp, API_CONFIG.PATHS.GET_HOST_IMG_LIST)
    let remoteImages: any[] = []
    try {
      const imgList = await request.get(url)
      remoteImages =
        imgList?.data?.map((item: any) => ({
          version: item.repository,
          image_id: item.image_id,
          androidVersion: parseAndroidVersion(item.repository),
          isUploaded: true,
          // 补充字段
          name: item.repository,
          path: '',
          size: 0,
          createTime: 0
        })) || []
    } catch (error) {
      console.error('获取远端镜像列表失败，仅显示本地镜像', error)
    }

    // 3. 合并逻辑
    const mergedMap = new Map<string, Image & { isUploaded: boolean }>()

    remoteImages.forEach((remoteImg) => {
      const localMatch = localImages.find((l) => l.version === remoteImg.version)
      if (localMatch) {
        mergedMap.set(remoteImg.version, { ...localMatch, isUploaded: true })
      } else {
        mergedMap.set(remoteImg.version, remoteImg)
      }
    })

    localImages.forEach((img) => {
      if (!mergedMap.has(img.version)) {
        mergedMap.set(img.version, img)
      }
    })

    // 4. 排除指定版本
    if (props.excludeVersion) {
      mergedMap.delete(props.excludeVersion)
    }

    imageOptions.value = Array.from(mergedMap.values())

    const setFirstImage = () => {
      const first = imageOptions.value?.[0]
      if (first) {
        modelValue.value = first.version
        androidVersion.value = first.androidVersion
        emits('change', first)
      }
    }

    if (!modelValue.value && imageOptions.value.length > 0) {
      setFirstImage()
    } else if (modelValue.value) {
      const selected = imageOptions.value.find((i) => i.version === modelValue.value)
      if (selected) {
        if (androidVersion.value !== selected.androidVersion) {
          androidVersion.value = selected.androidVersion
        }
        emits('change', selected)
      } else {
        setFirstImage()
      }
    }
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error, '获取镜像列表失败'))
  } finally {
    loading.value = false
  }
}

const handleChange = (val: string) => {
  const image = imageOptions.value.find((item) => item.version === val)
  if (image) {
    androidVersion.value = image.androidVersion // Update model
    emits('change', image)
  } else {
    androidVersion.value = ''
  }
}

// 监听 hostIp 变化重新加载
watch(
  () => props.hostIp,
  (val) => {
    if (val) {
      getImageOptions()
    }
  },
  { immediate: true }
)

// 暴露方法和数据
defineExpose({
  getImageOptions,
  getSelectedImage,
  imageOptions
})
</script>

<style scoped lang="scss">
.image-select-tip {
  font-size: 12px;
  color: #f56c6c;
  margin-top: 5px;
  .primary-link {
    color: #409eff;
    text-decoration: none;
    cursor: pointer;
  }
}
</style>
