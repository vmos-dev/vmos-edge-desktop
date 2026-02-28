<template>
  <div
    ref="itemRef"
    class="grid-item"
    :class="[`grid-item-${size}`, { 'is-offline': isOffline }]"
    :style="style"
    @click="onClick"
    @contextmenu.prevent="onContextMenu"
  >
    <!-- 截图区域 -->
    <div class="item-preview" :style="getPreviewStyle(device.state)" @click="onPreviewClick">
      <Transition name="screenshot-fade" appear>
        <div v-if="screenshotUrl && !isError" class="preview-image">
          <!-- 前景内容层 -->
          <img
            class="preview-fg"
            :src="screenshotUrl"
            alt="preview"
            :style="fgStyle"
            @error="handleImageError"
            @load="onImgLoad"
          />
        </div>
      </Transition>
      <div v-if="!screenshotUrl || isError" class="preview-placeholder">
        <el-icon class="placeholder-icon"><Monitor /></el-icon>
        <span class="device-status">{{ formatState(device.state) }}</span>
      </div>

      <!-- 悬浮操作栏 -->
      <div class="item-overlay" v-if="!isOffline">
        <el-button-group>
          <el-button
            :size="buttonSize"
            :icon="VideoPlay"
            circle
            v-if="device.state === DeviceState.StateStopped"
            @click.stop="$emit('command', 'start', device)"
            :title="t('phone.powerOnNow')"
          />
          <el-button
            :size="buttonSize"
            :icon="CopyDocument"
            circle
            v-if="device.state === DeviceState.StateStopped"
            @click.stop="$emit('command', 'clone', device)"
            :title="t('cloudPhone.cloneDevice')"
          />
          <el-button
            :size="buttonSize"
            :icon="Iphone"
            circle
            v-if="device.state === DeviceState.StateRunning"
            @click.stop="$emit('open-window', device)"
            :title="t('cloudPhone.openWindow')"
          />
        </el-button-group>
      </div>
    </div>

    <!-- 信息区域 -->
    <div class="item-info">
      <div class="info-checkbox" v-if="selectable" @click.stop>
        <el-checkbox :model-value="isSelected" @change="onCheckboxChange" size="small" />
      </div>
      <div class="info-text">
        <span class="device-name" :title="device.user_name">{{ device.user_name }}</span>
        <span class="device-ip" :title="ipLink" v-if="ipLink">{{ ipLink }} </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Monitor, VideoPlay, Iphone, CopyDocument } from '@element-plus/icons-vue'
import { Device, DeviceState } from '@shared/ipc/data.types'
import { MacvlanPortMap } from '@renderer/utils/constant'
import { getDeviceStateText } from '@renderer/utils/i18n-maps'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'
import { request, isCancel } from '@shared/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface MenuItem {
  label: string
  command: string
  divided?: boolean
}

const props = defineProps<{
  device: Device
  size: 'small' | 'medium' | 'large'
  width: number
  height: number
  style?: any
  isSelected?: boolean
  selectable?: boolean
  menuItems?: MenuItem[]
  isGroupControl?: boolean
}>()

const emit = defineEmits<{
  (e: 'click', device: Device, event: MouseEvent): void
  (e: 'context-menu', device: Device, event: MouseEvent): void
  (e: 'selection-change', checked: boolean, device: Device): void
  (e: 'command', command: string, device: Device): void
  (e: 'open-window', device: Device): void
}>()

const ipLink = computed(() => {
  return props.device.network_mode === 'macvlan'
    ? props.device.state === DeviceState.StateRunning
      ? `${props.device.ip}:${MacvlanPortMap.adb}`
      : '-'
    : `${props.device.host_ip}:${props.device.adb}`
})
const isOffline = computed(() => props.device.state === DeviceState.StateOffline)

const buttonSize = computed(() => {
  if (props.size === 'small') return 'small'
  if (props.size === 'large') return 'large'
  return 'default'
})

// ==========================================
// 样式 & 旋转逻辑
// ==========================================

const imgRealWidth = ref(0)
const imgRealHeight = ref(0)

const onImgLoad = (e: Event) => {
  const img = e.target as HTMLImageElement
  imgRealWidth.value = img.naturalWidth
  imgRealHeight.value = img.naturalHeight
}

const getRotatedStyle = () => {
  // 容器内容区高度 (总高度 - 底部信息栏)
  const contentHeight = props.height - 56
  // 判断容器是否横向 (Landscape)
  const isContainerLandscape = props.width > contentHeight

  // 判断图片真实方向
  // 如果尚未加载完成（宽高为0），默认回退到 device 属性判断，或者默认为竖屏
  let isImagePortrait = true
  if (imgRealWidth.value && imgRealHeight.value) {
    isImagePortrait = imgRealWidth.value < imgRealHeight.value
  } else {
    // Fallback
    const dw = parseInt(props.device.width || '720', 10)
    const dh = parseInt(props.device.height || '1280', 10)
    isImagePortrait = dw < dh
  }

  // 1. 横屏模式 + 竖屏图片 -> 旋转 270 (让图片横过来)
  if (isContainerLandscape && isImagePortrait) {
    return {
      position: 'absolute' as const,
      width: `${contentHeight}px`,
      height: 'auto',
      minHeight: `${props.width}px`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%) rotate(270deg)',
      objectFit: 'cover' as const,
      objectPosition: 'top',
      transformOrigin: 'center center'
    }
  }

  // 2. 竖屏模式 + 横屏图片 -> 旋转 90 (让图片竖过来)
  if (!isContainerLandscape && !isImagePortrait) {
    return {
      position: 'absolute' as const,
      width: `${contentHeight}px`,
      height: 'auto',
      minHeight: `${props.width}px`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%) rotate(90deg)',
      objectFit: 'cover' as const,
      objectPosition: 'top',
      transformOrigin: 'center center'
    }
  }

  // 3. 其他情况 (方向一致) -> 不旋转，直接填满
  return {
    width: '100%',
    height: '100%',
    objectFit: 'fill' as const, // 使用 cover 保持比例，填满容器
    objectPosition: 'top', // 顶部对齐，超出的部分向下裁剪
    display: 'block',
    position: 'absolute' as const,
    top: 0,
    left: 0
  }
}

const fgStyle = computed(() => {
  return {
    ...getRotatedStyle(),
    zIndex: 2
  }
})

// ==========================================
// 截图加载逻辑
// ==========================================

const screenshotUrl = ref('')
const isLoading = ref(false)
const isError = ref(false)
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let isComponentUnmounted = false // 标记组件是否已销毁
let abortController: AbortController | null = null
const itemRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)
let observer: IntersectionObserver | null = null

// 防抖定时器，用于快速滚动时取消不必要的请求
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const cleanupScreenshot = () => {
  if (screenshotUrl.value) {
    screenshotUrl.value = ''
  }
}

const cancelCurrentRequest = () => {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

const loadScreenshot = async () => {
  if (props.device.state !== DeviceState.StateRunning) return
  cancelCurrentRequest()

  isLoading.value = true
  isError.value = false

  abortController = new AbortController()

  try {
    const baseUrl = buildApiUrl(
      props.device.host_ip || '',
      `${API_CONFIG.PATHS.GET_SCREENSHOT}/${props.device.db_id}`
    )

    // 计算盒子最短边的宽度
    const minSize = Math.min(props.width, props.height)

    const res = await request.get(
      baseUrl,
      {
        format: 'jpg',
        quality: 100,
        width: minSize,
        no_cache: true,
        time: new Date().getTime()
      },
      {
        responseType: 'blob',
        signal: abortController.signal,
        timeout: 5000
      }
    )

    abortController = null

    if (isComponentUnmounted || props.device.state !== DeviceState.StateRunning) return

    if (props.device.db_id && !baseUrl.includes(String(props.device.db_id))) {
      return
    }

    const blob = res instanceof Blob ? res : new Blob([res], { type: 'image/webp' })

    // 改用 FileReader 转 Base64，避免 Blob URL 需要手动 revoke 导致的内存泄漏问题
    const blobToDataURL = (b: Blob): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(b)
      })
    }

    const newUrl = await blobToDataURL(blob)

    if (isComponentUnmounted) {
      return
    }

    // 更新 URL (Base64 字符串会自动被垃圾回收)
    screenshotUrl.value = newUrl
  } catch (e: any) {
    if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED' || (e && isCancel(e))) {
      return
    }

    if (!isComponentUnmounted) {
      // 只有非取消的错误才记录
      // console.error('Failed to load screenshot', e)
    }
  } finally {
    if (!isComponentUnmounted) {
      isLoading.value = false
    }
  }
}

const startRefresh = () => {
  stopRefresh()
  if (props.device.state === DeviceState.StateRunning && !isComponentUnmounted && isVisible.value) {
    loadScreenshot().finally(() => {
      if (
        !isComponentUnmounted &&
        props.device.state === DeviceState.StateRunning &&
        isVisible.value
      ) {
        refreshTimer = setTimeout(startRefresh, props.isGroupControl ? 1000 : 5000)
      }
    })
  }
}

const stopRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  cancelCurrentRequest()
}

const handleImageError = () => {
  isError.value = true
}

const getPreviewStyle = (state: any) => {
  if (state === DeviceState.StateRunning) {
    return { backgroundColor: 'var(--el-bg-color-page)' }
  }
  return {
    backgroundColor: 'var(--el-bg-color-page)'
  }
}

// 监听设备 ID 变化（组件复用时）
watch(
  () => props.device.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      // 立即清理旧的 URL，防止内存泄漏和显示错误
      cleanupScreenshot()
      cancelCurrentRequest()
      // 重置状态
      isLoading.value = false
      isError.value = false
      // 重新开始刷新
      imgRealWidth.value = 0
      imgRealHeight.value = 0
      startRefresh()
    }
  }
)

watch(
  () => props.device.state,
  (newState, oldState) => {
    if (newState === DeviceState.StateRunning) {
      // 如果是从停止状态变为运行状态，清理旧截图和错误状态
      // 这样即使组件当前不可见，当变为可见时也能正确加载新截图
      if (oldState === DeviceState.StateStopped) {
        cleanupScreenshot()
        isError.value = false
        isLoading.value = false
      }
      // 只有在组件可见时才立即开始刷新
      // 如果不可见，IntersectionObserver 会在组件变为可见时触发
      if (isVisible.value) {
        startRefresh()
      }
    } else {
      stopRefresh()
      // 设备关机或离线时，才清理截图
      cleanupScreenshot()
    }
  }
)

// 监听群控状态变化
watch(
  () => props.isGroupControl,
  () => {
    // 只有在设备运行中且组件可见时才需要处理
    if (
      props.device.state === DeviceState.StateRunning &&
      isVisible.value &&
      !isComponentUnmounted
    ) {
      // 立即停止当前计时器
      stopRefresh()
      // 重新开始刷新，这样会使用新的时间间隔
      startRefresh()
    }
  }
)

onMounted(() => {
  isComponentUnmounted = false

  if (itemRef.value) {
    // 根据 item 高度动态计算 rootMargin，大约预加载 1-1.5 屏的内容
    // 小图模式下高度小，预加载行数多；大图模式下高度大，预加载行数少
    // 这里取一个较为通用的值，或者根据 size 动态调整
    // 目前固定 200px 可能在 Large 模式下（高度480）连一行都预加载不到
    // 建议设为通过 props 传入或设为更大的值，比如 '100% 0px' (即上下各预加载一个视口高度)
    observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const wasVisible = isVisible.value
        isVisible.value = entry.isIntersecting

        if (entry.isIntersecting) {
          // 如果之前不可见，现在可见了
          if (!wasVisible) {
            // 防抖：延迟 200ms 再发起请求，防止快速滚动时产生大量瞬时请求
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              if (
                isVisible.value &&
                !isComponentUnmounted &&
                props.device.state === DeviceState.StateRunning
              ) {
                startRefresh()
              }
            }, 200)
          }
        } else {
          // 不可见时：立即清除防抖定时器，并停止刷新
          if (debounceTimer) {
            clearTimeout(debounceTimer)
            debounceTimer = null
          }
          stopRefresh()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(itemRef.value)
  }
})

onUnmounted(() => {
  isComponentUnmounted = true // 标记销毁
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  stopRefresh()
  cleanupScreenshot()
  cancelCurrentRequest()
})

const onPreviewClick = (e: MouseEvent) => {
  // 只有在运行中状态下，点击预览图才打开窗口
  if (props.device.state === DeviceState.StateRunning) {
    e.stopPropagation()
    emit('open-window', props.device)
  }
}

const onClick = (e: MouseEvent) => {
  emit('click', props.device, e)
}

const onContextMenu = (e: MouseEvent) => {
  if (isOffline.value) return
  emit('context-menu', props.device, e)
}

const onCheckboxChange = (val: boolean | string | number) => {
  emit('selection-change', !!val, props.device)
}

const formatState = (state: any) => {
  return getDeviceStateText(state as DeviceState) || state
}
</script>

<style scoped lang="scss">
.grid-item {
  position: relative;
  background: var(--el-bg-color);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  cursor: pointer;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--el-border-color-light);

  &:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
    border-color: var(--el-color-primary);
    z-index: 1;

    .item-overlay {
      opacity: 1;
    }
  }

  &.is-selected {
    border-color: var(--el-color-primary);
    border-width: 2px;
    box-shadow: 0 0 0 2px var(--el-color-primary-alpha-1);

    .item-info {
      background-color: var(--el-bg-color);
    }

    .device-name {
      color: var(--el-color-primary);
    }
  }

  &.is-offline {
    filter: grayscale(100%);
    opacity: 0.7;
    cursor: not-allowed;

    &:hover {
      box-shadow: none;
      transform: none;
    }
  }
}

.item-preview {
  width: 100%;
  height: calc(100% - 56px);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    border: none;
  }
}

.preview-image {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* 截图淡入效果 - 使用 Vue Transition */
.screenshot-fade-enter-active,
.screenshot-fade-appear-active {
  transition: opacity 0.2s ease-out;
}

.screenshot-fade-enter-from,
.screenshot-fade-appear-from {
  opacity: 0;
}

.screenshot-fade-enter-to,
.screenshot-fade-appear-to {
  opacity: 1;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--el-border-color);
  gap: 12px;
  width: 100%;
  height: 100%;
  background-color: var(--el-bg-color-page);

  .placeholder-icon {
    font-size: 36px;
    opacity: 0.6;
  }

  .device-status {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
  }
}

.item-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--el-color-primary-alpha-1);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 10;
  backdrop-filter: blur(4px);
}

:deep(.el-button.is-circle) {
  box-shadow: 0 2px 8px var(--app-shadow-hover-color, var(--el-box-shadow-light));
  border: none;
}

.item-info {
  height: 56px;
  padding: 0 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-bg-color-page);

  .info-checkbox {
    margin-right: 10px;
    display: flex;
    align-items: center;
    height: 100%;

    :deep(.el-checkbox) {
      height: auto;
      --el-checkbox-input-width: 18px;
      --el-checkbox-input-height: 18px;
    }
  }

  .info-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
    gap: 4px;
    min-width: 0;
  }

  .device-name {
    font-size: 13px;

    font-weight: 600;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
    transition: color 0.2s;
  }

  .device-ip {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    opacity: 0.8;
  }
}

.grid-item-small {
  .item-info {
    padding: 0 10px;

    .info-checkbox {
      margin-right: 6px;
      :deep(.el-checkbox) {
        --el-checkbox-input-width: 16px;
        --el-checkbox-input-height: 16px;
      }
    }

    .device-name {
      font-size: 12px;
    }
    .device-ip {
      font-size: 10px;
    }
  }
}

.grid-item-large {
  .item-info {
    padding: 0 10px;
    .device-name {
      font-size: 14px;
    }
    .device-ip {
      font-size: 12px;
    }
  }
}
</style>
