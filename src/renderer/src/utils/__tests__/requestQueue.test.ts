import { afterEach, describe, expect, it, vi } from 'vitest'

const requestMock = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}

vi.mock('@shared/api/request', () => ({
  request: requestMock,
  isCancel: vi.fn(() => false),
  isAxiosError: vi.fn(() => false)
}))

describe('RequestQueue', () => {
  afterEach(() => {
    requestMock.get.mockReset()
    requestMock.post.mockReset()
    requestMock.put.mockReset()
    requestMock.delete.mockReset()
  })

  it('uses custom executor result when task provides one', async () => {
    requestMock.get.mockResolvedValue({
      code: 200,
      data: { message: 'fallback-request-result' }
    })

    const { RequestQueue } = await import('../requestQueue')

    const queue = new RequestQueue({ concurrency: 1 })
    const finish = vi.fn()

    const expectedResult = { message: 'executor-result' }

    queue.on('finish', finish)

    queue.add({
      url: 'http://unused.local/task',
      method: 'GET',
      executor: vi.fn(async () => expectedResult)
    } as any)

    await vi.waitFor(() => {
      expect(finish).toHaveBeenCalledTimes(1)
    })

    const [task] = queue.getTasks()

    expect(task.status).toBe('success')
    expect(task.data).toEqual(expectedResult)
    expect(requestMock.get).not.toHaveBeenCalled()
  })
})
