<template>
  <el-drawer
    v-if="renderDrawer"
    v-model="modelValue"
    append-to-body
    modal-class="vmos-drawer-modal"
    :class="randomClass"
    :show-close="showClose"
    :size="size"
    :direction="direction"
    :close-on-click-modal="false"
    :close-on-press-escape="showClose"
    v-bind="$attrs"
    @close="emit('close')"
    @closed="handleClosed"
  >
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { useSlots } from 'vue'
import { useDeferredOverlayRender } from '../overlay/useDeferredOverlayRender'

defineOptions({ name: 'VmosDrawer' })

withDefaults(
  defineProps<{
    size?: string
    direction?: 'rtl' | 'ltr' | 'ttb' | 'btt'
    showClose?: boolean
  }>(),
  {
    size: '820px',
    direction: 'rtl',
    showClose: true
  }
)

const emit = defineEmits<{
  close: []
  closed: []
}>()

const modelValue = defineModel<boolean>({ default: false })
const { renderOverlay: renderDrawer, handleClosed: handleOverlayClosed } =
  useDeferredOverlayRender(modelValue)

const $slots = useSlots()
const randomId = `vmos-drawer-${Math.random().toString(36).substring(2, 15)}`
const randomClass = `vmos-drawer ${randomId}`

const handleClosed = () => {
  handleOverlayClosed()
  emit('closed')
}
</script>

<style lang="scss">
.vmos-drawer.el-drawer {
  background: var(--el-bg-color);

  .el-drawer__header {
    margin-bottom: 0;
    border-bottom: 1px solid var(--el-border-color-light);
    padding: 16px 20px;
    box-sizing: border-box;
    background: var(--el-bg-color);

    .el-drawer__title {
      color: var(--el-text-color-primary);
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
    }
  }

  .el-drawer__body {
    padding: 0;
    overflow: hidden;
    background: var(--el-bg-color-page);
  }

  .el-drawer__footer {
    border-top: 1px solid var(--el-border-color-light);
    padding: 12px 20px;
    background: var(--el-bg-color);
  }
}

.vmos-drawer-modal {
  background: rgba(15, 23, 42, 0.12);
}
</style>
