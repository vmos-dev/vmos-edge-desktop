/**
 * AI 对话 UI 内置中文翻译
 */

const messages: Record<string, string> = {
  'chat.user': '用户',
  'chat.ai': 'AI',
  'chat.turnN': '第 {n} 轮',
  'chat.thinkingInProgress': '思考中…',
  'chat.thinkingTitle': '思考过程',
  'chat.thinkingDone': '已深度思考 {duration} 秒',
  'chat.aiThinking': '正在思考…',
  'chat.running': '运行中',
  'chat.completedDetail': '已完成（{turns} 轮，{toolCalls} 次工具调用）',
  'chat.failed': '任务失败',
  'chat.unknownError': '未知错误',
  'chat.send': '发送',
  'chat.stop': '停止',
  'chat.inputPlaceholder': '输入任务描述，Ctrl+Enter 发送',
  'chat.sendTip': 'Ctrl + Enter 发送',
  'chat.selectDevice': '请先选择设备',
  'chat.startFailed': '启动任务失败',
  'chat.stopSuccess': '已发送停止指令',
  'chat.stopFailed': '停止失败',
  'chat.userAvatarShort': '我',
  'chat.noHistory': '暂无对话记录',
  'chat.history': '对话记录',
  'chat.newChat': '新对话',
  'chat.rawShow': '原始数据',
  'chat.rawHide': '隐藏',
  'chat.welcomeTitle': '你好，我是 AI Agent',
  'chat.welcomeDesc': '请输入任务描述，我会帮你在设备上完成操作',
  'chat.toolGroupLoading': '工具调用执行中...',
  'chat.noThinking': '操作完成',
  'chat.toolGroupDone': '工具调用',
  'skill.empty': '暂无技能',
  'skill.builtin': '内置',
  'skill.installed': '已安装',
  'skill.nameLabel': '名称',
  'skill.namePlaceholder': '输入 Skill 名称',
  'skill.descLabel': '描述',
  'skill.descPlaceholder': '输入 Skill 描述',
  'skill.contentLabel': '内容',
  'skill.contentPlaceholder': '输入 Skill 内容（Markdown 格式）'
}

/** 内置翻译函数 */
export function defaultT(key: string, params?: Record<string, any>): string {
  let text = messages[key] || key
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    })
  }
  return text
}
