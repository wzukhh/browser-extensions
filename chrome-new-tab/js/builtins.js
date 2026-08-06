/** 内置快捷方式模块注册表 */
const BUILTIN_MODULES = {
  news: {
    id: 'news',
    name: '新闻热搜',
    iconPath: 'icons/news-hot.png',
    desc: '点击查看热搜榜单',
    unique: true,
  },
};

function isBuiltinLink(link) {
  return link?.type === 'builtin' && !!link?.action && !!BUILTIN_MODULES[link.action];
}

function getBuiltinModule(action) {
  return BUILTIN_MODULES[action] || null;
}

function getBuiltinIconUrl(action) {
  const mod = getBuiltinModule(action);
  if (!mod) return '';
  if (mod.iconPath && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(mod.iconPath);
  }
  return mod.icon || '';
}

function openBuiltinModule(action) {
  if (action === 'news' && typeof newsPanel !== 'undefined') {
    newsPanel.open();
    return;
  }
  console.warn('[builtins] 未知内置模块:', action);
}
