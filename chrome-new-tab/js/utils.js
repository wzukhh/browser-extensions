const BUILTIN_ENGINES = {
  google: { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
  baidu: { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=' },
  bing: { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=' },
  yandex: { id: 'yandex', name: 'Yandex', url: 'https://yandex.com/search/?text=' },
};

const APP_VERSION = chrome.runtime.getManifest().version;

function getFaviconUrl(pageUrl) {
  try {
    const domain = new URL(pageUrl).hostname;
    return `https://api.xinac.net/icon/?url=${domain}`;
  } catch {
    return '';
  }
}

// xinac API 默认图标的 SHA-256（不存在的域名均返回此图）
const XINAC_DEFAULT_HASH = 'fe8033d04a82150cb1d1f825ab353785344f1c0fa9871bd6fd73e231c68dea03';

// chrome:// 和 edge:// 内部页面对应的 emoji 图标
const INTERNAL_PAGE_ICONS = {
  'extensions': '🧩', 'extension': '🧩',
  'settings': '⚙️', 'setting': '⚙️',
  'bookmarks': '⭐', 'favorites': '⭐',
  'history': '🕐',
  'downloads': '⬇️', 'download': '⬇️',
  'flags': '🚩',
  'version': 'ℹ️',
  'help': '❓',
  'apps': '📦', 'app': '📦',
  'newtab': '🏠',
  'performance': '📊',
  'password-manager': '🔑', 'passwords': '🔑',
  'crashes': '💥',
  'sandbox': '📋',
  'components': '🧩',
  'management': '📋',
  'quota-internals': '📊',
  'sync-internals': '🔄',
};

function getInternalPageIcon(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '').replace(/^\//, '');
    return INTERNAL_PAGE_ICONS[path] || INTERNAL_PAGE_ICONS[parsed.hostname] || null;
  } catch {
    return null;
  }
}

const QUICKLINK_MAX_COUNT = 200;

function normalizeQuickLinkUrl(url) {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (/^(https?:\/\/|chrome:\/\/|edge:\/\/)/i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function getQuickLinkDedupKey(url) {
  return normalizeQuickLinkUrl(url).replace(/\/+$/, '').toLowerCase();
}

function getQuickLinkDisplayName(title, url) {
  const trimmedTitle = (title || '').trim();
  if (trimmedTitle) return trimmedTitle;

  try {
    const parsed = new URL(normalizeQuickLinkUrl(url));
    if (parsed.protocol === 'chrome:' || parsed.protocol === 'edge:') {
      return parsed.hostname || parsed.pathname.replace(/^\/+/, '') || parsed.href;
    }
    return parsed.hostname || parsed.pathname.replace(/^\/+/, '') || parsed.href;
  } catch {
    return (url || '').trim() || '未命名页面';
  }
}

function getQuickLinkIconForTab(tab) {
  const url = normalizeQuickLinkUrl(tab?.url || tab?.pendingUrl || '');
  const internalIcon = getInternalPageIcon(url);
  if (internalIcon) return internalIcon;

  const favIconUrl = tab?.favIconUrl || '';
  if (/^(https?:\/\/|data:)/i.test(favIconUrl)) return favIconUrl;

  if (/^https?:\/\//i.test(url)) return getFaviconUrl(url);

  return null;
}

function findFirstEmptyQuickLinkPosition(links, columns = 6) {
  const cols = Math.max(1, Number.parseInt(columns, 10) || 6);
  const occupied = new Set();
  (links || []).forEach(link => {
    if (typeof link?.col === 'number' && typeof link?.row === 'number') {
      occupied.add(`${link.col},${link.row}`);
    }
  });

  for (let i = 0; i < QUICKLINK_MAX_COUNT; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    if (!occupied.has(`${col},${row}`)) {
      return { col, row };
    }
  }

  return { col: 0, row: 0 };
}

let _localManifestVersionPromise = null;

async function getLocalManifestVersion(forceRefresh = false) {
  if (!forceRefresh && _localManifestVersionPromise) {
    return _localManifestVersionPromise;
  }

  _localManifestVersionPromise = (async () => {
    try {
      const manifestUrl = chrome.runtime.getURL('manifest.json');
      const resp = await fetch(`${manifestUrl}?_=${Date.now()}`, { cache: 'no-store' });
      if (resp.ok) {
        const manifest = await resp.json();
        if (manifest?.version) return String(manifest.version);
      }
    } catch {
      // fall through to runtime manifest
    }

    try {
      return String(chrome.runtime.getManifest().version || APP_VERSION);
    } catch {
      return String(APP_VERSION || '');
    }
  })();

  return _localManifestVersionPromise;
}

// Theme definitions for the theme selector
const THEMES = {
  default: {
    id: 'default',
    name: '默认',
    desc: '经典深色 · 紫色强调',
    preview: ['#1a1a2e', '#16213e', '#0f3460'],
    bgColor: '#1a1a2e',
    bgOverlay: 0.3,
    bgGradients: [
      ['#1a1a2e', '#16213e', '#0f3460'],
      ['#120f2f', '#3b2f63', '#1f4068'],
      ['#0f172a', '#233554', '#475569'],
      ['#1f1b4b', '#4c1d95', '#111827'],
    ],
  },
  cyber: {
    id: 'cyber',
    name: '赛博未来',
    desc: '霓虹电流 · 赛博朋克',
    preview: ['#050510', '#ff0080', '#00f0ff'],
    bgColor: '#050510',
    bgOverlay: 0.36,
    bgGradients: [
      ['#050510', '#111827', '#ff0080'],
      ['#040816', '#00f0ff', '#0a0f1f'],
      ['#12051d', '#ff0080', '#00c2ff'],
      ['#020617', '#8b5cf6', '#00f0ff'],
    ],
  },
  magazine: {
    id: 'magazine',
    name: '杂志极简',
    desc: '深色编辑 · 朱红强调',
    preview: ['#1a1816', '#e53935', '#f0ece8'],
    bgColor: '#1a1816',
    bgOverlay: 0.3,
    bgGradients: [
      ['#1a1816', '#4a332f', '#f0ece8'],
      ['#231f20', '#8b2c2c', '#f7efea'],
      ['#151312', '#6b4f3a', '#d8c8b8'],
      ['#2b211d', '#c2410c', '#ede3d2'],
    ],
  },
  warm: {
    id: 'warm',
    name: '深夜暖光',
    desc: '琥珀暖色 · 沉浸舒适',
    preview: ['#1a1410', '#d4a373', '#e8d5b7'],
    bgColor: '#1a1410',
    bgOverlay: 0.26,
    bgGradients: [
      ['#1a1410', '#3e2723', '#d4a373'],
      ['#24160f', '#6b4f3a', '#e8d5b7'],
      ['#2d1f16', '#b26a4a', '#f1e1cf'],
      ['#140f0b', '#9a3412', '#d8b08a'],
    ],
  },
};

const CONFIG_DEFAULTS = {
  quickLinks: [],
  faviconCache: {},
  searchEngine: 'google',
  customEngines: [],
  hiddenEngines: [],
  bgType: 'gradient',
  bgColor: '#1a1a2e',
  bgImageData: null,
  theme: 'default',
  glitchEnabled: true,
  weatherDisplayEnabled: true,
  weatherCoords: null,
  weatherCityName: null,
  weatherCache: null,
  newsEnabled: true,
};

const CONFIG_KEYS = Object.freeze(Object.keys(CONFIG_DEFAULTS));
const CONFIG_METADATA_KEYS = Object.freeze(['_configBackup', '_migratedVersion', '_divCache']);
const CONFIG_CLEAR_KEYS = Object.freeze([...CONFIG_KEYS, ...CONFIG_METADATA_KEYS]);

function isConfigValueDefault(key, value) {
  const defaultValue = CONFIG_DEFAULTS[key];
  if (Array.isArray(defaultValue) || (defaultValue && typeof defaultValue === 'object')) {
    return JSON.stringify(value ?? null) === JSON.stringify(defaultValue);
  }
  return value === defaultValue;
}

function exportConfigData(data) {
  const result = {};
  for (const key of CONFIG_KEYS) {
    if (!(key in data)) continue;
    const value = data[key];
    if (value === undefined) continue;
    if (isConfigValueDefault(key, value)) continue;
    result[key] = value;
  }
  return result;
}

async function isXinacDefaultIcon(blob) {
  try {
    const hash = await crypto.subtle.digest('SHA-256', blob);
    const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === XINAC_DEFAULT_HASH;
  } catch {
    // crypto.subtle 不可用时，fallback 到 blob 大小判断
    return blob.size === 5543;
  }
}
