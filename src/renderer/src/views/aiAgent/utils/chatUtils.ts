/**
 * AI 对话 UI 工具函数
 */
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

/** 渲染 Markdown 为 HTML */
export function renderMarkdown(text: string): string {
  if (!text) return ''
  try {
    const normalized = text.replace(/\\n/g, '\n')
    return md.render(normalized)
  } catch {
    return text.replace(/\\n/g, '\n').replace(/</g, '&lt;').replace(/\n/g, '<br>')
  }
}

/** 格式化 JSON */
export function formatJson(s: any): string {
  if (!s) return ''
  try {
    const obj = typeof s === 'string' ? JSON.parse(s) : s
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(s)
  }
}

/** 截断结果文本 */
export function truncateResult(s: string, maxLen = 500): string {
  if (!s) return ''
  if (s.length > maxLen) return s.substring(0, maxLen) + `... (${s.length} chars)`
  return s
}

/** 格式化时间戳 */
export function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

/**
 * 从 LLM content 中分离思考链内容
 * 支持格式：
 * 1. <think>...</think> 标签（DeepSeek/QWen）
 * 2. Thought: ... 前缀（通用 ReAct 格式）
 */
export function parseThinkingFromContent(content: string | undefined): {
  thinking: string
  content: string
} {
  if (!content) return { thinking: '', content: '' }

  // 格式 1: <think>...</think>
  const thinkTagMatch = content.match(/^<think>([\s\S]*?)<\/think>\s*/i)
  if (thinkTagMatch) {
    return {
      thinking: thinkTagMatch[1].trim(),
      content: content.slice(thinkTagMatch[0].length).trim()
    }
  }

  // 格式 2: {"thought": "..."} JSON 格式（某些模型返回）
  const trimmed = content.trim()
  if (trimmed.startsWith('{') && trimmed.includes('"thought"')) {
    try {
      const json = JSON.parse(trimmed)
      if (json.thought && typeof json.thought === 'string') {
        return {
          thinking: json.thought.trim(),
          content: ''
        }
      }
    } catch (_) {
      /* 非合法 JSON，忽略 */
    }
  }

  return { thinking: '', content }
}
