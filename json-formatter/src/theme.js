export function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light'
}

export function getNextTheme(theme) {
  return normalizeTheme(theme) === 'light' ? 'dark' : 'light'
}
