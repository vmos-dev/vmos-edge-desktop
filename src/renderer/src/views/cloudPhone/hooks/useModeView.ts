import { ref, watch } from 'vue'
import store from 'store'

export function useModeView() {
  const viewMode = ref<'list' | 'grid'>(store.get('viewMode') || 'list')
  const gridSize = ref<'small' | 'medium' | 'large'>(store.get('gridSize') || 'medium')
  const gridOrientation = ref<'portrait' | 'landscape'>(store.get('gridOrientation') || 'portrait')

  watch(
    () => viewMode.value,
    (value) => {
      store.set('viewMode', value)
    },
    {
      immediate: true
    }
  )

  watch(
    () => gridSize.value,
    (value) => {
      store.set('gridSize', value)
    },
    {
      immediate: true
    }
  )

  watch(
    () => gridOrientation.value,
    (value) => {
      store.set('gridOrientation', value)
    },
    {
      immediate: true
    }
  )

  return {
    viewMode,
    gridSize,
    gridOrientation
  }
}
