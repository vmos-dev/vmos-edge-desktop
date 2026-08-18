import { computed, type Ref } from 'vue'
import type { WorkflowListItem } from '@shared/ipc/workflow.types'
import { t } from '@renderer/locales'

export interface WorkflowGroupItem {
  id: string
  label: string
  subtitle: string | null
  appIcon?: string
  count: number
  items: WorkflowListItem[]
}

export interface WorkflowGroupNavItem {
  id: string
  label: string
  count: number
  appIcon?: string
}

export interface WorkflowGroupSummary {
  workflowCount: number
  appCount: number
}

interface GroupAccumulator {
  key: string
  label: string
  source: 'appName' | 'appId' | 'fallback'
  appIds: Set<string>
  appIcon?: string
  items: WorkflowListItem[]
}

function resolveGroupLabel(item: WorkflowListItem): {
  label: string
  source: GroupAccumulator['source']
} {
  const appName = item.appName.trim()
  if (appName) return { label: appName, source: 'appName' }

  const appId = item.appId.trim()
  if (appId) return { label: appId, source: 'appId' }

  return { label: t('workflow.misc.unnamedApp'), source: 'fallback' }
}

function buildGroupKey(label: string): string {
  return label.trim().toLowerCase()
}

function buildGroupId(key: string, appIds: Iterable<string>): string {
  const normalizedLabel = key.replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-').replace(/^-+|-+$/g, '')

  const suffix = [...appIds]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .join('__')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/gi, '-')

  return `app-${normalizedLabel || 'unknown'}-${suffix || 'none'}`
}

function buildSubtitle(
  source: GroupAccumulator['source'],
  appIds: readonly string[]
): string | null {
  if (appIds.length === 0) return null
  if (appIds.length > 1) return `${appIds[0]} +${appIds.length - 1}`
  if (source !== 'appName') return null
  return null
}

function compareByLabel(left: { label: string }, right: { label: string }): number {
  return left.label.localeCompare(right.label, 'zh-Hans-CN', { sensitivity: 'base' })
}

export function useWorkflowGroups(items: Readonly<Ref<readonly WorkflowListItem[]>>) {
  const groups = computed<WorkflowGroupItem[]>(() => {
    const map = new Map<string, GroupAccumulator>()

    for (const item of items.value) {
      const { label, source } = resolveGroupLabel(item)
      const key = buildGroupKey(label)
      const existing = map.get(key)

      if (existing) {
        existing.appIds.add(item.appId)
        if (!existing.appIcon && item.appIcon) existing.appIcon = item.appIcon
        existing.items.push(item)
        continue
      }

      map.set(key, {
        key,
        label,
        source,
        appIds: new Set(item.appId ? [item.appId] : []),
        appIcon: item.appIcon,
        items: [item]
      })
    }

    return [...map.values()].sort(compareByLabel).map((group) => {
      const sortedItems = [...group.items].sort((left, right) => right.updatedAt - left.updatedAt)
      const appIds = [...group.appIds]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))

      return {
        id: buildGroupId(group.key, appIds),
        label: group.label,
        subtitle: buildSubtitle(group.source, appIds),
        appIcon: group.appIcon,
        count: sortedItems.length,
        items: sortedItems
      }
    })
  })

  const navItems = computed<WorkflowGroupNavItem[]>(() =>
    groups.value.map((group) => ({
      id: group.id,
      label: group.label,
      count: group.count,
      appIcon: group.appIcon
    }))
  )

  const summary = computed<WorkflowGroupSummary>(() => ({
    workflowCount: items.value.length,
    appCount: groups.value.length
  }))

  return {
    groups,
    navItems,
    summary
  }
}
