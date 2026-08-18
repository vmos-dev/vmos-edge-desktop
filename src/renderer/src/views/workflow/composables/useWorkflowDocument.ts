/**
 * useWorkflowDocument · 工作流编辑会话(单源:YAML 文本)
 *
 * 架构原则:
 *  - 唯一可写状态 = `text`(YAML 文本)+ `metadata`(YAML 不承载的字段)
 *  - steps / config / errors 全部从 text 派生(computed)
 *  - 可视化端的所有 op 都翻译成 yamlOps 文本补丁,写回 text
 *  - 这样 visual 和 yaml 编辑器天然实时同步,不需要任何手动 push
 *
 * metadata 是 YAML 之外的字段(appName / appIcon / defaultDeviceId / createdAt / updatedAt / id):
 *  - 这些不进 YAML(YAML schema 里没有);只在保存时拼回去
 *
 * 保存:Ctrl+S / Save 按钮 → save() → repository.update(或 create→update)
 */

import { computed, ref, shallowRef, type Ref } from 'vue'
import type { CreateWorkflowPayload, Step, Workflow } from '@shared/ipc/workflow.types'
import { stepsToYaml } from '../utils/stepsToYaml'
import { formatYaml } from '../utils/formatYaml'
import { parseYamlDocument } from '../utils/yamlDocument'
import {
  appendStep,
  appendStepInContainerWithBody,
  appendStepWithBody,
  deleteStep,
  duplicateStep,
  insertStepAfter,
  insertStepAfterWithBody,
  patchStep,
  reorderSteps,
  setConfigField,
  setStepBody
} from '../utils/yamlOps'
import { ACTION_REGISTRY } from '../utils/actionRegistry'
import type { WorkflowRepository } from './useWorkflowRepository'

const NEW_WORKFLOW_ID = '__new__'
const PENDING_SEED_KEY = 'workflow:pendingSeed'

export type WorkflowLeaveDecision =
  | { kind: 'clean' }
  | { kind: 'dirty-valid' }
  | { kind: 'invalid-yaml' }

// ═══════════════ 新建草稿的 seed 临时存储 ═══════════════
// 列表页确认设备/应用 → 跳到 /workflow/new 这两步之间用 sessionStorage 透传 seed,
// 而不是 history.state(可能在直链 / 跨标签场景丢失)。
// 一次性消费:EditView 读完立即清除,避免下次 /workflow/new 误用旧 seed。

/** 列表页确认后写入 */
export function setPendingNewWorkflowSeed(seed: CreateWorkflowPayload | null): void {
  if (seed) {
    sessionStorage.setItem(PENDING_SEED_KEY, JSON.stringify(seed))
  } else {
    sessionStorage.removeItem(PENDING_SEED_KEY)
  }
}

/** EditView 读取并消费(读完即清) */
export function consumePendingNewWorkflowSeed(): CreateWorkflowPayload | null {
  const json = sessionStorage.getItem(PENDING_SEED_KEY)
  if (!json) return null
  sessionStorage.removeItem(PENDING_SEED_KEY)
  try {
    return JSON.parse(json) as CreateWorkflowPayload
  } catch {
    return null
  }
}

/** YAML 之外但属于工作流的字段 */
interface DocumentMeta {
  id: string
  appId: string
  appName: string
  appIcon?: string
  appVersion?: string
  defaultDeviceId?: string
  createdAt: number
  updatedAt: number
}

interface Snapshot {
  text: string
  meta: DocumentMeta
}

function workflowToInitial(workflow: Workflow): Snapshot {
  // 优先用后端存的原始 YAML 文本(保留引号 / flow / 顺序 / 注释);
  // 为空(老数据未保存过原文本)则从 steps 反向重建 —— 仍可用,只是失去风格细节
  const text = workflow.yamlText ?? stepsToYaml(workflow)
  return {
    text,
    meta: {
      id: workflow.id,
      appId: workflow.appId,
      appName: workflow.appName,
      appIcon: workflow.appIcon,
      appVersion: workflow.appVersion,
      defaultDeviceId: workflow.defaultDeviceId,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    }
  }
}

/**
 * 新建工作流的初始 launchApp 步骤
 *
 * 任何工作流的第一步都是「启动应用」 —— 没有它脚本根本运行不起来。
 * 在创建时硬植入,避免每次都让用户手动加。stepsToYaml 会把它输出成 `- launchApp`,
 * 引擎结合 config 段的 appId 自动启目标应用。
 *
 * id 在这里随便给(占位),解析回来时 yamlDocument 会按路径重新分配 path-encoded id。
 */
function buildInitialLaunchAppStep(now: number): Step {
  return {
    id: '__launch__',
    action: 'launchApp',
    stability: 'ok',
    metadata: {
      elementType: 'unknown',
      capturedAt: now
    }
  }
}

function seedToInitial(seed: CreateWorkflowPayload): Snapshot {
  const now = Date.now()
  const text = stepsToYaml({
    appId: seed.appId,
    name: seed.name,
    steps: [buildInitialLaunchAppStep(now)]
  })
  return {
    text,
    meta: {
      id: NEW_WORKFLOW_ID,
      appId: seed.appId,
      appName: seed.appName,
      appIcon: seed.appIcon,
      appVersion: seed.appVersion,
      defaultDeviceId: seed.defaultDeviceId,
      createdAt: now,
      updatedAt: now
    }
  }
}

function metaEqual(a: DocumentMeta, b: DocumentMeta): boolean {
  return (
    a.id === b.id &&
    a.appId === b.appId &&
    a.appName === b.appName &&
    a.appIcon === b.appIcon &&
    a.appVersion === b.appVersion &&
    a.defaultDeviceId === b.defaultDeviceId &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt
  )
}

function snapshotsEqual(a: Snapshot | null, b: Snapshot | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.text !== b.text) return false
  return metaEqual(a.meta, b.meta)
}

export function useWorkflowDocument(repository: WorkflowRepository) {
  // ═══ source of truth ═══
  const text = ref<string>('')
  const meta = ref<DocumentMeta | null>(null)
  const baseSnapshot = ref<Snapshot | null>(null)

  // ═══ session state ═══
  const isNew = shallowRef(false)
  const isSaving = shallowRef(false)
  const error = shallowRef<string | null>(null)

  // ═══ 派生 ═══
  const parsed = computed(() => parseYamlDocument(text.value))
  const steps = computed<Step[]>(() => parsed.value.steps)
  const yamlMeta = computed(() => parsed.value.meta)
  const yamlErrors = computed<string[]>(() => parsed.value.errors)
  const hasYamlError = computed(() => yamlErrors.value.length > 0)

  const isLoaded = computed(() => meta.value !== null)
  const currentSnapshot = computed<Snapshot | null>(() =>
    meta.value ? { text: text.value, meta: meta.value } : null
  )
  const isDirty = computed(() => !snapshotsEqual(baseSnapshot.value, currentSnapshot.value))

  // ─────────────────────────────────────────────────────────────────────────
  // workflow computed 拆成两个,明确职责(架构:混职责是 YAML 错 → 云机整块被隐藏
  // 的根因。两个 computed 都依赖 meta/parsed,但对"YAML 错"做不同响应):
  //
  //   - displayMeta: UI 显示用。meta 加载即有值,**不**受 YAML 错影响。
  //     云机画面、顶栏、侧栏骨架都用它 → YAML 错也不会让整块消失。
  //
  //   - workflow:    save/run 用。YAML 解析失败时返回 null,作为"当前状态不可
  //                  持久化"的信号。EditActionBar 据此禁用保存/运行按钮。
  //
  // 调用方选用哪个体现了明确意图:需要"能跑的数据" vs "能画的数据"。
  // ─────────────────────────────────────────────────────────────────────────

  /** 显示用的元信息(meta 加载即有值,忽略 YAML 错) */
  const displayMeta = computed<Workflow | null>(() => {
    if (!meta.value) return null
    const m = yamlMeta.value
    return {
      id: meta.value.id,
      name: m.name ?? meta.value.appName ?? '',
      appId: m.appId ?? meta.value.appId,
      appName: meta.value.appName,
      appIcon: meta.value.appIcon,
      appVersion: meta.value.appVersion,
      defaultDeviceId: meta.value.defaultDeviceId,
      steps: parsed.value.steps,
      env: m.env,
      tags: m.tags,
      createdAt: meta.value.createdAt,
      updatedAt: meta.value.updatedAt
    }
  })

  /** 可保存/可运行的 Workflow(YAML 解析失败时返回 null,阻断 save/run) */
  const workflow = computed<Workflow | null>(() => {
    if (hasYamlError.value) return null
    return displayMeta.value
  })

  const canSave = computed(
    () => isLoaded.value && !hasYamlError.value && isDirty.value && !isSaving.value
  )

  // ═══ 文本写入(YAML 编辑器侧) ═══
  function setText(next: string): void {
    if (next === text.value) return
    text.value = next
  }

  // ═══ 可视化侧 op:全部走 yamlOps 文本补丁 ═══
  function gateForOp(): boolean {
    if (!isLoaded.value) return false
    if (hasYamlError.value) return false
    return true
  }

  function removeStep(id: string): void {
    if (!gateForOp()) return
    const next = deleteStep(text.value, id)
    if (next !== text.value) text.value = next
  }

  function updateStep(id: string, patch: Partial<Omit<Step, 'id'>>): void {
    if (!gateForOp()) return
    const next = patchStep(text.value, id, patch)
    if (next !== text.value) text.value = next
  }

  function duplicate(id: string): void {
    if (!gateForOp()) return
    const next = duplicateStep(text.value, id)
    if (next !== text.value) text.value = next
  }

  function insertAfter(afterId: string, step: Omit<Step, 'id'>): void {
    if (!gateForOp()) return
    const next = insertStepAfter(text.value, afterId, step)
    if (next !== text.value) text.value = next
  }

  function append(step: Omit<Step, 'id'>): void {
    if (!gateForOp()) return
    const next = appendStep(text.value, step)
    if (next !== text.value) text.value = next
  }

  function appendBatch(stepsToAdd: Array<Omit<Step, 'id'>>): void {
    if (!gateForOp() || stepsToAdd.length === 0) return
    let next = text.value
    for (const step of stepsToAdd) next = appendStep(next, step)
    if (next !== text.value) text.value = next
  }

  function reorder(parentId: string | null, from: number, to: number): void {
    if (!gateForOp()) return
    const next = reorderSteps(text.value, parentId, from, to)
    if (next !== text.value) text.value = next
  }

  // ═══ Schema-driven 表单 / 手动添加(走 yamlOps body 操作,绕 Step 拆分模型) ═══

  /**
   * 替换某 step 的整体 body(配合 schema 表单使用 - 表单读 body / 改 / 写回)
   * action 从 ACTION_REGISTRY 取(注册过的 action 才能改);未注册的 action 不动
   */
  function editStepBody(stepId: string, action: string, body: unknown): void {
    if (!gateForOp()) return
    if (!ACTION_REGISTRY[action]) return
    const next = setStepBody(text.value, stepId, action, body)
    if (next !== text.value) text.value = next
  }

  /**
   * 手动添加一个步骤 —— 用 actionRegistry.defaultBody 填默认值
   *  opts.afterStepId  → 在该 step 之后插入(同级)
   *  opts.parentStepId → 追加到容器(repeat/retry/runFlow)的 commands 末尾
   *  都不传        → 追加到根 commands 末尾
   * 三个互斥(优先级:afterStepId > parentStepId > 根)
   */
  function addStep(
    actionId: string,
    opts: { afterStepId?: string; parentStepId?: string } = {}
  ): void {
    if (!gateForOp()) return
    const def = ACTION_REGISTRY[actionId]
    if (!def) return
    const body = def.defaultBody()

    let nextText: string
    if (opts.afterStepId) {
      nextText = insertStepAfterWithBody(text.value, opts.afterStepId, actionId, body)
    } else if (opts.parentStepId) {
      nextText = appendStepInContainerWithBody(text.value, opts.parentStepId, actionId, body)
    } else {
      nextText = appendStepWithBody(text.value, actionId, body)
    }
    if (nextText !== text.value) text.value = nextText
  }

  // ═══ metadata 写入(非 YAML 字段) ═══
  function updateMeta(patch: Partial<DocumentMeta>): void {
    if (!meta.value) return
    meta.value = { ...meta.value, ...patch }
  }

  function rename(name: string): void {
    if (hasYamlError.value || !name) return
    const next = setConfigField(text.value, 'name', name)
    if (next !== text.value) text.value = next
  }

  /** 同时改 YAML 的 appId 和 metadata 字段(切换设备/应用) */
  function setAppBinding(payload: {
    appId?: string
    appName?: string
    appIcon?: string
    appVersion?: string
    defaultDeviceId?: string
  }): void {
    if (!meta.value) return
    if (payload.appId !== undefined && !hasYamlError.value) {
      const next = setConfigField(text.value, 'appId', payload.appId)
      if (next !== text.value) text.value = next
    }
    const metaPatch: Partial<DocumentMeta> = {}
    if (payload.appName !== undefined) metaPatch.appName = payload.appName
    if (payload.appIcon !== undefined) metaPatch.appIcon = payload.appIcon
    if (payload.appVersion !== undefined) metaPatch.appVersion = payload.appVersion
    if (payload.defaultDeviceId !== undefined) metaPatch.defaultDeviceId = payload.defaultDeviceId
    if (Object.keys(metaPatch).length > 0) updateMeta(metaPatch)
  }

  // ═══ 会话生命周期 ═══

  function loadSnapshot(snapshot: Snapshot, options: { isNew: boolean }): void {
    text.value = snapshot.text
    meta.value = { ...snapshot.meta }
    // 新建未保存的草稿:base 设为 null,使 isDirty=true,直到首次 save 才落盘成基线
    baseSnapshot.value = options.isNew ? null : { text: snapshot.text, meta: { ...snapshot.meta } }
    isNew.value = options.isNew
    error.value = null
  }

  /**
   * save 成功后更新基线 —— 保留当前 YAML 原文,不从 Step[] 反向重建。
   *
   * 为什么不用 loadSnapshot(workflowToInitial(persisted)):
   *   workflowToInitial 调 stepsToYaml 从 Step[] 重建 YAML,过程中 yaml 库
   *   对"安全"字符串默认 emit PLAIN(无引号),用户原本写的 "登录" 会变成 登录;
   *   flow 风格、map 键顺序、注释等也会被规范化。用户期望"保存只处理持久化,
   *   不动我的文本"。
   *
   * 原则:客户端当前 text 已通过 hasYamlError 校验,能进 save 就是合法 YAML。
   *      直接把它作为新基线,meta 用后端返回的(id / updatedAt 等后端权威字段)。
   */
  function rebaselineFromPersisted(persisted: Workflow): void {
    const nextMeta: DocumentMeta = {
      id: persisted.id,
      appId: persisted.appId,
      appName: persisted.appName,
      appIcon: persisted.appIcon,
      appVersion: persisted.appVersion,
      defaultDeviceId: persisted.defaultDeviceId,
      createdAt: persisted.createdAt,
      updatedAt: persisted.updatedAt
    }
    meta.value = nextMeta
    baseSnapshot.value = { text: text.value, meta: { ...nextMeta } }
    isNew.value = false
    error.value = null
  }

  async function openExisting(id: string): Promise<void> {
    error.value = null
    const wf = await repository.get(id)
    if (!wf) {
      close()
      return
    }
    loadSnapshot(workflowToInitial(wf), { isNew: false })
  }

  function startNew(seed: CreateWorkflowPayload): void {
    loadSnapshot(seedToInitial(seed), { isNew: true })
  }

  async function save(): Promise<boolean> {
    const wf = workflow.value
    if (!wf || !meta.value || hasYamlError.value) return false

    isSaving.value = true
    error.value = null
    try {
      // save 时顺手规范缩进 —— formatYaml 只动空白,保留引号 / flow / 注释 / 键顺序。
      // 规范化结果会作为新的 text 基线,下次 load 也拿这份已格式化的版本。
      const formatted = formatYaml(text.value)
      if (formatted !== text.value) text.value = formatted

      // yamlText 是用户当前编辑的 YAML 原文(已格式化),和 steps 同源(已通过 hasYamlError 校验)。
      // 一并传给后端,下次 load 时可字节级还原用户风格,避免重建丢引号/flow/注释。
      const yamlText = text.value
      let persisted: Workflow
      if (isNew.value) {
        // 单事务 IPC:create 直接带上 steps/env/tags,避免两段提交中间失败留脏数据
        persisted = await repository.create({
          name: wf.name,
          appId: wf.appId,
          appName: wf.appName,
          appIcon: wf.appIcon,
          appVersion: wf.appVersion,
          defaultDeviceId: wf.defaultDeviceId,
          steps: wf.steps,
          env: wf.env,
          tags: wf.tags,
          yamlText
        })
      } else {
        persisted = await repository.update(wf.id, {
          name: wf.name,
          appId: wf.appId,
          appName: wf.appName,
          appIcon: wf.appIcon,
          appVersion: wf.appVersion,
          defaultDeviceId: wf.defaultDeviceId,
          steps: wf.steps,
          env: wf.env,
          tags: wf.tags,
          yamlText
        })
      }

      // 保留当前 YAML 原文作新基线,只同步后端的 meta;避免重建丢引号/flow/注释等
      rebaselineFromPersisted(persisted)
      return true
    } catch (saveError) {
      error.value = saveError instanceof Error ? saveError.message : String(saveError)
      return false
    } finally {
      isSaving.value = false
    }
  }

  function discard(): void {
    if (baseSnapshot.value) {
      const snap = baseSnapshot.value
      text.value = snap.text
      meta.value = { ...snap.meta }
    } else {
      close()
    }
    error.value = null
  }

  function canLeave(): WorkflowLeaveDecision {
    if (hasYamlError.value) return { kind: 'invalid-yaml' }
    if (isDirty.value) return { kind: 'dirty-valid' }
    return { kind: 'clean' }
  }

  function close(): void {
    text.value = ''
    meta.value = null
    baseSnapshot.value = null
    isNew.value = false
    isSaving.value = false
    error.value = null
  }

  return {
    // state(只读对外暴露)
    text: text as Readonly<Ref<string>>,
    steps,
    yamlMeta,
    yamlErrors,
    hasYamlError,
    isDirty,
    isLoaded,
    isNew,
    isSaving,
    error,
    canSave,
    workflow,
    displayMeta,

    // YAML 编辑器侧
    setText,

    // 可视化侧 ops
    removeStep,
    updateStep,
    duplicate,
    insertAfter,
    append,
    appendBatch,
    reorder,
    updateMeta,
    rename,
    setAppBinding,

    // schema-driven 表单 / 手动添加
    addStep,
    editStepBody,

    // 会话
    openExisting,
    startNew,
    save,
    discard,
    canLeave,
    close
  }
}

export type WorkflowDocument = ReturnType<typeof useWorkflowDocument>
