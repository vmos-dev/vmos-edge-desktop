import { ref, watch } from 'vue'
import store from 'store'

export function useModeView() {
  const viewMode = ref<'list' | 'grid'>(store.get('viewMode') || 'list')
  const gridSize = ref<'small' | 'medium' | 'large' | 'custom'>(store.get('gridSize') || 'medium')
  const gridOrientation = ref<'portrait' | 'landscape'>(store.get('gridOrientation') || 'portrait')

  // 从 storage 恢复时 clamp 到合法区间 [50, 200]
  const rawScale = store.get('gridCustomScale')
  const clampedScale = typeof rawScale === 'number' ? Math.min(200, Math.max(50, rawScale)) : 100
  const gridCustomScale = ref<number>(clampedScale)

  watch(
    () => viewMode.value,
    (value) => {
      store.set('viewMode', value)
    },
    { immediate: true }
  )

  watch(
    () => gridSize.value,
    (value) => {
      store.set('gridSize', value)
    },
    { immediate: true }
  )

  watch(
    () => gridOrientation.value,
    (value) => {
      store.set('gridOrientation', value)
    },
    { immediate: true }
  )

  watch(
    () => gridCustomScale.value,
    (value) => {
      store.set('gridCustomScale', value)
    },
    { immediate: true }
  )

  return {
    viewMode,
    gridSize,
    gridOrientation,
    gridCustomScale
  }
}
