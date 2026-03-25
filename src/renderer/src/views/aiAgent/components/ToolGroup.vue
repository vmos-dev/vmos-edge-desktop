<template>
  <div class="aic-tool-group">
    <div class="aic-tool-group-list">
      <div
        v-for="(tool, ti) in tools"
        :key="ti"
        class="aic-tool-entry"
        :class="{ 'aic-tool-entry-error': tool.status === 'fail' }"
      >
        <div class="aic-tool-entry-header" @click.stop="$emit('toggle-detail', ti)">
          <svg v-if="tool.status === 'loading'" class="aic-tool-status-icon is-loading" viewBox="0 0 1024 1024" width="13" height="13">
            <path d="M512 64c-247.4 0-448 200.6-448 448s200.6 448 448 448 448-200.6 448-448-200.6-448-448-448zm0 832c-212.1 0-384-171.9-384-384S299.9 128 512 128s384 171.9 384 384-171.9 384-384 384z" fill="currentColor" opacity="0.3"/>
            <path d="M512 128V64C264.6 64 64 264.6 64 512h64c0-212.1 171.9-384 384-384z" fill="currentColor"/>
          </svg>
          <svg v-else-if="tool.status === 'fail'" class="aic-tool-status-icon fail" viewBox="0 0 1024 1024" width="13" height="13">
            <path d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm158.4 625.6c25.6 25.6 25.6 64 0 89.6-12.8 12.8-25.6 19.2-44.8 19.2s-32-6.4-44.8-19.2L512 646.4l-68.8 68.8c-12.8 12.8-25.6 19.2-44.8 19.2s-32-6.4-44.8-19.2c-25.6-25.6-25.6-64 0-89.6l68.8-68.8-68.8-68.8c-25.6-25.6-25.6-64 0-89.6s64-25.6 89.6 0l68.8 68.8 68.8-68.8c25.6-25.6 64-25.6 89.6 0s25.6 64 0 89.6L601.6 556.8l68.8 68.8z" fill="currentColor"/>
          </svg>
          <svg v-else class="aic-tool-status-icon ok" viewBox="0 0 1024 1024" width="13" height="13">
            <path d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm236.8 393.6l-288 288c-12.8 12.8-25.6 19.2-44.8 19.2s-32-6.4-44.8-19.2l-128-128c-25.6-25.6-25.6-64 0-89.6s64-25.6 89.6 0L416 547.2l243.2-243.2c25.6-25.6 64-25.6 89.6 0s25.6 64 0 89.6z" fill="currentColor"/>
          </svg>
          <span class="aic-tool-entry-name">{{ tool.toolTitle || tool.toolName }}</span>
          <svg class="aic-collapse-arrow small" :class="{ expanded: expandedDetails[ti] }" viewBox="0 0 1024 1024" width="11" height="11">
            <path d="M384 192l384 320-384 320z" fill="currentColor" />
          </svg>
        </div>
        <div class="aic-collapsible-content" :class="{ expanded: expandedDetails[ti] }">
          <div class="aic-collapsible-inner">
            <div v-if="tool.arguments" class="aic-tool-detail-content">{{ tool.arguments }}</div>
            <div v-if="tool.fullResult" class="aic-tool-detail-content aic-tool-detail-result">{{ tool.fullResult.length > 1000 ? tool.fullResult.substring(0, 1000) + `... (${tool.fullResult.length} chars)` : tool.fullResult }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tools: any[]
  expandedDetails: Record<number, boolean>
}>()

defineEmits<{
  'toggle-detail': [index: number]
}>()
</script>
