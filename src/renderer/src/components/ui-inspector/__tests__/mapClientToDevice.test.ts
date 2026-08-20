import { describe, expect, it } from 'vitest'
import { mapClientPointToDevice } from '../mapClientToDevice'
import { findNodeAtPoint } from '../dumpParser'
import type { DumpResult, UiNode } from '../types'

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height } as DOMRect
}

describe('mapClientPointToDevice', () => {
  const screen = { width: 1080, height: 2400 }

  it('maps center of a meet-fitted 330x715 rect to device center', () => {
    const r = rect(100, 50, 330, 715)
    const scale = Math.min(r.width / screen.width, r.height / screen.height)
    const offsetX = (r.width - screen.width * scale) / 2
    const offsetY = (r.height - screen.height * scale) / 2
    const clientX = r.left + offsetX + (screen.width * scale) / 2
    const clientY = r.top + offsetY + (screen.height * scale) / 2

    const point = mapClientPointToDevice(clientX, clientY, r, screen.width, screen.height)
    expect(point?.x).toBeCloseTo(screen.width / 2, 0)
    expect(point?.y).toBeCloseTo(screen.height / 2, 0)
  })

  it('returns null for clicks outside the fitted content box', () => {
    const r = rect(0, 0, 330, 715)
    const scale = Math.min(r.width / screen.width, r.height / screen.height)
    const offsetX = (r.width - screen.width * scale) / 2
    const point = mapClientPointToDevice(offsetX - 1, 200, r, screen.width, screen.height)
    expect(point).toBeNull()
  })

  it('16-002 dialog: wrong dump screen size misses button, video size hits', () => {
    // 用户实测 video surface
    const videoRect = rect(85, 182, 210, 467)
    const device = { width: 1440, height: 3200 }
    const wrongDump = { width: 1404, height: 1878 }

    // 「取消」按钮中心 (752, 1735)
    const btnCx = (631 + 874) / 2
    const btnCy = (1645 + 1825) / 2
    const scale = Math.min(videoRect.width / device.width, videoRect.height / device.height)
    const clientX = videoRect.left + btnCx * scale
    const clientY = videoRect.top + btnCy * scale

    const wrongPoint = mapClientPointToDevice(
      clientX,
      clientY,
      videoRect,
      wrongDump.width,
      wrongDump.height
    )
    const rightPoint = mapClientPointToDevice(
      clientX,
      clientY,
      videoRect,
      device.width,
      device.height
    )

    expect(rightPoint).not.toBeNull()
    expect(Math.abs(rightPoint!.x - btnCx)).toBeLessThan(2)
    expect(Math.abs(rightPoint!.y - btnCy)).toBeLessThan(2)

    const button: UiNode = {
      id: 1,
      className: 'android.widget.Button',
      depth: 1,
      bounds: [631, 1645, 874, 1825],
      attrs: { text: '取消', clickable: 'true' },
      children: []
    }
    const dump: DumpResult = {
      screenWidth: wrongDump.width,
      screenHeight: wrongDump.height,
      rotation: 0,
      nodes: [button],
      tree: [button],
      actionableNodes: [button]
    }

    expect(findNodeAtPoint(dump, rightPoint!.x, rightPoint!.y)?.attrs.text).toBe('取消')
    if (wrongPoint) {
      expect(findNodeAtPoint(dump, wrongPoint.x, wrongPoint.y)).toBeNull()
    }
  })
})
