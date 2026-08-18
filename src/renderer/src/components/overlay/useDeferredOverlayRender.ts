import { ref, watch, type Ref } from 'vue'

export const useDeferredOverlayRender = (modelValue: Ref<boolean>) => {
  const renderOverlay = ref(modelValue.value)

  watch(
    modelValue,
    (value) => {
      if (value) {
        renderOverlay.value = true
      }
    },
    {
      immediate: true
    }
  )

  const handleClosed = () => {
    renderOverlay.value = false
  }

  return {
    renderOverlay,
    handleClosed
  }
}
