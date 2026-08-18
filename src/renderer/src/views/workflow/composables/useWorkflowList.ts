/**
 * useWorkflowList · 工作流列表加载 + 客户端搜索
 *
 * 状态分层:
 *  - 共享(模块级):items / loading / error / initialized —— 列表页和编辑页(切换下拉)
 *    复用同一份缓存,避免每次进出视图都重打 IPC
 *  - 私有(每实例):keyword —— 列表页搜索框 / 切换下拉搜索框 互不影响
 *
 * 写入路径:
 *  - refresh()  → 全量重拉(首次挂载或显式刷新)
 *  - remove(id) → 本地剔除 + 远端删除(无需 refresh)
 *  - patchItem(item) → 单条 upsert(保存后调用,无需 refresh)
 *
 * 列表很小(典型 < 50 条),搜索完全本地完成,不打 IPC。
 */
import { computed, ref, shallowRef } from 'vue'
import type { WorkflowListItem } from '@shared/ipc/workflow.types'
import type { WorkflowRepository } from './useWorkflowRepository'

// ═══════════════ 模块级共享状态(renderer 进程作用域) ═══════════════
const _items = shallowRef<readonly WorkflowListItem[]>([])
const _loading = shallowRef(false)
const _error = shallowRef<string | null>(null)
const _initialized = shallowRef(false)
/** 同时只允许一个 refresh 在飞,避免快速进出视图的重复 IPC */
let _refreshInflight: Promise<void> | null = null

export function useWorkflowList(repository: WorkflowRepository) {
  const keyword = ref('')

  const filtered = computed<readonly WorkflowListItem[]>(() => {
    const q = keyword.value.trim().toLowerCase()
    if (!q) return _items.value
    return _items.value.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.appName.toLowerCase().includes(q) ||
        w.appId.toLowerCase().includes(q)
    )
  })

  const totalSteps = computed(() => _items.value.reduce((sum, w) => sum + (w.stepCount ?? 0), 0))

  const isEmpty = computed(() => _initialized.value && !_loading.value && _items.value.length === 0)
  const noMatch = computed(
    () =>
      _initialized.value &&
      !_loading.value &&
      _items.value.length > 0 &&
      filtered.value.length === 0
  )

  async function refresh(): Promise<void> {
    if (_refreshInflight) return _refreshInflight
    _loading.value = true
    _error.value = null
    _refreshInflight = repository
      .list()
      .then((items) => {
        _items.value = items
      })
      .catch((e: unknown) => {
        _error.value = e instanceof Error ? e.message : String(e)
        _items.value = []
      })
      .finally(() => {
        _loading.value = false
        _initialized.value = true
        _refreshInflight = null
      })
    return _refreshInflight
  }

  /** 首次挂载用:仅当尚未初始化才拉,避免重复 IPC */
  async function refreshIfNeeded(): Promise<void> {
    if (_initialized.value || _refreshInflight) return _refreshInflight ?? Promise.resolve()
    return refresh()
  }

  async function remove(id: string): Promise<boolean> {
    try {
      const ok = await repository.remove(id)
      if (ok) _items.value = _items.value.filter((w) => w.id !== id)
      return ok
    } catch (e) {
      _error.value = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  /** 保存后调用:把新结果 upsert 到列表缓存,不重打 IPC */
  function patchItem(updated: WorkflowListItem): void {
    const idx = _items.value.findIndex((w) => w.id === updated.id)
    if (idx >= 0) {
      const next = _items.value.slice()
      next[idx] = updated
      _items.value = next
    } else {
      // 新建保存后:插到列表最前(按 updatedAt DESC)
      _items.value = [updated, ...(_items.value as WorkflowListItem[])]
    }
  }

  return {
    // shared state(只读暴露)
    items: _items,
    loading: _loading,
    error: _error,
    initialized: _initialized,
    isEmpty,
    noMatch,
    totalSteps,

    // per-instance
    keyword,
    filtered,

    // actions
    refresh,
    refreshIfNeeded,
    remove,
    patchItem
  }
}

export type WorkflowListSession = ReturnType<typeof useWorkflowList>
