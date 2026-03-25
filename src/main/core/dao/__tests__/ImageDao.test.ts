import { describe, expect, test, vi } from 'vitest'
import { ImageDao } from '../ImageDao'
import type { SQLiteDB } from '../../db/SQLiteDB'

describe('ImageDao', () => {
  test('query sorts images by import time descending before name', () => {
    const all = vi.fn(() => [])
    const prepare = vi.fn(() => ({ all }))
    const dao = new ImageDao({ db: { prepare } } as unknown as SQLiteDB)

    dao.query()

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY importTime DESC, name ASC, version ASC')
    )
  })
})
