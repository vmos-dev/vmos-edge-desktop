import type { Proxy } from '@shared/ipc/data.types'
import {
  buildProxyPayload,
  type BuildProxyPayloadOptions,
  type ProxyFormModel
} from '@renderer/views/cloudPhone/services/proxyService'

interface BuildCreateProxySubmitArgs {
  proxyEnabled: boolean
  proxyForm: ProxyFormModel
  proxyList: Proxy[]
  parseConfigFailedMessage: string
}

export const buildCreateProxySubmit = ({
  proxyEnabled,
  proxyForm,
  proxyList,
  parseConfigFailedMessage
}: BuildCreateProxySubmitArgs) => {
  if (!proxyEnabled) {
    return undefined
  }

  const options: BuildProxyPayloadOptions | undefined = proxyForm.ipSimulatorDisabled
    ? {
        ipSimulatorMode: 'custom-params',
        extraDataKey: 'extraData',
        isRestart: false
      }
    : undefined

  return buildProxyPayload(proxyForm, proxyList, parseConfigFailedMessage, options).params
}
