<template>
  <div class="aic-chat-content">
    <!-- 空状态 -->
    <div v-if="messages.length === 0" class="aic-empty-state">
      <slot name="empty">
        <img v-if="aiAvatar" :src="aiAvatar" class="aic-empty-avatar" />
        <h3 class="aic-empty-title">{{ t('chat.welcomeTitle') }}</h3>
        <p class="aic-empty-desc">{{ t('chat.welcomeDesc') }}</p>
        <div v-if="quickActions && quickActions.length > 0" class="aic-quick-actions">
          <div
            v-for="(action, i) in quickActions"
            :key="i"
            class="aic-quick-action-card"
            @click="$emit('quick-action', action.prompt)"
          >
            <div class="aic-quick-action-icon" v-html="action.icon" />
            <div class="aic-quick-action-text">
              <div class="aic-quick-action-title">{{ action.title }}</div>
              <div class="aic-quick-action-desc">{{ action.desc }}</div>
            </div>
          </div>
        </div>
      </slot>
    </div>

    <!-- 消息列表 -->
    <template v-for="(msg, idx) in messages" :key="idx">
      <!-- 用户消息 -->
      <div v-if="msg.type === 'user'" class="aic-message-row aic-user-message">
        <div class="aic-message-header aic-user-header">
          <div class="aic-message-label">{{ t('chat.user') }}</div>
          <div class="aic-avatar aic-user-avatar">{{ userAvatarText }}</div>
        </div>
        <div class="aic-message-bubble aic-user-bubble">{{ msg.content }}</div>
      </div>

      <!-- 轮次分隔线 -->
      <div v-else-if="msg.type === 'turn_divider'" class="aic-turn-divider">
        <div class="aic-divider">
          <span class="aic-divider-text">{{ t('chat.turnN', { n: msg.turn }) }}</span>
        </div>
      </div>

      <!-- AI 响应（思考链 + 正文 + 工具调用 在同一个气泡内） -->
      <div v-else-if="msg.type === 'assistant'" class="aic-message-row aic-ai-message">
        <div class="aic-message-header aic-ai-header">
          <img v-if="aiAvatar" :src="aiAvatar" class="aic-avatar aic-ai-avatar" />
          <span class="aic-message-label">{{ t('chat.ai') }}</span>
          <button v-if="debug && msg._raw" class="aic-btn-link" @click="msg.showRaw = !msg.showRaw">
            {{ msg.showRaw ? t('chat.rawHide') : t('chat.rawShow') }}
          </button>
        </div>
        <div class="aic-message-bubble aic-ai-bubble">
          <!-- 思考链（从 _thinking 合并或 content 内嵌） -->
          <ThinkingBlock
            v-if="getThinkingContent(msg)"
            :content="getThinkingContent(msg)!"
            :expanded="props.isThinkingExpanded(idx)"
            :status="getThinkingStatus(msg)"
            :duration="getThinkingDuration(msg)"
            :t="t"
            @toggle="props.toggleThinking(idx)"
          />
          <!-- 正文内容 -->
          <div
            v-if="getAssistantContent(msg)"
            class="aic-markdown-body"
            v-html="renderMarkdown(getAssistantContent(msg))"
          />
          <!-- 无思考也无正文时显示"操作完成" -->
          <div v-else-if="!getThinkingContent(msg)" class="aic-markdown-body">
            {{ t('chat.noThinking') }}
          </div>
          <!-- 内嵌工具调用 -->
          <ToolGroup
            v-if="msg._toolGroup"
            :tools="msg._toolGroup.tools"
            :expanded-details="
              getToolDetailExpandedMap(msg._toolGroup.groupId, msg._toolGroup.tools.length)
            "
            @toggle-detail="(ti: number) => toggleToolDetail(msg._toolGroup.groupId, ti)"
          />
        </div>
        <div v-if="msg.showRaw" class="aic-raw-block">{{ formatJson(msg._raw) }}</div>
      </div>

      <!-- 独立工具调用分组（无前置 assistant 消息时的兜底） -->
      <div v-else-if="msg.type === 'tool_group'" class="aic-message-row aic-ai-message">
        <div class="aic-message-header aic-ai-header">
          <img v-if="aiAvatar" :src="aiAvatar" class="aic-avatar aic-ai-avatar" />
          <span class="aic-message-label">{{ t('chat.ai') }}</span>
        </div>
        <div class="aic-message-bubble aic-ai-bubble">
          <ToolGroup
            :tools="msg.tools"
            :expanded-details="getToolDetailExpandedMap(msg.groupId, msg.tools.length)"
            @toggle-detail="(ti: number) => toggleToolDetail(msg.groupId, ti)"
          />
        </div>
      </div>

      <!-- 完成状态 -->
      <div v-else-if="msg.type === 'completed'" class="aic-status-bar aic-completed">
        <div class="aic-status-content">
          <svg class="aic-status-icon success" viewBox="0 0 1024 1024" width="16" height="16">
            <path
              d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm236.8 393.6l-288 288c-12.8 12.8-25.6 19.2-44.8 19.2s-32-6.4-44.8-19.2l-128-128c-25.6-25.6-25.6-64 0-89.6s64-25.6 89.6 0L416 547.2l243.2-243.2c25.6-25.6 64-25.6 89.6 0s25.6 64 0 89.6z"
              fill="currentColor"
            />
          </svg>
          <span>{{ completedText(msg) }}</span>
          <button
            v-if="debug && msg._raw"
            class="aic-btn-link"
            @click.stop="msg.showRaw = !msg.showRaw"
          >
            {{ msg.showRaw ? t('chat.rawHide') : t('chat.rawShow') }}
          </button>
        </div>
        <div v-if="msg.content" class="aic-status-detail">{{ msg.content }}</div>
        <div v-if="msg.showRaw" class="aic-raw-block">{{ formatJson(msg._raw) }}</div>
      </div>

      <!-- 失败状态 -->
      <div v-else-if="msg.type === 'failed'" class="aic-status-bar aic-failed">
        <div class="aic-status-content">
          <svg class="aic-status-icon danger" viewBox="0 0 1024 1024" width="16" height="16">
            <path
              d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0zm158.4 625.6c25.6 25.6 25.6 64 0 89.6-12.8 12.8-25.6 19.2-44.8 19.2s-32-6.4-44.8-19.2L512 646.4l-68.8 68.8c-12.8 12.8-25.6 19.2-44.8 19.2s-32-6.4-44.8-19.2c-25.6-25.6-25.6-64 0-89.6l68.8-68.8-68.8-68.8c-25.6-25.6-25.6-64 0-89.6s64-25.6 89.6 0l68.8 68.8 68.8-68.8c25.6-25.6 64-25.6 89.6 0s25.6 64 0 89.6L601.6 556.8l68.8 68.8z"
              fill="currentColor"
            />
          </svg>
          <span>{{ t('chat.failed') }}</span>
          <button
            v-if="debug && msg._raw"
            class="aic-btn-link"
            @click.stop="msg.showRaw = !msg.showRaw"
          >
            {{ msg.showRaw ? t('chat.rawHide') : t('chat.rawShow') }}
          </button>
        </div>
        <div v-if="msg.content" class="aic-status-detail aic-error-text">{{ msg.content }}</div>
        <div v-if="msg.showRaw" class="aic-raw-block">{{ formatJson(msg._raw) }}</div>
      </div>

      <!-- 未知消息类型：通过 slot 扩展 -->
      <slot v-else :name="`message-${msg.type}`" :message="msg">
        <!-- 默认不渲染未知类型 -->
      </slot>
    </template>

    <!-- 思考中指示器 -->
    <div v-if="isRunning && !hasRecentMessage" class="aic-message-row aic-ai-message">
      <div class="aic-message-header aic-ai-header">
        <img v-if="aiAvatar" :src="aiAvatar" class="aic-avatar aic-ai-avatar" />
        <span class="aic-message-label">{{ t('chat.ai') }}</span>
      </div>
      <div class="aic-message-bubble aic-ai-bubble aic-thinking-bubble">
        <span>{{ t('chat.aiThinking') }}</span>
        <div class="aic-typing-indicator">
          <span class="aic-dot" />
          <span class="aic-dot" />
          <span class="aic-dot" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { renderMarkdown, formatJson, parseThinkingFromContent } from '../utils/chatUtils'
import { defaultT } from '../utils/chatI18n'
import ThinkingBlock from './ThinkingBlock.vue'
import ToolGroup from './ToolGroup.vue'
import type { DisplayMessage, QuickAction } from '../utils/chatTypes'

const props = withDefaults(
  defineProps<{
    messages: DisplayMessage[]
    isRunning: boolean
    hasRecentMessage: boolean
    aiAvatar?: string
    userAvatarText?: string
    debug?: boolean
    quickActions?: QuickAction[]
    toggleThinking: (msgIdx: number) => void
    isThinkingExpanded: (msgIdx: number) => boolean
    toggleToolDetail: (groupId: string, toolIdx: number) => void
    isToolDetailExpanded: (groupId: string, toolIdx: number) => boolean
    t?: (key: string, params?: Record<string, any>) => string
  }>(),
  {
    aiAvatar: undefined,
    userAvatarText: undefined,
    debug: false,
    quickActions: undefined,
    t: undefined
  }
)

defineEmits<{
  'quick-action': [prompt: string]
}>()

const t = props.t || defaultT
const userAvatarText = props.userAvatarText || t('chat.userAvatarShort')

/** 提取思考内容：优先 _thinking（合并的 thinking 消息）、其次 reasoning_content、最后从 content 解析。返回 null 表示无思考 */
function getThinkingContent(msg: any): string | null {
  if (msg._thinking?.content && msg._thinking.content.trim()) return msg._thinking.content
  if (
    msg.reasoning_content &&
    typeof msg.reasoning_content === 'string' &&
    msg.reasoning_content.trim()
  ) {
    return msg.reasoning_content
  }
  const parsed = parseThinkingFromContent(msg.content)
  if (parsed.thinking.trim()) return parsed.thinking
  return null
}

/** 思考状态：_thinking 可能还在 loading */
function getThinkingStatus(msg: any): 'loading' | 'done' {
  if (msg._thinking) return msg._thinking.status || 'done'
  return 'done'
}

/** 思考耗时（毫秒） */
function getThinkingDuration(msg: any): number {
  return msg._thinking?.duration || msg._thinkingDuration || 0
}

/** 内容是否为空（null / "null" / 空白 均视为空） */
function isEmptyContent(s: any): boolean {
  return !s || s === 'null' || (typeof s === 'string' && !s.trim())
}

/** 去除 Thought: 前缀 */
function stripThoughtPrefix(s: string): string {
  return s.replace(/^Thought:\s*/i, '')
}

/** 提取 assistant 消息的正文内容（去除思考链部分） */
function getAssistantContent(msg: any): string {
  if (isEmptyContent(msg.content)) return ''
  if (msg._thinking || msg.reasoning_content) return stripThoughtPrefix(msg.content || '')
  const parsed = parseThinkingFromContent(msg.content)
  return stripThoughtPrefix(parsed.content)
}

/** 完成状态文案（model 为空时不显示） */
function completedText(msg: any): string {
  const base = t('chat.completedDetail', { turns: msg.turns, toolCalls: msg.toolCallCount })
  return msg.model ? `${base} · ${msg.model}` : base
}

/** 构建工具详情展开映射 */
function getToolDetailExpandedMap(groupId: string, count: number): Record<number, boolean> {
  const map: Record<number, boolean> = {}
  for (let i = 0; i < count; i++) {
    map[i] = props.isToolDetailExpanded(groupId, i)
  }
  return map
}
</script>
