/**
 * Storage 抽象层 - 使用 chrome.storage.local
 * 清除浏览器缓存不影响此存储，配置永久保留
 * 非浏览器环境 fallback 到 localStorage
 */
const Storage = {
  async get(keys) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise(resolve => chrome.storage.local.get(keys, resolve));
    }
    const result = {};
    for (const key of keys) {
      try {
        const val = localStorage.getItem(key);
        result[key] = val ? JSON.parse(val) : undefined;
      } catch { /* ignore */ }
    }
    return result;
  },

  async set(items) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise(resolve => chrome.storage.local.set(items, resolve));
    }
    for (const [key, val] of Object.entries(items)) {
      localStorage.setItem(key, JSON.stringify(val));
    }
  },

  async remove(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      return new Promise(resolve => chrome.storage.local.remove(list, resolve));
    }
    for (const key of list) {
      localStorage.removeItem(key);
    }
  },
};
