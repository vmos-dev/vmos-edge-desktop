import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useDebouncedSave } from '../useDebouncedSave'

describe('useDebouncedSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function inScope<T>(fn: () => T): { result: T; stop: () => void } {
    const scope = effectScope()
    let result!: T
    scope.run(() => {
      result = fn()
    })
    return { result, stop: () => scope.stop() }
  }

  it('only fires save once after the last schedule call', () => {
    const save = vi.fn()
    const { result: handle } = inScope(() => useDebouncedSave(save, 100))

    handle.schedule()
    vi.advanceTimersByTime(50)
    handle.schedule() // resets the timer
    vi.advanceTimersByTime(50)
    handle.schedule() // resets again

    expect(save).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('cancel() prevents the pending save', () => {
    const save = vi.fn()
    const { result: handle } = inScope(() => useDebouncedSave(save, 100))

    handle.schedule()
    handle.cancel()
    vi.advanceTimersByTime(200)

    expect(save).not.toHaveBeenCalled()
  })

  it('default delay falls back to 600ms when not provided', () => {
    const save = vi.fn()
    const { result: handle } = inScope(() => useDebouncedSave(save))

    handle.schedule()
    vi.advanceTimersByTime(599)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('subsequent schedule after fire works again', () => {
    const save = vi.fn()
    const { result: handle } = inScope(() => useDebouncedSave(save, 100))

    handle.schedule()
    vi.advanceTimersByTime(100)
    expect(save).toHaveBeenCalledTimes(1)

    handle.schedule()
    vi.advanceTimersByTime(100)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('does not throw when save returns void', () => {
    const save = vi.fn(() => undefined)
    const { result: handle } = inScope(() => useDebouncedSave(save, 100))

    handle.schedule()
    expect(() => vi.advanceTimersByTime(100)).not.toThrow()
    expect(save).toHaveBeenCalledTimes(1)
  })
})
