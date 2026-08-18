import { describe, expect, test } from 'vitest'
import { decideFlowEngineInstallStrategy } from '../flowEngineVersion'

describe('decideFlowEngineInstallStrategy', () => {
  test('returns unreachable when host cannot be reached', () => {
    expect(
      decideFlowEngineInstallStrategy({
        reachable: false,
        bundledVersionCode: 2_000_000
      })
    ).toBe('unreachable')
  })

  test('returns install when heartbeat is reachable but version code is missing', () => {
    expect(
      decideFlowEngineInstallStrategy({
        reachable: true,
        bundledVersionCode: 2_000_000
      })
    ).toBe('install')
  })

  test('returns update when remote version code is lower than bundled version code', () => {
    expect(
      decideFlowEngineInstallStrategy({
        reachable: true,
        remoteVersionCode: 1_999_999,
        bundledVersionCode: 2_000_000
      })
    ).toBe('update')
  })

  test('returns none when remote version code is equal to bundled version code', () => {
    expect(
      decideFlowEngineInstallStrategy({
        reachable: true,
        remoteVersionCode: 2_000_000,
        bundledVersionCode: 2_000_000
      })
    ).toBe('none')
  })

  test('returns none when remote version code is newer than bundled version code', () => {
    expect(
      decideFlowEngineInstallStrategy({
        reachable: true,
        remoteVersionCode: 2_000_001,
        bundledVersionCode: 2_000_000
      })
    ).toBe('none')
  })
})
