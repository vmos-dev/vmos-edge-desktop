<template>
  <vmos-dialog
    v-model="visible"
    :title="t('proxy.importTitle')"
    width="1000px"
    :show-close="!importing"
    append-to-body
    @closed="handleClosed"
  >
    <div class="pre-config">
      <el-form inline :model="form" ref="preFormRef">
        <el-form-item
          :label="t('proxy.namePrefix')"
          prop="prefix"
          :rules="[{ required: true, message: t('proxy.namePrefixRequired'), trigger: 'blur' }]"
        >
          <el-input
            v-model="form.prefix"
            :placeholder="t('proxy.namePrefixPlaceholder')"
            maxlength="20"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <div class="header-actions">
        <el-button text type="primary" size="small" @click="showParseHelp = !showParseHelp">
          <el-icon size="16"><InfoFilled /></el-icon>&nbsp; {{ t('proxy.formatHelp') }}
        </el-button>
        <template v-if="proxies.length > 0">
          <div class="button-group">
            <el-button type="primary" size="small" plain @click="reset">{{ t('proxy.reUpload') }}</el-button>
            <el-button
              type="danger"
              size="small"
              v-if="failedCount > 0"
              plain
              @click="handleClearError"
              >{{ t('proxy.clearErrorProxies') }}</el-button
            >
            <el-button
              type="danger"
              size="small"
              plain
              v-if="failedCount > 0"
              @click="handleDownloadFailed"
              >{{ t('proxy.downloadErrorProxies') }}</el-button
            >
            <el-button type="danger" size="small" plain @click="handleBatchDelete"
              >{{ t('proxy.batchDelete') }}</el-button
            >
          </div>
        </template>
      </div>
    </div>

    <div v-show="showParseHelp" class="parse-help">
      <div class="help-title">{{ t('proxy.supportedFormats') }}</div>
      <div class="help-examples">
        <div class="help-category">
          <div class="category-title">HTTP / HTTPS：</div>
          <div class="help-item">
            <code>http://username:password@host:port</code>
          </div>
          <div class="help-item">
            <code>http://host:port</code>
          </div>
          <div class="help-item">
            <code>https://username:password@host:port</code>
          </div>
          <div class="help-note" style="padding-left: 12px; margin-top: 4px">
            {{ t('proxy.httpHttpsNote') }}
          </div>
        </div>
        <div class="help-category">
          <div class="category-title">SOCKS5：</div>
          <div class="help-item">
            <code>socks5://username:password@host:port</code>
          </div>
          <div class="help-item">
            <code>socks5://host:port</code>
          </div>
          <div class="help-note" style="padding-left: 12px; margin-top: 4px">
            {{ t('proxy.socks5Note') }}
          </div>
        </div>
        <div class="help-category">
          <div class="category-title">Shadowsocks (SS)：</div>
          <div class="help-item">
            <code>ss://base64(method:password)@host:port[?plugin=...][#remarks]</code>
          </div>
          <div class="help-item">
            <code>ss://base64(method:password@host:port)[?plugin=...][#remarks]</code>
          </div>
          <div class="help-note" style="padding-left: 12px; margin-top: 4px">
            {{ t('proxy.ssNote') }}
          </div>
        </div>
        <div class="help-category">
          <div class="category-title">ShadowsocksR (SSR)：</div>
          <div class="help-item">
            <code>ssr://base64(host:port:protocol:method:obfs:password/...)</code>
          </div>
        </div>
        <div class="help-category">
          <div class="category-title">VMess：</div>
          <div class="help-item">
            <code>vmess://base64(json)</code>
          </div>
          <div class="help-item">
            <code>vmess://base64?params</code>
          </div>
          <div class="help-note" style="padding-left: 12px; margin-top: 4px">
            {{ t('proxy.vmessNote') }}
          </div>
        </div>
        <div class="help-category">
          <div class="category-title">VLESS：</div>
          <div class="help-item">
            <code>vless://uuid@host:port?params#remarks</code>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传/输入区域 -->
    <div v-if="proxies.length === 0" class="input-container" v-loading="parsing">
      <el-tabs v-model="activeTab" class="import-tabs" @tab-change="handleTabChange">
        <el-tab-pane :label="t('proxy.fileImport')" name="file">
          <div class="tab-content">
            <el-upload
              ref="uploadRef"
              class="upload-area"
              drag
              action=""
              :auto-upload="false"
              :on-change="handleFileChange"
              :show-file-list="false"
              accept=".txt,.xlsx,.xls"
            >
              <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
              <div class="el-upload__text">{{ t('proxy.dragFileTip') }} <em>{{ t('proxy.clickUpload') }}</em></div>
              <template #tip>
                <div class="el-upload__tip">
                  {{ t('proxy.fileFormatTip') }}
                  <div class="template-links">
                    <el-button
                      type="primary"
                      link
                      size="small"
                      @click="handleDownloadTemplate('xlsx')"
                      >{{ t('proxy.downloadExcelTemplate') }}</el-button
                    >
                    <el-divider direction="vertical" />
                    <el-button
                      type="primary"
                      link
                      size="small"
                      @click="handleDownloadTemplate('txt')"
                      >{{ t('proxy.downloadTxtTemplate') }}</el-button
                    >
                  </div>
                </div>
              </template>
            </el-upload>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('proxy.textImport')" name="text">
          <div class="tab-content">
            <el-input
              v-model="pasteContent"
              type="textarea"
              :rows="15"
              :placeholder="t('proxy.pastePlaceholder')"
              resize="none"
            />
            <div class="paste-actions">
              <el-button type="primary" @click="handlePasteParse" :disabled="!pasteContent.trim()">
                {{ t('proxy.parseText') }}
              </el-button>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 预览区域 -->
    <div v-else class="import-preview-container">
      <div class="table-wrapper">
        <el-table
          :data="proxies"
          height="300"
          stripe
          size="small"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="40" align="center" />

          <el-table-column :label="t('proxy.previewName')" width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" maxlength="20" :placeholder="t('proxy.namePlaceholder')" />
            </template>
          </el-table-column>
          <el-table-column :label="t('proxy.previewStatus')" width="70" align="center">
            <template #default="{ row }">
              <span v-if="row.valid" class="success-text">{{ t('proxy.statusNormal') }}</span>
              <span v-else class="error-text">{{ t('proxy.statusAbnormal') }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="payload.protocol" :label="t('proxy.previewProtocol')" width="80" align="center">
            <template #default="{ row }">
              <span v-if="row.valid" class="text-gray">{{ row.payload.protocol }}</span>
              <span v-else class="text-gray">-</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('proxy.previewHost')" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.valid">{{ row.payload.host }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('proxy.previewPort')" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.valid">{{ row.payload.port }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column :label="t('proxy.previewRaw')" show-overflow-tooltip prop="raw"> </el-table-column>
          <el-table-column :label="t('proxy.previewError')" width="150" align="center">
            <template #default="{ row }">
              <span v-if="!row.valid" class="error-text">{{ row.error || t('proxy.parseFailed') }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="summary-bar">
        <span
          >{{ t('proxy.totalCount', { total: proxies.length }) }}
          <span class="success-text">{{ t('proxy.validCount', { valid: validCount }) }}</span>
          <span class="error-text">{{ t('proxy.invalidCount', { invalid: failedCount }) }}</span></span
        >
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false" :disabled="importing">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          @click="handleConfirm"
          :loading="importing"
          :disabled="validCount === 0"
        >
          {{ t('proxy.confirmImport', { count: validCount }) }}
        </el-button>
      </div>
    </template>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive, toRaw } from 'vue'
import { ElMessage, UploadFile, type FormInstance, type ElUpload } from 'element-plus'
import { UploadFilled, InfoFilled } from '@element-plus/icons-vue'
import { ipc } from '@renderer/core/ipc'
import { PROXY_EVENTS } from '@shared/ipc/proxy.types'
import * as XLSX from 'xlsx'
import parseUri from '@renderer/utils/uri-parser'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const visible = ref(false)
const activeTab = ref('file')
const importing = ref(false)
const parsing = ref(false)
const showParseHelp = ref(false)
const proxies = ref<any[]>([])
const selection = ref<any[]>([])
const pasteContent = ref('')
const uploadRef = ref<InstanceType<typeof ElUpload>>()
const preFormRef = ref<FormInstance>()
const previewFormRef = ref<FormInstance>()
const form = reactive({
  prefix: 'Proxy'
})

const emit = defineEmits<{
  success: []
}>()

const init = () => {
  visible.value = true
  reset()
}

const reset = () => {
  proxies.value = []
  selection.value = []
  pasteContent.value = ''
  parsing.value = false
  importing.value = false
  form.prefix = 'Proxy'
  showParseHelp.value = false
}

const handleClosed = () => {
  reset()
  activeTab.value = 'file'
}

const handleTabChange = () => {
  pasteContent.value = ''
  proxies.value = []
}

const validCount = computed(() => proxies.value.filter((p) => p.valid).length)
const failedCount = computed(() => proxies.value.filter((p) => !p.valid).length)
const convertConfigToPayload = (config: any) => {
  const protocol = config.type
  const base = {
    protocol
  }

  if (['http', 'https', 'socks5'].includes(protocol)) {
    return {
      ...base,
      host: config.server,
      port: config.port,
      username: config.username,
      password: config.password
    }
  }

  // 复杂协议
  return {
    ...base,
    host: config.server,
    port: config.port,
    rawLink: JSON.stringify(config)
  }
}

const parseLines = (lines: string[]) => {
  const results: any[] = []
  for (const line of lines) {
    if (!line || !line.trim()) continue
    try {
      const config = parseUri(line.trim())
      const payload = convertConfigToPayload(config)
      results.push({ raw: line, valid: true, payload })
    } catch (e: any) {
      results.push({ raw: line, valid: false, error: t('proxy.formatIncorrect') })
    }
  }
  return results
}

const handleFileChange = async (uploadFile: UploadFile) => {
  if (!uploadFile.raw) return

  // 校验前缀
  try {
    await preFormRef.value?.validate()
  } catch {
    return
  }

  parsing.value = true
  try {
    const lines = await readFileContent(uploadFile.raw)
    const parsed = parseLines(lines)

    if (parsed.length === 0) {
      ElMessage.warning(t('proxy.fileEmpty'))
    } else {
      proxies.value =
        parsed?.map((p, index) => ({
          ...p,
          name: `${form.prefix}-${index + 1}`
        })) || []
    }
  } catch (err: any) {
    ElMessage.error(err.message || t('proxy.fileParseFailed'))
  } finally {
    parsing.value = false
    uploadRef.value?.clearFiles()
  }
}

const handlePasteParse = async () => {
  if (!pasteContent.value.trim()) return

  // 校验前缀
  try {
    await preFormRef.value?.validate()
  } catch {
    return
  }

  parsing.value = true
  try {
    const lines = pasteContent.value.split(/\r?\n/)
    const parsed = parseLines(lines)

    if (parsed.length === 0) {
      ElMessage.warning(t('proxy.noValidContent'))
    } else {
      proxies.value =
        parsed?.map((p, index) => ({
          ...p,
          name: `${form.prefix}-${index + 1}`
        })) || []
    }
  } finally {
    parsing.value = false
  }
}

const readFileContent = (file: File): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const data = e.target?.result
      if (!data) {
        resolve([])
        return
      }

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        try {
          const workbook = XLSX.read(data, { type: 'binary' })
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          const lines = jsonData
            .map((row) => row[0])
            .filter((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '')
            .map((cell) => String(cell).trim())
          resolve(lines)
        } catch (err) {
          reject(new Error(t('proxy.excelParseFailed')))
        }
      } else {
        const text = data as string
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line)
        resolve(lines)
      }
    }

    reader.onerror = () => reject(new Error(t('proxy.fileReadFailed')))

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file)
    } else {
      reader.readAsText(file)
    }
  })
}

const handleDownloadTemplate = (type: 'xlsx' | 'txt') => {
  const examples = [
    // HTTP / HTTPS
    'http://user:pass@127.0.0.1:8080',
    'http://127.0.0.1:8080',
    'https://user:pass@127.0.0.1:8443',

    // SOCKS5
    'socks5://user:pass@127.0.0.1:1080',
    'socks5://127.0.0.1:1080',

    // Shadowsocks (SS)
    // aes-256-gcm:password@127.0.0.1:8388 -> YWVzLTI1Ni1nY206cGFzc3dvcmRAMTI3LjAuMC4xOjgzODg=
    'ss://YWVzLTI1Ni1nY206cGFzc3dvcmRAMTI3LjAuMC4xOjgzODg=#Example-SS',

    // ShadowsocksR (SSR)
    // 127.0.0.1:8388:origin:aes-256-cfb:plain:dGVzdHBhc3M= -> MTI3LjAuMC4xOjgzODg6b3JpZ2luOmFlcy0yNTYtY2ZiOnBsYWluOmRHVnpkSEJoYzNMPQ==
    'ssr://MTI3LjAuMC4xOjgzODg6b3JpZ2luOmFlcy0yNTYtY2ZiOnBsYWluOmRHVnpkSEJoYzNMPQ==',

    // VMess
    'vmess://ew0KICAidiI6ICIyIiwNCiAgInBzIjogInZtZXNzLWV4YW1wbGUiLA0KICAiYWRkIjogIjEyNy4wLjAuMSIsDQogICJwb3J0IjogIjgwODAiLA0KICAiaWQiOiAiZTMyMWIzYTMtZWRjYy00ODAxLThmZGItMzZlZjEzNzlhNTdjIiwNCiAgImFpZCI6ICIwIiwNCiAgInNjeSI6ICJhdXRvIiwNCiAgIm5ldCI6ICJ0Y3AiLA0KICAidHlwZSI6ICJub25lIiwNCiAgImhvc3QiOiAiIiwNCiAgInBhdGgiOiAiIiwNCiAgInRscyI6ICIiDQp9',

    // VLESS
    'vless://e321b3a3-edcc-4801-8fdb-36ef1379a57c@127.0.0.1:8080?security=reality&sni=example.com&fp=chrome&pbk=public-key&sid=short-id&type=tcp&headerType=none#VLESS-Example'
  ]

  if (type === 'xlsx') {
    const data = examples.map((e) => [e])

    const ws = XLSX.utils.aoa_to_sheet(data)
    // 设置列宽
    ws['!cols'] = [{ wch: 100 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, 'proxy_template.xlsx')
  } else {
    const content = examples.join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proxy_template.txt'
    a.click()
    URL.revokeObjectURL(url)
  }
}

// === Actions ===

const handleConfirm = async () => {
  if (proxies.value.length === 0 || importing.value) return

  // 再次校验预览界面的表单
  try {
    await previewFormRef.value?.validate()
  } catch {
    return
  }

  // 校验名称是否为空
  const emptyNameIndices: number[] = []
  const validProxies = proxies.value.filter((p) => p.valid)

  validProxies.forEach((p, index) => {
    if (!p.name || !p.name.trim()) {
      emptyNameIndices.push(index + 1)
    }
  })

  if (emptyNameIndices.length > 0) {
    const lines =
      emptyNameIndices.length > 5
        ? emptyNameIndices.slice(0, 5).join(', ') + ' etc.'
        : emptyNameIndices.join(', ')
    ElMessage.warning(t('proxy.nameEmptyWarning', { line: lines }))
    return
  }

  importing.value = true
  try {
    const res = await ipc.invoke<any>(
      PROXY_EVENTS.BATCH_ADD_PROXY,
      validProxies.map((p) => {
        const raw = toRaw(p)
        return {
          name: raw.name,
          ...raw.payload
        }
      })
    )

    if (res.success) {
      const { success, failed } = res.data
      if (failed > 0) {
        ElMessage.warning(t('proxy.importPartial', { success, failed }))
      } else {
        ElMessage.success(t('proxy.importSuccess', { count: success }))
      }
      emit('success')
      visible.value = false
    } else {
      ElMessage.error(res.error || t('proxy.importFailed'))
    }
  } catch (error: any) {
    ElMessage.error(error?.message || t('proxy.importSystemError'))
  } finally {
    importing.value = false
  }
}

const handleClearError = () => {
  proxies.value = proxies.value.filter((p) => p.valid)
}

const handleSelectionChange = (val: any[]) => {
  selection.value = val
}

const handleBatchDelete = () => {
  if (selection.value.length === 0) return
  const selectedRaws = new Set(selection.value.map((item) => item.raw))
  proxies.value = proxies.value.filter((item) => !selectedRaws.has(item.raw))
  selection.value = []
}

const handleDownloadFailed = () => {
  const failedProxies = proxies.value.filter((p) => !p.valid)
  const failedLines = failedProxies.map((p) => p.raw)
  const blob = new Blob([failedLines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'proxy-failed.txt'
  a.click()
  URL.revokeObjectURL(url)
}
defineExpose({
  init
})
</script>

<style scoped lang="scss">
.pre-config {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.button-group {
  display: flex;
  gap: 8px;
}
.input-container {
  padding: 0;
}

.import-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }
}

.tab-content {
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-area {
  width: 100%;
  :deep(.el-upload) {
    width: 100%;
  }
  :deep(.el-upload-dragger) {
    width: 100%;
  }
}

.paste-actions {
  display: flex;
  justify-content: flex-end;
}

.import-preview-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 4px;

  .el-form-item {
    margin-bottom: 0;
  }
}

.table-wrapper {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.el-upload__tip {
  text-align: center;
  margin-top: 8px;
  color: var(--el-text-color-secondary);

  .template-links {
    margin-top: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}

.success-text {
  color: var(--el-color-success);
}
.error-text {
  color: var(--el-color-danger);
}
.text-gray {
  color: var(--el-text-color-secondary);
}
.raw-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.summary-bar {
  text-align: right;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

/* Parse Help Styles */
.parse-help {
  margin-bottom: 16px;
  padding: 12px;
  background-color: var(--el-bg-color);
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
  max-height: 200px;
  overflow-y: auto;
  margin-top: -8px;
}

.help-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.help-examples {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-category {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.category-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-color-primary);
  margin-bottom: 4px;
}

.help-item {
  font-size: 12px;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;

  code {
    padding: 2px 6px;
    background-color: var(--el-bg-color-page);
    border: 1px solid var(--el-border-color);
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    color: var(--el-color-primary);
    font-size: 12px;
  }
}

.help-note {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-style: italic;
}
</style>
