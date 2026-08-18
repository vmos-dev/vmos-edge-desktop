<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="create-cloud-section-card">
    <header class="section-card-header">
      <div class="section-card-title">{{ title }}</div>
      <p v-if="description" class="section-card-description">
        {{ description }}
      </p>
    </header>

    <div class="section-card-body">
      <slot />
    </div>
  </section>
</template>

<style scoped lang="scss">
.create-cloud-section-card {
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.section-card-header {
  margin-bottom: 12px;
}

.section-card-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}

.section-card-description {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.section-card-body {
  min-width: 0;
}
</style>
