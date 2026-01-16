<template>
  <span v-if="svgContent" class="svg-icon" :style="iconStyle" v-html="svgContent" />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

defineOptions({ name: 'SvgIcon' })

const props = withDefaults(
  defineProps<{
    name: string
    color?: string
    width?: string | number
    height?: string | number
  }>(),
  {
    width: 14,
    height: 14
  }
)

const svgContent = ref('')

// ⭐ 关键：只有显式传 color 才写 color
const iconStyle = computed(() => {
  const style: Record<string, string> = {
    width: typeof props.width === 'number' ? `${props.width}px` : props.width,
    height: typeof props.height === 'number' ? `${props.height}px` : props.height,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  }

  if (props.color) {
    style.color = props.color
  }

  return style
})

const svgModules = import.meta.glob('../../assets/svg/*.svg', {
  query: '?raw',
  import: 'default'
})

async function loadSvg() {
  if (!props.name) {
    svgContent.value = ''
    return
  }

  const path = Object.keys(svgModules).find((key) => key.endsWith(`/${props.name}.svg`))

  if (!path) {
    console.warn(`[SvgIcon] Icon not found: ${props.name}`)
    svgContent.value = ''
    return
  }

  let svg = (await svgModules[path]()) as string

  // ⭐ 核心：只做一件事 —— 去掉硬编码颜色
  svg = svg
    .replace(/fill="(?!none|transparent|currentColor)[^"]*"/gi, '')
    .replace(/stroke="(?!none|transparent|currentColor)[^"]*"/gi, '')
    .replace(/\s(width|height)="[^"]*"/gi, '')

  if (!svg.includes('style=')) {
    svg = svg.replace(/<svg([^>]*)>/, '<svg$1 style="width:100%;height:100%;">')
  }

  svgContent.value = svg
}

watch(() => props.name, loadSvg, { immediate: true })
</script>

<style scoped lang="scss">
.svg-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: middle;
}

/* ⭐ 所有图形元素统一吃 currentColor */
.svg-icon :deep(svg),
.svg-icon :deep(path),
.svg-icon :deep(circle),
.svg-icon :deep(rect),
.svg-icon :deep(polygon),
.svg-icon :deep(polyline),
.svg-icon :deep(line),
.svg-icon :deep(ellipse),
.svg-icon :deep(g) {
  fill: currentColor;
  stroke: currentColor;
}
</style>
