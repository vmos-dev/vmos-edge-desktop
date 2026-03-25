<template>
  <el-dialog
    v-if="renderDialog"
    v-model="modelValue"
    modal-class="vmos-dialog-modal"
    :class="randomClass"
    append-to-body
    align-center
    v-bind="$attrs"
    :draggable="draggable"
    :show-close="showClose"
    :width="width"
    :close-on-click-modal="false"
    :close-on-press-escape="showClose"
    @close="handleClose"
    @closed="handleClosed"
  >
    <template v-for="(_, name) in $slots" v-slot:[name]>
      <slot :name="name" />
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, useSlots, watch } from 'vue'
defineOptions({ name: 'VmosDialog' })

defineProps({
  width: {
    type: String,
    default: '30%'
  },
  draggable: {
    type: Boolean,
    default: true
  },
  showClose: {
    type: Boolean,
    default: true
  }
})

const emits = defineEmits(['close', 'closed'])
const modelValue = defineModel<boolean>({ default: false })
const renderDialog = ref(!!modelValue.value)

// Generate stable class name for each dialog instance.
const randomId = `vmos-dialog-${Math.random().toString(36).substring(2, 15)}`
const randomClass = `vmos-dialog ${randomId}`
const $slots = useSlots()

watch(
  () => modelValue.value,
  (val) => {
    if (val) {
      renderDialog.value = true
    }
  }
)

const handleClose = () => {
  emits('close')
}

const handleClosed = () => {
  // Destroy after close transition so `closed` always fires.
  renderDialog.value = false
  emits('closed')
}
</script>

<style lang="scss">
.vmos-dialog.el-dialog {
  padding: 0px;
  .el-dialog__header {
    margin-bottom: 0px;
    -webkit-app-region: no-drag;
    border-bottom: 1px solid var(--el-border-color-light);
    padding: 10px 15px;
    box-sizing: border-box;
    .el-dialog__headerbtn {
      height: 53px;
      -webkit-app-region: no-drag;
      pointer-events: auto;
    }
    span {
      font-weight: bold;
      font-size: 16px;
      -webkit-app-region: no-drag;
    }
  }
  .el-dialog__body {
    padding: 20px 15px;
  }
  .el-dialog__footer {
    border-top: 1px solid var(--el-border-color-light);
    padding: 8px 20px;
  }
}

.vmos-dialog-modal {
  background: rgba(0, 0, 0, 0.2);
}
</style>
