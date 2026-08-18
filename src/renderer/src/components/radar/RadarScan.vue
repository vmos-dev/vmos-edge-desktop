<template>
  <canvas
    ref="canvasRef"
    :width="sz * dpr"
    :height="sz * dpr"
    class="radar-canvas"
    :style="{ width: sz + 'px', height: sz + 'px' }"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

interface BlipItem {
  id: string
  x: number // 0-1，中心为 0.5
  y: number // 0-1，中心为 0.5
}

const props = withDefaults(
  defineProps<{
    size?: number
    scanning?: boolean
    blips?: BlipItem[]
  }>(),
  {
    size: 200,
    scanning: false,
    blips: () => []
  }
)

const canvasRef = ref<HTMLCanvasElement>()
const dpr = Math.min(window.devicePixelRatio || 1, 2)
const sz = computed(() => props.size)

let raf = 0
let lastTime = 0
let sweepAngle = -Math.PI / 2 // 从顶部开始
const blipHit = new Map<string, number>()

let observer: MutationObserver | null = null

const isDark = () => document.documentElement.classList.contains('dark')

const angleInRange = (from: number, to: number, target: number): boolean => {
  if (from <= to) return target >= from && target <= to
  // 跨越 2π 换行
  return target >= from || target <= to
}

const normalizeAngle = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)

const draw = (ts: number) => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.05) : 0
  lastTime = ts

  const dark = isDark()
  const cw = canvas.width
  const ch = canvas.height
  const cx = cw / 2
  const cy = ch / 2
  const R = cx - 3 * dpr

  const prevAngle = normalizeAngle(sweepAngle)
  if (props.scanning) {
    sweepAngle += dt * ((Math.PI * 2) / 2.6) // 2.6s 一圈
  }
  const curAngle = normalizeAngle(sweepAngle)

  // 清空
  ctx.clearRect(0, 0, cw, ch)

  // ===== 裁切到圆形 =====
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()

  // ===== 背景径向渐变 =====
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
  if (dark) {
    bgGrad.addColorStop(0, '#0d1e18')
    bgGrad.addColorStop(0.6, '#08130f')
    bgGrad.addColorStop(1, '#050d0b')
  } else {
    bgGrad.addColorStop(0, '#eef8f3')
    bgGrad.addColorStop(0.6, '#e2f1eb')
    bgGrad.addColorStop(1, '#d8ece4')
  }
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, cw, ch)

  // ===== 同心圆环 =====
  const ringAlpha = dark ? 0.13 : 0.16
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath()
    ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2)
    ctx.strokeStyle = dark ? `rgba(0,210,130,${ringAlpha})` : `rgba(0,140,80,${ringAlpha + 0.03})`
    ctx.lineWidth = 0.8 * dpr
    ctx.stroke()
  }

  // ===== 十字准线（虚线） =====
  ctx.save()
  ctx.setLineDash([3 * dpr, 5 * dpr])
  ctx.strokeStyle = dark ? 'rgba(0,210,130,0.09)' : 'rgba(0,140,80,0.11)'
  ctx.lineWidth = 0.7 * dpr
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.stroke()
  }
  ctx.restore()

  // ===== 扫描扇形 =====
  if (props.scanning) {
    const trailAngle = (Math.PI * 2) / 3 // 120° 拖尾
    const steps = 28
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const startA = sweepAngle - trailAngle + trailAngle * t
      const endA = sweepAngle - trailAngle + (trailAngle * (i + 1)) / steps
      const alpha = t * t * (dark ? 0.2 : 0.15)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, startA, endA)
      ctx.closePath()
      ctx.fillStyle = dark
        ? `rgba(0,220,130,${alpha.toFixed(4)})`
        : `rgba(0,170,100,${alpha.toFixed(4)})`
      ctx.fill()
    }

    // 扫描线
    const ex = cx + Math.cos(sweepAngle) * R
    const ey = cy + Math.sin(sweepAngle) * R
    const lineGrad = ctx.createLinearGradient(cx, cy, ex, ey)
    if (dark) {
      lineGrad.addColorStop(0, 'rgba(0,240,140,0.08)')
      lineGrad.addColorStop(0.35, 'rgba(0,240,140,0.65)')
      lineGrad.addColorStop(1, 'rgba(0,255,150,1)')
    } else {
      lineGrad.addColorStop(0, 'rgba(0,170,95,0.08)')
      lineGrad.addColorStop(0.35, 'rgba(0,170,95,0.65)')
      lineGrad.addColorStop(1, 'rgba(0,185,105,1)')
    }
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(ex, ey)
    ctx.strokeStyle = lineGrad
    ctx.lineWidth = 1.8 * dpr
    ctx.stroke()

    // 端点光晕
    const tipGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 11 * dpr)
    tipGrad.addColorStop(0, dark ? 'rgba(0,255,150,0.55)' : 'rgba(0,185,105,0.5)')
    tipGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(ex, ey, 11 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = tipGrad
    ctx.fill()

    // 圆心光点
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 7 * dpr)
    centerGrad.addColorStop(0, dark ? 'rgba(0,255,150,0.9)' : 'rgba(0,185,105,0.85)')
    centerGrad.addColorStop(0.5, dark ? 'rgba(0,210,130,0.4)' : 'rgba(0,160,90,0.35)')
    centerGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(cx, cy, 7 * dpr, 0, Math.PI * 2)
    ctx.fillStyle = centerGrad
    ctx.fill()
  }

  ctx.restore() // 结束裁切

  // ===== 外边框圆 =====
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.strokeStyle = dark ? 'rgba(0,210,130,0.22)' : 'rgba(0,150,85,0.22)'
  ctx.lineWidth = 1.2 * dpr
  ctx.stroke()

  // ===== 检测 blip 命中 =====
  if (props.scanning) {
    for (const b of props.blips) {
      if (blipHit.has(b.id)) continue
      const bAngle = normalizeAngle(Math.atan2(b.y - 0.5, b.x - 0.5))
      if (angleInRange(prevAngle, curAngle, bAngle)) {
        blipHit.set(b.id, ts)
      }
    }
  } else {
    // 扫描停止后，显示全部未命中的 blip
    for (const b of props.blips) {
      if (!blipHit.has(b.id)) blipHit.set(b.id, ts)
    }
  }

  // ===== 绘制 blip =====
  for (const b of props.blips) {
    if (!blipHit.has(b.id)) continue

    const bx = cx + (b.x - 0.5) * 2 * (R - 5 * dpr)
    const by = cy + (b.y - 0.5) * 2 * (R - 5 * dpr)
    const age = (ts - blipHit.get(b.id)!) / 1000
    const r = 3.2 * dpr

    const bright = props.scanning
      ? Math.max(0.22, 1 - age / 5.5)
      : 0.45 + 0.22 * Math.sin(ts / 950 + b.x * 9.3 + b.y * 6.7)

    // 外发光
    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, r * 5.5)
    glow.addColorStop(
      0,
      dark
        ? `rgba(0,220,130,${(0.32 * bright).toFixed(3)})`
        : `rgba(0,165,90,${(0.28 * bright).toFixed(3)})`
    )
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.beginPath()
    ctx.arc(bx, by, r * 5.5, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    // 内光晕
    ctx.beginPath()
    ctx.arc(bx, by, r * 2, 0, Math.PI * 2)
    ctx.fillStyle = dark
      ? `rgba(0,220,130,${(0.28 * bright).toFixed(3)})`
      : `rgba(0,165,90,${(0.22 * bright).toFixed(3)})`
    ctx.fill()

    // 实心点
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.fillStyle = dark
      ? `rgba(55,255,160,${Math.max(0.5, bright).toFixed(3)})`
      : `rgba(0,185,105,${Math.max(0.55, bright).toFixed(3)})`
    ctx.fill()

    // 白芯高光
    if (bright > 0.35) {
      ctx.beginPath()
      ctx.arc(bx, by, r * 0.44, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (bright - 0.25) * 1.6).toFixed(3)})`
      ctx.fill()
    }

    // 新发现扩散环（1.8s 内）
    if (age < 1.8) {
      const progress = age / 1.8
      const ringR = r * (1 + progress * 6.5)
      ctx.beginPath()
      ctx.arc(bx, by, ringR, 0, Math.PI * 2)
      ctx.strokeStyle = dark
        ? `rgba(0,230,140,${((1 - progress) * 0.5).toFixed(3)})`
        : `rgba(0,170,90,${((1 - progress) * 0.45).toFixed(3)})`
      ctx.lineWidth = 1 * dpr
      ctx.stroke()
    }
  }

  raf = requestAnimationFrame(draw)
}

const start = () => {
  lastTime = 0
  sweepAngle = -Math.PI / 2
  blipHit.clear()
  if (!raf) raf = requestAnimationFrame(draw)
}

const stop = () => {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

watch(
  () => props.scanning,
  (v) => {
    if (v) start()
  }
)

onMounted(() => {
  start()
  observer = new MutationObserver(() => {
    // 主题切换时强制重绘（无缓存）
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  observer = null
})
</script>

<style scoped>
.radar-canvas {
  display: block;
}
</style>
