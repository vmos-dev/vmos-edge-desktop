import { parseAllDocuments } from 'yaml'

export function extractVariableNames(yamlText: string): string[] {
  const vars = new Set<string>()
  try {
    const docs = parseAllDocuments(yamlText)
    if (docs.length > 0) {
      const config = docs[0].toJSON()
      if (config?.env && typeof config.env === 'object') {
        Object.keys(config.env).forEach((k) => vars.add(k))
      }
    }
    const commands = docs.length > 1 ? docs[1].toJSON() : docs[0].toJSON()
    if (Array.isArray(commands)) {
      scanCommands(commands, vars)
    }
  } catch {
    /* YAML parse error — return empty */
  }
  return Array.from(vars)
}

function scanCommands(commands: unknown[], vars: Set<string>): void {
  for (const cmd of commands) {
    if (!cmd || typeof cmd !== 'object') continue
    const obj = cmd as Record<string, unknown>

    if (obj.defineVariables && typeof obj.defineVariables === 'object') {
      Object.keys(obj.defineVariables as object).forEach((k) => vars.add(k))
    }

    for (const action of ['runFlow', 'repeat', 'retry']) {
      const body = obj[action]
      if (!body || typeof body !== 'object') continue
      const block = body as Record<string, unknown>
      if (block.env && typeof block.env === 'object') {
        Object.keys(block.env as object).forEach((k) => vars.add(k))
      }
      if (Array.isArray(block.commands)) {
        scanCommands(block.commands, vars)
      }
    }
  }
}
