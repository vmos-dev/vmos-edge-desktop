import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CreateWorkflowPayload,
  ListWorkflowsPayload,
  UpdateWorkflowPayload,
  Workflow,
  WorkflowListItem
} from '@shared/ipc/workflow.types'
import { useWorkflowDocument } from '../useWorkflowDocument'

interface MockRepository {
  list: (params?: ListWorkflowsPayload) => Promise<WorkflowListItem[]>
  get: (id: string) => Promise<Workflow | null>
  create: (payload: CreateWorkflowPayload) => Promise<Workflow>
  update: (id: string, patch: UpdateWorkflowPayload['patch']) => Promise<Workflow>
  remove: (id: string) => Promise<boolean>
}

function createMockRepository(overrides: Partial<MockRepository> = {}): MockRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    ...overrides
  }
}

describe('useWorkflowDocument', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads an existing workflow into text + meta', async () => {
    const existing: Workflow = {
      id: 'wf-1',
      name: 'Demo',
      appId: 'com.demo.app',
      appName: 'Demo App',
      steps: [
        {
          id: 'ignored',
          action: 'tapOn',
          stability: 'ok',
          selector: { primary: { type: 'text', value: 'Login', stabilityScore: 80 } },
          metadata: { elementType: 'unknown', capturedAt: 1 }
        }
      ],
      createdAt: 1,
      updatedAt: 2
    }
    const repo = createMockRepository({ get: vi.fn().mockResolvedValue(existing) })
    const doc = useWorkflowDocument(repo)

    await doc.openExisting('wf-1')

    expect(repo.get).toHaveBeenCalledWith('wf-1')
    expect(doc.text.value).toContain('appId')
    expect(doc.text.value).toContain('tapOn')
    expect(doc.steps.value).toHaveLength(1)
    expect(doc.steps.value[0].id).toBe('0') // path-based id
    expect(doc.isDirty.value).toBe(false)
  })

  it('starts a new draft from a seed (yaml + meta initialized + launchApp prepended)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123)
    const repo = createMockRepository()
    const doc = useWorkflowDocument(repo)

    doc.startNew({
      name: 'Demo',
      appId: 'com.demo.app',
      appName: 'Demo App',
      defaultDeviceId: 'device-1'
    })

    expect(doc.isLoaded.value).toBe(true)
    expect(doc.isNew.value).toBe(true)
    expect(doc.text.value).toContain('appId')
    expect(doc.text.value).toContain('com.demo.app')
    expect(doc.workflow.value?.appName).toBe('Demo App')
    expect(doc.workflow.value?.defaultDeviceId).toBe('device-1')
    expect(doc.workflow.value?.createdAt).toBe(123)
    // 新建即视为脏(未持久化)
    expect(doc.isDirty.value).toBe(true)
    // 任何新工作流第一步固定是 launchApp,避免脚本一开始没启动应用就操作
    expect(doc.steps.value).toHaveLength(1)
    expect(doc.steps.value[0].action).toBe('launchApp')
    expect(doc.text.value).toContain('launchApp')
  })

  it('YAML edit reflects in steps (text-as-truth, real-time)', () => {
    const doc = useWorkflowDocument(createMockRepository())
    doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })

    doc.setText(`appId: "com.demo.app"
name: "YAML Demo"
---
- tapOn: "Confirm"
- inputText: "hello"
`)

    expect(doc.steps.value).toHaveLength(2)
    expect(doc.steps.value[0].action).toBe('tapOn')
    expect(doc.steps.value[1].action).toBe('inputText')
    expect(doc.workflow.value?.name).toBe('YAML Demo')
  })

  it('marks invalid YAML and exposes errors without dropping the text', () => {
    const doc = useWorkflowDocument(createMockRepository())
    doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })

    doc.setText('invalid: [')

    expect(doc.hasYamlError.value).toBe(true)
    expect(doc.yamlErrors.value.length).toBeGreaterThan(0)
    expect(doc.text.value).toBe('invalid: [') // 文本未被回滚
    expect(doc.workflow.value).toBeNull() // 不可拼装 workflow → 不可保存
  })

  it('keeps display metadata when YAML becomes invalid', () => {
    const doc = useWorkflowDocument(createMockRepository())
    doc.startNew({
      name: 'Demo',
      appId: 'com.demo.app',
      appName: 'Demo App',
      defaultDeviceId: 'device-1'
    })

    doc.setText('invalid: [')

    expect(doc.workflow.value).toBeNull()
    expect(doc.displayMeta.value?.appId).toBe('com.demo.app')
    expect(doc.displayMeta.value?.defaultDeviceId).toBe('device-1')
  })

  it('removeStep applies a surgical text edit (yaml stays in sync)', () => {
    const doc = useWorkflowDocument(createMockRepository())
    doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
    doc.setText(`appId: "com.demo.app"
---
- tapOn: "A"
- tapOn: "B"
- tapOn: "C"
`)

    expect(doc.steps.value).toHaveLength(3)
    doc.removeStep('1') // 删中间一条

    expect(doc.steps.value).toHaveLength(2)
    expect(doc.steps.value[0].selector?.primary.value).toBe('A')
    expect(doc.steps.value[1].selector?.primary.value).toBe('C')
    expect(doc.text.value).not.toContain('"B"')
  })

  it('updateStep patches a field by id', () => {
    const doc = useWorkflowDocument(createMockRepository())
    doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
    doc.setText(`appId: "com.demo.app"
---
- tapOn: "Old"
`)

    doc.updateStep('0', { label: 'my-label' })

    expect(doc.text.value).toContain('label')
    expect(doc.text.value).toContain('my-label')
    expect(doc.steps.value[0].label).toBe('my-label')
  })

  it('append + insertAfter both update text', () => {
    const doc = useWorkflowDocument(createMockRepository())
    doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
    doc.setText(`appId: "com.demo.app"
---
- tapOn: "First"
`)

    doc.append({
      action: 'tapOn',
      stability: 'ok',
      selector: { primary: { type: 'text', value: 'Last', stabilityScore: 80 } },
      metadata: { elementType: 'button', capturedAt: 1 }
    })

    expect(doc.steps.value).toHaveLength(2)
    expect(doc.steps.value[1].selector?.primary.value).toBe('Last')

    doc.insertAfter('0', {
      action: 'tapOn',
      stability: 'ok',
      selector: { primary: { type: 'text', value: 'Middle', stabilityScore: 80 } },
      metadata: { elementType: 'button', capturedAt: 1 }
    })

    expect(doc.steps.value).toHaveLength(3)
    expect(doc.steps.value.map((s) => s.selector?.primary.value)).toEqual([
      'First',
      'Middle',
      'Last'
    ])
  })

  it('save() does atomic create-with-steps for new workflows (single IPC) and clears dirty', async () => {
    const repo = createMockRepository({
      create: vi.fn().mockResolvedValue({
        id: 'wf-created',
        name: 'YAML Demo',
        appId: 'com.demo.app',
        appName: 'Demo App',
        steps: [
          {
            id: '0',
            action: 'tapOn',
            stability: 'ok',
            selector: { primary: { type: 'text', value: 'Confirm', stabilityScore: 80 } },
            metadata: { elementType: 'unknown', capturedAt: 1 }
          }
        ],
        createdAt: 10,
        updatedAt: 10
      })
    })
    const doc = useWorkflowDocument(repo)

    doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
    doc.setText(`appId: "com.demo.app"
name: "YAML Demo"
---
- tapOn: "Confirm"
`)

    const ok = await doc.save()
    expect(ok).toBe(true)
    expect(repo.create).toHaveBeenCalledTimes(1)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'YAML Demo',
        appId: 'com.demo.app',
        steps: expect.any(Array)
      })
    )
    // 关键:新建路径不再走 update —— 不能让两段提交回归
    expect(repo.update).not.toHaveBeenCalled()
    expect(doc.isNew.value).toBe(false)
    expect(doc.isDirty.value).toBe(false)
  })

  it('openExisting 优先用 persisted.yamlText 而不是 stepsToYaml 重建', async () => {
    const originalYaml = `appId: "com.demo.app"
name: "演示"
# 我写的注释
---
- tapOn: "登录"
- sleep: [300, 500]
`
    const existing: Workflow = {
      id: 'wf-z',
      name: '演示',
      appId: 'com.demo.app',
      appName: 'Demo',
      steps: [], // 空也没关系,因为会优先用 yamlText
      yamlText: originalYaml,
      createdAt: 1,
      updatedAt: 2
    }
    const repo = createMockRepository({ get: vi.fn().mockResolvedValue(existing) })
    const doc = useWorkflowDocument(repo)

    await doc.openExisting('wf-z')
    // 字节级保留:引号、flow seq、注释都在
    expect(doc.text.value).toBe(originalYaml)
  })

  it('openExisting 对老数据(无 yamlText)回退到 stepsToYaml 重建,保持兼容', async () => {
    const legacy: Workflow = {
      id: 'legacy',
      name: 'legacy',
      appId: 'com.legacy',
      appName: 'Legacy',
      steps: [
        {
          id: '0',
          action: 'tapOn',
          stability: 'ok',
          selector: { primary: { type: 'text', value: 'A', stabilityScore: 80 } },
          metadata: { elementType: 'unknown', capturedAt: 1 }
        }
      ],
      // yamlText 未定义 → 走 fallback
      createdAt: 1,
      updatedAt: 2
    }
    const repo = createMockRepository({ get: vi.fn().mockResolvedValue(legacy) })
    const doc = useWorkflowDocument(repo)
    await doc.openExisting('legacy')
    expect(doc.text.value).toContain('tapOn')
    expect(doc.text.value).toContain('A')
  })

  it('save() 把 yamlText 一并传给 repository,保证下次 load 能还原风格', async () => {
    const userYaml = `appId: "com.demo.app"
---
- tapOn: "登录"
`
    const repo = createMockRepository({
      get: vi.fn().mockResolvedValue({
        id: 'wf-s',
        name: '',
        appId: 'com.demo.app',
        appName: '',
        steps: [],
        yamlText: userYaml,
        createdAt: 1,
        updatedAt: 2
      } as Workflow),
      update: vi.fn().mockImplementation(async (_id, patch) => ({
        id: 'wf-s',
        name: '',
        appId: 'com.demo.app',
        appName: '',
        ...patch,
        createdAt: 1,
        updatedAt: 99
      }))
    })
    const doc = useWorkflowDocument(repo)
    await doc.openExisting('wf-s')
    doc.setText(userYaml + '- sleep: 100\n')
    await doc.save()

    expect(repo.update).toHaveBeenCalledTimes(1)
    const patchArg = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(patchArg.yamlText).toBe(userYaml + '- sleep: 100\n')
    expect(patchArg.steps).toBeDefined()
  })

  it('save() 自动规范缩进但保留引号 / flow 风格 / 注释', async () => {
    // 用户用了杂乱缩进,但写了双引号和 flow 风格
    const messy = `appId: "com.demo.app"
---
-   tapOn: "登录"
-     sleep: [300, 500]
`
    const existing: Workflow = {
      id: 'wf-fmt',
      name: '',
      appId: 'com.demo.app',
      appName: '',
      steps: [],
      createdAt: 1,
      updatedAt: 2
    }
    const repo = createMockRepository({
      get: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockImplementation(async (_id, patch) => ({
        ...existing,
        ...patch,
        updatedAt: 99
      }))
    })
    const doc = useWorkflowDocument(repo)
    await doc.openExisting('wf-fmt')
    doc.setText(messy)

    await doc.save()

    // 缩进被规范化(行首 `-` 后单空格)
    expect(doc.text.value).toMatch(/^- tapOn:/m)
    expect(doc.text.value).toMatch(/^- sleep:/m)
    // 引号保留
    expect(doc.text.value).toContain('"登录"')
    expect(doc.text.value).toContain('"com.demo.app"')
    // flow 保留
    expect(doc.text.value).toMatch(/\[300,\s*500\]/)

    // 传给后端的 yamlText 是格式化后的版本
    const patchArg = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(patchArg.yamlText).toBe(doc.text.value)
  })

  it('save() 保留用户原 YAML 文本,不因往返重建而丢引号 / flow / 顺序', async () => {
    const userYaml = `appId: "com.demo.app"
name: "演示"
---
- tapOn: "登录"
- sleep: [300, 500]
- scrollUntilVisible:
    direction: UP
    element:
      text: "Hop Mania"
`
    const existing: Workflow = {
      id: 'wf-x',
      name: '演示',
      appId: 'com.demo.app',
      appName: 'Demo',
      steps: [],
      createdAt: 1,
      updatedAt: 2
    }
    const repo = createMockRepository({
      get: vi.fn().mockResolvedValue(existing),
      update: vi.fn().mockImplementation(async (_id, patch) => ({
        ...existing,
        ...patch,
        updatedAt: 99
      }))
    })
    const doc = useWorkflowDocument(repo)
    await doc.openExisting('wf-x')
    doc.setText(userYaml)

    const ok = await doc.save()
    expect(ok).toBe(true)

    // 核心断言:text 未被重建,用户的引号/flow seq/缩进原样保留
    expect(doc.text.value).toBe(userYaml)
    expect(doc.text.value).toContain('"登录"')
    expect(doc.text.value).toContain('[300, 500]')
    expect(doc.text.value).toContain('"Hop Mania"')

    // meta 来自后端(updatedAt 99)
    expect(doc.isDirty.value).toBe(false)
    expect(doc.isNew.value).toBe(false)
  })

  it('discard reverts to last persisted snapshot', async () => {
    const existing: Workflow = {
      id: 'wf-1',
      name: 'Demo',
      appId: 'com.demo.app',
      appName: 'Demo App',
      steps: [],
      createdAt: 1,
      updatedAt: 2
    }
    const repo = createMockRepository({ get: vi.fn().mockResolvedValue(existing) })
    const doc = useWorkflowDocument(repo)

    await doc.openExisting('wf-1')
    const baseText = doc.text.value
    doc.setText(`${baseText}\n# scratch comment`)
    expect(doc.isDirty.value).toBe(true)

    doc.discard()
    expect(doc.text.value).toBe(baseText)
    expect(doc.isDirty.value).toBe(false)
  })

  it('canLeave reports invalid-yaml when text has parse error', () => {
    const doc = useWorkflowDocument(createMockRepository())
    doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
    doc.setText('invalid: [')

    expect(doc.canLeave()).toEqual({ kind: 'invalid-yaml' })
  })

  it('canLeave reports dirty-valid when text differs but parses', async () => {
    const existing: Workflow = {
      id: 'wf-1',
      name: 'Demo',
      appId: 'com.demo.app',
      appName: 'Demo App',
      steps: [],
      createdAt: 1,
      updatedAt: 2
    }
    const repo = createMockRepository({ get: vi.fn().mockResolvedValue(existing) })
    const doc = useWorkflowDocument(repo)

    await doc.openExisting('wf-1')
    doc.setText(`appId: "com.demo.app"
---
- tapOn: "A"
`)
    expect(doc.canLeave()).toEqual({ kind: 'dirty-valid' })
  })

  it('setAppBinding updates yaml appId and metadata side fields', () => {
    const doc = useWorkflowDocument(createMockRepository())
    doc.startNew({ name: 'Demo', appId: 'old.id', appName: 'Old' })

    doc.setAppBinding({
      appId: 'new.id',
      appName: 'New App',
      defaultDeviceId: 'dev-1'
    })

    expect(doc.text.value).toContain('new.id')
    expect(doc.workflow.value?.appName).toBe('New App')
    expect(doc.workflow.value?.defaultDeviceId).toBe('dev-1')
  })

  describe('addStep · 手动添加(走 actionRegistry.defaultBody)', () => {
    it('appends to root with the registry default body', () => {
      const doc = useWorkflowDocument(createMockRepository())
      doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
      const before = doc.steps.value.length

      doc.addStep('sleep')

      const after = doc.steps.value
      expect(after.length).toBe(before + 1)
      expect(after[after.length - 1].action).toBe('sleep')
      // sleep 默认 body 是 1000
      expect(doc.text.value).toMatch(/sleep:\s*1000/)
    })

    it('inserts after a specific step when afterStepId is provided', () => {
      const doc = useWorkflowDocument(createMockRepository())
      doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
      doc.setText(`appId: "com.demo.app"
---
- tapOn: "A"
- tapOn: "C"
`)

      doc.addStep('back', { afterStepId: '0' })

      const list = doc.steps.value
      expect(list).toHaveLength(3)
      expect(list[1].action).toBe('back')
      expect(list[2].action).toBe('tapOn')
    })

    it('writes bare form for actions whose defaultBody is undefined', () => {
      const doc = useWorkflowDocument(createMockRepository())
      doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
      doc.addStep('back')

      // back 默认 body=undefined → 应写成裸字符串 `- back`
      expect(doc.text.value).toMatch(/-\s+back\s*\n/)
    })

    it('ignores unknown actionId silently', () => {
      const doc = useWorkflowDocument(createMockRepository())
      doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
      const before = doc.text.value
      doc.addStep('totallyMadeUp')
      expect(doc.text.value).toBe(before)
    })

    it('does nothing when YAML has parse error (gated)', () => {
      const doc = useWorkflowDocument(createMockRepository())
      doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
      doc.setText('invalid: [')
      doc.addStep('back')
      expect(doc.text.value).toBe('invalid: [')
    })
  })

  describe('editStepBody · 表单回写', () => {
    it('replaces the step body wholesale', () => {
      const doc = useWorkflowDocument(createMockRepository())
      doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
      doc.setText(`appId: "com.demo.app"
---
- tapOn: "old"
`)

      doc.editStepBody('0', 'tapOn', { text: 'new', index: 1 })

      expect(doc.text.value).toMatch(/text:\s*"?new"?/)
      expect(doc.text.value).toMatch(/index:\s*1/)
    })

    it('downgrades object body to bare form when body is undefined', () => {
      const doc = useWorkflowDocument(createMockRepository())
      doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
      doc.setText(`appId: "com.demo.app"
---
- back: true
`)

      doc.editStepBody('0', 'back', undefined)

      expect(doc.text.value).toMatch(/-\s+back\s*\n/)
      expect(doc.text.value).not.toMatch(/back:\s*true/)
    })

    it('ignores when action is not in the registry', () => {
      const doc = useWorkflowDocument(createMockRepository())
      doc.startNew({ name: 'Demo', appId: 'com.demo.app', appName: 'Demo App' })
      const before = doc.text.value
      doc.editStepBody('0', 'totallyMadeUp', { foo: 'bar' })
      expect(doc.text.value).toBe(before)
    })
  })
})
