<template>
  <vmos-dialog
    v-model="visible"
    :title="t('skill.detailTitle')"
    width="660px"
    :close-on-click-modal="true"
    class="skill-detail-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-title-wrap">
          <el-icon class="header-icon"><Document /></el-icon>
          <span class="header-title">{{
            detail?.display_name || detail?.name || t('skill.detailTitle')
          }}</span>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="detail-content">
      <template v-if="detail">
        <div class="meta-section">
          <div class="meta-row">
            <span class="meta-label">{{ t('skill.nameLabel') }}</span>
            <span class="meta-value">
              {{ detail.display_name || detail.name }}
              <el-tag
                :type="detail.source === 'builtin' ? 'info' : 'success'"
                size="small"
                effect="plain"
                class="source-tag"
              >
                {{ detail.source === 'builtin' ? t('skill.builtin') : t('skill.external') }}
              </el-tag>
            </span>
          </div>
          <div class="meta-row">
            <span class="meta-label">{{ t('skill.descLabel') }}</span>
            <span class="meta-value">{{ detail.description || '-' }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">{{ t('skill.scenariosLabel') }}</span>
            <span class="meta-value">{{ detail.scenarios || '-' }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">{{ t('skill.observeModeLabel') }}</span>
            <span class="meta-value">{{ detail.observe_mode || '-' }}</span>
          </div>
        </div>

        <el-divider />

        <div class="content-header">
          <span class="content-title">{{ t('skill.contentLabel') }}</span>
          <el-button text size="small" :icon="showRaw ? View : EditPen" @click="showRaw = !showRaw">
            {{ showRaw ? t('skill.preview') : t('skill.edit') }}
          </el-button>
        </div>

        <el-scrollbar height="360px" class="content-scrollbar">
          <pre v-if="showRaw" class="raw-content">{{ detail.content }}</pre>
          <div v-else class="markdown-body" v-html="renderedContent" />
        </el-scrollbar>
      </template>
    </div>
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, View, EditPen } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import MarkdownIt from 'markdown-it'
import type { Device } from '@shared/ipc/data.types'
import { SkillService } from './skillService'
import type { SkillDetail } from './types'

const { t } = useI18n()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true
})

interface Props {
  modelValue: boolean
  device: Device | null
  skillName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = ref(false)
const loading = ref(false)
const detail = ref<SkillDetail | null>(null)
const showRaw = ref(false)

const renderedContent = computed(() => {
  if (!detail.value?.content) return ''
  return md.render(detail.value.content)
})

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
  },
  { immediate: true }
)
watch(visible, (val) => {
  emit('update:modelValue', val)
  if (!val) {
    detail.value = null
    showRaw.value = false
  }
})

watch(
  () => props.modelValue,
  async (val) => {
    if (val && props.skillName) {
      loading.value = true
      try {
        detail.value = await SkillService.get(props.device, props.skillName)
      } catch (e: any) {
        ElMessage.error(t('skill.loadDetailFailed') + ': ' + (e.message || e))
      } finally {
        loading.value = false
      }
    }
  }
)
</script>

<style scoped lang="scss">
.skill-detail-dialog {
  :deep(.el-dialog__body) {
    padding-top: 0;
  }
}

.dialog-header {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;

    .header-icon {
      font-size: 20px;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      padding: 6px;
      border-radius: var(--app-radius-base);
    }

    .header-title {
      font-size: var(--app-text-h2-size);
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
}

.detail-content {
  padding: 16px 0 0;
  min-height: 200px;
}

.meta-section {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .meta-row {
    display: flex;
    align-items: flex-start;
    gap: 16px;

    .meta-label {
      flex-shrink: 0;
      width: 80px;
      font-size: 13px;
      color: var(--el-text-color-secondary);
      font-weight: 500;
      line-height: 22px;
    }

    .meta-value {
      flex: 1;
      font-size: 13px;
      color: var(--el-text-color-primary);
      line-height: 22px;
      word-break: break-word;

      .source-tag {
        margin-left: 8px;
        vertical-align: middle;
      }
    }
  }
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .content-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }
}

.content-scrollbar {
  margin-top: 8px;
}

.raw-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  word-break: break-word;

  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin-top: 16px;
    margin-bottom: 8px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  :deep(p) {
    margin-bottom: 8px;
  }

  :deep(code) {
    background: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  :deep(pre) {
    background: var(--el-fill-color-light);
    padding: 12px 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin-bottom: 12px;

    code {
      background: none;
      padding: 0;
    }
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 20px;
    margin-bottom: 8px;
  }

  :deep(blockquote) {
    border-left: 3px solid var(--el-border-color);
    padding-left: 12px;
    margin: 8px 0;
    color: var(--el-text-color-secondary);
  }
}
</style>
