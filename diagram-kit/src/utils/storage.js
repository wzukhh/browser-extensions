// @ts-check

function isExtension() {
  return !!(typeof chrome !== 'undefined' && chrome.runtime?.id)
}

export const KEYS = {
  DOCUMENTS: 'mermaiddraw_documents',
  SESSION: 'mermaiddraw_session',
  SETTINGS: 'mermaiddraw_settings',
  TEMPLATES: 'mermaiddraw_templates',
  MARKMAP_TEMPLATES: 'markmap_templates'
}

export async function get(key) {
  if (isExtension()) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null)
      })
    })
  }
  try {
    return JSON.parse(localStorage.getItem(key))
  } catch {
    return null
  }
}

export async function set(key, value) {
  if (isExtension()) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve)
    })
  }
  localStorage.setItem(key, JSON.stringify(value))
}

export async function remove(key) {
  if (isExtension()) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve)
    })
  }
  localStorage.removeItem(key)
}
