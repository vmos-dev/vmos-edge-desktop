import type { FlowEngineInstallStrategy } from '../ipc/flowEngine.types'

export interface FlowEngineStrategyInput {
  reachable: boolean
  remoteVersionCode?: number
  bundledVersionCode: number
}

export function decideFlowEngineInstallStrategy(
  input: FlowEngineStrategyInput
): FlowEngineInstallStrategy {
  if (!input.reachable) return 'unreachable'
  if (typeof input.remoteVersionCode !== 'number') return 'install'
  return input.remoteVersionCode < input.bundledVersionCode ? 'update' : 'none'
}
