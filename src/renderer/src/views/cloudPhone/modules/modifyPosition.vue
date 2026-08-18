<template>
  <vmos-dialog
    v-model="visible"
    :title="t('cloudPhone.modifyPosition')"
    :show-close="!isProcessing"
    width="75%"
    class="update-edit-dialog"
    @closed="handleClose"
  >
    <div class="modify-position-content">
      <div class="header-control">
        <el-form
          ref="formRef"
          :model="locationForm"
          :rules="formRules"
          label-width="auto"
          :inline="false"
          class="location-form"
        >
          <el-form-item :label="t('cloudPhone.coordinate')">
            <el-input
              v-model="coordinate"
              :placeholder="t('cloudPhone.coordinatePlaceholder')"
              style="width: 200px"
              clearable
            />
          </el-form-item>
          <el-form-item :label="t('cloudPhone.altitude')" prop="altitude">
            <el-input-number
              v-model="locationForm.altitude"
              :placeholder="t('cloudPhone.altitudePlaceholder')"
              :precision="2"
              :step="0.1"
              style="width: 150px"
              clearable
            />
          </el-form-item>
          <el-form-item :label="t('cloudPhone.speed')" prop="speed">
            <el-input-number
              v-model="locationForm.speed"
              :placeholder="t('cloudPhone.speedPlaceholder')"
              :min="0"
              :precision="2"
              :step="0.1"
              style="width: 150px"
              clearable
            />
          </el-form-item>
          <el-form-item :label="t('cloudPhone.bearing')" prop="bearing">
            <el-input-number
              v-model="locationForm.bearing"
              :placeholder="t('cloudPhone.bearingPlaceholder')"
              :min="0"
              :max="360"
              :precision="2"
              :step="0.1"
              style="width: 150px"
              clearable
            />
          </el-form-item>
          <el-form-item :label="t('cloudPhone.accuracy')" prop="horizontalAccuracyMeters">
            <el-input-number
              v-model="locationForm.horizontalAccuracyMeters"
              :placeholder="t('cloudPhone.accuracyPlaceholder')"
              :min="0"
              :precision="2"
              :step="0.1"
              style="width: 150px"
              clearable
            />
          </el-form-item>
        </el-form>
      </div>

      <div class="map-selector-content">
        <span>{{ t('cloudPhone.thirdPartyTip') }}</span>
        <div class="map-selector">
          <label>{{ t('cloudPhone.thirdPartyMap') }}</label>
          <el-radio-group v-model="activeMap" size="default">
            <el-radio-button label="baidu">{{ t('cloudPhone.baiduMap') }}</el-radio-button>
            <el-radio-button label="amap">{{ t('cloudPhone.amap') }}</el-radio-button>
            <el-radio-button label="google">Google Maps</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div class="browser-container">
        <div class="url-bar-wrapper">
          <div class="url-bar">
            <el-input
              v-model="webviewUrl"
              :placeholder="t('cloudPhone.urlPlaceholder')"
              clearable
              @keyup.enter="handleNavigate"
            >
              <template #append>
                <el-button @click="handleNavigate">{{ t('cloudPhone.navigate') }}</el-button>
              </template>
            </el-input>
          </div>
        </div>

        <div class="map-container">
          <webview
            v-if="visible"
            ref="webviewRef"
            :src="webviewUrl"
            class="map-webview"
            allowpopups
            @dom-ready="handleDomReady"
            @did-finish-load="handleDidFinishLoad"
            @did-navigate="handleDidNavigate"
            @console-message="handleConsoleMessage"
          >
          </webview>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer-content">
        <div class="queue-status" v-if="isProcessing || taskList.length > 0">
          <div class="status-item processing">
            <span class="dot"></span>
            <span class="label">{{ t('common.processing') }}</span>
            <span class="count">{{
              taskList.filter((t) => t.status === 'processing').length
            }}</span>
          </div>
          <div class="status-item success">
            <span class="dot"></span>
            <span class="label">{{ t('common.success') }}</span>
            <span class="count">{{ taskList.filter((t) => t.status === 'success').length }}</span>
          </div>
          <div class="status-item error">
            <span class="dot"></span>
            <span class="label">{{ t('common.failed') }}</span>
            <span class="count">{{ taskList.filter((t) => t.status === 'error').length }}</span>
          </div>
          <div class="status-item waiting">
            <span class="dot"></span>
            <span class="label">{{ t('cloudPhone.waitingStatus') }}</span>
            <span class="count">{{ taskList.filter((t) => t.status === 'waiting').length }}</span>
          </div>
        </div>
        <div class="dialog-actions">
          <el-button v-if="!isProcessing" @click="visible = false">{{
            t('cloudPhone.close')
          }}</el-button>
          <el-button type="primary" :loading="isProcessing" @click="handleConfirm">
            {{ isProcessing ? t('cloudPhone.modifying') : t('cloudPhone.confirmModify') }}
          </el-button>
        </div>
      </div>
    </template>
  </vmos-dialog>
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage, FormInstance, FormRules } from 'element-plus'
import { buildApiUrl, API_CONFIG } from '@shared/api/config'
import { RequestQueue, type RequestTask } from '@renderer/utils/requestQueue'
import { parseCoordinate } from '@renderer/utils'
import { useI18n } from 'vue-i18n'
import { useLocale } from '@renderer/hooks/useLocale'
const { locale } = useLocale()

const { t } = useI18n()
const visible = ref(false)
const devices = ref<any>([])
const activeMap = ref(locale.value?.indexOf('CN') !== -1 ? 'baidu' : 'google')
const coordinate = ref('')
const webviewRef = ref()
const webviewUrl = ref('')
const formRef = ref<FormInstance>()

// 位置表单数据
const locationForm = ref({
  altitude: undefined as number | undefined,
  speed: undefined as number | undefined,
  bearing: undefined as number | undefined,
  horizontalAccuracyMeters: undefined as number | undefined
})

// 表单验证规则
const formRules: FormRules = {
  altitude: [
    {
      validator: (_rule, value, callback) => {
        if (value !== undefined && value !== null) {
          const num = Number(value)
          if (isNaN(num)) {
            callback(new Error(t('cloudPhone.enterValidAltitude')))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  speed: [
    {
      validator: (_rule, value, callback) => {
        if (value !== undefined && value !== null) {
          const num = Number(value)
          if (isNaN(num) || num < 0) {
            callback(new Error(t('cloudPhone.speedMustPositive')))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  bearing: [
    {
      validator: (_rule, value, callback) => {
        if (value !== undefined && value !== null) {
          const num = Number(value)
          if (isNaN(num) || num < 0 || num > 360) {
            callback(new Error(t('cloudPhone.bearingRange')))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  horizontalAccuracyMeters: [
    {
      validator: (_rule, value, callback) => {
        if (value !== undefined && value !== null) {
          const num = Number(value)
          if (isNaN(num) || num < 0) {
            callback(new Error(t('cloudPhone.accuracyMustPositive')))
          } else {
            callback()
          }
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 队列相关
const queue = new RequestQueue({ concurrency: 10 })
const taskList = ref<RequestTask[]>([])
const isProcessing = ref(false)

// 监听队列变化
queue.on('change', (list) => {
  taskList.value = [...list]
})

queue.on('finish', () => {
  if (isProcessing.value) {
    const successCount = taskList.value.filter((t) => t.status === 'success').length
    const failCount = taskList.value.filter((t) => t.status === 'error').length

    if (failCount > 0) {
      ElMessage.warning(
        t('cloudPhone.processingComplete', { success: successCount, fail: failCount })
      )
    } else {
      ElMessage.success(t('cloudPhone.modifyPositionComplete', { success: successCount }))
    }
    isProcessing.value = false
    visible.value = false
  }
})

const handleClose = () => {
  queue.clearAllTasks()
  coordinate.value = ''
  // 重置表单
  locationForm.value = {
    altitude: undefined,
    speed: undefined,
    bearing: undefined,
    horizontalAccuracyMeters: undefined
  }
  formRef.value?.clearValidate()
}

const mapUrls = {
  baidu: 'https://lbs.baidu.com/maptool/getpoint',
  amap: 'https://lbs.amap.com/tools/picker',
  google: 'https://www.google.com/maps'
}

const currentMapUrl = computed(() => {
  let url = mapUrls[activeMap.value]
  if (activeMap.value === 'google') {
    const lang = locale.value === 'zh-CN' ? 'zh-CN' : 'en'
    url = `${url}?hl=${lang}`
  }
  return url
})

// 监听地图类型切换，更新地址栏和 webview
watch(activeMap, () => {
  const newUrl = currentMapUrl.value
  webviewUrl.value = newUrl
  coordinate.value = ''
  // 更新 webview 地址
  if (webviewRef.value) {
    webviewRef.value.src = newUrl
  }
})

// 不监听 webviewUrl 变化，只在用户点击"前往"时更新

const init = (targetDevices: any[]) => {
  devices.value = targetDevices

  // 每次打开时根据当前语言重置地图选择
  activeMap.value = locale.value?.toLowerCase() === 'zh-cn' ? 'baidu' : 'google'

  // 初始化地址栏为当前选中的地图 URL
  webviewUrl.value = currentMapUrl.value
  visible.value = true
  coordinate.value = ''

  // 重置表单
  locationForm.value = {
    altitude: undefined,
    speed: undefined,
    bearing: undefined,
    horizontalAccuracyMeters: undefined
  }
  formRef.value?.clearValidate()
}

const handleNavigate = () => {
  if (!webviewUrl.value) {
    ElMessage.warning(t('cloudPhone.urlPlaceholder'))
    return
  }
  // 验证 URL 格式
  try {
    new URL(webviewUrl.value)
  } catch {
    ElMessage.warning(t('cloudPhone.urlFormatError'))
    return
  }
  // 更新 webview 地址
  if (webviewRef.value) {
    webviewRef.value.src = webviewUrl.value
  }
}

const handleDidNavigate = (e: any) => {
  // 当 webview 导航时，更新地址栏
  if (e.url && e.url !== webviewUrl.value) {
    webviewUrl.value = e.url
  }
}

watch(
  () => activeMap.value,
  () => {
    // 清空坐标输入
    coordinate.value = ''
  }
)

const handleDomReady = () => {
  const wv = webviewRef.value
  if (!wv) return

  // 注入 CSS 隐藏不必要的头部和底部
  //   wv.insertCSS(`
  //     /* 通用隐藏 */
  //     header, footer, nav, aside, .tips, .header, .footer, .top-bar, .bottom-bar, .nav, .menu, .breadcrumb { display: none !important; }
  //     [class*="header"], [class*="footer"], [id*="header"], [id*="footer"] { display: none !important; }

  //     /** google maps specific */
  //     .XltNde.tTVLSc { display: none !important; }
  //     /* Baidu specific */
  //     .head_wrap, .foot_wrap, .src-pages-maptool-getpoint-styles-index__tips, .mp_head,  .mp_foot, .BMap_cpyCtrl, .anchorBL, #copyright { display: none !important; }
  //     #maptool {
  //       height: 100vh !important;
  //       overflow: hidden !important;
  //     }
  //     .src-pages-maptool-getpoint-styles-index__Instructions {
  //       display: none !important;
  //     }
  //     /* Amap specific */
  //     .amap-copyright, .amap-logo, .search-box-wrapper, .layout-header, .layout-footer, .feedback-box { display: none !important; }
  //     .tools-picker { padding: 0 !important; }
  //     #hd { height: 80px !important; }  #myPage { height: calc(100% - 80px) !important; overflow: hidden !important; }
  //     #center-container{ overflow: hidden !important; }
  //   `)
}

const handleDidFinishLoad = () => {
  const wv = webviewRef.value
  if (!wv) return

  console.log('VMOS: Page finished loading, injecting script...')

  // 注入 JS 拦截剪贴板写入和监听坐标变化
  wv.executeJavaScript(
    `
    (function() {
      console.log('VMOS: Script injected! Location:', location.href);

      // 辅助函数：发送坐标到宿主
      function sendCoordinate(text) {
        if (!text) {
          console.log('VMOS: sendCoordinate called with empty text');
          return;
        }
        // 简单清理，例如去除空格
        text = text.trim();
        console.log('VMOS: sendCoordinate called with:', text);

        // 方式1: 使用 console.log（辅助）
        const coordinateMsg = '__COORDINATE__:' + text;
        console.log(coordinateMsg);

        // 方式2: 使用 window.postMessage（主要方式）
        try {
          // 向父窗口发送消息
          // 注意：在 webview 中，window.parent 指向的是 webview 容器，
          // 但出于安全考虑，最好明确指定 targetOrigin 或使用 '*'
          console.log('VMOS: Posting message to parent...');
          window.parent.postMessage({ type: 'VMOS_COORDINATE', coordinate: text }, '*');
        } catch (e) {
          console.log('VMOS: postMessage failed:', e);
        }
      }

      // 1. 拦截剪贴板复制 (保留原有逻辑作为兜底)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        const originalWriteText = navigator.clipboard.writeText;
        navigator.clipboard.writeText = (text) => {
          sendCoordinate(text);
          return originalWriteText.call(navigator.clipboard, text);
        };
      }

      document.addEventListener('copy', () => {
        const selection = window.getSelection().toString();
        if (selection) {
           sendCoordinate(selection);
        }
      });

      // 2. 针对特定地图的自动监听逻辑
      // 使用 MutationObserver 监听 DOM 变化，替代轮询

      const setupObservers = () => {
        console.log('VMOS: Script setupObservers called for ' + location.hostname);

        // --- 百度地图 (Baidu) ---
        if (location.href.includes('baidu.com')) {
          console.log('VMOS: Baidu map detected, setting up...');
          const selector = '.src-pages-maptool-getpoint-styles-index__CoordintesText';

          const el = document.querySelector(selector);
          if (el) {
            console.log('VMOS: Baidu element found, observer attached');

            const observer = new MutationObserver(() => {
              const text = el.innerText || el.textContent || '';
              console.log('VMOS: Baidu text changed:', text);
              if (text && text.includes(',')) {
                sendCoordinate(text.trim());
              }
            });

            observer.observe(el, {
              childList: true,
              characterData: true,
              subtree: true
            });

            window.__coordObserver = observer;
          } else {
            console.log('VMOS: Baidu element NOT FOUND:', selector);
          }
        }

        // --- 高德地图 (Amap) ---
        if (location.href.includes('amap.com')) {
           console.log('VMOS: Setup Amap logic');
           const amapInputId = 'txtCoordinate';
           const input = document.getElementById(amapInputId);

           if (input) {
             console.log('VMOS: Found Amap input');
             input.addEventListener('input', (e) => sendCoordinate(e.target.value));

             const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
             if (descriptor && descriptor.set) {
               const originalSet = descriptor.set;
               Object.defineProperty(input, 'value', {
                 set: function(val) {
                   sendCoordinate(val);
                   return originalSet.call(this, val);
                 },
                 get: function() {
                   return descriptor.get.call(this);
                 }
               });
             }
           } else {
             console.log('VMOS: Amap input NOT FOUND:', amapInputId);
           }
        }

        // --- Google Maps ---
        if (location.href.includes('google.com/maps')) {
          console.log('VMOS: Setup Google Maps logic');
          const buttonSelector = 'button.ZqLNQd.t9f27';

          // 监听按钮点击事件
          const handleGoogleButtonClick = (e) => {
            const button = e.target.closest(buttonSelector);
            if (button) {
              const text = button.innerText || button.textContent || '';
              console.log('VMOS: Google Maps button clicked, text:', text);
              if (text && text.includes(',')) {
                sendCoordinate(text.trim());
              }
            }
          };

          // 使用事件委托监听点击
          document.addEventListener('click', handleGoogleButtonClick, true);
          console.log('VMOS: Google Maps click listener attached');
        }
      };

      // 等待 DOM 加载完成后启动
      console.log('VMOS: Current readyState:', document.readyState);
      if (document.readyState === 'loading') {
        console.log('VMOS: Waiting for DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', () => {
          console.log('VMOS: DOMContentLoaded fired, calling setupObservers');
          setupObservers();
        });
      } else {
        console.log('VMOS: DOM already loaded, calling setupObservers immediately');
        setupObservers();
      }

    })();
  `
  ).catch((err) => {
    console.error('VMOS: Failed to inject script:', err)
  })
}

const handleConsoleMessage = (e: any) => {
  const msg = e.message || ''
  const level = e.level || 0 // 0=log, 1=warning, 2=error

  // 显示所有 VMOS 开头的调试日志
  if (msg.includes('VMOS:')) {
    console.log('[Webview]', msg)
  }

  // 处理坐标消息（支持 console.log 和 console.error）
  if (msg.startsWith('__COORDINATE__:')) {
    console.log('VMOS: handleConsoleMessage received:', msg, 'level:', level)
    const text = msg.replace('__COORDINATE__:', '').trim()
    // 简单的格式校验：包含逗号且有数字
    if (text && text.includes(',') && /\d/.test(text)) {
      console.log('VMOS: Setting coordinate to:', text)
      coordinate.value = text?.replace(/\s/g, '')
    } else {
      console.log('VMOS: Invalid coordinate format:', text)
    }
  }
}

watch(visible, (val) => {
  if (!val) {
    coordinate.value = ''
    // 重置表单
    locationForm.value = {
      altitude: undefined,
      speed: undefined,
      bearing: undefined,
      horizontalAccuracyMeters: undefined
    }
    formRef.value?.clearValidate()
  }
})

const handleConfirm = async () => {
  if (isProcessing.value) return

  // 验证经纬度输入
  if (!coordinate.value) {
    ElMessage.warning(t('cloudPhone.selectOrEnterLatLng'))
    return
  }

  // 验证表单（只验证可选字段）
  if (formRef.value) {
    try {
      await formRef.value.validate()
    } catch (e) {
      ElMessage.warning(t('cloudPhone.checkFormInput'))
      return
    }
  }

  // 解析经纬度
  let longitude: number
  let latitude: number
  try {
    const parsed = parseCoordinate(
      coordinate.value,
      activeMap.value === 'google' ? 'latlng' : 'lnglat'
    )
    longitude = parsed.longitude
    latitude = parsed.latitude
  } catch (e: any) {
    ElMessage.warning(e.message || t('cloudPhone.latLngFormatError'))
    return
  }

  // 清理旧任务
  queue.clearAllTasks()
  isProcessing.value = true

  // 构建请求数据
  const requestData: any = {
    latitude,
    longitude
  }

  // 添加可选参数（如果存在）
  if (locationForm.value.altitude !== undefined && locationForm.value.altitude !== null) {
    requestData.altitude = Number(locationForm.value.altitude)
  }
  if (locationForm.value.speed !== undefined && locationForm.value.speed !== null) {
    requestData.speed = Number(locationForm.value.speed)
  }
  if (locationForm.value.bearing !== undefined && locationForm.value.bearing !== null) {
    requestData.bearing = Number(locationForm.value.bearing)
  }
  if (
    locationForm.value.horizontalAccuracyMeters !== undefined &&
    locationForm.value.horizontalAccuracyMeters !== null
  ) {
    requestData.horizontalAccuracyMeters = Number(locationForm.value.horizontalAccuracyMeters)
  }

  devices.value.forEach((item: any) => {
    queue.add({
      url: buildApiUrl(item.host_ip, `${API_CONFIG.PATHS.SET_DEVICE_LOCATION}/${item.db_id}`),
      method: 'POST',
      data: requestData,
      meta: {
        name: item.id
      }
    })
  })
}

defineExpose({
  init
})
</script>

<style scoped lang="scss">
:deep(.update-edit-dialog) {
  .el-dialog__body {
    overflow: hidden;
  }
}

.modify-position-content {
  height: 75vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;

  .header-control {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 12px;
    flex-wrap: wrap;

    .info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;

      .label {
        font-weight: bold;
        white-space: nowrap;
      }
    }

    .location-form {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;

      :deep(.el-form-item) {
        margin-bottom: 0;
      }

      :deep(.el-form-item__label) {
        padding-right: 8px;
        font-size: 13px;
        white-space: nowrap;
      }
    }
  }

  .browser-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    overflow: hidden;
    min-height: 0; // 确保 flex 子元素可以缩小
  }

  .url-bar-wrapper {
    width: 100%;
    border-bottom: 1px solid var(--el-border-color);
    overflow: hidden;
    flex-shrink: 0;
  }

  .url-bar {
    width: 100%;

    :deep(.el-input-group__append) {
      border-left: none;
    }

    :deep(.el-input__wrapper) {
      border: none;
      box-shadow: none;
      border-radius: 0;
    }

    :deep(.el-input) {
      border: none;
    }
  }

  .map-container {
    flex: 1;
    overflow: hidden;
    position: relative;
    min-height: 0; // 确保 flex 子元素可以缩小

    .map-webview {
      width: 100%;
      height: 100%;
      display: inline-flex;
    }
  }
}

.dialog-footer-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.queue-status {
  display: flex;
  align-items: center;
  gap: 16px;

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .count {
      font-weight: 600;
      min-width: 14px;
    }

    &.processing {
      color: var(--el-color-primary);

      .dot {
        background-color: var(--el-color-primary);
      }
    }

    &.success {
      color: var(--el-color-success);

      .dot {
        background-color: var(--el-color-success);
      }
    }

    &.error {
      color: var(--el-color-danger);

      .dot {
        background-color: var(--el-color-danger);
      }
    }

    &.waiting {
      color: var(--el-text-color-secondary);

      .dot {
        background-color: var(--el-text-color-secondary);
      }
    }
  }
}

.map-selector-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  background-color: #f1f1f1;
  padding: 8px;
  border-radius: 4px;

  .map-selector {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  // 确保右侧对齐，如果 queue-status 不存在，actions 仍然在右边
  margin-left: auto;
}
</style>
