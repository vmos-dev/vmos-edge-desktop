import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const deviceRowPath = path.resolve(__dirname, '../DeviceRow.vue')

function readDeviceRowSource(): string {
  return fs.readFileSync(deviceRowPath, 'utf8')
}

describe('DeviceRow visuals', () => {
  it('uses a smaller phone thumbnail size', () => {
    const source = readDeviceRowSource()

    expect(source).toMatch(/\.thumb\s*\{[\s\S]*?width:\s*28px;/)
    expect(source).toMatch(/\.thumb\s*\{[\s\S]*?height:\s*46px;/)
  })
})
