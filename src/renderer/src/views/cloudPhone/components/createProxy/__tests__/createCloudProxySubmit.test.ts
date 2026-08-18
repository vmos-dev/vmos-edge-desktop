import { describe, expect, it } from 'vitest'
import { createDefaultProxyForm } from '@renderer/views/cloudPhone/services/proxyService'
import { buildCreateProxySubmit } from '../createCloudProxySubmit'

describe('buildCreateProxySubmit', () => {
  const proxyList = [
    {
      id: 'proxy-1',
      name: 'Proxy 1',
      protocol: 'http' as const,
      host: '1.1.1.1',
      port: 8080,
      country: 'SG',
      timezone: 'Asia/Singapore',
      loc: '1.3521,103.8198',
      lastCheckStatus: 'success' as const,
      createTime: 0
    }
  ]

  it('returns undefined when create-time proxy is disabled', () => {
    expect(
      buildCreateProxySubmit({
        proxyEnabled: false,
        proxyForm: createDefaultProxyForm(),
        proxyList,
        parseConfigFailedMessage: 'parse failed'
      })
    ).toBeUndefined()
  })

  it('builds proxy without extraData when ip simulator is off', () => {
    const result = buildCreateProxySubmit({
      proxyEnabled: true,
      proxyForm: {
        ...createDefaultProxyForm(),
        id: 'proxy-1',
        ipSimulatorDisabled: false
      },
      proxyList,
      parseConfigFailedMessage: 'parse failed'
    })

    expect(result?.extraData).toBeUndefined()
  })

  it('builds proxy.extraData with fixed false isRestart when ip simulator is on', () => {
    const result = buildCreateProxySubmit({
      proxyEnabled: true,
      proxyForm: {
        ...createDefaultProxyForm(),
        id: 'proxy-1',
        ipSimulatorDisabled: true
      },
      proxyList,
      parseConfigFailedMessage: 'parse failed'
    })

    expect(result?.extraData?.enabled).toBe(true)
    expect(result?.extraData?.isRestart).toBe(false)
  })
})
