<template>
  <el-dialog
    v-if="modelValue"
    v-model="modelValue"
    modal-class="vmos-dialog-modal"
    :class="randomClass"
    append-to-body
    align-center
    v-bind="$attrs"
    :draggable="draggable"
    :width="width"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @close="emits('close')"
    @closed="emits('closed')"
  >
    <template v-for="(_, name) in $slots" v-slot:[name]>
      <slot :name="name" />
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { useSlots } from 'vue'
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
// 生成随机 id
const randomId = `vmos-dialog-${Math.random().toString(36).substring(2, 15)}`
// 生成随机 class
const randomClass = `vmos-dialog ${randomId}`
const $slots = useSlots()

// const handleOpen = async () => {
//   await nextTick()
//   const dialogEl = document.querySelector(`.${randomId}`) as HTMLElement | undefined
//   if (!dialogEl) return

//   // 重置拖拽残留状态，确保每次打开都居中
//   dialogEl.style.transform = 'none'
//   dialogEl.style.left = ''
//   dialogEl.style.top = ''
// }
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
