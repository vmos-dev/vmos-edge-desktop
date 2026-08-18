import { describe, expect, it } from 'vitest'
import type { AppInfo } from '@shared/ipc/workflow.types'
import { resolveRecentApps } from '../recentApps'

describe('resolveRecentApps', () => {
  it('only shows recent apps that still exist in the scanned app list', () => {
    const scannedApps: AppInfo[] = [
      {
        packageName: 'com.example.current',
        displayName: 'Current App',
        versionName: '9.9.9',
        size: 1024
      }
    ]

    const recentApps: AppInfo[] = [
      {
        packageName: 'com.example.missing',
        displayName: 'Missing App',
        versionName: '1.0.0'
      },
      {
        packageName: 'com.example.current',
        displayName: 'Old App Name',
        versionName: '1.0.0'
      }
    ]

    expect(resolveRecentApps(scannedApps, recentApps)).toEqual([
      {
        packageName: 'com.example.current',
        displayName: 'Current App',
        versionName: '9.9.9',
        size: 1024
      }
    ])
  })
})
