export function isPinchGesture(e = {}) {
  return Boolean(e.ctrlKey || e.metaKey)
}

export function getWheelZoomFactor(e = {}) {
  const deltaY = e.deltaY || 0
  if (!deltaY) return 1
  return deltaY < 0 ? 1.05 : 1 / 1.05
}

export function getWheelPanDelta(e = {}) {
  const unit = getWheelDeltaUnit(e)
  return {
    x: -(e.deltaX || 0) * unit,
    y: -(e.deltaY || 0) * unit
  }
}

function getWheelDeltaUnit(e) {
  if (e.deltaMode === 1) return 16
  if (e.deltaMode === 2) return 240
  return 1
}
