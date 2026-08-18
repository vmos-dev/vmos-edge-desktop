interface GetVisibleTabCountOptions {
  containerWidth: number
  tabCount: number
  tabWidths: number[]
  moreButtonWidth: number
}

export const getVisibleTabCount = ({
  containerWidth,
  tabCount,
  tabWidths,
  moreButtonWidth
}: GetVisibleTabCountOptions): number | null => {
  if (containerWidth <= 0) {
    return null
  }

  if (tabWidths.length < tabCount || tabWidths.some((width) => width <= 0)) {
    return null
  }

  const totalWidth = tabWidths.reduce((sum, width) => sum + width, 0)

  if (totalWidth <= containerWidth) {
    return tabCount
  }

  const availableWidth = containerWidth - moreButtonWidth
  let usedWidth = 0
  let visibleCount = 0

  for (const width of tabWidths) {
    if (usedWidth + width > availableWidth) {
      break
    }

    usedWidth += width
    visibleCount += 1
  }

  return Math.max(1, visibleCount)
}
