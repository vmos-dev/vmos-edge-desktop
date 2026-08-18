import type { FlowStepRecord } from '@shared/ipc/flowEngine.api.types'
import type { BatchTaskItemStatus } from '@shared/ipc/batchTask.types'
import { substituteEnvVars } from './envResolver'

export interface ParamTag {
  key: string
  value: string
  accent?: boolean
}

export interface ParsedStep {
  commandKey: string
  label: string
  params: ParamTag[]
  isContainer: boolean
}

export const COMMAND_LABELS: Record<string, string> = {
  tapOnElement: 'Tap',
  tapOnPointV2: 'Tap Point',
  swipeCommand: 'Swipe',
  scrollCommand: 'Scroll',
  scrollUntilVisible: 'Scroll Until Visible',
  backPressCommand: 'Back',
  hideKeyboardCommand: 'Hide Keyboard',
  inputTextCommand: 'Input Text',
  eraseTextCommand: 'Erase Text',
  pressKeyCommand: 'Press Key',
  launchAppCommand: 'Launch App',
  stopAppCommand: 'Stop App',
  killAppCommand: 'Kill App',
  clearStateCommand: 'Clear State',
  openLinkCommand: 'Open Link',
  assertConditionCommand: 'Assert',
  repeatCommand: 'Repeat',
  retryCommand: 'Retry',
  runFlowCommand: 'Run Flow',
  branchCommand: 'Branch',
  defineVariablesCommand: 'Set Variables',
  runScriptCommand: 'Run Script',
  evalScriptCommand: 'Eval Script',
  sleepCommand: 'Sleep',
  copyTextCommand: 'Copy Text',
  setClipboardCommand: 'Set Clipboard',
  pasteTextCommand: 'Paste',
  takeScreenshotCommand: 'Screenshot',
  setLocationCommand: 'Set Location',
  httpRequestCommand: 'HTTP Request',
  waitForAnimationToEndCommand: 'Wait Animation',
  inputRandomCommand: 'Random Input',
  setAirplaneModeCommand: 'Airplane Mode'
}

const SKIP_KEYS = new Set([
  'optional',
  'label',
  'commands',
  'when',
  'config',
  'retryIfNoChange',
  'waitUntilVisible',
  'longPress'
])

const CONTAINER_COMMANDS = new Set([
  'repeatCommand',
  'retryCommand',
  'runFlowCommand',
  'branchCommand'
])

export function parseStep(step: FlowStepRecord, env?: Record<string, string>): ParsedStep {
  const cmd = step.command as Record<string, unknown> | null
  if (!cmd || typeof cmd !== 'object') {
    return { commandKey: '', label: `Step ${step.index + 1}`, params: [], isContainer: false }
  }

  const commandKey = Object.keys(cmd).find((k) => k !== 'when' && cmd[k] != null) ?? ''
  const label = COMMAND_LABELS[commandKey] ?? commandKey
  const hasEnv = env && Object.keys(env).length > 0
  const body = hasEnv ? resolveCommandEnv(cmd[commandKey], env) : cmd[commandKey]
  const isContainer = CONTAINER_COMMANDS.has(commandKey)

  const params: ParamTag[] = []

  if (body == null) return { commandKey, label, params, isContainer }

  if (typeof body === 'string') {
    params.push({ key: 'value', value: body })
    return { commandKey, label, params, isContainer }
  }

  if (typeof body !== 'object') {
    params.push({ key: 'value', value: String(body) })
    return { commandKey, label, params, isContainer }
  }

  const obj = body as Record<string, unknown>

  if ('selector' in obj && obj.selector && typeof obj.selector === 'object') {
    extractSelectorParams(obj.selector as Record<string, unknown>, params)
  }

  if ('condition' in obj && obj.condition && typeof obj.condition === 'object') {
    extractConditionParams(obj.condition as Record<string, unknown>, params)
  }

  for (const [k, v] of Object.entries(obj)) {
    if (SKIP_KEYS.has(k) || k === 'selector' || k === 'condition') continue
    if (v == null || v === false) continue
    if (typeof v === 'object') {
      const s = JSON.stringify(v)
      params.push({ key: k, value: s.length > 50 ? s.slice(0, 47) + '…' : s })
    } else {
      params.push({ key: k, value: String(v) })
    }
  }

  return { commandKey, label, params, isContainer }
}

function resolveCommandEnv(body: unknown, env: Record<string, string>): unknown {
  if (typeof body === 'string') return substituteEnvVars(body, env)
  if (typeof body !== 'object' || body === null) return body

  const obj = { ...(body as Record<string, unknown>) }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      obj[k] = k in env ? env[k] : substituteEnvVars(v, env)
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = { ...(v as Record<string, unknown>) }
      for (const [nk, nv] of Object.entries(nested)) {
        if (typeof nv === 'string') {
          nested[nk] = nk in env ? env[nk] : substituteEnvVars(nv, env)
        }
      }
      obj[k] = nested
    }
  }
  return obj
}

function extractSelectorParams(sel: Record<string, unknown>, params: ParamTag[]) {
  if (sel.textRegex != null)
    params.push({ key: 'text', value: String(sel.textRegex), accent: true })
  if (sel.idRegex != null) params.push({ key: 'id', value: String(sel.idRegex), accent: true })
  for (const [k, v] of Object.entries(sel)) {
    if (k === 'textRegex' || k === 'idRegex' || k === 'optional') continue
    if (v == null || v === false) continue
    if (typeof v === 'object') {
      params.push({ key: k, value: JSON.stringify(v) })
    } else {
      params.push({ key: k, value: String(v) })
    }
  }
}

function extractConditionParams(cond: Record<string, unknown>, params: ParamTag[]) {
  for (const [ck, cv] of Object.entries(cond)) {
    if (cv == null) continue
    if (typeof cv === 'object') {
      const inner = cv as Record<string, unknown>
      const summary = Object.entries(inner)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      params.push({ key: ck, value: summary || '…', accent: true })
    } else {
      params.push({ key: ck, value: String(cv), accent: true })
    }
  }
}

export function stepStatusClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'completed'
    case 'RUNNING':
      return 'running'
    case 'FAILED':
      return 'failed'
    case 'WARNED':
      return 'warned'
    case 'SKIPPED':
      return 'skipped'
    default:
      return 'pending'
  }
}

export function stepIcon(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return '✓'
    case 'RUNNING':
      return '›'
    case 'FAILED':
      return '✕'
    case 'WARNED':
      return '!'
    case 'SKIPPED':
      return '–'
    default:
      return ''
  }
}

export function stepDuration(step: FlowStepRecord): string {
  if (!step.startedAt || !step.completedAt) return ''
  const ms = step.completedAt - step.startedAt
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const ITEM_STATUS_TAG_TYPE: Record<string, '' | 'success' | 'danger' | 'info'> = {
  COMPLETED: 'success',
  FAILED: 'danger',
  RUNNING: ''
}

export function itemStatusTagType(status: BatchTaskItemStatus): '' | 'success' | 'danger' | 'info' {
  return ITEM_STATUS_TAG_TYPE[status] ?? 'info'
}
