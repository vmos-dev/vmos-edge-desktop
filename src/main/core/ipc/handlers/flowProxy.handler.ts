import { handle } from '../IpcBus'
import { FlowEngineClient } from '../../client/FlowEngineClient'
import { FLOW_ENGINE_PORT } from '@shared/constant/flowEngine'
import {
  FLOW_EVENTS,
  type FlowIpcExecutePayload,
  type FlowIpcStatusPayload,
  type FlowIpcCancelPayload,
  type FlowExecuteResponse,
  type FlowStatusResponse,
  type FlowCancelResponse
} from '@shared/ipc/flowEngine.api.types'
import { logger } from '../../logger'

function handleError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  logger.error(`[FlowProxy Handler] ${msg}`)
  return { success: false as const, error: msg }
}

export function registerFlowProxyHandlers(): void {
  handle<FlowIpcExecutePayload, FlowExecuteResponse>(FLOW_EVENTS.EXECUTE, async (payload) => {
    try {
      const client = new FlowEngineClient(payload.hostIp, FLOW_ENGINE_PORT)
      const result = await client.execute({ yaml: payload.yaml, devices: payload.devices })
      return { success: true, data: result }
    } catch (err) {
      return handleError(err)
    }
  })

  handle<FlowIpcStatusPayload, FlowStatusResponse>(FLOW_EVENTS.STATUS, async (payload) => {
    try {
      const client = new FlowEngineClient(payload.hostIp, FLOW_ENGINE_PORT)
      const result = await client.status({ deviceIds: payload.deviceIds })
      return { success: true, data: result }
    } catch (err) {
      return handleError(err)
    }
  })

  handle<FlowIpcCancelPayload, FlowCancelResponse>(FLOW_EVENTS.CANCEL, async (payload) => {
    try {
      const client = new FlowEngineClient(payload.hostIp, FLOW_ENGINE_PORT)
      const result = await client.cancel({ deviceIds: payload.deviceIds })
      return { success: true, data: result }
    } catch (err) {
      return handleError(err)
    }
  })
}
