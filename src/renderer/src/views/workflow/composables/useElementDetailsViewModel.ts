import { computed, type Ref } from 'vue'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import { buildSelector } from '../utils/selectorBuilder'
import { buildPropertyRows, buildSelectorRows } from '../utils/elementPopoverMappers'

interface UseElementDetailsViewModelOptions {
  node: Ref<UiNode | null>
  selectorHost: Ref<UiNode | null>
  screen?: Ref<{ width: number; height: number } | undefined>
}

export function useElementDetailsViewModel(options: UseElementDetailsViewModelOptions) {
  const selector = computed(() => {
    const host = options.selectorHost.value
    return host ? buildSelector(host, options.screen?.value) : null
  })

  const selectorRows = computed(() => {
    const currentSelector = selector.value
    return currentSelector ? buildSelectorRows(currentSelector) : []
  })

  const propertyRows = computed(() => {
    const node = options.node.value
    return node ? buildPropertyRows(node) : []
  })

  return {
    selector,
    selectorRows,
    propertyRows
  }
}
