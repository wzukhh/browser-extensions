/**
 * History persistence — stores recent JSON editing sessions in chrome.storage.local.
 *
 * Each history entry has:
 *   - id:        unique string (timestamp-based)
 *   - timestamp: epoch ms when the item was saved
 *   - label:     preview of the content
 *   - content:   the full JSON text
 *
 * The history list is capped at MAX_ITEMS entries (oldest evicted first).
 *
 * Exports:
 *   loadHistory()          — returns the history array
 *   addHistoryItem(content) — persist the current content, then render
 *   removeHistoryItem(id)   — remove a specific history entry, then render
 *   clearHistory()          — remove all entries, then render
 */

const MAX_ITEMS = 50
const PREVIEW_LENGTH = 80

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

/**
 * Load history from chrome.storage.local.
 *
 * @returns {Promise<Array>}
 */
export async function loadHistory() {
  const result = await chrome.storage.local.get('history')
  return result.history || []
}

/**
 * Render the history list into the #historyList DOM element.
 *
 * @param {Array} items
 */
function renderHistory(items) {
  const container = document.getElementById('historyList')
  if (!container) return

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="history-item">暂无历史记录</div>'
    return
  }

  container.innerHTML = items
    .map(
      (item) =>
        `<div class="history-item" data-id="${escapeHtml(item.id)}">
          <div class="history-preview">${escapeHtml(item.label || item.preview || '')}</div>
          <div class="history-meta">${formatTimestamp(item.timestamp)}</div>
        </div>`
    )
    .join('')

  // Attach click handlers to restore content into the editor
  container.querySelectorAll('.history-item').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = el.dataset.id
      const all = await loadHistory()
      const found = all.find((i) => i.id === id)
      if (!found) return

      // Dispatch a custom event that app.js listens for to restore content
      window.dispatchEvent(
        new CustomEvent('jsonfmt-restore', { detail: { content: found.content } })
      )
    })
  })
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(str))
  return div.innerHTML
}

function formatTimestamp(ts) {
  try {
    const d = new Date(ts)
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return String(ts)
  }
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Add a new history entry for the given JSON content.
 *
 * Deduplicates: if the most recent entry has identical content, its timestamp
 * is updated rather than adding a duplicate entry.
 *
 * @param {string} content
 * @returns {Promise<Array>}
 */
export async function addHistoryItem(content) {
  if (!content || typeof content !== 'string') return

  const items = await loadHistory()

  // Dedup against the most recent entry
  if (items.length > 0 && items[0].content === content) {
    items[0].timestamp = Date.now()
    await chrome.storage.local.set({ history: items })
    renderHistory(items)
    return items
  }

  const label =
    content.length > PREVIEW_LENGTH
      ? content.slice(0, PREVIEW_LENGTH) + '…'
      : content

  const item = {
    id: Date.now().toString(36),
    timestamp: Date.now(),
    label,
    content,
  }

  items.unshift(item)

  // Cap at MAX_ITEMS
  if (items.length > MAX_ITEMS) {
    items.length = MAX_ITEMS
  }

  await chrome.storage.local.set({ history: items })
  renderHistory(items)
  return items
}

/**
 * Clear all history entries and re-render the list.
 *
 * @returns {Promise<void>}
 */
export async function clearHistory() {
  await chrome.storage.local.set({ history: [] })
  renderHistory([])
}

/**
 * Remove a history item by its id and re-render the list.
 *
 * @param {string} id - The id of the history entry to remove.
 * @returns {Promise<Array>}
 */
export async function removeHistoryItem(id) {
  let items = await loadHistory()
  items = items.filter((item) => item.id !== id)
  await chrome.storage.local.set({ history: items })
  renderHistory(items)
  return items
}

// ──────────────────────────────────────────────
// Init on boot
// ──────────────────────────────────────────────

// When the app boots and the module loads, render any existing history
document.addEventListener('DOMContentLoaded', async () => {
  const items = await loadHistory()
  renderHistory(items)
})
