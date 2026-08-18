import { describe, expect, it } from 'vitest'
import { getVisibleTabCount } from '../tabOverflow'

describe('getVisibleTabCount', () => {
  it('returns null until all tab widths are measured', () => {
    expect(
      getVisibleTabCount({
        containerWidth: 360,
        tabCount: 4,
        tabWidths: [96, 108],
        moreButtonWidth: 44
      })
    ).toBeNull()
  })

  it('computes the visible tab count when measurements are ready', () => {
    expect(
      getVisibleTabCount({
        containerWidth: 320,
        tabCount: 4,
        tabWidths: [96, 108, 104, 112],
        moreButtonWidth: 44
      })
    ).toBe(2)
  })

  it('keeps all tabs visible when everything fits', () => {
    expect(
      getVisibleTabCount({
        containerWidth: 460,
        tabCount: 4,
        tabWidths: [96, 108, 104, 112],
        moreButtonWidth: 44
      })
    ).toBe(4)
  })
})
