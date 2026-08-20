/**
 * 将浏览器 client 坐标映射到 Android accessibility dump 坐标系。
 * 必须与 SVG preserveAspectRatio="xMidYMid meet" 使用同一套 meet 算法。
 */

export function mapClientPointToDevice(
  clientX: number,
  clientY: number,
  rect: DOMRect | DOMRectReadOnly,
  screenWidth: number,
  screenHeight: number
): { x: number; y: number } | null {
  if (screenWidth <= 0 || screenHeight <= 0 || rect.width <= 0 || rect.height <= 0) {
    return null
  }

  const scale = Math.min(rect.width / screenWidth, rect.height / screenHeight)
  const offsetX = (rect.width - screenWidth * scale) / 2
  const offsetY = (rect.height - screenHeight * scale) / 2
  const x = (clientX - rect.left - offsetX) / scale
  const y = (clientY - rect.top - offsetY) / scale

  if (x < 0 || x > screenWidth || y < 0 || y > screenHeight) return null
  return { x, y }
}

/** overlay 内定位 video surface 的 frame 样式 */
export function videoSurfaceFrameStyle(
  overlayRect: DOMRect | DOMRectReadOnly,
  videoRect: DOMRect | DOMRectReadOnly
): Record<string, string> {
  return {
    position: 'absolute',
    left: `${videoRect.left - overlayRect.left}px`,
    top: `${videoRect.top - overlayRect.top}px`,
    width: `${videoRect.width}px`,
    height: `${videoRect.height}px`
  }
}
