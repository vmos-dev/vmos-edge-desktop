import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Image } from '@shared/ipc/data.types'

vi.mock('../BaseManager', () => ({
  BaseManager: class BaseManager {
    protected dbInstance = {}
  }
}))

const { ImageManager } = await import('../ImageManager')

function createImage(overrides: Partial<Image>): Image {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'image',
    version: overrides.version ?? 'v1',
    size: overrides.size ?? 1,
    androidVersion: overrides.androidVersion ?? '11',
    storagePath: overrides.storagePath ?? '/tmp/image',
    importTime: overrides.importTime ?? 0,
    connectionMode: overrides.connectionMode
  }
}

class FakeImageDao {
  private readonly records = new Map<string, Image>()

  addImage(image: Image): void {
    this.records.set(image.id, image)
  }

  getById(id: string): Image | undefined {
    return this.records.get(id)
  }

  query(options?: { version?: string }): Image[] {
    return Array.from(this.records.values()).filter((image) =>
      options?.version ? image.version === options.version : true
    )
  }

  deleteImage(id: string): boolean {
    return this.records.delete(id)
  }
}

describe('ImageManager.deleteImages', () => {
  let dao: FakeImageDao
  let manager: InstanceType<typeof ImageManager>
  let tempRoot: string

  beforeEach(() => {
    dao = new FakeImageDao()
    manager = Object.create(ImageManager.prototype) as InstanceType<typeof ImageManager>
    ;(manager as unknown as { imageDao: FakeImageDao }).imageDao = dao
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'image-manager-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  })

  test('removes storage path when deleting the last image for a version', () => {
    const storagePath = path.join(tempRoot, 'solo-version')
    fs.mkdirSync(storagePath, { recursive: true })
    fs.writeFileSync(path.join(storagePath, 'payload.txt'), 'payload')

    dao.addImage(
      createImage({
        id: 'solo',
        name: 'Solo',
        version: 'v-solo',
        storagePath,
        importTime: 100
      })
    )

    const deletedCount = manager.deleteImages(['solo'])

    expect(deletedCount).toBe(1)
    expect(dao.getById('solo')).toBeUndefined()
    expect(fs.existsSync(storagePath)).toBe(false)
  })

  test('keeps storage path when another image with the same version remains', () => {
    const sharedPath = path.join(tempRoot, 'shared-version')
    fs.mkdirSync(sharedPath, { recursive: true })
    fs.writeFileSync(path.join(sharedPath, 'payload.txt'), 'payload')

    dao.addImage(
      createImage({
        id: 'keep-a',
        name: 'Keep A',
        version: 'v-shared',
        storagePath: sharedPath,
        importTime: 100
      })
    )
    dao.addImage(
      createImage({
        id: 'keep-b',
        name: 'Keep B',
        version: 'v-shared',
        storagePath: sharedPath,
        importTime: 200
      })
    )

    const deletedCount = manager.deleteImages(['keep-a'])

    expect(deletedCount).toBe(1)
    expect(dao.getById('keep-a')).toBeUndefined()
    expect(dao.getById('keep-b')).toBeDefined()
    expect(fs.existsSync(sharedPath)).toBe(true)
  })
})
