<template>
  <template v-if="text">
    <el-tooltip :content="text" v-if="text" placement="top">
      <span class="copy-text" @click="handleCopy" :style="styles">{{ text }}</span>
    </el-tooltip>
  </template>
  <span class="copy-text" v-else>-</span>
</template>
<script setup lang="ts">
import { copyToClipboard } from '@renderer/utils/index'
import { ElMessage } from 'element-plus'
import { computed } from 'vue'

defineOptions({ name: 'CopyText' })

const props = defineProps<{
  text?: string
  color?: string
}>()

const styles = computed(() => {
  return {
    color: props.color
  }
})

const handleCopy = () => {
  if (!props.text) return
  copyToClipboard(props.text, () => ElMessage.success('复制成功'))
}
</script>
