<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CreateCloudSectionCard from './CreateCloudSectionCard.vue'

defineProps<{
  hostIp: string
  showCustomCert: boolean
}>()

const { t } = useI18n()
const form = defineModel<Record<string, any>>('form', { required: true })
const uploadLoading = defineModel<boolean>('uploadLoading', { required: true })
</script>

<template>
  <CreateCloudSectionCard :title="t('cloudPhone.createAdvancedSectionTitle')">
    <el-form-item class="toggle-form-item">
      <template #label>
        <div class="label-row">
          <span class="label-with-tip">
            <span>{{ t('cloudPhone.customSystemProperties') }}</span>
            <el-tooltip :content="t('cloudPhone.customSystemPropertiesTip')" placement="top">
              <span class="question-mark">?</span>
            </el-tooltip>
          </span>
          <el-switch v-model="form.bool_custom_properties" @change="form.userProp = ''" />
        </div>
      </template>
    </el-form-item>

    <el-form-item v-if="form.bool_custom_properties" prop="userProp">
      <vmos-json v-model="form.userProp" />
    </el-form-item>

    <template v-if="showCustomCert">
      <el-form-item class="toggle-form-item">
        <template #label>
          <div class="label-row">
            <span>{{ t('cloudPhone.customCert') }}</span>
            <el-switch v-model="form.bool_custom_cert" />
          </div>
        </template>
      </el-form-item>

      <el-form-item
        v-if="form.bool_custom_cert"
        :label="t('cloudPhone.certFile')"
        prop="cert_hash"
        class="indented-form-item"
      >
        <upload-cert
          v-model="form.cert_hash"
          v-model:upload-loading="uploadLoading"
          :host-ip="hostIp"
        />
      </el-form-item>
    </template>
  </CreateCloudSectionCard>
</template>

<style scoped lang="scss">
.toggle-form-item {
  margin-bottom: 12px;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.question-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--el-text-color-secondary);
  color: var(--el-bg-color);
  font-size: 12px;
  cursor: help;
}

.indented-form-item {
  margin-left: 10px;
}
</style>
