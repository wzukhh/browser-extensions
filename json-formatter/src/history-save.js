export function isHistorySaveCandidate(content) {
  if (typeof content !== 'string') return false
  const trimmed = content.trim()
  if (!trimmed) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}
