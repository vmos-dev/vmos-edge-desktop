import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useDeferredOverlayRender } from '../useDeferredOverlayRender'

describe('useDeferredOverlayRender', () => {
  it('keeps overlay rendered until closed handler runs', async () => {
    const model = ref(false)
    const { renderOverlay, handleClosed } = useDeferredOverlayRender(model)

    expect(renderOverlay.value).toBe(false)

    model.value = true
    await nextTick()

    expect(renderOverlay.value).toBe(true)

    model.value = false
    await nextTick()

    expect(renderOverlay.value).toBe(true)

    handleClosed()

    expect(renderOverlay.value).toBe(false)
  })

  it('starts rendered when overlay is initially open', () => {
    const model = ref(true)
    const { renderOverlay } = useDeferredOverlayRender(model)

    expect(renderOverlay.value).toBe(true)
  })
})
