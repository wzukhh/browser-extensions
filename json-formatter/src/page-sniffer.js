const GLOBAL_CANDIDATES = ['__NUXT__', '__INITIAL_STATE__', '__INITIAL_PROPS__']

export function findJsonCandidateFromSnapshot(snapshot = {}) {
  const nextDataText = snapshot.nextDataText
  if (typeof nextDataText === 'string' && isValidJSON(nextDataText)) {
    return { ok: true, source: '__NEXT_DATA__ (Next.js)', data: nextDataText }
  }

  const globals = snapshot.globals || {}
  for (const key of GLOBAL_CANDIDATES) {
    if (globals[key] !== undefined) {
      try {
        return { ok: true, source: key, data: JSON.stringify(globals[key], null, 2) }
      } catch {
        continue
      }
    }
  }

  for (const text of snapshot.jsonScriptTexts || []) {
    if (typeof text === 'string' && isValidJSON(text)) {
      return { ok: true, source: 'script[type="application/json"]', data: text }
    }
  }

  return { ok: false, error: '未在页面中发现内嵌 JSON 数据' }
}

function isValidJSON(text) {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

export function createInjectedJsonSniffer() {
  return function injectedJsonSniffer() {
    const globalCandidates = ['__NUXT__', '__INITIAL_STATE__', '__INITIAL_PROPS__']
    const isValidJSON = (text) => {
      try {
        JSON.parse(text)
        return true
      } catch {
        return false
      }
    }

    const nextData = document.getElementById('__NEXT_DATA__')
    if (nextData && isValidJSON(nextData.textContent || '')) {
      return { ok: true, source: '__NEXT_DATA__ (Next.js)', data: nextData.textContent || '' }
    }

    for (const key of globalCandidates) {
      if (window[key] !== undefined) {
        try {
          return { ok: true, source: key, data: JSON.stringify(window[key], null, 2) }
        } catch {
          continue
        }
      }
    }

    for (const el of document.querySelectorAll('script[type="application/json"]')) {
      if (el.id === '__NEXT_DATA__') continue
      const text = el.textContent || ''
      if (isValidJSON(text)) {
        return { ok: true, source: 'script[type="application/json"]', data: text }
      }
    }

    return { ok: false, error: '未在页面中发现内嵌 JSON 数据' }
  }
}
