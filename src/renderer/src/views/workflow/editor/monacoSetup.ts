/**
 * Monaco Editor 全局配置 + per-editor model 工厂
 *
 * 全局副作用（Worker 补丁、MonacoEnvironment、monaco-yaml schema 注册）
 * 只执行一次。Model 不再共享单例 —— 每个 YamlEditor 实例自己创建/销毁,
 * 避免跨 mount 残留旧文本(切工作流时拿到上次的内容)
 */
import * as monaco from 'monaco-editor'
import { configureMonacoYaml, type MonacoYaml } from 'monaco-yaml'
import { createYamlFlowSchema } from '../components/yamlFlowSchema'
import { formatYaml } from '../utils/formatYaml'

import EditorWorker from '../workers/editor.worker?worker'
import YamlWorker from '../workers/yaml.worker?worker'

const MODEL_URI_PATTERN = 'file:///workflow.yaml'

let initialized = false
let modelCounter = 0
let yamlHandle: MonacoYaml | null = null

/** 确保全局配置只执行一次 */
export function ensureSetup(): void {
  if (initialized) return
  initialized = true

  // ── createWebWorker 兼容层（monaco-editor>=0.53 API 变更）──
  const _orig = monaco.editor.createWebWorker.bind(monaco.editor)
  monaco.editor.createWebWorker = function compatCreateWebWorker(opts: any) {
    if (opts.worker) return _orig(opts)

    const env = (globalThis as any).MonacoEnvironment
    const w = env?.getWorker?.(opts.moduleId, opts.label)
    if (!w) return _orig(opts)

    const workerPromise = Promise.resolve(w).then((worker: Worker) => {
      worker.postMessage('ignore')
      worker.postMessage(opts.createData)
      return worker
    })

    return _orig({ ...opts, worker: workerPromise })
  } as any

  // ── MonacoEnvironment ──
  self.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'yaml') return new YamlWorker()
      return new EditorWorker()
    }
  }

  // ── 配置 monaco-yaml(只注册一次 provider)──
  // 用 fileMatch 通配,任何形如 file:///workflow.*.yaml 的 model 都套同一个 schema
  // format 关掉:monaco-yaml 内置格式化会改引号 / flow / 注释。
  // 我们在下面注册自己的 formatter(formatYaml),只规范缩进,不动用户代码。
  yamlHandle = configureMonacoYaml(monaco, {
    enableSchemaRequest: false,
    schemas: [
      {
        uri: 'file:///yaml-flow-engine-schema.json',
        fileMatch: ['file:///workflow*.yaml', MODEL_URI_PATTERN],
        schema: createYamlFlowSchema() as any
      }
    ],
    format: false,
    completion: true,
    validate: true,
    hover: true
  })

  // ── 注册自研 YAML formatter ──
  // 快捷键 Shift+Alt+F / 菜单 "Format Document" 都走这个。
  // 规则:parseDocument → toString,yaml 库对未修改节点自动保留
  //       .type / .flow / 注释,只有缩进会被规范为 2 空格。
  monaco.languages.registerDocumentFormattingEditProvider('yaml', {
    provideDocumentFormattingEdits(model) {
      const src = model.getValue()
      const formatted = formatYaml(src)
      if (formatted === src) return []
      return [{ range: model.getFullModelRange(), text: formatted }]
    }
  })
}

/** 用当前 locale 重新生成 schema 并更新 monaco-yaml（语言切换时调用） */
export function refreshYamlSchema(): void {
  yamlHandle?.update({
    schemas: [
      {
        uri: 'file:///yaml-flow-engine-schema.json',
        fileMatch: ['file:///workflow*.yaml', MODEL_URI_PATTERN],
        schema: createYamlFlowSchema() as any
      }
    ]
  })
}

/** 为本次 mount 创建独立 model;调用方负责 dispose */
export function createWorkflowModel(initialValue: string): monaco.editor.ITextModel {
  // 每次自增 URI 后缀,避免和其它存活 model 冲突
  modelCounter += 1
  const uri = monaco.Uri.parse(`file:///workflow.${modelCounter}.yaml`)
  return monaco.editor.createModel(initialValue, 'yaml', uri)
}
