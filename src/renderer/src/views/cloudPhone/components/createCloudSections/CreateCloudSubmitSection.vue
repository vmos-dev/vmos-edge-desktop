<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CreateCloudSectionCard from './CreateCloudSectionCard.vue'

defineProps<{
  previewNames: string[]
}>()

const { t } = useI18n()
const form = defineModel<Record<string, any>>('form', { required: true })
</script>

<template>
  <CreateCloudSectionCard :title="t('cloudPhone.createSubmitSectionTitle')">
    <el-form-item :label="t('cloudPhone.deviceName')" prop="user_name">
      <el-input
        v-model="form.user_name"
        :placeholder="t('cloudPhone.deviceNamePlaceholder')"
        maxlength="200"
        show-word-limit
        clearable
      />
    </el-form-item>

    <el-form-item :label="t('cloudPhone.deviceCount')" prop="count">
      <div class="count-row">
        <el-input-number
          v-model="form.count"
          :min="1"
          :max="12"
          controls-position="right"
          class="custom-input-number"
        />
        <span class="count-tip">{{ t('cloudPhone.maxCreateCount') }}</span>
        <el-checkbox v-model="form.bool_start" :label="t('cloudPhone.autoStart')" />
      </div>
    </el-form-item>

    <div v-if="form.user_name" class="preview-section">
      <div>{{ t('cloudPhone.willCreate', { count: form.count }) }}:</div>
      <div class="preview-list">
        <div v-for="name in previewNames" :key="name" class="preview-item">
          {{ name }}
        </div>
      </div>
    </div>
  </CreateCloudSectionCard>
</template>

<style scoped lang="scss">
.count-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.count-tip {
  flex: 1;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.preview-section {
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  background: var(--el-bg-color);
}

.preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  max-height: 110px;
  overflow-y: auto;
}

.preview-item {
  color: var(--el-text-color-primary);
  font-size: 13px;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
}

.custom-input-number {
  width: 120px;
}
</style>
