import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, vi } from 'vitest'

vi.mock('@renderer/locales', () => ({
  default: {},
  t: (key: string, ...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      const named = args[0] as Record<string, unknown>
      return key.replace(/\{(\w+)\}/g, (_, k) => String(named[k] ?? `{${k}}`))
    }
    return key
  }
}))

const electronUserDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'vmos-edge-vitest-'))

vi.mock('electron', () => ({
  app: {
    getPath: () => electronUserDataPath,
    getVersion: () => 'test-version',
    isPackaged: false
  },
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
    removeAllListeners: vi.fn(),
    removeHandler: vi.fn()
  },
  BrowserWindow: vi.fn()
}))

afterEach(() => {
  vi.restoreAllMocks()
})
