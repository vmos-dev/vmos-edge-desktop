import { describe, expect, it } from 'vitest'
import type { ParsedProxyResult } from '@renderer/components/proxy/customProxyTypes'
import {
  buildCustomProxyPayload,
  buildProxyPayload,
  computeProxyHash,
  createDefaultProxyForm,
  proxyIdentity
} from '../proxyService'

describe('proxyService', () => {
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

  it('adds extraData and nests batch isRestart with a false default', () => {
    const form = {
      ...createDefaultProxyForm(),
      id: 'proxy-1',
      ipSimulatorDisabled: true
    }

    const { params } = buildProxyPayload(form, proxyList, 'parse failed', {
      ipSimulatorMode: 'custom-params',
      extraDataKey: 'extraData'
    })

    expect(params.extraData).toEqual({
      enabled: true,
      country: 'SG',
      language: 'en',
      timezone: 'Asia/Singapore',
      longitude: 103.8198,
      latitude: 1.3521,
      isRestart: false
    })
    expect(params.isRestart).toBeUndefined()
  })

  it('uses the provided batch isRestart value inside extraData when enabled', () => {
    const form = {
      ...createDefaultProxyForm(),
      id: 'proxy-1',
      ipSimulatorDisabled: true
    }

    const { params } = buildProxyPayload(form, proxyList, 'parse failed', {
      ipSimulatorMode: 'custom-params',
      extraDataKey: 'extraData',
      isRestart: true
    })

    expect(params.extraData.isRestart).toBe(true)
    expect(params.isRestart).toBeUndefined()
  })

  it('forces nested batch isRestart to false when ip simulator is disabled', () => {
    const form = {
      ...createDefaultProxyForm(),
      id: 'proxy-1',
      ipSimulatorDisabled: false
    }

    const { params } = buildProxyPayload(form, proxyList, 'parse failed', {
      ipSimulatorMode: 'custom-params',
      extraDataKey: 'extraData',
      isRestart: true
    })

    expect(params.extraData.enabled).toBe(false)
    expect(params.extraData.isRestart).toBe(false)
    expect(params.isRestart).toBeUndefined()
  })

  it('computes a stable, deterministic hash for the same identity', () => {
    const id = 'ss://abc@1.2.3.4:443#node'
    expect(computeProxyHash(id)).toBe(computeProxyHash(id))
    expect(computeProxyHash('a')).not.toBe(computeProxyHash('b'))
  })

  it('proxyIdentity uses rawLink when present, else synthesizes a credential URI', () => {
    expect(proxyIdentity({ protocol: 'ss', host: 'h', port: 1, rawLink: 'ss://x' })).toBe('ss://x')
    expect(
      proxyIdentity({
        protocol: 'socks5',
        host: '1.1.1.1',
        port: 1080,
        username: 'u',
        password: 'p'
      })
    ).toBe('socks5://u:p@1.1.1.1:1080')
  })

  it('injects the rawLink hash at outer layer and node for link-based protocols', () => {
    const rawLink = '{"server":"2.2.2.2","port":443,"cipher":"aes-256-gcm","password":"pass"}'
    const ssProxyList = [
      {
        id: 'proxy-ss',
        name: 'SS Proxy',
        protocol: 'ss' as const,
        host: '2.2.2.2',
        port: 443,
        rawLink,
        lastCheckStatus: 'success' as const,
        createTime: 0
      }
    ]
    const form = { ...createDefaultProxyForm(), id: 'proxy-ss' }

    const { params } = buildProxyPayload(form, ssProxyList, 'parse failed')
    const mainNode = params.nodes[params.nodes.length - 1]
    const expected = computeProxyHash(rawLink)

    expect(mainNode.proxyHash).toBe(expected)
    expect(params.proxyHash).toBe(expected)
  })

  it('injects a synthesized-identity hash at outer layer and node for traditional protocols', () => {
    const form = { ...createDefaultProxyForm(), id: 'proxy-1' }

    const { params } = buildProxyPayload(form, proxyList, 'parse failed')
    const mainNode = params.nodes[params.nodes.length - 1]
    const expected = computeProxyHash(proxyIdentity(proxyList[0]))

    expect(mainNode.proxyHash).toBe(expected)
    expect(params.proxyHash).toBe(expected)
  })

  describe('中转代理', () => {
    const transferProxyList = [
      ...proxyList,
      {
        id: 'transfer-1',
        name: 'Transfer 1',
        protocol: 'socks5' as const,
        host: '9.9.9.9',
        port: 1080,
        lastCheckStatus: 'success' as const,
        createTime: 0
      }
    ]

    const parsed: ParsedProxyResult = {
      protocol: 'socks5',
      host: '3.3.3.3',
      port: 1080,
      username: 'u',
      password: 'p',
      rawLink: 'socks5://u:p@3.3.3.3:1080',
      rawConfig: {}
    }

    it('自定义代理模式下把中转代理作为首个节点下发', () => {
      const form = {
        ...createDefaultProxyForm(),
        isTransferAgent: true,
        transferAgentId: 'transfer-1'
      }

      const params = buildCustomProxyPayload(
        parsed,
        form,
        null,
        {},
        'parse failed',
        transferProxyList
      )

      expect(params.nodes).toHaveLength(2)
      expect(params.nodes[0].ip).toBe('9.9.9.9')
      expect(params.nodes[params.nodes.length - 1].ip).toBe('3.3.3.3')
    })

    // 特征测试：固化「列表为空 → 中转节点被静默丢弃」这一危险行为。
    // 它本身不是期望行为，而是 CreateProxySection.clearProxyExitInfo 必须保留 proxyList 的原因：
    // 一旦调用方把列表清空，中转代理就会无声消失、云机按直连创建，而界面仍显示中转已开启。
    // 若将来给 builder 加了显式报错，这条会失败 —— 那时请连同 clearProxyExitInfo 的注释一起重新评估。
    it('代理列表为空时中转节点被静默丢弃（调用方必须保证列表可用）', () => {
      const form = {
        ...createDefaultProxyForm(),
        isTransferAgent: true,
        transferAgentId: 'transfer-1'
      }

      const params = buildCustomProxyPayload(parsed, form, null, {}, 'parse failed', [])

      expect(params.nodes).toHaveLength(1)
      expect(params.nodes[0].ip).toBe('3.3.3.3')
    })

    it('关闭中转代理时自定义模式不下发中转节点', () => {
      const form = {
        ...createDefaultProxyForm(),
        isTransferAgent: false,
        transferAgentId: 'transfer-1'
      }

      const params = buildCustomProxyPayload(
        parsed,
        form,
        null,
        {},
        'parse failed',
        transferProxyList
      )

      expect(params.nodes).toHaveLength(1)
    })

    it('选择已有代理模式下把中转代理作为首个节点下发', () => {
      const form = {
        ...createDefaultProxyForm(),
        id: 'proxy-1',
        isTransferAgent: true,
        transferAgentId: 'transfer-1'
      }

      const { params } = buildProxyPayload(form, transferProxyList, 'parse failed')

      expect(params.nodes).toHaveLength(2)
      expect(params.nodes[0].ip).toBe('9.9.9.9')
      expect(params.nodes[params.nodes.length - 1].ip).toBe('1.1.1.1')
    })
  })
})
