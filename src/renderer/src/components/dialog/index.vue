<template>
  <el-dialog
    ref="dialogRef"
    v-model="modelValue"
    modal-class="vmos-dialog-modal"
    class="vmos-dialog"
    append-to-body
    align-center
    v-bind="$attrs"
    :draggable="draggable"
    :width="width"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @open="handleOpen"
    @close="emits('close')"
    @closed="emits('closed')"
  >
    <template v-for="(_, name) in $slots" v-slot:[name]>
      <slot :name="name" />
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, useSlots, nextTick } from 'vue'
import type { ElDialog } from 'element-plus'

defineOptions({ name: 'VmosDialog' })

const props = defineProps({
  width: {
    type: String,
    default: '30%'
  },
  draggable: {
    type: Boolean,
    default: true
  }
})

const emits = defineEmits(['close', 'closed'])
const modelValue = defineModel<boolean>()
const $slots = useSlots()

const dialogRef = ref<InstanceType<typeof ElDialog>>()

const handleOpen = async () => {
  await nextTick()

  const dialogEl = dialogRef.value?.$el as HTMLElement | undefined
  if (!dialogEl) return

  // 重置拖拽残留状态
  dialogEl.style.transform = ''
  dialogEl.style.left = ''
  dialogEl.style.top = ''
  dialogEl.style.margin = ''
}
</script>

<style lang="scss">
.vmos-dialog.el-dialog {
  padding: 0px;
  .el-dialog__header {
    margin-bottom: 0px;
    -webkit-app-region: no-drag;
    border-bottom: 1px solid #e4e4e7;
    padding: 10px 15px;
    box-sizing: border-box;
    .el-dialog__headerbtn {
      height: 53px;
      -webkit-app-region: no-drag;
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
    border-top: 1px solid #e4e4e7;
    padding: 8px 20px;
  }
}

.vmos-dialog-modal {
  background: rgba(0, 0, 0, 0.2);
}
</style>
