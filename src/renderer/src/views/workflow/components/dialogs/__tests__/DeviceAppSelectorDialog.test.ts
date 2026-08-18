import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const dialogPath = path.resolve(__dirname, '../DeviceAppSelectorDialog.vue')

function readDialogSource(): string {
  return fs.readFileSync(dialogPath, 'utf8')
}

describe('DeviceAppSelectorDialog layout guards', () => {
  it('uses the shared VmosDialog component', () => {
    const source = readDialogSource()

    expect(source).toContain('<VmosDialog')
    expect(source).not.toContain('<ElDialog')
  })

  it('keeps the dialog inside the viewport and clips column overflow', () => {
    const source = readDialogSource()

    expect(source).toContain('class="device-app-selector-dialog"')
    expect(source).toMatch(
      /:deep\(\.device-app-selector-dialog\)\s*\{[\s\S]*?max-height:\s*calc\(100vh - 64px\);/
    )
    expect(source).toMatch(/\.selector-cols\s*\{[\s\S]*?overflow:\s*hidden;/)
    expect(source).toMatch(/\.device-col,\s*\.app-col\s*\{[\s\S]*?min-height:\s*0;/)
  })
})
