import { ref, watch } from 'vue'
import store from 'store'

/* =========================
 * Storage Keys
 * ========================= */
const AI_MODELS_KEY = 'ai_models_config'

/* =========================
 * Types
 * ========================= */
export interface AiModelConfig {
  id: string // 唯一标识
  vendor: string // 模型厂商
  apiHost: string // API Host
  modelName: string // 模型名称
  apiKey: string // API Key
  displayName?: string // 显示名称（可选，用于下拉框显示）
}

/* =========================
 * Store Management
 * ========================= */
function getStoredModels(): AiModelConfig[] {
  const stored = store.get(AI_MODELS_KEY)
  if (stored && Array.isArray(stored)) {
    return stored
  }
  return []
}

function saveModels(models: AiModelConfig[]) {
  store.set(AI_MODELS_KEY, models)
}

/* =========================
 * Hook — 仅管理模型列表的增删改，不含"选中"状态
 * "选中哪个模型"由各业务页面（AI Agent / 工作流）各自维护
 * ========================= */
export function useAiModelConfig() {
  const models = ref<AiModelConfig[]>(getStoredModels())

  // 监听 models 变化，同步到 store
  watch(
    models,
    (newModels) => {
      saveModels(newModels)
    },
    { deep: true }
  )

  // 添加模型
  const addModel = (model: AiModelConfig) => {
    models.value.push(model)
  }

  // 更新模型
  const updateModel = (id: string, updates: Partial<AiModelConfig>) => {
    const index = models.value.findIndex((m) => m.id === id)
    if (index !== -1) {
      models.value[index] = { ...models.value[index], ...updates }
    }
  }

  // 删除模型
  const deleteModel = (id: string) => {
    const index = models.value.findIndex((m) => m.id === id)
    if (index !== -1) {
      models.value.splice(index, 1)
    }
  }

  // 获取模型
  const getModel = (id: string) => {
    return models.value.find((m) => m.id === id)
  }

  return {
    models,
    addModel,
    updateModel,
    deleteModel,
    getModel
  }
}

export function vendorToProvider(vendor: string): string {
  const normalized = String(vendor || '')
    .trim()
    .toLowerCase()

  if (normalized.includes('deepseek')) return 'deepseek'
  if (normalized.includes('openai')) return 'openai'
  if (normalized.includes('anthropic') || normalized.includes('claude')) return 'anthropic'
  if (normalized.includes('google') || normalized.includes('gemini')) return 'google'
  if (normalized.includes('azure')) return 'azure'
  if (
    normalized.includes('dashscope') ||
    normalized.includes('zhipu') ||
    normalized.includes('ollama') ||
    normalized.includes('other') ||
    normalized.includes('custom')
  ) {
    return 'custom'
  }

  return 'custom'
}
