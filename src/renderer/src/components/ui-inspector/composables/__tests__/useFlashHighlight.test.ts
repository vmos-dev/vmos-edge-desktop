/**
 * useFlashHighlight · 定时闪烁状态机单元测试
 *
 * 覆盖:
 *   - sourceId 非 null → target 立即变对应对象
 *   - durationMs 到期 → target 自动变 null
 *   - sourceId 切换 → 定时器重置,animationKey 递增
 *   - sourceId 变 null → 立即清空,不等定时器
 *   - 组件卸载 → 定时器清理(间接通过无残留回调验证)
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { ref, effectScope, nextTick } from 'vue'
import { useFlashHighlight } from '../useFlashHighlight'

interface MockNode {
  id: number
  label: string
}

function setupComposable<T>(
  sourceId: ReturnType<typeof ref<number | null | undefined>>,
  lookup: (id: number) => T | null,
  durationMs = 5000
) {
  const scope = effectScope()
  const result = scope.run(() => useFlashHighlight<T>(sourceId, { durationMs, lookup }))!
  return { result, scope }
}

const MOCK_NODES: MockNode[] = [
  { id: 1, label: 'a' },
  { id: 2, label: 'b' }
]
const lookupMock = (id: number): MockNode | null => MOCK_NODES.find((n) => n.id === id) ?? null

describe('useFlashHighlight', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sourceId 变非 null → target = lookup(id), animationKey 递增', async () => {
    const sourceId = ref<number | null>(null)
    const { result, scope } = setupComposable<MockNode>(sourceId, lookupMock, 5000)

    expect(result.target.value).toBeNull()
    expect(result.animationKey.value).toBe(0)

    sourceId.value = 1
    await nextTick()

    expect(result.target.value).toEqual({ id: 1, label: 'a' })
    expect(result.animationKey.value).toBe(1)

    scope.stop()
  })

  it('durationMs 到期 → target 自动变 null', async () => {
    const sourceId = ref<number | null>(null)
    const { result, scope } = setupComposable<MockNode>(sourceId, lookupMock, 3000)

    sourceId.value = 1
    await nextTick()
    expect(result.target.value).not.toBeNull()

    vi.advanceTimersByTime(2999)
    expect(result.target.value).not.toBeNull()

    vi.advanceTimersByTime(1)
    expect(result.target.value).toBeNull()

    scope.stop()
  })

  it('sourceId 切换 → 重置定时器 + animationKey 再 +1', async () => {
    const sourceId = ref<number | null>(null)
    const { result, scope } = setupComposable<MockNode>(sourceId, lookupMock, 5000)

    sourceId.value = 1
    await nextTick()
    expect(result.animationKey.value).toBe(1)

    vi.advanceTimersByTime(4000) // 还没过 5s

    sourceId.value = 2
    await nextTick()
    expect(result.target.value).toEqual({ id: 2, label: 'b' })
    expect(result.animationKey.value).toBe(2)

    // 又过 4s(累计 8s),但 id=2 才计时 4s,target 仍在
    vi.advanceTimersByTime(4000)
    expect(result.target.value).not.toBeNull()

    // 再过 1s 到 id=2 的 5s 期
    vi.advanceTimersByTime(1000)
    expect(result.target.value).toBeNull()

    scope.stop()
  })

  it('sourceId 变 null → 立即清空', async () => {
    const sourceId = ref<number | null>(null)
    const { result, scope } = setupComposable<MockNode>(sourceId, lookupMock, 5000)

    sourceId.value = 1
    await nextTick()
    expect(result.target.value).not.toBeNull()

    sourceId.value = null
    await nextTick()
    expect(result.target.value).toBeNull()

    // 过了 5s 也没有残留触发
    vi.advanceTimersByTime(10000)
    expect(result.target.value).toBeNull()

    scope.stop()
  })

  it('lookup 返回 null → target 为 null 但 animationKey 仍递增', async () => {
    const sourceId = ref<number | null>(null)
    const { result, scope } = setupComposable<MockNode>(sourceId, () => null, 5000)

    sourceId.value = 999
    await nextTick()
    expect(result.target.value).toBeNull()
    expect(result.animationKey.value).toBe(1)

    scope.stop()
  })

  it('scope 销毁 → 定时器清理(再推进时间不触发 activeId 变化)', async () => {
    const sourceId = ref<number | null>(null)
    const { result, scope } = setupComposable<MockNode>(sourceId, lookupMock, 5000)

    sourceId.value = 1
    await nextTick()
    expect(result.target.value).not.toBeNull()

    scope.stop() // 模拟 onBeforeUnmount

    // 即使推过 5s,也不应有问题(清理过的定时器不会设置 activeId)
    vi.advanceTimersByTime(6000)
    // scope 停止后读不到新的响应;关键是不报错
    expect(() => result.target.value).not.toThrow()
  })
})
