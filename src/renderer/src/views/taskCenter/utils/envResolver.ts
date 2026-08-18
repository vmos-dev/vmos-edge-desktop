import { parseAllDocuments } from 'yaml'

export function parseYamlDefaultEnv(yamlText: string): Record<string, string> {
  try {
    const docs = parseAllDocuments(yamlText)
    if (docs.length > 0) {
      const config = docs[0].toJSON()
      if (config?.env && typeof config.env === 'object') {
        return { ...config.env }
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return {}
}

export function mergeEnv(
  yamlText: string,
  deviceEnv: Record<string, string>
): Record<string, string> {
  return { ...parseYamlDefaultEnv(yamlText), ...deviceEnv }
}

export function substituteEnvVars(value: string, env: Record<string, string>): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, key) => (key in env ? env[key] : match))
}
