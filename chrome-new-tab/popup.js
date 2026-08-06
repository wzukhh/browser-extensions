const popupState = {
  tab: null,
  pageLink: null,
  quickLinks: [],
  busy: false,
};

const NEW_TAB_URLS = new Set([
  'chrome://newtab',
  'chrome://newtab/',
  'edge://newtab',
  'edge://newtab/',
]);

const popupEls = {
  status: document.getElementById('popup-status'),
  iconImg: document.getElementById('page-icon-img'),
  iconFallback: document.getElementById('page-icon-fallback'),
  title: document.getElementById('page-title'),
  domain: document.getElementById('page-domain'),
  url: document.getElementById('page-url'),
  addBtn: document.getElementById('add-current-btn'),
};

document.addEventListener('DOMContentLoaded', initPopup);

async function initPopup() {
  popupEls.addBtn.addEventListener('click', () => addCurrentPageToQuickLinks());

  try {
    setStatus('loading', '正在读取当前页面…');

    const [tab] = await queryActiveTab();
    if (!tab) {
      throw new Error('未找到当前标签页');
    }

    popupState.tab = tab;
    const data = await Storage.get(['quickLinks']);
    popupState.quickLinks = data.quickLinks || [];
    popupState.pageLink = buildQuickLinkFromTab(tab);

    renderPagePreview(popupState.pageLink);
    syncActionState();
  } catch (error) {
    console.error('[popup] init failed:', error);
    renderErrorState(error);
  }
}

async function queryActiveTab() {
  return new Promise((resolve, reject) => {
    if (!chrome?.tabs?.query) {
      reject(new Error('当前环境不支持标签页查询'));
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message || '读取标签页失败'));
        return;
      }
      resolve(tabs || []);
    });
  });
}

function buildQuickLinkFromTab(tab) {
  const url = normalizeQuickLinkUrl(tab?.url || tab?.pendingUrl || '');
  const title = getQuickLinkDisplayName(tab?.title || '', url);
  const icon = getQuickLinkIconForTab(tab);
  return { name: title, url, icon };
}

function normalizeUrlForCompare(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    return parsed.href.replace(/\/+$/, '');
  } catch {
    return (url || '').trim().replace(/\/+$/, '');
  }
}

function isHomePageUrl(url) {
  return NEW_TAB_URLS.has(normalizeUrlForCompare(url));
}

function renderPagePreview(link) {
  popupEls.title.textContent = link.name;
  popupEls.domain.textContent = getPageDomainLabel(link.url);
  popupEls.url.textContent = link.url;

  if (link.icon && /^(https?:\/\/|data:)/i.test(link.icon)) {
    popupEls.iconImg.src = link.icon;
    popupEls.iconImg.classList.remove('hidden');
    popupEls.iconFallback.classList.add('hidden');
  } else {
    popupEls.iconImg.removeAttribute('src');
    popupEls.iconImg.classList.add('hidden');
    popupEls.iconFallback.textContent = getFallbackIconText(link);
    popupEls.iconFallback.classList.remove('hidden');
  }
}

function getFallbackIconText(link) {
  if (link.icon && !link.icon.includes('://') && !link.icon.startsWith('data:')) {
    return link.icon;
  }
  return firstChar(link.name);
}

function getPageDomainLabel(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'chrome:' || parsed.protocol === 'edge:') {
      return `${parsed.protocol}//${parsed.hostname || parsed.pathname.replace(/^\/+/, '') || 'page'}`;
    }
    return parsed.hostname || parsed.href;
  } catch {
    return url || '';
  }
}

function setStatus(type, message) {
  popupEls.status.className = `status status-${type}`;
  popupEls.status.textContent = message;
}

function renderErrorState(error) {
  const message = error?.message || '无法读取当前页面';
  popupEls.title.textContent = '当前页面不可用';
  popupEls.domain.textContent = '';
  popupEls.url.textContent = message;
  popupEls.iconImg.classList.add('hidden');
  popupEls.iconFallback.textContent = '!';
  popupEls.iconFallback.classList.remove('hidden');
  popupEls.addBtn.disabled = true;
  popupEls.addBtn.textContent = '不可添加';
  setStatus('error', message);
}

function syncActionState() {
  const pageLink = popupState.pageLink;
  if (!pageLink?.url) {
    renderErrorState(new Error('当前页面没有可保存的链接'));
    return;
  }

  if (isHomePageUrl(pageLink.url)) {
    popupEls.addBtn.disabled = true;
    popupEls.addBtn.textContent = '首页不可添加';
    setStatus('warning', '当前就是快捷链接首页');
    return;
  }

  if (popupState.quickLinks.length >= QUICKLINK_MAX_COUNT) {
    popupEls.addBtn.disabled = true;
    popupEls.addBtn.textContent = '已满';
    setStatus('warning', '快捷链接已满');
    return;
  }

  const key = getQuickLinkDedupKey(pageLink.url);
  const duplicated = popupState.quickLinks.some(link => getQuickLinkDedupKey(link.url) === key);
  if (duplicated) {
    popupEls.addBtn.disabled = true;
    popupEls.addBtn.textContent = '已存在';
    setStatus('warning', '已存在于快捷链接中');
    return;
  }

  popupEls.addBtn.disabled = false;
  popupEls.addBtn.textContent = '添加';
  setStatus('ready', '点击即可添加到首页');
}

async function addCurrentPageToQuickLinks() {
  if (popupState.busy || !popupState.pageLink) return;
  if (isHomePageUrl(popupState.pageLink.url)) {
    setStatus('warning', '当前就是快捷链接首页');
    popupEls.addBtn.disabled = true;
    popupEls.addBtn.textContent = '首页不可添加';
    return;
  }
  popupState.busy = true;
  popupEls.addBtn.disabled = true;
  popupEls.addBtn.textContent = '添加中…';
  setStatus('loading', '正在保存到快捷链接…');

  try {
    const data = await Storage.get(['quickLinks']);
    const links = data.quickLinks || [];
    const key = getQuickLinkDedupKey(popupState.pageLink.url);
    const duplicated = links.some(link => getQuickLinkDedupKey(link.url) === key);

    if (duplicated) {
      setStatus('warning', '这个页面已经在快捷链接里了');
      popupEls.addBtn.textContent = '已存在';
      return;
    }

    if (links.length >= QUICKLINK_MAX_COUNT) {
      setStatus('error', '快捷链接已满，无法继续添加');
      popupEls.addBtn.textContent = '已满';
      return;
    }

    const pos = findFirstEmptyQuickLinkPosition(links);
    links.push({
      name: popupState.pageLink.name,
      url: popupState.pageLink.url,
      icon: popupState.pageLink.icon || null,
      col: pos.col,
      row: pos.row,
    });

    await Storage.set({ quickLinks: links });
    popupState.quickLinks = links;
    setStatus('success', '已添加到首页快捷链接');
    popupEls.addBtn.textContent = '已添加';
    popupEls.addBtn.classList.add('success');

    setTimeout(() => window.close(), 700);
  } catch (error) {
    console.error('[popup] add failed:', error);
    popupEls.addBtn.disabled = false;
    popupEls.addBtn.textContent = '重试';
    setStatus('error', error?.message || '添加失败');
  } finally {
    popupState.busy = false;
  }
}
