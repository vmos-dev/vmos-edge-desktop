import { computed, type Ref } from 'vue'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import type { EffectiveTarget, NodeTreeContext, RecommendationContext } from '../types'
import { buildElementHeading } from '../utils/elementPopoverMappers'
import { chooseSelectorHost } from '../utils/selectorHost'
import { findEffectiveTarget } from '../utils/targetResolver'
import { useElementActionViewModel } from './useElementActionViewModel'
import { useElementDetailsViewModel } from './useElementDetailsViewModel'

interface Screen {
  width: number
  height: number
}

interface UseElementPopoverViewModelOptions {
  node: Ref<UiNode | null>
  screen: Ref<Screen | undefined>
  tree?: Ref<NodeTreeContext | undefined>
  context?: Ref<RecommendationContext | undefined>
}

export function useElementPopoverViewModel(options: UseElementPopoverViewModelOptions) {
  const heading = computed(() => {
    const node = options.node.value
    return node ? buildElementHeading(node) : { title: '', subtitle: '' }
  })

  const effectiveTarget = computed<EffectiveTarget | undefined>(() => {
    const node = options.node.value
    const tree = options.tree?.value
    if (!node || !tree) return undefined
    return findEffectiveTarget(node, tree, 'generic')
  })

  const actionViewModel = useElementActionViewModel({
    node: options.node,
    screen: options.screen,
    tree: options.tree,
    context: options.context,
    effectiveTarget
  })

  const selectorHost = computed<UiNode | null>(() => {
    const node = options.node.value
    if (!node) return null
    const et = effectiveTarget.value
    const action = actionViewModel.recommendation.value?.rec.action
    if (et && action) {
      return chooseSelectorHost(action, et.source, et.target)
    }
    return node
  })

  const detailsViewModel = useElementDetailsViewModel({
    node: options.node,
    selectorHost,
    screen: options.screen
  })

  return {
    heading,
    effectiveTarget,
    recommendation: actionViewModel.recommendation,
    actions: actionViewModel.actions,
    selector: detailsViewModel.selector,
    selectorRows: detailsViewModel.selectorRows,
    propertyRows: detailsViewModel.propertyRows
  }
}
