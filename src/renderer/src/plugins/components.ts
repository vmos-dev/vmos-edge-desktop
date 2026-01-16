import type { App } from 'vue'
import { globalComponents } from '../components'

export function setupGlobalComponents(app: App) {
  for (const [key, component] of Object.entries(globalComponents)) {
    app.component(key, component)
  }
}
