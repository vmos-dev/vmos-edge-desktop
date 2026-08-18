<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { Document, UploadFilled, ArrowUp, ArrowDown } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { ipc } from '@renderer/core/ipc'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import type { ProxyExportItem } from '@shared/ipc/proxy.types'

const { t } = useI18n()

const emit = defineEmits<{
  imported: []
}>()

const VALID_PROTOCOLS = ['http', 'https', 'socks5', 'vmess', 'ss', 'ssr', 'vless'] as const

type Stage = 'idle' | 'preview' | 'result'

const visible = shallowRef(false)
const stage = shallowRef<Stage>('idle')
const isImporting = shallowRef(false)
const fileName = shallowRef('')
const parseError = shallowRef<string | null>(null)
const showInvalidList = shallowRef(false)

// shallowRef：只追踪数组引用替换，内部元素保持普通对象，避免 IPC 结构化克隆失败
const validItems = shallowRef<ProxyExportItem[]>([])
const invalidItems = shallowRef<{ index: number; reason: string }[]>([])
const importResult = shallowRef<{ success: number; failed: number; errors: string[] } | null>(null)

const totalCount = computed(() => validItems.value.length + invalidItems.value.length)
const toggleIcon = computed(() => (showInvalidList.value ? ArrowUp : ArrowDown))

const reset = () => {
  stage.value = 'idle'
  isImporting.value = false
  fileName.value = ''
  parseError.value = null
  showInvalidList.value = false
  validItems.value = []
  invalidItems.value = []
  importResult.value = null
}

const open = () => {
  reset()
  visible.value = true
}

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target!.result as string)
    reader.onerror = () => reject(new Error(t('proxy.importSourceReadFailed')))
    reader.readAsText(file)
  })

const parseItem = (
  raw: unknown,
  _index: number
): { valid: ProxyExportItem } | { error: string } => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: t('proxy.importSourceNotObject') }
  }
  const item = raw as Record<string, unknown>

  if (!VALID_PROTOCOLS.includes(item.protocol as (typeof VALID_PROTOCOLS)[number])) {
    return {
      error: t('proxy.importSourceInvalidProtocol', { protocol: String(item.protocol ?? '') })
    }
  }
  if (!item.host || typeof item.host !== 'string') {
    return { error: t('proxy.importSourceMissingHost') }
  }
  const port = Number(item.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: t('proxy.importSourceInvalidPort') }
  }

  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

  return {
    valid: {
      name: str(item.name) ?? `${item.host}:${port}`,
      protocol: item.protocol as ProxyExportItem['protocol'],
      host: item.host,
      port,
      username: str(item.username),
      password: str(item.password),
      rawLink: str(item.rawLink),
      ip: str(item.ip),
      country: str(item.country),
      timezone: str(item.timezone),
      loc: str(item.loc)
    }
  }
}

const handleFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.json')) {
    parseError.value = t('proxy.importSourceOnlyJson')
    return
  }

  fileName.value = file.name
  parseError.value = null

  try {
    const text = await readFileAsText(file)
    const raw = JSON.parse(text)

    if (!Array.isArray(raw)) {
      parseError.value = t('proxy.importSourceNotArray')
      return
    }

    if (raw.length === 0) {
      parseError.value = t('proxy.importSourceEmptyArray')
      return
    }

    const valid: ProxyExportItem[] = []
    const invalid: { index: number; reason: string }[] = []

    for (let i = 0; i < raw.length; i++) {
      const result = parseItem(raw[i], i + 1)
      if ('valid' in result) {
        valid.push(result.valid)
      } else {
        invalid.push({ index: i + 1, reason: result.error })
      }
    }

    validItems.value = valid
    invalidItems.value = invalid
    stage.value = 'preview'
  } catch {
    parseError.value = t('proxy.importSourceJsonParseFailed')
  }
}

const handleImport = async () => {
  if (isImporting.value || validItems.value.length === 0) return

  isImporting.value = true
  try {
    const res = await ipc.invoke<{ success: number; failed: number; errors: string[] }>(
      PROXY_EVENTS.BATCH_ADD_PROXY,
      validItems.value
    )
    if (res.success && res.data) {
      importResult.value = res.data
      stage.value = 'result'
      emit('imported')
    } else {
      ElMessage.error(res.error || t('proxy.importFailed'))
    }
  } catch (e: any) {
    ElMessage.error(e?.message || t('proxy.importSystemError'))
  } finally {
    isImporting.value = false
  }
}

const handleBack = () => reset()

defineExpose({ open })
</script>

<template>
  <VmosDialog v-model="visible" :title="t('proxy.importSourceTitle')" width="520px" @closed="reset">
    <!-- 阶段 1：选择文件 -->
    <template v-if="stage === 'idle'">
      <el-upload
        drag
        :auto-upload="false"
        accept=".json"
        :show-file-list="false"
        @change="handleFileChange"
      >
        <el-icon class="upload-area-icon"><UploadFilled /></el-icon>
        <div class="upload-area-text">{{ t('proxy.importSourceDragHint') }}</div>
        <div class="upload-area-hint">{{ t('proxy.importSourceOnlyJson') }}</div>
      </el-upload>
      <div v-if="parseError" class="parse-error">{{ parseError }}</div>
    </template>

    <!-- 阶段 2：预览 -->
    <template v-else-if="stage === 'preview'">
      <div class="file-name-row">
        <el-icon><Document /></el-icon>
        <span class="file-name">{{ fileName }}</span>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ totalCount }}</div>
          <div class="stat-label">{{ t('proxy.importSourceTotal') }}</div>
        </div>
        <div class="stat-card valid">
          <div class="stat-value success-text">{{ validItems.length }}</div>
          <div class="stat-label">{{ t('proxy.importSourceValid') }}</div>
        </div>
        <div class="stat-card invalid">
          <div class="stat-value danger-text">{{ invalidItems.length }}</div>
          <div class="stat-label">{{ t('proxy.importSourceInvalid') }}</div>
        </div>
      </div>

      <template v-if="invalidItems.length > 0">
        <div class="error-toggle" @click="showInvalidList = !showInvalidList">
          <span>{{
            showInvalidList ? t('proxy.importSourceHideErrors') : t('proxy.importSourceShowErrors')
          }}</span>
          <el-icon>
            <component :is="toggleIcon" />
          </el-icon>
        </div>
        <ul v-if="showInvalidList" class="error-list">
          <li v-for="item in invalidItems" :key="item.index" class="error-item">
            <span class="error-index">#{{ item.index }}</span>
            <span class="error-reason">{{ item.reason }}</span>
          </li>
        </ul>
      </template>
    </template>

    <!-- 阶段 3：结果 -->
    <template v-else-if="stage === 'result'">
      <div class="result-card">
        <div class="result-text">
          {{
            t('proxy.importSourceResult', {
              success: importResult?.success ?? 0,
              failed: importResult?.failed ?? 0
            })
          }}
        </div>
        <template v-if="importResult && importResult.failed > 0 && importResult.errors.length > 0">
          <div class="result-errors-title">{{ t('proxy.importSourceResultErrors') }}</div>
          <ul class="error-list">
            <li v-for="(err, idx) in importResult.errors" :key="idx" class="error-item">
              {{ err }}
            </li>
          </ul>
        </template>
      </div>
    </template>

    <template #footer>
      <template v-if="stage === 'idle'">
        <el-button @click="visible = false">{{ t('common.cancel') }}</el-button>
      </template>
      <template v-else-if="stage === 'preview'">
        <el-button @click="handleBack">{{ t('common.back') }}</el-button>
        <el-button
          type="primary"
          :loading="isImporting"
          :disabled="isImporting || validItems.length === 0"
          @click="handleImport"
        >
          {{ t('proxy.importSourceConfirm', { count: validItems.length }) }}
        </el-button>
      </template>
      <template v-else-if="stage === 'result'">
        <el-button type="primary" @click="visible = false">{{ t('common.confirm') }}</el-button>
      </template>
    </template>
  </VmosDialog>
</template>

<style scoped lang="scss">
.upload-area-icon {
  font-size: 48px;
  color: var(--el-text-color-placeholder);
  margin-bottom: 12px;
}

.upload-area-text {
  font-size: 14px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}

.upload-area-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.parse-error {
  margin-top: 10px;
  padding: 8px 12px;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  border-radius: 4px;
  font-size: 12px;
}

.file-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;

  .file-name {
    font-family: monospace;
    color: var(--el-text-color-regular);
  }
}

.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  text-align: center;
  padding: 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .stat-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-top: 4px;
  }

  &.valid {
    background: var(--el-color-success-light-9);
    border-color: var(--el-color-success-light-5);
  }

  &.invalid {
    background: var(--el-color-danger-light-9);
    border-color: var(--el-color-danger-light-5);
  }
}

.success-text {
  color: var(--el-color-success) !important;
}

.danger-text {
  color: var(--el-color-danger) !important;
}

.error-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
  margin-bottom: 8px;
  user-select: none;

  &:hover {
    opacity: 0.8;
  }
}

.error-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 140px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
}

.error-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: none;
  }
}

.error-index {
  flex-shrink: 0;
  color: var(--el-color-danger);
  font-weight: 500;
  min-width: 32px;
}

.error-reason {
  flex: 1;
  word-break: break-all;
}

.result-card {
  padding: 4px 0;

  .result-text {
    font-size: 14px;
    color: var(--el-text-color-primary);
    margin-bottom: 12px;
  }

  .result-errors-title {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
  }
}
</style>
