<script setup lang="ts">
defineOptions({ name: 'SharedFolderPanel' })

import { computed } from 'vue'
import { FolderOpened, SwitchButton, WarningFilled, Link, ArrowDown } from '@element-plus/icons-vue'
import { ElTag } from 'element-plus'
import { CopyText } from '@renderer/components'
import type { SharedFolderStatus } from '@shared/ipc/sharedFolder.types'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  status: SharedFolderStatus
  loading: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  (event: 'pick-directory'): void
  (event: 'open-directory'): void
  (event: 'toggle'): void
}>()

const { t } = useI18n()

const expanded = defineModel<boolean>('expanded', { default: false })

const hasDirectory = computed(() => Boolean(props.status.directory))
const hasInvalidPath = computed(() => hasDirectory.value && !props.status.pathExists)
const pathText = computed(
  () => props.errorMessage || props.status.directory || t('host.sharedFolderEmpty')
)
const canToggle = computed(() => {
  if (props.status.running) return true
  return hasDirectory.value && props.status.pathExists
})

const summaryText = computed(() => {
  if (props.status.running) return props.status.accessUrl || t('host.sharedFolderRunning')
  if (hasDirectory.value) return props.status.directory
  return t('host.sharedFolderEmpty')
})
</script>

<template>
  <section class="collapse-panel" :class="{ expanded }">
    <!-- 折叠头部 -->
    <div class="panel-header" @click="expanded = !expanded">
      <div class="panel-icon shared-icon">
        <el-icon><FolderOpened /></el-icon>
      </div>
      <h3 class="panel-title">{{ t('host.sharedFolderTitle') }}</h3>
      <ElTag v-if="status.running" round type="success" effect="light" size="small">
        {{ t('host.sharedFolderRunning') }}
      </ElTag>
      <ElTag v-else round effect="light" type="info" size="small">
        {{ t('host.sharedFolderStopped') }}
      </ElTag>
      <span class="panel-summary">{{ summaryText }}</span>
      <el-icon class="panel-arrow"><ArrowDown /></el-icon>
    </div>

    <!-- 折叠内容 -->
    <div class="panel-body">
      <div class="panel-body-inner">
        <div class="shared-row">
          <!-- 路径信息 -->
          <div
            class="config-shell"
            :class="{ 'is-invalid': hasInvalidPath, 'config-empty': !hasDirectory }"
          >
            <template v-if="hasDirectory">
              <span class="config-label">{{ t('host.sharedFolderDirectory') }}</span>
              <span class="config-value">
                <CopyText v-if="!errorMessage" :text="status.directory" />
                <span v-else class="path-error">{{ pathText }}</span>
              </span>
              <el-icon v-if="hasInvalidPath" style="color: var(--el-color-danger); flex-shrink: 0"
                ><WarningFilled
              /></el-icon>
            </template>
            <template v-else>
              {{ t('host.sharedFolderEmpty') }}
            </template>
          </div>

          <!-- 操作按钮 -->
          <div class="shared-actions">
            <el-button size="small" :disabled="loading" @click.stop="emit('pick-directory')">
              <el-icon><FolderOpened /></el-icon>
              {{ hasDirectory ? t('host.sharedFolderChange') : t('host.sharedFolderChoose') }}
            </el-button>
            <el-button
              size="small"
              :disabled="loading || !hasDirectory"
              @click.stop="emit('open-directory')"
            >
              <el-icon><Link /></el-icon>
              {{ t('host.sharedFolderOpen') }}
            </el-button>
            <el-button
              :type="status.running ? 'warning' : 'success'"
              size="small"
              :loading="loading"
              :disabled="!canToggle"
              @click.stop="emit('toggle')"
            >
              <el-icon><SwitchButton /></el-icon>
              {{ status.running ? t('host.sharedFolderStop') : t('host.sharedFolderStart') }}
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use './collapse-panel.scss';

.shared-icon {
  background: linear-gradient(
    135deg,
    var(--el-color-success),
    var(--el-color-success-light-3)
  ) !important;
  box-shadow: 0 2px 6px rgba(103, 194, 58, 0.2) !important;
}

.shared-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shared-row .config-shell {
  flex: 1;
  min-width: 0;
}

.shared-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;

  :deep(.el-button) {
    height: 26px;
    padding: 0 10px;
    border-radius: 6px;
    font-size: 12px;
    margin-left: 0;

    .el-icon {
      margin-right: 5px;
    }
  }
}

.config-shell.is-invalid {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}

.path-error {
  color: var(--el-color-danger);
}
</style>
