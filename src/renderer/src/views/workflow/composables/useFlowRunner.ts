import { shallowRef, computed, type Ref } from 'vue'
import { parseAllDocuments, LineCounter, isSeq, isMap, isNode } from 'yaml'
import type { YAMLSeq } from 'yaml'
import type { Device } from '@shared/ipc/data.types'
import { FLOW_ENGINE_PORT, FLOW_ENGINE_HTTP_TIMEOUT_MS } from '@shared/constant/flowEngine'
import type {
  FlowApiEnvelope,
  FlowExecuteRequest,
  FlowExecuteResponse,
  FlowStatusResponse,
  FlowStatusFoundItem,
  FlowCancelResponse,
  FlowStepRecord,
  FlowTaskShape
} from '@shared/ipc/flowEngine.api.types'
import { findChildCommands, findBranchArms } from '../utils/yamlAst'
import { FLOW_MAX_POLL_FAILURES, FLOW_POLL_INTERVAL_MS } from '../constants'

// ═══════════════════════════════════════════════════════════
// 运行时行状态(Monaco 装饰消费)
// ═══════════════════════════════════════════════════════════
//
// 基础状态(running/success/error):命令首行,显示 glyph 图标 + 行背景
// 续行状态(*-cont):多行命令的后续行,只显示行背景,无 glyph
//
// 这一对类型是"运行侧"的产物,由 useFlowRunner 生成;YamlEditor 等消费方
// 从这里 import,避免组件被数据层反向依赖

export type LineStatus =
  | 'running'
  | 'success'
  | 'error'
  | 'running-cont'
  | 'success-cont'
  | 'error-cont'

export interface LineStatusMap {
  [lineNumber: number]: LineStatus
}

/** 失败步骤首行 → 错误文案(供编辑器 glyph hover tooltip 用);只在 error 行有 */
export interface LineErrorMap {
  [lineNumber: number]: string
}

// ═══════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════

interface SyncStatusResult {
  success: boolean
  active: boolean
  error?: string
}

/**
 * 命令在 YAML 源码中的行范围（树形，和 FlowStepRecord 对称）
 *
 * 例如 repeat / runFlow / branch 的 commands 子级也会被解析为 children
 */
interface CommandRange {
  startLine: number // 命令首行（1-based，`- xxx` 所在行）
  endLine: number // 命令末行（含多行属性的最后一行）
  children: CommandRange[] // 嵌套 commands 里的子命令
}

// ═══════════════════════════════════════════════════════════
// YAML AST → 树形 CommandRange
// ═══════════════════════════════════════════════════════════

/**
 * 从 YAML Sequence 节点递归提取每个命令的行范围和子命令
 */
function extractRangesFromSeq(seq: YAMLSeq, lineCounter: LineCounter): CommandRange[] {
  const ranges: CommandRange[] = []

  for (const item of seq.items) {
    if (!isNode(item) || !item.range) continue

    const startPos = lineCounter.linePos(item.range[0])
    const endPos = lineCounter.linePos(Math.max(item.range[0], item.range[2] - 1))

    const range: CommandRange = {
      startLine: startPos.line,
      endLine: endPos.line,
      children: []
    }

    if (isMap(item)) {
      // 命令 Map:合并「commands 子序列」+「branch 各分支的 commands」为 children
      const childSeq = findChildCommands(item)
      if (childSeq) range.children.push(...extractRangesFromSeq(childSeq, lineCounter))

      const armSeq = findBranchArms(item)
      if (armSeq) {
        for (const arm of armSeq.items) {
          if (!isMap(arm)) continue
          const armCmds = findChildCommands(arm)
          if (armCmds) range.children.push(...extractRangesFromSeq(armCmds, lineCounter))
        }
      }
    }

    ranges.push(range)
  }

  return ranges
}

/**
 * 解析 YAML 命令段的树形行范围
 *
 * 支持两种格式：
 *   1. config + --- + commands（多文档）→ 只返回 --- 下方命令的行范围
 *   2. 纯 commands 列表（单文档）
 */
function parseCommandRanges(yaml: string): CommandRange[] {
  const lineCounter = new LineCounter()
  const docs = parseAllDocuments(yaml, { lineCounter })

  const seqDoc = docs.find((doc) => isSeq(doc.contents))
  return seqDoc && isSeq(seqDoc.contents) ? extractRangesFromSeq(seqDoc.contents, lineCounter) : []
}

// ═══════════════════════════════════════════════════════════
// 执行进度 → 行状态映射
// ═══════════════════════════════════════════════════════════

/**
 * 将引擎步骤 + YAML 命令行范围按位置映射，生成行状态和错误信息。
 *
 * 引擎可能在 steps 前面注入隐式步骤（defineVariables / launchApp），
 * 数量取决于 config 段内容和引擎的去重策略——客户端无法准确预测。
 * 因此 offset 直接由 `steps.length - ranges.length` 推算：
 * 尾部的 N 个 step 与 N 条 YAML 命令一一对齐。
 */
function extractLineAnnotations(
  steps: FlowStepRecord[],
  ranges: CommandRange[]
): { statuses: LineStatusMap; errors: LineErrorMap } {
  const statuses: LineStatusMap = {}
  const errors: LineErrorMap = {}

  function mapStep(step: FlowStepRecord, range: CommandRange) {
    let baseStatus: 'running' | 'success' | 'error' | null = null
    switch (step.status) {
      case 'RUNNING':
        baseStatus = 'running'
        break
      case 'COMPLETED':
      case 'WARNED':
        baseStatus = 'success'
        break
      case 'FAILED':
        baseStatus = 'error'
        break
    }
    if (!baseStatus) return

    statuses[range.startLine] = baseStatus
    for (let line = range.startLine + 1; line <= range.endLine; line++) {
      statuses[line] = `${baseStatus}-cont` as LineStatus
    }
    if (baseStatus === 'error' && step.error) {
      errors[range.startLine] = step.error
    }

    if (step.children && range.children.length > 0) {
      const len = Math.min(step.children.length, range.children.length)
      for (let i = 0; i < len; i++) {
        mapStep(step.children[i], range.children[i])
      }
    }
  }

  const offset = Math.max(0, steps.length - ranges.length)
  const len = Math.min(steps.length - offset, ranges.length)
  for (let i = 0; i < len; i++) {
    mapStep(steps[i + offset], ranges[i])
  }

  return { statuses, errors }
}

// ═══════════════════════════════════════════════════════════
// 辅助
// ═══════════════════════════════════════════════════════════

function getDeviceBaseUrl(dev: Device): string {
  const isMacvlan = dev.network_mode === 'macvlan' || dev.is_macvlan === true
  if (isMacvlan) return `http://${dev.ip}:18185/api`
  return `http://${dev.host_ip}:18182/android_api/v2/${dev.id}`
}

async function flowPost<Req, Res>(hostIp: string, path: string, body: Req): Promise<Res> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FLOW_ENGINE_HTTP_TIMEOUT_MS)
  try {
    const res = await fetch(`http://${hostIp}:${FLOW_ENGINE_PORT}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })
    const envelope = (await res.json()) as FlowApiEnvelope<Res>
    if (envelope.code !== 200 || !envelope.data) {
      throw new Error(envelope.message || `flow-engine ${path} failed: code=${envelope.code}`)
    }
    return envelope.data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`flow-engine ${path} timeout after ${FLOW_ENGINE_HTTP_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

const ACTIVE_TASK_STATUSES: readonly FlowTaskShape['status'][] = ['PENDING', 'RUNNING']

// ═══════════════════════════════════════════════════════════
// Composable
// ═══════════════════════════════════════════════════════════

export function useFlowRunner(device: Ref<Device | null>) {
  const taskDeviceId = shallowRef<string | null>(null)
  const isRunning = shallowRef(false)
  const lineStatuses = shallowRef<LineStatusMap>({})
  const lineErrors = shallowRef<LineErrorMap>({})
  /** 最近一次轮询失败原因(供 UI 显示「flow engine 离线」之类提示) */
  const pollError = shallowRef<string | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let commandRanges: CommandRange[] = []
  /** 连续失败计数;到 FLOW_MAX_POLL_FAILURES 标记 engine 不可达 */
  let consecutivePollFails = 0

  const canRun = computed(() => !!device.value && !isRunning.value)

  function clearRuntimeState(): void {
    stopPolling()
    taskDeviceId.value = null
    isRunning.value = false
    lineStatuses.value = {}
    lineErrors.value = {}
    commandRanges = []
  }

  // ── 轮询（链式：上一次完成后才调度下一次）──

  function startPolling() {
    stopPolling()
    consecutivePollFails = 0
    pollError.value = null
    scheduleNext()
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  function scheduleNext() {
    pollTimer = setTimeout(async () => {
      await pollStatus()
      if (isRunning.value) scheduleNext()
    }, FLOW_POLL_INTERVAL_MS)
  }

  async function pollStatus() {
    if (!taskDeviceId.value || !device.value?.host_ip) return
    try {
      const data = await flowPost<{ deviceIds: string[] }, FlowStatusResponse>(
        device.value.host_ip,
        '/flow/status',
        { deviceIds: [taskDeviceId.value] }
      )
      consecutivePollFails = 0
      pollError.value = null

      const statusResult = data.results[0]
      if (!statusResult || !statusResult.found) return

      const task = (statusResult as FlowStatusFoundItem).task
      const { statuses, errors } = extractLineAnnotations(task.steps, commandRanges)
      lineStatuses.value = statuses
      lineErrors.value = errors

      if (task.status === 'COMPLETED' || task.status === 'FAILED' || task.status === 'CANCELLED') {
        isRunning.value = false
        stopPolling()
      }
    } catch (e) {
      consecutivePollFails += 1
      pollError.value = e instanceof Error ? e.message : 'Network error'
      if (consecutivePollFails >= FLOW_MAX_POLL_FAILURES) {
        isRunning.value = false
        stopPolling()
      }
    }
  }

  async function syncStatus(yaml?: string): Promise<SyncStatusResult> {
    if (isRunning.value) return { success: true, active: true }
    if (!device.value?.host_ip) {
      clearRuntimeState()
      return { success: false, active: false, error: 'Missing device' }
    }

    lineStatuses.value = {}
    lineErrors.value = {}

    try {
      const data = await flowPost<{ deviceIds: string[] }, FlowStatusResponse>(
        device.value.host_ip,
        '/flow/status',
        { deviceIds: [device.value.id] }
      )
      consecutivePollFails = 0
      pollError.value = null

      const statusResult = data.results[0]
      if (!statusResult?.found) {
        clearRuntimeState()
        return { success: true, active: false }
      }

      const task = (statusResult as FlowStatusFoundItem).task
      if (!ACTIVE_TASK_STATUSES.includes(task.status)) {
        clearRuntimeState()
        return { success: true, active: false }
      }

      commandRanges = yaml ? parseCommandRanges(yaml) : []
      taskDeviceId.value = task.deviceId
      isRunning.value = true

      if (commandRanges.length > 0) {
        const { statuses, errors } = extractLineAnnotations(task.steps, commandRanges)
        lineStatuses.value = statuses
        lineErrors.value = errors
      }

      startPolling()
      return { success: true, active: true }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to sync flow status'
      pollError.value = message
      clearRuntimeState()
      return { success: false, active: false, error: message }
    }
  }

  // ── 运行 ──

  async function run(yaml: string): Promise<{ success: boolean; error?: string }> {
    if (!device.value?.host_ip || !yaml.trim()) {
      return { success: false, error: 'Missing device or YAML' }
    }

    lineStatuses.value = {}
    lineErrors.value = {}
    taskDeviceId.value = null
    commandRanges = parseCommandRanges(yaml)

    try {
      const data = await flowPost<FlowExecuteRequest, FlowExecuteResponse>(
        device.value.host_ip,
        '/flow/execute',
        {
          yaml,
          devices: [
            {
              baseUrl: getDeviceBaseUrl(device.value),
              deviceId: device.value.id,
              name: device.value.user_name
            }
          ]
        }
      )
      const result = data.results[0]
      if (!result.success) {
        return { success: false, error: (result as any).error ?? 'Device rejected' }
      }
      taskDeviceId.value = result.deviceId
      isRunning.value = true
      startPolling()
      return { success: true }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to connect to flow engine'
      }
    }
  }

  // ── 取消 ──

  async function cancel(): Promise<{ success: boolean; error?: string }> {
    if (!taskDeviceId.value) return { success: false, error: 'No task running' }
    if (!device.value?.host_ip) return { success: false, error: 'No device' }

    try {
      await flowPost<{ deviceIds: string[] }, FlowCancelResponse>(
        device.value.host_ip,
        '/flow/cancel',
        { deviceIds: [taskDeviceId.value] }
      )
      isRunning.value = false
      stopPolling()
      lineStatuses.value = {}
      lineErrors.value = {}
      return { success: true }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to cancel' }
    }
  }

  // ── 清理 ──

  function dispose() {
    stopPolling()
    taskDeviceId.value = null
    isRunning.value = false
    lineStatuses.value = {}
    lineErrors.value = {}
    pollError.value = null
    consecutivePollFails = 0
    commandRanges = []
  }

  return {
    isRunning,
    lineStatuses,
    lineErrors,
    pollError,
    canRun,
    syncStatus,
    run,
    cancel,
    dispose
  }
}
