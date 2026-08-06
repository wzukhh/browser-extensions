/**
 * Settings persistence — stores user preferences in chrome.storage.local.
 *
 * All settings are stored under a single key "settings" (an object).
 * Defaults are defined centrally so the settings modal and
 * application code share a single source of truth.
 *
 * Exports:
 *   loadSettings()   — returns a plain object of all settings (with defaults)
 *   saveSettings(s)  — persists every key-value pair in the object
 *   getSetting(key)  — returns a single setting (with default fallback)
 */

const DEFAULTS = {
  theme: 'light',
  indentSize: 2,
  fontSize: 14,
  fontFamily: "'SF Mono', 'Fira Code', monospace",
}

let _cache = null

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Load all settings from chrome.storage.local, falling back to defaults
 * for any key that has no stored value.
 *
 * @returns {Promise<Record<string, any>>}
 */
export async function loadSettings() {
  if (_cache) return _cache
  const result = await chrome.storage.local.get('settings')
  _cache = { ...DEFAULTS, ...(result.settings || {}) }
  return _cache
}

/**
 * Persist every key-value pair in the given settings object.
 *
 * @param {Record<string, any>} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  _cache = { ..._cache, ...settings }
  await chrome.storage.local.set({ settings: _cache })
}

/**
 * Get a single setting by key, returning the default if no value
 * has been stored.  Requires loadSettings() to have been called first.
 *
 * @param {string} key
 * @returns {any}
 */
export function getSetting(key) {
  return _cache ? _cache[key] : DEFAULTS[key]
}
