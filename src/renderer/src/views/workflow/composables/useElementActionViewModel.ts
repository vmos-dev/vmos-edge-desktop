import { computed, type Ref } from 'vue'
import type { UiNode } from '@renderer/components/ui-inspector/types'
import type {
  EffectiveTarget,
  NodeTreeContext,
  RecommendationContext,
  ScoredAction
} from '../types'
import type {
  ElementActionListItem,
  ElementRecommendationCard
} from '../components/edit/element-popover/types'
import { categoryStyle } from '../utils/actionCategoryStyle'
import { actionLabel, actionDescription, getActionDefinition } from '../utils/actionRegistry'
import { computeRecommendation, emptyContext, scoreAllActions } from '../utils/recommendation'
import { t } from '@renderer/locales'

interface Screen {
  width: number
  height: number
}

interface UseElementActionViewModelOptions {
  node: Ref<UiNode | null>
  screen: Ref<Screen | undefined>
  tree?: Ref<NodeTreeContext | undefined>
  context?: Ref<RecommendationContext | undefined>
  effectiveTarget: Ref<EffectiveTarget | undefined>
}

function flattenActions(actions: ReturnType<typeof scoreAllActions>): ScoredAction[] {
  return [...actions.top, ...actions.ok, ...actions.more].sort((a, b) => b.value - a.value)
}

function resolveContext(context?: RecommendationContext): RecommendationContext {
  return context ?? emptyContext()
}

function toActionListItem(item: ScoredAction): ElementActionListItem {
  const actionDefinition = getActionDefinition(item.rule.id)

  return {
    label: actionLabel(item.rule.id),
    description:
      actionDescription(item.rule.id) ||
      t('workflow.recommendation.currentElement', { name: item.rule.name }),
    score: item.value,
    rule: item.rule,
    style: categoryStyle(actionDefinition?.category)
  }
}

function toRecommendationCard(
  item: NonNullable<ReturnType<typeof computeRecommendation>>
): ElementRecommendationCard {
  const actionDefinition = getActionDefinition(item.action)

  return {
    title: item.title,
    reason:
      item.reason ?? (actionDescription(item.action) || t('workflow.recommendation.suitsCurrent')),
    helperText: t('workflow.recommendation.insertOneStep'),
    actionLabel: actionLabel(item.action),
    rec: item,
    style: categoryStyle(actionDefinition?.category)
  }
}

export function useElementActionViewModel(options: UseElementActionViewModelOptions) {
  const recommendation = computed<ElementRecommendationCard | null>(() => {
    const node = options.node.value
    if (!node) return null

    const rec = computeRecommendation(
      node,
      resolveContext(options.context?.value),
      options.screen.value,
      options.tree?.value,
      options.effectiveTarget.value
    )

    return rec ? toRecommendationCard(rec) : null
  })

  const actions = computed<ElementActionListItem[]>(() => {
    const node = options.node.value
    if (!node) return []

    const items = flattenActions(
      scoreAllActions(
        node,
        resolveContext(options.context?.value),
        options.screen.value,
        options.tree?.value,
        options.effectiveTarget.value
      )
    )

    return items
      .filter((item) => item.rule.id !== recommendation.value?.rec.action)
      .map(toActionListItem)
  })

  return {
    recommendation,
    actions
  }
}
