export function capturePreviewViewState(svg, offsets = {}) {
  if (!svg) return null
  return {
    width: getSvgStyleValue(svg, 'width'),
    height: getSvgStyleValue(svg, 'height'),
    transform: svg.style?.transform || '',
    offsetX: finiteNumber(offsets.offsetX),
    offsetY: finiteNumber(offsets.offsetY)
  }
}

export function restorePreviewViewState(svg, state) {
  if (!svg || !state) return
  if (state.width) svg.style.width = state.width
  if (state.height) svg.style.height = state.height
  svg.style.transform = state.transform || ''
}

function getSvgStyleValue(svg, name) {
  const inlineValue = svg.style?.[name]
  if (inlineValue) return inlineValue
  return normalizeStyleSize(svg.getAttribute?.(name))
}

function normalizeStyleSize(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^-?\d+(\.\d+)?$/.test(text)) return text + 'px'
  return text
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : 0
}
