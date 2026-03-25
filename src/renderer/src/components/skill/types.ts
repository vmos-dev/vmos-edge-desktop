/** Skill 列表项 */
export interface SkillListItem {
  name: string
  display_name?: string
  description: string
  scenarios: string
  source: 'builtin' | 'external'
}

/** Skill 详情 */
export interface SkillDetail extends SkillListItem {
  observe_mode: string
  content: string
}

/** Skill 操作结果 */
export interface SkillOperationResult {
  success: boolean
  name: string
  error?: string
}
