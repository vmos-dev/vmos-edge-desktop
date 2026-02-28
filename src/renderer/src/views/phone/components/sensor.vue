<template>
  <div class="sensor-container">
    <!-- 3D 模型预览区域 -->
    <div class="model-section">
      <div
        ref="modelContainerRef"
        class="model-container"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @wheel.prevent="handleWheel"
      ></div>
    </div>

    <!-- 下方控制和信息区域 -->
    <div class="sensor-content">
      <!-- 左侧控制区域 -->
      <div class="control-section">
        <!-- 模式切换 -->
        <div class="mode-tabs">
          <div
            class="tab-item"
            :class="{ active: controlMode === 'rotate' }"
            @click="controlMode = 'rotate'"
          >
            {{ t('phone.sensor.rotate') }}
          </div>
          <div
            class="tab-item"
            :class="{ active: controlMode === 'move' }"
            @click="controlMode = 'move'"
          >
            {{ t('phone.sensor.move') }}
          </div>
        </div>

        <!-- 滑块控制区域 - Rotate 模式 -->
        <div v-if="controlMode === 'rotate'" class="controls">
          <div class="control-item">
            <div class="item-label">{{ t('phone.sensor.zAxisRotation') }}</div>
            <div class="item-control">
              <el-slider
                v-model="rotation.z"
                :min="-180"
                :max="180"
                :step="0.1"
                class="slider"
                @input="handleRotationChange"
              />
              <el-input-number
                v-model="rotation.z"
                :min="-180"
                :max="180"
                :step="0.1"
                :precision="1"
                controls-position="right"
                size="small"
                class="input-number"
                @change="handleRotationChange"
              />
            </div>
          </div>

          <div class="control-item">
            <div class="item-label">{{ t('phone.sensor.xAxisRotation') }}</div>
            <div class="item-control">
              <el-slider
                v-model="rotation.x"
                :min="-180"
                :max="180"
                :step="0.1"
                class="slider"
                @input="handleRotationChange"
              />
              <el-input-number
                v-model="rotation.x"
                :min="-180"
                :max="180"
                :step="0.1"
                :precision="1"
                controls-position="right"
                size="small"
                class="input-number"
                @change="handleRotationChange"
              />
            </div>
          </div>

          <div class="control-item">
            <div class="item-label">{{ t('phone.sensor.yAxisRotation') }}</div>
            <div class="item-control">
              <el-slider
                v-model="rotation.y"
                :min="-180"
                :max="180"
                :step="0.1"
                class="slider"
                @input="handleRotationChange"
              />
              <el-input-number
                v-model="rotation.y"
                :min="-180"
                :max="180"
                :step="0.1"
                :precision="1"
                controls-position="right"
                size="small"
                class="input-number"
                @change="handleRotationChange"
              />
            </div>
          </div>
        </div>

        <!-- 滑块控制区域 - Move 模式 -->
        <div v-else class="controls">
          <div class="control-item">
            <div class="item-label">{{ t('phone.sensor.xAxis') }}</div>
            <div class="item-control">
              <el-slider
                v-model="position.x"
                :min="-7"
                :max="7"
                :step="0.1"
                class="slider"
                @input="handlePositionChange"
              />
              <el-input-number
                v-model="position.x"
                :min="-7"
                :max="7"
                :step="0.1"
                :precision="1"
                controls-position="right"
                size="small"
                class="input-number"
                @change="handlePositionChange"
              />
            </div>
          </div>

          <div class="control-item">
            <div class="item-label">{{ t('phone.sensor.yAxis') }}</div>
            <div class="item-control">
              <el-slider
                v-model="position.y"
                :min="-4"
                :max="4"
                :step="0.1"
                class="slider"
                @input="handlePositionChange"
              />
              <el-input-number
                v-model="position.y"
                :min="-4"
                :max="4"
                :step="0.1"
                :precision="1"
                controls-position="right"
                size="small"
                class="input-number"
                @change="handlePositionChange"
              />
            </div>
          </div>

          <div class="control-item">
            <div class="item-label">{{ t('phone.sensor.zAxis') }}</div>
            <div class="item-control">
              <el-slider
                v-model="position.z"
                :min="-4"
                :max="4"
                :step="0.1"
                class="slider"
                @input="handlePositionChange"
              />
              <el-input-number
                v-model="position.z"
                :min="-4"
                :max="4"
                :step="0.1"
                :precision="1"
                controls-position="right"
                size="small"
                class="input-number"
                @change="handlePositionChange"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧信息区域 -->
      <div class="info-section">
        <!-- 设备方向 -->
        <div class="info-group">
          <div class="group-title">{{ t('phone.sensor.deviceOrientation') }}</div>
          <div class="rotation-buttons">
            <div
              class="rotation-btn"
              :class="{ active: deviceRotation === 0 }"
              @click="setDeviceRotation(0)"
              :title="t('phone.sensor.portrait')"
            >
              <div class="device-icon portrait"></div>
            </div>
            <div
              class="rotation-btn"
              :class="{ active: deviceRotation === 90 }"
              @click="setDeviceRotation(90)"
              :title="t('phone.sensor.landscapeLeft')"
            >
              <div class="device-icon landscape-left"></div>
            </div>
            <div
              class="rotation-btn"
              :class="{ active: deviceRotation === 180 }"
              @click="setDeviceRotation(180)"
              :title="t('phone.sensor.portraitUpsideDown')"
            >
              <div class="device-icon portrait-reverse"></div>
            </div>
            <div
              class="rotation-btn"
              :class="{ active: deviceRotation === 270 }"
              @click="setDeviceRotation(270)"
              :title="t('phone.sensor.landscapeRight')"
            >
              <div class="device-icon landscape-right"></div>
            </div>
          </div>
        </div>

        <!-- 传感器数值 -->
        <div class="info-group">
          <div class="group-title">{{ t('phone.sensor.sensorValues') }}</div>
          <div class="sensor-values">
            <div class="sensor-item">
              <span class="sensor-label">{{ t('phone.sensor.accelerometer') }}</span>
              <div class="sensor-data">
                {{ formatNumber(accelerometer.x) }} {{ formatNumber(accelerometer.y) }}
                {{ formatNumber(accelerometer.z) }}
              </div>
            </div>
            <div class="sensor-item">
              <span class="sensor-label">{{ t('phone.sensor.gyroscope') }}</span>
              <div class="sensor-data">
                {{ formatNumber(gyroscope.x) }} {{ formatNumber(gyroscope.y) }}
                {{ formatNumber(gyroscope.z) }}
              </div>
            </div>
            <div class="sensor-item">
              <span class="sensor-label">{{ t('phone.sensor.magnetometer') }}</span>
              <div class="sensor-data">
                {{ formatNumber(magnetometer.x) }} {{ formatNumber(magnetometer.y) }}
                {{ formatNumber(magnetometer.z) }}
              </div>
            </div>
            <div class="sensor-item">
              <span class="sensor-label">{{ t('phone.sensor.deviceOrientation') }}</span>
              <span class="sensor-data">{{ deviceRotation }}°</span>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <!-- <el-button @click="fetchSensorData" :loading="loadingData" :icon="Refresh">
            {{ t('phone.sensor.refresh') }}
          </el-button> -->
          <el-button @click="resetRotation" :icon="RefreshRight">{{
            t('phone.sensor.reset')
          }}</el-button>
          <el-button type="primary" @click="applySensorData" :loading="submitting" :icon="Check">
            {{ t('phone.sensor.apply') }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>
>

<script lang="ts" setup>
import { ref, reactive, inject, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElSlider, ElButton, ElInputNumber } from 'element-plus'
import { RefreshRight, Check } from '@element-plus/icons-vue'

const { t } = useI18n()
import {
  request,
  API_CONTROL_CONFIG,
  buildDeviceApiUrl,
  getErrorMessage,
  isCancel
} from '@shared/api'
import { API_CONFIG, buildApiUrl } from '@shared/api/config'
import type { Device } from '@shared/ipc/data.types'
import { DeviceState } from '@shared/ipc/data.types'
import {
  SensorSimulator,
  DeviceOrientation,
  GRAVITY,
  MAGNETIC_FIELD,
  type SensorChangeEvent
} from '@vmosedge/sensor-simulator'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
// 导入 GLB 模型
const phoneModelUrl = 'google_pixel_6_pro.glb'

defineOptions({ name: 'Sensor' })

// ================= Three.js 相关 =================
const modelContainerRef = ref<HTMLDivElement | null>(null)
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let pivotGroup: THREE.Group | null = null // 新增：用于旋转的中心容器
let phoneMesh: THREE.Object3D | null = null // 重命名：实际的模型网格
let animationFrameId: number | null = null
let screenMaterial: THREE.MeshBasicMaterial | null = null // 存储屏幕材质引用
const initialModelPosition = new THREE.Vector3()

// ================= 截图更新相关 =================
const screenshotUrl = ref('')
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let isComponentUnmounted = false
let abortController: AbortController | null = null

/** 加载截图并更新模型纹理 */
const loadScreenshot = async () => {
  const device = phoneDevice?.value
  if (!device || device.state !== DeviceState.StateRunning) return

  if (abortController) {
    abortController.abort()
  }
  abortController = new AbortController()

  try {
    const hostIp = device.host_ip || ''
    const dbId = device.db_id || deviceIdRef?.value || ''

    const baseUrl = buildApiUrl(hostIp, `${API_CONFIG.PATHS.GET_SCREENSHOT}/${dbId}`)

    const res = await request.get(
      baseUrl,
      {
        format: 'jpg',
        width: 1024,
        no_cache: true,
        time: new Date().getTime()
      },
      {
        responseType: 'blob',
        signal: abortController.signal
      }
    )

    if (isComponentUnmounted || device.state !== DeviceState.StateRunning) return

    const blob = res instanceof Blob ? res : new Blob([res], { type: 'image/jpeg' })

    const blobToDataURL = (b: Blob): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(b)
      })
    }

    const newUrl = await blobToDataURL(blob)
    if (isComponentUnmounted) return

    screenshotUrl.value = newUrl

    // 更新 Three.js 材质纹理
    if (screenMaterial) {
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(newUrl, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = true

        // 确保纹理最清晰
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = false

        if (renderer) {
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        }

        // 释放旧纹理以防内存泄漏
        if (screenMaterial?.map) {
          screenMaterial.map.dispose()
        }

        screenMaterial!.map = texture
        screenMaterial!.needsUpdate = true
      })
    }
  } catch (e: any) {
    if (e?.name === 'CanceledError' || isCancel(e)) return
    console.error('加载截图失败:', e)
  }
}

/** 开始定时刷新截图 */
const startRefresh = () => {
  stopRefresh()
  const device = phoneDevice?.value
  if (device?.state === DeviceState.StateRunning && !isComponentUnmounted) {
    loadScreenshot().finally(() => {
      if (!isComponentUnmounted && device?.state === DeviceState.StateRunning) {
        refreshTimer = setTimeout(startRefresh, 1000)
      }
    })
  }
}

/** 停止定时刷新 */
const stopRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  if (abortController) {
    abortController.abort()
    abortController = null
  }
}

/** 初始化 Three.js 场景 */
const initThreeScene = () => {
  if (!modelContainerRef.value) return

  const container = modelContainerRef.value
  const width = container.clientWidth
  const height = container.clientHeight

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe9edf2)

  // 创建中心容器组
  pivotGroup = new THREE.Group()
  scene.add(pivotGroup)

  // 创建相机
  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000) // FOV 改小一点，减小透视变形
  camera.position.set(0, 0, 4.5)
  camera.lookAt(0, 0, 0)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.8 // 降低曝光，防止过白
  renderer.outputColorSpace = THREE.SRGBColorSpace // 确保颜色正确

  // 设置环境贴图 - 对于金属材质至关重要
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture

  // 清除旧的 canvas
  while (container.firstChild) {
    container.removeChild(container.firstChild)
  }
  container.appendChild(renderer.domElement)

  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  // 添加主光源 - 调整位置照亮正面
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0) // 降低强度
  directionalLight.position.set(2, 2, 5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // 添加补光
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5) // 降低强度
  fillLight.position.set(-5, 0, 5)
  scene.add(fillLight)

  // 添加顶部光
  const topLight = new THREE.DirectionalLight(0xffffff, 0.8) // 降低强度
  topLight.position.set(0, 5, 0)
  scene.add(topLight)

  // 加载模型
  loadPhoneModel()

  // 开始渲染循环
  lastFrameTimestamp = performance.now()
  animate()

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)

  // 确保初始大小正确
  handleResize()
}

/** 加载手机模型 */
const loadPhoneModel = () => {
  const loader = new GLTFLoader()

  loader.load(
    phoneModelUrl,
    (gltf) => {
      phoneMesh = gltf.scene

      // 第一步：遍历模型处理材质
      phoneMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true

          // 替换屏幕纹理
          if (child.name === 'Screen_Screen_0' || child.name.includes('Screen')) {
            // 如果还没初始化过 screenMaterial，立即初始化
            if (!screenMaterial) {
              screenMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff // 初始白色，等待纹理加载
              })
            }

            // 立即应用材质引用
            child.material = screenMaterial

            const textureLoader = new THREE.TextureLoader()
            // 优先使用当前已加载的截图，否则使用默认壁纸
            const initialUrl = screenshotUrl.value || '/bizhi.png'

            textureLoader.load(initialUrl, (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace
              texture.flipY = true

              // 确保纹理清晰
              texture.minFilter = THREE.LinearFilter
              texture.magFilter = THREE.LinearFilter
              texture.generateMipmaps = false

              if (renderer) {
                texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
              }

              // 更新材质纹理
              if (screenMaterial) {
                if (screenMaterial.map) {
                  screenMaterial.map.dispose()
                }
                screenMaterial.map = texture
                screenMaterial.needsUpdate = true
              }
            })
          }

          if (child.material.map) {
            child.material.map.colorSpace = THREE.SRGBColorSpace
          }
        }
      })

      // 第二步：计算整个模型的边界盒
      const box = new THREE.Box3().setFromObject(phoneMesh)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())

      console.log('Model center:', center)
      console.log('Model size:', size)

      // 第三步：根据模型大小计算缩放比例
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2.3 / maxDim

      // 第四步：先应用缩放
      phoneMesh.scale.setScalar(scale)

      // 修正：旋转 180 度，使正面朝向相机 (默认 GLB 可能是背面朝前的)
      phoneMesh.rotation.y = Math.PI

      // 第五步：重新计算缩放后的边界盒
      const scaledBox = new THREE.Box3().setFromObject(phoneMesh)
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3())

      // 第六步：将模型几何中心移动到原点
      // 这样旋转 pivotGroup 时，就是绕着手机中心旋转
      phoneMesh.position.sub(scaledCenter)

      // 将模型添加到 pivotGroup
      if (pivotGroup) {
        pivotGroup.add(phoneMesh)
        // 确保 pivotGroup 在场景中心
        pivotGroup.position.set(0, 0, 0)
      }

      // 记录初始位置（pivotGroup的位置，初始为0）
      initialModelPosition.set(0, 0, 0)

      // 设置初始旋转
      if (pivotGroup) {
        pivotGroup.rotation.set(0, 0, 0)
      }

      // 应用当前旋转状态
      updateModelRotation()
    },
    undefined, // 移除 progress 参数
    (error) => {
      console.error('模型加载失败:', error)
    }
  )
}

/** 更新模型旋转 */
const updateModelRotation = () => {
  if (!pivotGroup) return

  // 将角度转换为弧度
  const xRad = toRadians(rotation.x)
  const yRad = toRadians(rotation.y)
  const zRad = toRadians(rotation.z)

  // 重置旋转
  pivotGroup.rotation.set(0, 0, 0)

  // 应用用户控制的旋转 (XYZ 顺序)
  const userEuler = new THREE.Euler(xRad, yRad, zRad, 'XYZ')
  const quaternion = new THREE.Quaternion().setFromEuler(userEuler)

  pivotGroup.setRotationFromQuaternion(quaternion)
}

/** 更新模型位置（Move 模式） */
const updateModelPosition = () => {
  if (!pivotGroup) return

  // Move 模式下，根据位移值微调模型位置
  // 将位移值映射到合适的视觉范围
  // 减小系数，防止飞出视野 (0.5 -> 0.25)
  const scaleFactor = 0.25

  // 基于初始位置进行偏移 (initialModelPosition 现在是 0,0,0)
  // X轴: 左右移动
  pivotGroup.position.x = initialModelPosition.x + position.x * scaleFactor
  // Y轴: 上下移动 (对应 position.y)
  pivotGroup.position.y = initialModelPosition.y + position.y * scaleFactor
  // Z轴: 前后移动 (对应 position.z)
  pivotGroup.position.z = initialModelPosition.z + position.z * scaleFactor
}

/** 渲染循环 */
const animate = () => {
  animationFrameId = requestAnimationFrame(animate)
  const now = performance.now()
  const dt = lastFrameTimestamp > 0 ? (now - lastFrameTimestamp) / 1000 : 0
  lastFrameTimestamp = now

  if (dt > 0) {
    sensorSimulator.update(dt)
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

/** 处理窗口大小变化 */
const handleResize = () => {
  if (!modelContainerRef.value || !camera || !renderer) return

  const container = modelContainerRef.value
  const width = container.clientWidth
  const height = container.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

/** 清理 Three.js 资源 */
const disposeThreeScene = () => {
  window.removeEventListener('resize', handleResize)

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }

  if (renderer) {
    renderer.dispose()
    if (modelContainerRef.value && renderer.domElement.parentNode) {
      modelContainerRef.value.removeChild(renderer.domElement)
    }
  }

  if (scene) {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose()
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose())
        } else {
          object.material?.dispose()
        }
      }
    })
  }

  scene = null
  camera = null
  renderer = null
  pivotGroup = null
  phoneMesh = null
}

// ================= 常量定义 =================

const SENSOR_TYPE = {
  // 磁力计
  MAGNETOMETER: 2,
  // 加速度计
  ACCELEROMETER: 1,
  // 陀螺仪
  GYROSCOPE: 4
}

// ================= 依赖注入 =================

const phoneDevice = inject<Ref<Device | undefined>>('phoneDevice')
const deviceIdRef = inject<Ref<string>>('deviceId')

const getDeviceInfo = () => {
  const device = phoneDevice?.value
  if (!device) throw new Error(t('phone.multimedia.deviceInfoUnavailable'))
  const hostIp = device.host_ip || ''
  const dbId = device.db_id || deviceIdRef?.value || ''
  if (!hostIp || !dbId) throw new Error(t('phone.multimedia.deviceIpOrIdUnavailable'))
  return { hostIp, dbId }
}

// ================= 状态管理 =================

/** 控制模式: rotate=旋转, move=移动 */
const controlMode = ref<'rotate' | 'move'>('rotate')

/** 设备旋转角度 (0, 90, 180, 270) */
const deviceRotation = ref(0)

/** X/Y/Z 轴旋转角度 (度) - Rotate 模式 */
const rotation = reactive({
  x: 0, // Pitch - 绕 X 轴旋转
  y: 0, // Roll - 绕 Y 轴旋转
  z: 0 // Yaw/Azimuth - 绕 Z 轴旋转
})

/** X/Y/Z 轴位移 (m) - Move 模式 */
const position = reactive({
  x: 0, // X 轴位移 (-7 ~ 7)
  y: 0, // Y 轴位移 (-4 ~ 4)
  z: 0 // Z 轴位移 (-4 ~ 4)
})

let lastFrameTimestamp = 0

/** 加速度计数值 (m/s²) */
const accelerometer = reactive({
  x: 0,
  y: GRAVITY, // 设备平放时，Y 轴指向天空
  z: 0
})

/** 陀螺仪数值 (rad/s) */
const gyroscope = reactive({
  x: 0,
  y: 0,
  z: 0
})

/** 磁力计数值 (µT) */
const magnetometer = reactive({
  x: MAGNETIC_FIELD.x,
  y: MAGNETIC_FIELD.y,
  z: MAGNETIC_FIELD.z
})

const sensorSimulator = new SensorSimulator()

const handleSensorChange = (data: SensorChangeEvent) => {
  accelerometer.x = data.accelerometer.x
  accelerometer.y = data.accelerometer.y
  accelerometer.z = data.accelerometer.z
  gyroscope.x = data.gyroscope.x
  gyroscope.y = data.gyroscope.y
  gyroscope.z = data.gyroscope.z
  magnetometer.x = data.magnetometer.x
  magnetometer.y = data.magnetometer.y
  magnetometer.z = data.magnetometer.z
}

sensorSimulator.on('change', handleSensorChange)

const submitting = ref(false)

// ================= 交互状态 =================
const isDragging = ref(false)
const previousMousePosition = reactive({ x: 0, y: 0 })

const handleMouseDown = (event: MouseEvent) => {
  isDragging.value = true
  previousMousePosition.x = event.clientX
  previousMousePosition.y = event.clientY
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return

  const deltaX = event.clientX - previousMousePosition.x
  const deltaY = event.clientY - previousMousePosition.y

  if (controlMode.value === 'rotate') {
    // 旋转模式 - 模拟安卓陀螺仪效果，XYZ三轴都会变化
    const rotateSpeed = 0.5

    // 获取容器的中心点，用于计算Z轴旋转
    const container = modelContainerRef.value
    if (container) {
      const rect = container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      // 计算前一位置和当前位置相对于中心的角度
      const prevAngle = Math.atan2(
        previousMousePosition.y - centerY,
        previousMousePosition.x - centerX
      )
      const currAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX)

      // 角度差（弧度转角度）
      let angleDelta = (currAngle - prevAngle) * (180 / Math.PI)

      // 处理角度跳变（从 -π 到 π）
      if (angleDelta > 180) angleDelta -= 360
      if (angleDelta < -180) angleDelta += 360

      // 计算鼠标到中心的距离，用于决定Z轴旋转的权重
      const distFromCenter = Math.sqrt(
        Math.pow(event.clientX - centerX, 2) + Math.pow(event.clientY - centerY, 2)
      )
      const maxDist = Math.min(rect.width, rect.height) / 2
      // 距离越远，Z轴旋转权重越大（0.3到1.0之间）
      const zWeight = Math.min(1.0, 0.3 + (distFromCenter / maxDist) * 0.7)

      // 更新 Z 轴旋转 (Roll) - 基于环绕中心的角度变化
      let newZ = rotation.z + angleDelta * zWeight
      // 处理循环（-180 到 180）
      if (newZ > 180) newZ -= 360
      if (newZ < -180) newZ += 360
      rotation.z = formatValue(newZ, 1)
    }

    // 更新 X 轴旋转 (Pitch) - 垂直拖动
    let newX = rotation.x + deltaY * rotateSpeed
    // 限制范围 -180 到 180
    if (newX > 180) newX = 180
    if (newX < -180) newX = -180
    rotation.x = formatValue(newX, 1)

    // 更新 Y 轴旋转 (Yaw) - 水平拖动
    let newY = rotation.y + deltaX * rotateSpeed
    if (newY > 180) newY = 180
    if (newY < -180) newY = -180
    rotation.y = formatValue(newY, 1)

    handleRotationChange()
  } else {
    // 移动模式
    // 水平拖动 -> X 轴位移
    // 垂直拖动 -> Y 轴位移
    const moveSpeed = 0.05

    let newX = position.x + deltaX * moveSpeed
    // 限制范围 -7 到 7
    if (newX > 7) newX = 7
    if (newX < -7) newX = -7
    position.x = formatValue(newX, 1)

    let newY = position.y - deltaY * moveSpeed // 向上拖动 (deltaY < 0) -> Y 增加
    // 限制范围 -4 到 4
    if (newY > 4) newY = 4
    if (newY < -4) newY = -4
    position.y = formatValue(newY, 1)

    handlePositionChange()
  }

  previousMousePosition.x = event.clientX
  previousMousePosition.y = event.clientY
}

const handleMouseUp = () => {
  isDragging.value = false
}

/**
 * 处理鼠标滚轮事件
 * 移动模式下：控制 Z 轴位移（前后移动/放大缩小效果）
 * 旋转模式下：控制 Z 轴旋转
 */
const handleWheel = (event: WheelEvent) => {
  // deltaY > 0 表示向下滚动，< 0 表示向上滚动
  const delta = event.deltaY > 0 ? -1 : 1

  if (controlMode.value === 'move') {
    // 移动模式：滚轮控制 Z 轴位移
    const moveSpeed = 0.3
    let newZ = position.z + delta * moveSpeed
    // 限制范围 -4 到 4
    if (newZ > 4) newZ = 4
    if (newZ < -4) newZ = -4
    position.z = formatValue(newZ, 1)
    handlePositionChange()
    updateModelPosition()
  } else {
    // 旋转模式：滚轮也可以控制 Z 轴旋转
    const rotateSpeed = 5
    let newZ = rotation.z + delta * rotateSpeed
    // 处理循环（-180 到 180）
    if (newZ > 180) newZ -= 360
    if (newZ < -180) newZ += 360
    rotation.z = formatValue(newZ, 1)
    handleRotationChange()
  }
}

// ================= 工具函数 =================

/**
 * 将角度转换为弧度
 */
const toRadians = (degrees: number): number => {
  return (degrees * Math.PI) / 180
}

const DISPLAY_PRECISION = 2

const roundTo = (value: number, precision: number): number => {
  const factor = Math.pow(10, precision)
  const scaled = Math.abs(value) * factor
  const epsilon = Number.EPSILON * scaled
  const rounded = Math.round(scaled + epsilon)
  return Math.sign(value) * (rounded / factor)
}

/**
 * 格式化数字显示
 */
const formatNumber = (value: number, precision = DISPLAY_PRECISION): string => {
  return roundTo(value, precision).toFixed(precision)
}

const handleRotationChange = () => {
  sensorSimulator.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z })
}

const handlePositionChange = () => {
  sensorSimulator.setPosition({ x: position.x, y: position.y, z: position.z })
}

const setDeviceRotation = (degrees: number) => {
  deviceRotation.value = degrees

  let orientation: DeviceOrientation | undefined

  switch (degrees) {
    case 0:
      orientation = DeviceOrientation.PORTRAIT
      break
    case 90:
      orientation = DeviceOrientation.LANDSCAPE_LEFT
      break
    case 180:
      orientation = DeviceOrientation.PORTRAIT_REVERSE
      break
    case 270:
      orientation = DeviceOrientation.LANDSCAPE_RIGHT
      break
  }

  if (orientation === undefined) return

  sensorSimulator.setDeviceOrientation(orientation)

  const nextRotation = sensorSimulator.getRotation()
  rotation.x = nextRotation.x
  rotation.y = nextRotation.y
  rotation.z = nextRotation.z
}

/**
 * 根据当前姿态自动判定设备方向 (Android 官方阈值)
 *
 * 🔧 工具函数 - 暂未使用，但保留作为未来自动检测屏幕方向的扩展
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// const detectDeviceRotation = (): number => {
//   const roll = rotation.z
//   const pitch = rotation.x

//   // Android 官方判定逻辑
//   if (roll >= 45 && roll <= 135) {
//     return 90 // ROTATION_90
//   } else if (roll >= -135 && roll <= -45) {
//     return 270 // ROTATION_270
//   } else if (pitch > 45) {
//     return 180 // ROTATION_180
//   } else {
//     return 0 // ROTATION_0
//   }
// }

/**
 * 重置所有数值
 */
const resetRotation = () => {
  rotation.x = 0
  rotation.y = 0
  rotation.z = 0
  deviceRotation.value = 0

  position.x = 0
  position.y = 0
  position.z = 0

  sensorSimulator.reset()
}

/**
 * 格式化数值，保留指定小数位
 * @param value 原始数值
 * @param precision 小数位数
 * @returns 格式化后的数值
 */
const formatValue = (value: number, precision: number): number => {
  return roundTo(value, precision)
}

/**
 * 验证传感器数值的合理性
 *
 * @returns 是否通过验证
 */
const validateSensorValues = (): boolean => {
  return sensorSimulator.validate()
}

/**
 * 应用传感器数据到设备
 */
const applySensorData = async () => {
  try {
    submitting.value = true

    // 验证传感器数值
    if (!validateSensorValues()) {
      console.warn('传感器数值验证失败，但仍然继续发送')
    }
    const { hostIp, dbId } = getDeviceInfo()

    try {
      await request.post(
        buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.SET_SYSTEM_PROP),
        {
          properties: {
            'ro.build.cloud.mock_sensor_disabled': '1'
          }
        }
      )
    } catch (error: any) {}

    const url = buildDeviceApiUrl(hostIp, dbId, API_CONTROL_CONFIG.PATHS.SET_SENSOR_DATA)

    // 构建传感器数据载荷 (只发送 type=1 和 type=4)
    // 传感器数值保留2位小数
    const payload = {
      sensors: [
        {
          type: SENSOR_TYPE.ACCELEROMETER,
          x: accelerometer.x,
          y: accelerometer.y,
          z: accelerometer.z
        },
        {
          type: SENSOR_TYPE.GYROSCOPE,
          x: gyroscope.x,
          y: gyroscope.y,
          z: gyroscope.z
        },
        {
          type: SENSOR_TYPE.MAGNETOMETER,
          x: magnetometer.x,
          y: magnetometer.y,
          z: magnetometer.z
        }
      ]
    }

    await request.post(url, payload)
    ElMessage.success(t('phone.multimedia.operationSuccess'))
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error) || t('phone.sensor.setSensorDataFailed'))
  } finally {
    submitting.value = false
  }
}

// 监听设备状态变化
watch(
  () => phoneDevice?.value?.state,
  (newState) => {
    if (newState === DeviceState.StateRunning) {
      startRefresh()
    } else {
      stopRefresh()
    }
  }
)

// 初始化计算
handleRotationChange()

// 监听旋转变化，更新模型（无论哪种模式都要更新旋转）
watch(
  () => [rotation.x, rotation.y, rotation.z],
  () => {
    updateModelRotation()
  },
  { deep: true }
)

// 监听位移变化，更新模型
watch(
  () => [position.x, position.y, position.z],
  () => {
    updateModelPosition()
  },
  { deep: true }
)

// 组件挂载时初始化 Three.js 场景并获取传感器数据
onMounted(() => {
  isComponentUnmounted = false
  // 使用 nextTick 确保 DOM 已渲染
  setTimeout(() => {
    initThreeScene()
  }, 100)

  // 开始截图刷新
  startRefresh()
})

// 组件卸载时清理资源
onUnmounted(() => {
  isComponentUnmounted = true
  sensorSimulator.off('change', handleSensorChange)
  disposeThreeScene()
  stopRefresh()
})
</script>

<style scoped lang="scss">
.sensor-container {
  padding: 12px;
  background: var(--el-bg-color);
  box-sizing: border-box;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

// 3D 模型预览区域 - 放在顶部
.model-section {
  width: 100%;
  flex-shrink: 0;
}

.model-container {
  width: 100%;
  height: 500px;
  border-radius: 8px;
  overflow: hidden;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  canvas {
    display: block;
  }
}

.sensor-content {
  margin-top: 12px;
  display: flex;
  gap: 20px;
  flex: 1;
  width: 100%; /* 确保占满宽度 */
  min-height: 0; /* 防止内容过多撑破布局 */
}

// 左侧控制区域
.control-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0; /* 允许 Flex 子项收缩 */
}

.mode-tabs {
  display: flex;
  border-bottom: 1px solid var(--el-border-color);
  background: var(--el-bg-color);
  border-radius: 4px 4px 0 0;
  overflow: hidden;
  flex-shrink: 0;

  .tab-item {
    flex: 1;
    padding: 10px 20px;
    text-align: center;
    padding-top: 0px;
    cursor: pointer;
    font-size: 13px;
    color: var(--el-text-color-regular);
    transition: all 0.2s;
    border-bottom: 2px solid transparent;
    font-weight: 500;
    position: relative;
    white-space: nowrap; /* 防止文字换行 */

    &:hover {
      color: var(--el-color-primary);
      background: var(--el-bg-color-page);
    }

    &.active {
      color: var(--el-color-primary);
      border-bottom-color: var(--el-color-primary);
      font-weight: 600;
      background: var(--el-bg-color);
    }
  }
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.item-control {
  display: flex;
  align-items: center;
  gap: 16px;
}

.slider {
  flex: 1;
  min-width: 0;
}

.input-number {
  width: 100px;
  flex-shrink: 0;

  :deep(.el-input__wrapper) {
    padding-left: 8px;
    padding-right: 30px;
  }
}

// 右侧信息区域
.info-section {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-title {
  font-size: 12px;
  color: var(--el-text-color-regular);
  font-weight: 500;
}

.rotation-buttons {
  display: flex;
  gap: 8px;
}

.rotation-btn {
  width: 40px;
  height: 40px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--el-bg-color);

  &:hover {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  &.active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary);

    .device-icon {
      border-color: var(--el-bg-color);

      &::after {
        background: var(--el-bg-color);
      }
    }
  }
}

.device-icon {
  width: 16px;
  height: 22px;
  border: 2px solid var(--el-text-color-regular);
  border-radius: 2px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    background: var(--el-text-color-regular);
    border-radius: 1px;
  }

  &.portrait::after {
    width: 6px;
    height: 2px;
    top: 2px;
    left: 50%;
    transform: translateX(-50%);
  }

  &.landscape-left {
    width: 22px;
    height: 16px;

    &::after {
      width: 2px;
      height: 6px;
      left: 2px;
      top: 50%;
      transform: translateY(-50%);
    }
  }

  &.portrait-reverse::after {
    width: 6px;
    height: 2px;
    bottom: 2px;
    left: 50%;
    transform: translateX(-50%);
  }

  &.landscape-right {
    width: 22px;
    height: 16px;

    &::after {
      width: 2px;
      height: 6px;
      right: 2px;
      top: 50%;
      transform: translateY(-50%);
    }
  }
}

.sensor-values {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sensor-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sensor-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.sensor-data {
  font-size: 13px;
  color: var(--el-color-primary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: 500;
  word-break: break-all;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}

.action-btn {
  min-width: 90px;
  height: 36px;
  font-size: 14px;
  border-radius: 4px;
  padding: 0 20px;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px var(--el-color-primary-alpha-2);
  }

  &:active {
    transform: translateY(0);
  }
}

// 统一表单样式（与 battery.vue 保持一致）
:deep(.el-form-item__label) {
  font-size: 12px;
  color: var(--el-text-color-regular);
  font-weight: 500;
  margin-bottom: 8px;
}

:deep(.el-input-number .el-input__wrapper) {
  border-radius: 4px;
}

:deep(.el-slider__runway) {
  background-color: var(--el-border-color);
  border-radius: 2px;
}

:deep(.el-slider__bar) {
  background-color: var(--el-color-primary);
  border-radius: 2px;
}

:deep(.el-slider__button) {
  border-color: var(--el-color-primary);
}
</style>
