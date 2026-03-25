/**
 * 消息分组 composable
 * 职责：将 thinking 合并到后续 assistant、连续 tool_call 合并到前一个 assistant、管理展开/折叠状态
 */
import { computed, reactive, type Ref } from 'vue'
import type { ChatMessage, DisplayMessage, TranslateFn } from '../utils/chatTypes'
import { MESSAGE_TYPES } from '../utils/chatTypes'
import { defaultT } from '../utils/chatI18n'

export interface UseMessageGroupsOptions {
  messages: Ref<ChatMessage[]>
  t?: TranslateFn
}

export function useMessageGroups(options: UseMessageGroupsOptions) {
  const { messages, t = defaultT } = options

  // ===== 展开状态 =====
  const toolGroupExpanded = reactive<Record<string, boolean>>({})
  const toolDetailExpanded = reactive<Record<string, boolean>>({})

  /** 将 thinking 合并到后续 assistant、tool_call 合并到前一个 assistant */
  const displayMessages = computed<DisplayMessage[]>(() => {
    const result: DisplayMessage[] = []
    let i = 0
    let pendingThinking: ChatMessage | null = null

    while (i < messages.value.length) {
      const msg = messages.value[i]

      if (msg.type === MESSAGE_TYPES.THINKING) {
        // 暂存 thinking，等待后续 assistant 合并
        pendingThinking = msg
        i++
        continue
      }

      if (msg.type === MESSAGE_TYPES.ASSISTANT) {
        // 将 pendingThinking 挂载到 assistant 上（保持原始响应式引用，不用 spread）
        const assistantMsg = msg as any
        if (pendingThinking) {
          assistantMsg._thinking = pendingThinking
          pendingThinking = null
        } else {
          assistantMsg._thinking = undefined
        }
        result.push(assistantMsg)
        i++
        continue
      }

      if (msg.type === MESSAGE_TYPES.TOOL_CALL) {
        // 如果有 pendingThinking 但没有 assistant 来接，先 flush 它
        if (pendingThinking) {
          // 创建一个只有 thinking 的虚拟 assistant
          result.push({ type: MESSAGE_TYPES.ASSISTANT, content: '', _thinking: pendingThinking } as any)
          pendingThinking = null
        }
        // 收集连续的 tool_call
        const tools: any[] = []
        const startIdx = i
        while (i < messages.value.length && messages.value[i].type === MESSAGE_TYPES.TOOL_CALL) {
          tools.push(messages.value[i])
          i++
        }
        const groupId = `tg-${startIdx}`
        const prev = result.length > 0 ? result[result.length - 1] : null
        if (prev && prev.type === MESSAGE_TYPES.ASSISTANT) {
          prev._toolGroup = { groupId, tools }
        } else {
          result.push({ type: MESSAGE_TYPES.TOOL_GROUP, groupId, tools })
        }
        continue
      }

      // 其他消息类型：先 flush pendingThinking
      if (pendingThinking) {
        result.push({ type: MESSAGE_TYPES.ASSISTANT, content: '', _thinking: pendingThinking } as any)
        pendingThinking = null
      }
      result.push(msg)
      i++
    }

    // 末尾还有未合并的 thinking（正在思考中）
    if (pendingThinking) {
      result.push({ type: MESSAGE_TYPES.ASSISTANT, content: '', _thinking: pendingThinking } as any)
    }

    return result
  })

  /** 是否有最近的活跃消息（用于 thinking 指示器） */
  const hasRecentMessage = computed(() => {
    if (messages.value.length === 0) return false
    const last = messages.value[messages.value.length - 1]
    return last.type === MESSAGE_TYPES.ASSISTANT
      || last.type === MESSAGE_TYPES.TOOL_CALL
      || last.type === MESSAGE_TYPES.THINKING
  })

  // ===== 思考链展开状态 =====
  const thinkingExpanded = reactive<Record<number, boolean>>({})

  function toggleThinking(msgIdx: number) {
    thinkingExpanded[msgIdx] = !thinkingExpanded[msgIdx]
  }

  function isThinkingExpanded(msgIdx: number): boolean {
    return !!thinkingExpanded[msgIdx]
  }

  // ===== 操作 =====
  function toggleToolGroup(groupId: string) {
    toolGroupExpanded[groupId] = !toolGroupExpanded[groupId]
  }

  function toggleToolDetail(groupId: string, toolIdx: number) {
    const key = `${groupId}-${toolIdx}`
    toolDetailExpanded[key] = !toolDetailExpanded[key]
  }

  function isToolDetailExpanded(groupId: string, toolIdx: number): boolean {
    return !!toolDetailExpanded[`${groupId}-${toolIdx}`]
  }

  function toolGroupSummary(group: any): string {
    const total = group.tools.length
    const loading = group.tools.filter((tc: any) => tc.status === 'loading').length
    if (loading > 0) return t('chat.toolGroupLoading', { loading, total })
    return t('chat.toolGroupDone', { total })
  }

  return {
    displayMessages,
    hasRecentMessage,
    thinkingExpanded,
    toggleThinking,
    isThinkingExpanded,
    toolGroupExpanded,
    toolDetailExpanded,
    toggleToolGroup,
    toggleToolDetail,
    isToolDetailExpanded,
    toolGroupSummary
  }
}
