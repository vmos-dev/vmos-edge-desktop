<template>
  <vmos-dialog
    v-model="visible"
    :title="t('skill.title')"
    width="860px"
    :close-on-click-modal="false"
    class="skill-manager-dialog"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-title-wrap">
          <el-icon class="header-icon"><MagicStick /></el-icon>
          <span class="header-title">{{ t('skill.title') }}</span>
        </div>
        <div class="header-desc">{{ t('skill.headerDesc') }}</div>
      </div>
    </template>

    <div v-loading="loading" class="manager-content">
      <div class="toolbar">
        <div class="stats">
          {{ t('skill.count', { count: skills.length }) }}
        </div>
        <div class="toolbar-actions">
          <el-button :icon="Upload" @click="triggerImport">
            {{ t('skill.import') }}
          </el-button>
          <el-button type="primary" :icon="Plus" @click="showInstallDialog = true">
            {{ t('skill.create') }}
          </el-button>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept=".md"
          style="display: none"
          @change="handleFileImport"
        />
      </div>

      <!-- 已安装 -->
      <SkillList
        :group-title="t('skill.installedGroup')"
        :skills="skills"
        @select="handleViewDetail"
      >
        <template #action="{ skill }">
          <el-switch
            :model-value="true"
            :disabled="skill.source === 'builtin'"
            size="small"
            @change="
              (val: boolean) => {
                if (!val) handleUninstall(skill)
              }
            "
          />
        </template>
      </SkillList>

      <!-- 推荐 -->
      <div class="recommend-section">
        <div class="recommend-title">{{ t('skill.recommendedGroup') }}</div>
        <div class="recommend-empty">{{ t('skill.noRecommendations') }}</div>
      </div>
    </div>

    <!-- 详情对话框 -->
    <SkillDetailDialog v-model="showDetailDialog" :device="device" :skill-name="detailSkillName" />

    <!-- 安装对话框 -->
    <SkillInstallDialog v-model="showInstallDialog" :device="device" @installed="loadSkills" />
  </vmos-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { MagicStick, Plus, Upload } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { Device } from '@shared/ipc/data.types'
import SkillList from './SkillList.vue'
import { SkillService } from './skillService'
import type { SkillListItem } from './types'
import SkillDetailDialog from './SkillDetailDialog.vue'
import SkillInstallDialog from './SkillInstallDialog.vue'

const { t } = useI18n()

interface Props {
  modelValue: boolean
  device: Device | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = ref(false)
const loading = ref(false)
const skills = ref<SkillListItem[]>([])

const showDetailDialog = ref(false)
const detailSkillName = ref('')
const showInstallDialog = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
  },
  { immediate: true }
)
watch(visible, (val) => {
  emit('update:modelValue', val)
  if (val) loadSkills()
})

const loadSkills = async () => {
  if (!props.device) return
  loading.value = true
  try {
    const res = await SkillService.list(props.device)
    skills.value = res.skills || []
  } catch (e: any) {
    ElMessage.error(t('skill.loadFailed') + ': ' + (e.message || e))
  } finally {
    loading.value = false
  }
}

const triggerImport = () => {
  fileInputRef.value?.click()
}

const handleFileImport = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  // 重置 input，允许重复选择同一文件
  input.value = ''

  // 从文件名提取 skill name（去掉 .md 后缀）
  const name = file.name.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')

  try {
    const content = await file.text()
    await SkillService.install(props.device, name, content)
    ElMessage.success(t('skill.importSuccess'))
    await loadSkills()
  } catch (e: any) {
    ElMessage.error(t('skill.importFailed') + ': ' + (e.message || e))
  }
}

const handleViewDetail = (skill: SkillListItem) => {
  detailSkillName.value = skill.name
  showDetailDialog.value = true
}

const handleUninstall = (skill: SkillListItem) => {
  const name = skill.name
  ElMessageBox.confirm(t('skill.uninstallConfirm', { name }), t('skill.uninstallTitle'), {
    confirmButtonText: t('skill.uninstall'),
    cancelButtonText: t('common.cancel'),
    type: 'warning',
    buttonSize: 'default',
    draggable: true
  })
    .then(async () => {
      try {
        await SkillService.uninstall(props.device, name)
        ElMessage.success(t('skill.uninstallSuccess'))
        await loadSkills()
      } catch (e: any) {
        ElMessage.error(t('skill.uninstallFailed') + ': ' + (e.message || e))
      }
    })
    .catch(() => {})
}
</script>

<style scoped lang="scss">
.skill-manager-dialog {
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

  .header-desc {
    font-size: 13px;
    color: var(--el-text-color-secondary);
    padding-left: 42px;
  }
}

.manager-content {
  padding: var(--app-padding-base) 0 var(--app-padding-small);

  .toolbar {
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .stats {
      font-size: var(--app-text-body-size);
      color: var(--el-text-color-regular);
    }

    .toolbar-actions {
      display: flex;
      gap: 8px;
    }
  }
}

.recommend-section {
  margin-top: 24px;

  .recommend-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }

  .recommend-empty {
    text-align: center;
    padding: 40px 20px;
    font-size: 13px;
    color: var(--el-text-color-placeholder);
  }
}
</style>
