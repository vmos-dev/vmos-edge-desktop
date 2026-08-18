<template>
  <div class="aic-thinking-item">
    <div
      class="aic-thinking-header"
      :style="isPlaceholder ? 'cursor: default' : ''"
      @click="!isPlaceholder && $emit('toggle')"
    >
      <span class="aic-thinking-icon-wrapper">
        <span v-if="status === 'loading'" class="aic-thinking-sparkle is-loading">✦</span>
        <span v-else class="aic-thinking-sparkle">✦</span>
      </span>
      <span class="aic-thinking-label">
        {{ thinkingLabel }}
      </span>
      <svg
        v-if="!isPlaceholder"
        class="aic-collapse-arrow"
        :class="{ expanded }"
        viewBox="0 0 1024 1024"
        width="12"
        height="12"
      >
        <path d="M384 192l384 320-384 320z" fill="currentColor" />
      </svg>
    </div>
    <div
      v-if="!isPlaceholder"
      v-show="expanded"
      class="aic-thinking-body aic-markdown-body"
      v-html="renderedContent"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '../utils/chatUtils'
import { defaultT } from '../utils/chatI18n'

const props = withDefaults(
  defineProps<{
    content: string
    expanded: boolean
    status: 'loading' | 'done'
    duration?: number
    t?: (key: string, params?: Record<string, any>) => string
  }>(),
  {
    duration: 0,
    t: undefined
  }
)

defineEmits<{
  toggle: []
}>()

const t = props.t || defaultT

const isPlaceholder = computed(() => props.content === t('chat.noThinking'))

const thinkingLabel = computed(() => {
  if (isPlaceholder.value) return props.content
  if (props.status === 'loading') return t('chat.thinkingInProgress')
  if (props.duration > 0) {
    const sec = Math.round(props.duration / 1000)
    return t('chat.thinkingDone', { duration: sec })
  }
  return t('chat.thinkingTitle')
})

const renderedContent = computed(() => renderMarkdown(props.content))
</script>
