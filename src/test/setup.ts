import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, vi } from 'vitest'

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
