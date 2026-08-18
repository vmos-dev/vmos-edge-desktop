import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef } from 'vue'
import type { Device } from '@shared/ipc/data.types'
import { FLOW_POLL_INTERVAL_MS } from '../../constants'
import { useFlowRunner } from '../useFlowRunner'

function createDevice(): Device {
  return {
    id: 'device-db-1',
    host_ip: '10.0.0.2',
    user_name: 'Demo device',
    lastActiveTime: 1
  }
}

function envelope<T>(data: T) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ code: 200, message: 'ok', data })
  } as Response
}

function notFoundEnvelope() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code: 200,
      message: 'ok',
      data: {
        total: 1,
        found: 0,
        missing: 1,
        results: [{ deviceId: 'device-db-1', found: false, task: null }]
      }
    })
  } as Response
}

function inScope<T>(fn: () => T): { result: T; stop: () => void } {
  const scope = effectScope()
  let result!: T
  scope.run(() => {
    result = fn()
  })
  return { result, stop: () => scope.stop() }
}

describe('useFlowRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('polls task status by the deviceId returned from execute', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        envelope({
          total: 1,
          succeeded: 1,
          failed: 0,
          results: [{ deviceId: 'flow-device-1', success: true, taskId: 'task-1' }]
        })
      )
      .mockResolvedValueOnce(
        envelope({
          total: 1,
          found: 1,
          missing: 0,
          results: [
            {
              deviceId: 'flow-device-1',
              found: true,
              task: {
                taskId: 'task-1',
                deviceId: 'flow-device-1',
                status: 'COMPLETED',
                progress: { total: 1, completed: 1, current: 0 },
                steps: [{ index: 0, status: 'COMPLETED', metadata: {} }],
                error: null
              }
            }
          ]
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    const result = await runner.run('appId: com.demo\n---\n- inputText: hello\n')
    expect(result.success).toBe(true)

    await vi.advanceTimersByTimeAsync(FLOW_POLL_INTERVAL_MS)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [statusUrl, statusInit] = fetchMock.mock.calls[1]
    expect(statusUrl).toBe('http://10.0.0.2:47218/flow/status')
    expect(JSON.parse(statusInit.body)).toEqual({ deviceIds: ['flow-device-1'] })

    stop()
  })

  it('cancels task by the deviceId returned from execute', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        envelope({
          total: 1,
          succeeded: 1,
          failed: 0,
          results: [{ deviceId: 'flow-device-1', success: true, taskId: 'task-1' }]
        })
      )
      .mockResolvedValueOnce(
        envelope({
          total: 1,
          succeeded: 1,
          failed: 0,
          results: [{ deviceId: 'flow-device-1', success: true }]
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    const runResult = await runner.run('appId: com.demo\n---\n- inputText: hello\n')
    expect(runResult.success).toBe(true)

    const cancelResult = await runner.cancel()
    expect(cancelResult.success).toBe(true)

    const [cancelUrl, cancelInit] = fetchMock.mock.calls[1]
    expect(cancelUrl).toBe('http://10.0.0.2:47218/flow/cancel')
    expect(JSON.parse(cancelInit.body)).toEqual({ deviceIds: ['flow-device-1'] })

    stop()
  })

  it('syncs an active task without YAML — no line statuses', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      envelope({
        total: 1,
        found: 1,
        missing: 0,
        results: [
          {
            deviceId: 'device-db-1',
            found: true,
            task: {
              taskId: 'task-1',
              deviceId: 'device-db-1',
              status: 'RUNNING',
              progress: { total: 1, completed: 0, current: 0 },
              steps: [{ index: 0, status: 'RUNNING', metadata: {} }],
              error: null
            }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    const result = await runner.syncStatus()

    expect(result).toEqual({ success: true, active: true })
    expect(runner.isRunning.value).toBe(true)
    expect(runner.lineStatuses.value).toEqual({})

    stop()
  })

  it('syncs an active task with YAML — immediately restores line statuses', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      envelope({
        total: 1,
        found: 1,
        missing: 0,
        results: [
          {
            deviceId: 'device-db-1',
            found: true,
            task: {
              taskId: 'task-1',
              deviceId: 'device-db-1',
              status: 'RUNNING',
              progress: { total: 2, completed: 1, current: 1 },
              steps: [
                { index: 0, status: 'COMPLETED', metadata: {} },
                { index: 1, status: 'RUNNING', metadata: {} }
              ],
              error: null
            }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const yaml = '- tapOn: "hello"\n- inputText: "world"\n'
    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    const result = await runner.syncStatus(yaml)

    expect(result).toEqual({ success: true, active: true })
    expect(runner.isRunning.value).toBe(true)
    expect(runner.lineStatuses.value).toEqual({ 1: 'success', 2: 'running' })

    stop()
  })

  it('strips config-derived implicit steps (env+appId) — maps only explicit commands', async () => {
    // config 段有 appId + env → 引擎注入 2 个隐式步骤; YAML 命令段只有 3 条
    const fetchMock = vi.fn().mockResolvedValueOnce(
      envelope({
        total: 1,
        found: 1,
        missing: 0,
        results: [
          {
            deviceId: 'device-db-1',
            found: true,
            task: {
              taskId: 'task-1',
              deviceId: 'device-db-1',
              status: 'RUNNING',
              progress: { total: 5, completed: 3, current: 1 },
              steps: [
                {
                  index: 0,
                  command: { defineVariablesCommand: {} },
                  status: 'COMPLETED',
                  metadata: {}
                },
                { index: 1, command: { launchAppCommand: {} }, status: 'COMPLETED', metadata: {} },
                { index: 2, status: 'COMPLETED', metadata: {} },
                { index: 3, status: 'COMPLETED', metadata: {} },
                { index: 4, status: 'RUNNING', metadata: {} }
              ],
              error: null
            }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const yaml =
      'appId: com.demo\nenv:\n  k: v\n---\n- tapOn: "a"\n- tapOn: "b"\n- inputText: "c"\n'
    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    await runner.syncStatus(yaml)

    // 隐式步骤被剥离, 3 条显式命令(行 5/6/7)直接与 ranges 位置映射
    expect(runner.lineStatuses.value).toEqual({ 5: 'success', 6: 'success', 7: 'running' })

    stop()
  })

  it('strips config-derived step — children inside repeat map correctly', async () => {
    // config 段只有 appId → 1 个隐式步骤; 显式: tapOn + repeat(含 2 children)
    const fetchMock = vi.fn().mockResolvedValueOnce(
      envelope({
        total: 1,
        found: 1,
        missing: 0,
        results: [
          {
            deviceId: 'device-db-1',
            found: true,
            task: {
              taskId: 'task-1',
              deviceId: 'device-db-1',
              status: 'RUNNING',
              progress: { total: 3, completed: 1, current: 1 },
              steps: [
                { index: 0, command: { launchAppCommand: {} }, status: 'COMPLETED', metadata: {} },
                { index: 1, status: 'COMPLETED', metadata: {} },
                {
                  index: 2,
                  status: 'RUNNING',
                  metadata: {},
                  children: [
                    { index: 0, status: 'COMPLETED', metadata: {} },
                    { index: 1, status: 'RUNNING', metadata: {} }
                  ]
                }
              ],
              error: null
            }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const yaml = [
      'appId: com.demo',
      '---',
      '- tapOn: "btn"',
      '- repeat:',
      '    duration: 5000',
      '    commands:',
      '      - swipe: UP',
      '      - sleep: 1000',
      ''
    ].join('\n')

    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    await runner.syncStatus(yaml)

    // 剥离 1 个隐式步骤后: tapOn(行3)=success, repeat(行4-8)=running
    // children 位置映射: swipe(行7)=success, sleep(行8)=running
    expect(runner.lineStatuses.value[3]).toBe('success')
    expect(runner.lineStatuses.value[4]).toBe('running')
    expect(runner.lineStatuses.value[7]).toBe('success')
    expect(runner.lineStatuses.value[8]).toBe('running')

    stop()
  })

  it('config with only env — strips 1 implicit step', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      envelope({
        total: 1,
        found: 1,
        missing: 0,
        results: [
          {
            deviceId: 'device-db-1',
            found: true,
            task: {
              taskId: 'task-1',
              deviceId: 'device-db-1',
              status: 'RUNNING',
              progress: { total: 3, completed: 1, current: 1 },
              steps: [
                {
                  index: 0,
                  command: { defineVariablesCommand: {} },
                  status: 'COMPLETED',
                  metadata: {}
                },
                { index: 1, status: 'COMPLETED', metadata: {} },
                { index: 2, status: 'RUNNING', metadata: {} }
              ],
              error: null
            }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const yaml = 'env:\n  k: v\n---\n- tapOn: "a"\n- tapOn: "b"\n'
    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    await runner.syncStatus(yaml)

    expect(runner.lineStatuses.value).toEqual({ 4: 'success', 5: 'running' })
    stop()
  })

  it('config appId + explicit launchApp — engine deduplicates, offset = 1 not 2', async () => {
    // 用户 YAML: config 有 appId + env, 但命令段显式写了 `- launchApp`
    // 引擎去重: env→defineVariables(隐式), appId+launchApp→一个 launchAppCommand(不重复)
    // 所以 8 个 steps, 7 条 YAML 命令, offset = 1
    const fetchMock = vi.fn().mockResolvedValueOnce(
      envelope({
        total: 1,
        found: 1,
        missing: 0,
        results: [
          {
            deviceId: 'device-db-1',
            found: true,
            task: {
              taskId: 'task-1',
              deviceId: 'device-db-1',
              status: 'RUNNING',
              progress: { total: 8, completed: 5, current: 1 },
              steps: [
                {
                  index: 0,
                  command: { defineVariablesCommand: {} },
                  status: 'COMPLETED',
                  metadata: {}
                },
                { index: 1, command: { launchAppCommand: {} }, status: 'COMPLETED', metadata: {} },
                { index: 2, status: 'COMPLETED', metadata: {} },
                { index: 3, status: 'COMPLETED', metadata: {} },
                { index: 4, status: 'COMPLETED', metadata: {} },
                { index: 5, status: 'COMPLETED', metadata: {} },
                { index: 6, status: 'RUNNING', metadata: {} },
                { index: 7, status: 'PENDING', metadata: {} }
              ],
              error: null
            }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const yaml = [
      'appId: com.demo',
      'env:',
      '  k: v',
      '---',
      '- launchApp:',
      '    appId: com.demo',
      '- tapOn:',
      '    id: "btn1"',
      '- tapOn:',
      '    id: "btn2"',
      '- tapOn:',
      '    id: "btn3"',
      '- tapOn:',
      '    id: "btn4"',
      '- repeat:',
      '    duration: 5000',
      '    commands:',
      '      - swipe: UP',
      '- sleep: 1000',
      ''
    ].join('\n')

    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    await runner.syncStatus(yaml)

    // offset = 8 - 7 = 1, 跳过 defineVariables
    // step[1] launchApp → 行5 (launchApp:)
    // step[2..5] tapOn → 行7,9,11,13
    // step[6] repeat → 行15 RUNNING
    // step[7] sleep → 行19 PENDING (no status)
    expect(runner.lineStatuses.value[5]).toBe('success') // launchApp
    expect(runner.lineStatuses.value[7]).toBe('success') // tapOn btn1
    expect(runner.lineStatuses.value[9]).toBe('success') // tapOn btn2
    expect(runner.lineStatuses.value[11]).toBe('success') // tapOn btn3
    expect(runner.lineStatuses.value[13]).toBe('success') // tapOn btn4
    expect(runner.lineStatuses.value[15]).toBe('running') // repeat
    expect(runner.lineStatuses.value[19]).toBeUndefined() // sleep (PENDING → no status)

    stop()
  })

  it('non-implicit config keys (flowName) do not affect step count', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      envelope({
        total: 1,
        found: 1,
        missing: 0,
        results: [
          {
            deviceId: 'device-db-1',
            found: true,
            task: {
              taskId: 'task-1',
              deviceId: 'device-db-1',
              status: 'RUNNING',
              progress: { total: 2, completed: 1, current: 1 },
              steps: [
                { index: 0, command: { launchAppCommand: {} }, status: 'COMPLETED', metadata: {} },
                { index: 1, status: 'RUNNING', metadata: {} }
              ],
              error: null
            }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    // flowName 不产生隐式步骤，只有 appId 产生 1 个
    const yaml = 'appId: com.demo\nflowName: test\n---\n- tapOn: "a"\n'
    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    await runner.syncStatus(yaml)

    expect(runner.lineStatuses.value).toEqual({ 4: 'running' })
    stop()
  })

  it('pollStatus uses configStepCount to slice implicit steps', async () => {
    const fetchMock = vi
      .fn()
      // run → execute
      .mockResolvedValueOnce(
        envelope({
          total: 1,
          succeeded: 1,
          failed: 0,
          results: [{ deviceId: 'device-db-1', success: true, taskId: 'task-1' }]
        })
      )
      // pollStatus → status
      .mockResolvedValueOnce(
        envelope({
          total: 1,
          found: 1,
          missing: 0,
          results: [
            {
              deviceId: 'device-db-1',
              found: true,
              task: {
                taskId: 'task-1',
                deviceId: 'device-db-1',
                status: 'RUNNING',
                progress: { total: 3, completed: 2, current: 1 },
                steps: [
                  {
                    index: 0,
                    command: { launchAppCommand: {} },
                    status: 'COMPLETED',
                    metadata: {}
                  },
                  { index: 1, status: 'COMPLETED', metadata: {} },
                  { index: 2, status: 'RUNNING', metadata: {} }
                ],
                error: null
              }
            }
          ]
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const yaml = 'appId: com.demo\n---\n- tapOn: "a"\n- inputText: "b"\n'
    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    await runner.run(yaml)
    await vi.advanceTimersByTimeAsync(FLOW_POLL_INTERVAL_MS)

    // 轮询结果也正确剥离了 1 个隐式步骤
    expect(runner.lineStatuses.value).toEqual({ 3: 'success', 4: 'running' })
    stop()
  })

  it('propagates error message on FAILED step', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      envelope({
        total: 1,
        found: 1,
        missing: 0,
        results: [
          {
            deviceId: 'device-db-1',
            found: true,
            task: {
              taskId: 'task-1',
              deviceId: 'device-db-1',
              status: 'RUNNING',
              progress: { total: 2, completed: 1, current: 1 },
              steps: [
                { index: 0, status: 'COMPLETED', metadata: {} },
                { index: 1, status: 'FAILED', error: 'Element not found', metadata: {} }
              ],
              error: null
            }
          }
        ]
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const yaml = '- tapOn: "a"\n- tapOn: "missing"\n'
    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    await runner.syncStatus(yaml)

    expect(runner.lineStatuses.value).toEqual({ 1: 'success', 2: 'error' })
    expect(runner.lineErrors.value).toEqual({ 2: 'Element not found' })
    stop()
  })

  it('keeps the editor idle when there is no task for the current device', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(notFoundEnvelope()))

    const selectedDevice = shallowRef<Device | null>(createDevice())
    const { result: runner, stop } = inScope(() => useFlowRunner(selectedDevice))

    const result = await runner.syncStatus()

    expect(result).toEqual({ success: true, active: false })
    expect(runner.isRunning.value).toBe(false)
    expect(runner.lineStatuses.value).toEqual({})

    stop()
  })
})
