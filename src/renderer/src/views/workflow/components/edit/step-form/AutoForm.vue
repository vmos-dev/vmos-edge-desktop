<script setup lang="ts">
/**
 * AutoForm · schema 驱动的步骤表单
 *
 * 视觉灵感:Linear / Stripe Dashboard 的"安静精致"
 *  - 自己写 .field 布局,不用 ElForm/ElFormItem 的密集 wrapper
 *  - label 上方 12px medium · 控件 36px · hint 下方 11.5px
 *  - 字段间 16px,分组间 1px hairline + 16px padding
 *  - 控件本体仍用 EP(ElInput / ElInputNumber / ElSwitch / ElSelect)
 *
 * 单一职责:把 FieldDef[] + body 渲染成 form,字段变化 emit 完整新 body。
 * 不持有业务态,父级用 doc.editStepBody 写回。
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElIcon, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import type { FieldDef } from '../../../utils/actionSchema'
import { PRIMITIVE_BODY_FIELD } from '../../../utils/actionSchema'

interface Props {
  /** schema 派生的可编辑字段(不含通用字段) */
  fields: readonly FieldDef[]
  /** 默认展开的字段名;不传 → 头 3 个 */
  primaryFields?: readonly string[]
  /** 当前 YAML body(派生自 doc.text;父级 setStepBody 后会重新传入) */
  body: unknown
}

interface Emits {
  /** 任何字段改了 → 完整新 body 给父级写回 */
  (e: 'update:body', body: unknown): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// ═══════════════ 模式 ═══════════════
const isPrimitive = computed(() => props.fields.some((f) => f.name === PRIMITIVE_BODY_FIELD))

// ═══════════════ 字段分组 ═══════════════
const primarySet = computed<ReadonlySet<string>>(() => {
  if (props.primaryFields && props.primaryFields.length > 0) {
    return new Set(props.primaryFields)
  }
  return new Set(props.fields.slice(0, 3).map((f) => f.name))
})

const primaryFields = computed(() => props.fields.filter((f) => primarySet.value.has(f.name)))
const advancedFields = computed(() => props.fields.filter((f) => !primarySet.value.has(f.name)))

const moreOpen = ref(false)

// ═══════════════ 当前值读取 ═══════════════
function readField(name: string): unknown {
  if (name === PRIMITIVE_BODY_FIELD) return props.body
  if (props.body && typeof props.body === 'object' && !Array.isArray(props.body)) {
    return (props.body as Record<string, unknown>)[name]
  }
  return undefined
}

const optionalEnabled = computed(() => readField('optional') === true)
const chanceEnabled = computed(() => typeof readField('chance') === 'number')
const chanceValue = computed(() => {
  const v = readField('chance')
  return typeof v === 'number' ? v : 0.5
})

// ═══════════════ 写入(每次只改一个字段) ═══════════════
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function writeField(name: string, value: unknown): void {
  if (name === PRIMITIVE_BODY_FIELD) {
    emit('update:body', isEmpty(value) ? '' : value)
    return
  }

  const currentObj: Record<string, unknown> =
    props.body && typeof props.body === 'object' && !Array.isArray(props.body)
      ? { ...(props.body as Record<string, unknown>) }
      : {}

  if (isEmpty(value)) {
    delete currentObj[name]
  } else {
    currentObj[name] = value
  }

  emit('update:body', Object.keys(currentObj).length > 0 ? currentObj : undefined)
}

function toggleOptional(on: string | number | boolean): void {
  writeField('optional', on === true ? true : undefined)
}
function toggleChance(on: string | number | boolean): void {
  writeField('chance', on === true ? chanceValue.value : undefined)
}
function patchChance(v: number): void {
  if (Number.isFinite(v) && v > 0 && v < 1) writeField('chance', v)
}

// ═══════════════ JSON 兜底字段 ═══════════════
function readJsonString(name: string): string {
  const v = readField(name)
  if (v === undefined || v === null) return ''
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return ''
  }
}
function writeJsonString(name: string, raw: string): void {
  if (raw.trim() === '') {
    writeField(name, undefined)
    return
  }
  try {
    writeField(name, JSON.parse(raw))
  } catch {
    /* 忽略不合法的 JSON;用户继续编辑 */
  }
}
</script>

<template>
  <form class="auto-form" @submit.prevent>
    <!-- ─── 主要参数 ─── -->
    <section v-if="primaryFields.length > 0" class="section">
      <h4 class="section-title">{{ t('workflow.autoForm.primaryParams') }}</h4>
      <div class="field-list">
        <label v-for="field in primaryFields" :key="field.name" class="field" :for="field.name">
          <span class="field-label">
            {{ field.label }}
            <span v-if="field.required" class="required">*</span>
          </span>

          <ElInput
            v-if="field.kind === 'string'"
            :id="field.name"
            :model-value="(readField(field.name) as string | undefined) ?? ''"
            clearable
            class="control"
            @update:model-value="(v) => writeField(field.name, v)"
          />

          <ElInputNumber
            v-else-if="field.kind === 'integer' || field.kind === 'number'"
            :id="field.name"
            :model-value="(readField(field.name) as number | undefined) ?? undefined"
            :step="field.kind === 'integer' ? 1 : 0.1"
            :precision="field.kind === 'integer' ? 0 : 2"
            controls-position="right"
            class="control control-number"
            @update:model-value="(v) => writeField(field.name, v ?? undefined)"
          />

          <ElSwitch
            v-else-if="field.kind === 'boolean'"
            :model-value="(readField(field.name) as boolean | undefined) ?? false"
            class="control control-switch"
            @update:model-value="(v) => writeField(field.name, v ? true : undefined)"
          />

          <ElSelect
            v-else-if="field.kind === 'enum'"
            :id="field.name"
            :model-value="(readField(field.name) as string | undefined) ?? undefined"
            clearable
            class="control"
            @update:model-value="(v) => writeField(field.name, v || undefined)"
          >
            <ElOption
              v-for="opt in field.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>

          <ElInput
            v-else
            :id="field.name"
            :model-value="readJsonString(field.name)"
            type="textarea"
            :rows="2"
            :placeholder="t('workflow.autoForm.complexHint')"
            class="control"
            @update:model-value="(v) => writeJsonString(field.name, v)"
          />

          <span v-if="field.hint" class="field-hint">{{ field.hint }}</span>
        </label>
      </div>
    </section>

    <!-- ─── 更多设置 ─── -->
    <section v-if="advancedFields.length > 0" class="section section-collapsible">
      <button type="button" class="section-toggle" @click="moreOpen = !moreOpen">
        <ElIcon class="toggle-arrow" :class="{ open: moreOpen }" :size="14">
          <ArrowDown />
        </ElIcon>
        <span>{{ t('workflow.autoForm.moreSettings', { count: advancedFields.length }) }}</span>
      </button>

      <div v-if="moreOpen" class="field-list">
        <label v-for="field in advancedFields" :key="field.name" class="field" :for="field.name">
          <span class="field-label">
            {{ field.label }}
            <span v-if="field.required" class="required">*</span>
          </span>

          <ElInput
            v-if="field.kind === 'string'"
            :id="field.name"
            :model-value="(readField(field.name) as string | undefined) ?? ''"
            clearable
            class="control"
            @update:model-value="(v) => writeField(field.name, v)"
          />

          <ElInputNumber
            v-else-if="field.kind === 'integer' || field.kind === 'number'"
            :id="field.name"
            :model-value="(readField(field.name) as number | undefined) ?? undefined"
            :step="field.kind === 'integer' ? 1 : 0.1"
            :precision="field.kind === 'integer' ? 0 : 2"
            controls-position="right"
            class="control control-number"
            @update:model-value="(v) => writeField(field.name, v ?? undefined)"
          />

          <ElSwitch
            v-else-if="field.kind === 'boolean'"
            :model-value="(readField(field.name) as boolean | undefined) ?? false"
            class="control control-switch"
            @update:model-value="(v) => writeField(field.name, v ? true : undefined)"
          />

          <ElSelect
            v-else-if="field.kind === 'enum'"
            :id="field.name"
            :model-value="(readField(field.name) as string | undefined) ?? undefined"
            clearable
            class="control"
            @update:model-value="(v) => writeField(field.name, v || undefined)"
          >
            <ElOption
              v-for="opt in field.options"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </ElSelect>

          <ElInput
            v-else
            :id="field.name"
            :model-value="readJsonString(field.name)"
            type="textarea"
            :rows="2"
            :placeholder="t('workflow.autoForm.complexHint')"
            class="control"
            @update:model-value="(v) => writeJsonString(field.name, v)"
          />

          <span v-if="field.hint" class="field-hint">{{ field.hint }}</span>
        </label>
      </div>
    </section>

    <!-- ─── 通用 ─── -->
    <section v-if="!isPrimitive" class="section">
      <h4 class="section-title">{{ t('workflow.autoForm.common') }}</h4>
      <div class="field-list">
        <label class="field" for="common-label">
          <span class="field-label">{{ t('workflow.autoForm.labelField') }}</span>
          <ElInput
            id="common-label"
            :model-value="(readField('label') as string | undefined) ?? ''"
            :placeholder="t('workflow.autoForm.labelPlaceholder')"
            clearable
            class="control"
            @update:model-value="(v) => writeField('label', v)"
          />
        </label>

        <div class="field field-row">
          <span class="field-label">{{ t('workflow.autoForm.skipOnFail') }}</span>
          <div class="row-controls">
            <ElSwitch :model-value="optionalEnabled" @update:model-value="toggleOptional" />
            <span class="field-hint inline">{{ t('workflow.autoForm.skipOnFailHint') }}</span>
          </div>
        </div>

        <div class="field field-row">
          <span class="field-label">{{ t('workflow.autoForm.chanceField') }}</span>
          <div class="row-controls">
            <ElSwitch :model-value="chanceEnabled" @update:model-value="toggleChance" />
            <ElInputNumber
              v-if="chanceEnabled"
              :model-value="chanceValue"
              :min="0.05"
              :max="0.99"
              :step="0.05"
              :precision="2"
              controls-position="right"
              class="chance-input"
              @update:model-value="(v) => v != null && patchChance(v)"
            />
            <span class="field-hint inline">{{ t('workflow.autoForm.chanceHint') }}</span>
          </div>
        </div>
      </div>
    </section>
  </form>
</template>

<style scoped>
.auto-form {
  font-size: 13px;
  display: flex;
  flex-direction: column;
  font-family: var(--app-font-family);
}

/* ─── 分组 ─── */
.section {
  padding: 20px 0;
}
.section + .section {
  border-top: 1px solid var(--el-border-color-lighter);
}

.section-title {
  margin: 0 0 16px;
  font-size: 11px;
  font-weight: 700;
  color: var(--el-text-color-placeholder);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding-left: 2px;
}

.section-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  transition: color 0.2s ease;
}
.section-toggle:hover {
  color: var(--el-color-primary);
}
.toggle-arrow {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.toggle-arrow.open {
  transform: rotate(180deg);
}

.section-collapsible .field-list {
  margin-top: 16px;
}

/* ─── 字段 ─── */
.field-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: default;
}

.field-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.row-controls {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  display: flex;
  align-items: center;
}
.required {
  color: var(--el-color-danger);
  margin-left: 3px;
  font-weight: bold;
}

/* 控件:统一 36px,边框柔和,焦点 ring */
.control :deep(.el-input__wrapper),
.control:not(.control-switch) :deep(.el-textarea__inner),
.control :deep(.el-select__wrapper) {
  background: var(--el-bg-color);
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
  border-radius: 8px;
  min-height: 36px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.control :deep(.el-input__wrapper:hover),
.control:not(.control-switch) :deep(.el-textarea__inner:hover),
.control :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}

.control :deep(.is-focus .el-input__wrapper),
.control :deep(.el-textarea__inner:focus),
.control :deep(.el-select__wrapper.is-focused) {
  box-shadow:
    0 0 0 1px var(--el-color-primary) inset,
    0 0 0 3px color-mix(in srgb, var(--el-color-primary) 15%, transparent) !important;
}

.control-number {
  width: 100%;
}

.field-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  opacity: 0.8;
}
.field-hint.inline {
  margin-left: 0;
}

.chance-input {
  width: 110px;
}

html.dark .control :deep(.el-input__wrapper),
html.dark .control:not(.control-switch) :deep(.el-textarea__inner),
html.dark .control :deep(.el-select__wrapper) {
  background: color-mix(in srgb, var(--el-bg-color) 96%, white 4%);
}
</style>
