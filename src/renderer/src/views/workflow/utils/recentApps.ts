import type { AppInfo } from '@shared/ipc/workflow.types'

export function resolveRecentApps(
  scannedApps: readonly AppInfo[],
  recentApps: readonly AppInfo[],
  limit = 4
): AppInfo[] {
  const currentAppMap = new Map(scannedApps.map((app) => [app.packageName, app]))
  const resolved: AppInfo[] = []
  const seen = new Set<string>()

  for (const recentApp of recentApps) {
    if (seen.has(recentApp.packageName)) continue

    const matchedApp = currentAppMap.get(recentApp.packageName)
    if (!matchedApp) continue

    resolved.push(matchedApp)
    seen.add(recentApp.packageName)

    if (resolved.length >= limit) break
  }

  return resolved
}
