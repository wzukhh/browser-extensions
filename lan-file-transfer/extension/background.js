// ─── State ───────────────────────────────────────────────────
const NATIVE_HOST = 'com.browserplugin.filetransfer';

let port = null;
let serverInfo = null;
let openedTabId = null;

// ─── Badge ───────────────────────────────────────────────────
function setBadge(text, color) {
  try {
    chrome.action.setBadgeText({ text: text || '' });
    if (color) chrome.action.setBadgeBackgroundColor({ color: color });
  } catch (e) {}
}
function clearBadge() { setBadge(''); }

// ─── Native Messaging ───────────────────────────────────────
let connectRetries = 0;
const MAX_CONNECT_RETRIES = 5;

function connectNative() {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST);
  } catch (e) {
    console.error('Failed to connect native host:', e);
    scheduleReconnect();
    return;
  }

  port.onMessage.addListener(function(msg) {
    connectRetries = 0;
    if (msg.type === 'server-started') {
      serverInfo = msg;
      clearBadge();
    } else if (msg.type === 'error') {
      console.error('Native host error:', msg.message);
      setBadge('✕', '#e74c3c');
      serverInfo = null;
    }
  });

  port.onDisconnect.addListener(function() {
    if (chrome.runtime.lastError) {
      console.warn('Native host disconnected:', chrome.runtime.lastError.message);
    }
    port = null;
    if (!serverInfo) {
      scheduleReconnect();
    }
  });
}

function scheduleReconnect() {
  if (connectRetries >= MAX_CONNECT_RETRIES) {
    console.error('Failed to connect native host after', MAX_CONNECT_RETRIES, 'retries');
    setBadge('✕', '#e74c3c');
    return;
  }
  connectRetries++;
  var delay = Math.min(1000 * Math.pow(2, connectRetries - 1), 8000);
  setTimeout(function() {
    if (!port) connectNative();
  }, delay);
}

function sendMessage(msg) {
  if (!port) return;
  try { port.postMessage(msg); } catch (e) { port = null; }
}

// ─── Tab Management ─────────────────────────────────────────
function openTransferTab() {
  var loadingUrl = chrome.runtime.getURL('loading.html');
  chrome.tabs.create({ url: loadingUrl, active: true }).then(function(tab) {
    openedTabId = tab.id;
  });

  if (!chrome.tabs.onRemoved.hasListener(onTabRemoved)) {
    chrome.tabs.onRemoved.addListener(onTabRemoved);
  }
}

function onTabRemoved(tabId) {
  if (tabId === openedTabId) {
    openedTabId = null;
    stopServer();
  }
}

// ─── Handle messages from loading.html ───────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'get-server-url') {
    if (serverInfo && serverInfo.url) {
      sendResponse({ url: serverInfo.url });
    } else {
      sendResponse({ url: null });
    }
    return true;
  }
});

// ─── Start / Stop ────────────────────────────────────────────
function startServer() {
  if (serverInfo) {
    chrome.tabs.create({ url: serverInfo.url, active: true });
    return;
  }

  connectRetries = 0;
  setBadge('⟳', '#f39c12');

  if (!port) connectNative();
  if (!port) {
    setTimeout(function() {
      if (!port) connectNative();
    }, 500);
  }

  openTransferTab();
}

function stopServer() {
  if (port) {
    sendMessage({ type: 'stop-server' });
    port.disconnect();
    port = null;
  }
  serverInfo = null;
  openedTabId = null;
  clearBadge();
}

// ─── Extension Icon Clicked ─────────────────────────────────
chrome.action.onClicked.addListener(function() {
  startServer();
});

// ─── Extension Install ──────────────────────────────────────
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    startServer();
  }
});
