/**
 * actionSchema · 从 yamlFlowSchema 提取某 action 的可编辑字段
 *
 * 设计契约:
 *  - 纯函数,无 Vue 依赖,可单测
 *  - 把 schema 的 oneOf 化简成"对象形态"或"原子形态":
 *      · 对象形态: 多字段 → 多个 FieldDef
 *      · 原子形态: 单字段(name=PRIMITIVE_BODY_FIELD)
 *  - 通用元字段 label/optional/when/chance 不在结果里 —— 由表单单独渲染
 *  - 不能可视化的复杂字段(嵌套对象 / array / $ref 选择器)→ 退化成 'json' kind,
 *    让上层决定显示文字还是跳出 YAML 编辑器
 */

import { createYamlFlowSchema } from '../components/yamlFlowSchema'
import { friendlyFieldLabel, cleanDescription } from './fieldLabel'

// ═══════════════ 类型 ═══════════════

export type FieldKind = 'string' | 'integer' | 'number' | 'boolean' | 'enum' | 'json'

export interface EnumOption {
  value: string
  label: string
}

export interface FieldDef {
  /** YAML key(原样不翻译,保证读写对得上) */
  name: string
  /** 渲染什么 input */
  kind: FieldKind
  /** UI 标签(大白话) */
  label: string
  /** 字段下方一行 hint(已清洗,无 emoji / markdown) */
  hint: string
  /** kind === 'enum' 时的可选项 */
  options?: EnumOption[]
  /** schema required 数组里 = true */
  required?: boolean
}

/** 当 action body 是原子值(string/number/boolean)而非对象时,合成的 sentinel 字段名 */
export const PRIMITIVE_BODY_FIELD = '$value'

/** 通用字段(由表单的「通用」分组单独渲染,不混在 action 字段里) */
export const COMMON_FIELDS: ReadonlySet<string> = new Set(['label', 'optional', 'when', 'chance'])

// ═══════════════ 内部 schema 形状 ═══════════════
// 局部窄定义 —— 不依赖外部 JSON Schema 类型库,只描述我们要用的形状

interface SchemaNode {
  type?: string | string[]
  oneOf?: SchemaNode[]
  properties?: Record<string, SchemaNode>
  required?: string[]
  enum?: unknown[]
  markdownEnumDescriptions?: string[]
  markdownDescription?: string
  additionalProperties?: unknown
  items?: SchemaNode
  $ref?: string
}

// ═══════════════ 入口 ═══════════════

/** 提取某 action 的可编辑字段;未知 action / 无可编辑字段返回 [] */
export function getActionFields(actionId: string): FieldDef[] {
  const schema = lookupActionSchema(actionId)
  if (!schema) return []

  // 优先走对象形态(信息更全),没有再尝试原子形态
  const objectBranch = pickObjectBranch(schema)
  if (objectBranch) {
    return extractObjectProperties(objectBranch)
  }

  const primitiveKind = pickPrimitiveKind(schema)
  if (primitiveKind) {
    return [
      {
        name: PRIMITIVE_BODY_FIELD,
        kind: primitiveKind,
        label: friendlyFieldLabel(PRIMITIVE_BODY_FIELD),
        hint: cleanDescription(schema.markdownDescription)
      }
    ]
  }

  return []
}

// ═══════════════ schema 漫游 ═══════════════

function lookupActionSchema(actionId: string): SchemaNode | undefined {
  const cmdDef = (createYamlFlowSchema().definitions as Record<string, SchemaNode>).command
  if (!cmdDef?.oneOf) return undefined
  const objectBranch = cmdDef.oneOf.find((b) => b.type === 'object')
  return objectBranch?.properties?.[actionId]
}

/** 从 (oneOf) 里拣出"对象 + 有 properties"的分支;直接是对象也算 */
function pickObjectBranch(schema: SchemaNode): SchemaNode | null {
  if (schema.type === 'object' && schema.properties) return schema
  if (schema.oneOf) {
    return schema.oneOf.find((b) => b.type === 'object' && b.properties !== undefined) ?? null
  }
  return null
}

/** 从 schema 里拣出可表示成单一原子类型的 kind */
function pickPrimitiveKind(schema: SchemaNode): FieldKind | null {
  if (typeof schema.type === 'string' && isPrimitiveType(schema.type)) {
    return mapType(schema.type, schema)
  }
  if (schema.oneOf) {
    for (const branch of schema.oneOf) {
      if (typeof branch.type === 'string' && isPrimitiveType(branch.type)) {
        return mapType(branch.type, branch)
      }
    }
  }
  return null
}

function isPrimitiveType(t: string): boolean {
  return t === 'string' || t === 'integer' || t === 'number' || t === 'boolean'
}

function mapType(t: string, schema: SchemaNode): FieldKind {
  if (t === 'string' && schema.enum && schema.enum.length > 0) return 'enum'
  if (t === 'string') return 'string'
  if (t === 'integer') return 'integer'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'string'
}

// ═══════════════ 对象 → FieldDef[] ═══════════════

function extractObjectProperties(objectSchema: SchemaNode): FieldDef[] {
  const props = objectSchema.properties ?? {}
  const required = new Set(objectSchema.required ?? [])
  const out: FieldDef[] = []
  for (const [name, propSchema] of Object.entries(props)) {
    if (COMMON_FIELDS.has(name)) continue
    const def = propertyToFieldDef(name, propSchema, required.has(name))
    if (def) out.push(def)
  }
  return out
}

function propertyToFieldDef(name: string, schema: SchemaNode, required: boolean): FieldDef | null {
  // oneOf:优先挑"原子类型"分支(string/integer/...)
  // 全是对象/数组/$ref → 退化为 json,留给上层决定如何承载
  let working: SchemaNode = schema
  if (schema.oneOf) {
    const primitive = schema.oneOf.find(
      (b) => typeof b.type === 'string' && isPrimitiveType(b.type)
    )
    if (primitive) {
      // 用原子分支的 type/enum,但保留外层的 markdownDescription(往往写得更全)
      working = {
        ...primitive,
        markdownDescription: schema.markdownDescription ?? primitive.markdownDescription
      }
    } else {
      return jsonFallback(name, schema, required)
    }
  }

  // $ref(嵌套选择器等)/ object / array → json fallback
  if (
    working.$ref ||
    working.type === 'object' ||
    working.type === 'array' ||
    !working.type ||
    Array.isArray(working.type)
  ) {
    return jsonFallback(name, schema, required)
  }

  if (!isPrimitiveType(working.type)) return null

  const kind = mapType(working.type, working)
  const def: FieldDef = {
    name,
    kind,
    label: friendlyFieldLabel(name),
    hint: cleanDescription(schema.markdownDescription),
    required
  }

  if (kind === 'enum' && working.enum) {
    def.options = working.enum.map((v, i) => ({
      value: String(v),
      label: cleanDescription(working.markdownEnumDescriptions?.[i]) || String(v)
    }))
  }

  return def
}

function jsonFallback(name: string, schema: SchemaNode, required: boolean): FieldDef {
  return {
    name,
    kind: 'json',
    label: friendlyFieldLabel(name),
    hint: cleanDescription(schema.markdownDescription),
    required
  }
}
