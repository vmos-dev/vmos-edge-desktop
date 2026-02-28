<template>
  <div class="tabs" :style="{ height: height }">
    <div
      class="tab-item"
      v-for="tab in tabs"
      :key="tab.value"
      :class="{ active: modelValue === tab.value }"
      @click="modelValue = tab.value"
    >
      <span class="tab-label">{{ tab.label }}</span>
      <div class="tab-indicator" :class="{ active: modelValue === tab.value }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'VmosTabs' })

withDefaults(
  defineProps<{
    tabs: {
      value: string
      label: string
    }[]
    height?: string
  }>(),
  {
    height: '40px'
  }
)

const modelValue = defineModel<string>('modelValue')
</script>

<style scoped lang="scss">
.tabs {
  display: flex;
  width: 100%;
  background-color: var(--el-bg-color-page);
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
  position: relative;
  box-sizing: border-box;

  .tab-item {
    flex: 1;
    position: relative;
    cursor: pointer;
    padding: 0 16px;
    border-radius: 6px;
    background-color: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    z-index: 1;

    .tab-label {
      position: relative;
      z-index: 2;
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-secondary);
      transition: color 0.25s ease;
      user-select: none;
      white-space: nowrap;
    }

    .tab-indicator {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--el-bg-color);
      border-radius: 6px;
      opacity: 0;
      transition: opacity 0.25s ease;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      z-index: 0;

      &.active {
        opacity: 1;
      }
    }

    &:hover:not(.active) {
      .tab-label {
        color: var(--el-color-primary);
      }
    }

    &.active {
      .tab-label {
        color: var(--el-text-color-regular);
        font-weight: 500;
      }
    }
  }
}
</style>
