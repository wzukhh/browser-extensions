function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0
}

export function getMarkmapViewport(svg) {
  const rect = svg?.getBoundingClientRect?.()
  return {
    width: rect?.width,
    height: rect?.height
  }
}

export function getMarkmapContentBounds(markmap) {
  const rect = markmap?.state?.rect || {}
  const width = rect.x2 - rect.x1
  const height = rect.y2 - rect.y1
  return { width, height }
}

export function hasUsableMarkmapViewport(svg) {
  const { width, height } = getMarkmapViewport(svg)
  return isPositiveFinite(width) && isPositiveFinite(height)
}

export function hasUsableMarkmapContent(markmap) {
  const { width, height } = getMarkmapContentBounds(markmap)
  return isPositiveFinite(width) && isPositiveFinite(height)
}

export function canFitMarkmap(svg, markmap) {
  return hasUsableMarkmapViewport(svg) && hasUsableMarkmapContent(markmap)
}
