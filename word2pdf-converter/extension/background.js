// Word → PDF Converter — Service Worker
// Pattern: open loading.html immediately, poll for server URL.

const NATIVE_HOST = 'com.browserplugin.word2pdf';

let port = null;
let serverInfo = null;     // { url, office }
let openedTabId = null;
let keepAliveTimer = null;

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
    if (msg.type === 'converter-started') {
      serverInfo = msg;
      clearBadge();
    } else if (msg.type === 'error') {
      console.error('Native host error:', msg.message);
      setBadge('ERR', '#e74c3c');
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
    setBadge('ERR', '#e74c3c');
    return;
  }
  connectRetries++;
  var delay = Math.min(1000 * Math.pow(2, connectRetries - 1), 8000);
  console.log('Reconnecting in ' + delay + 'ms (attempt ' + connectRetries + '/' + MAX_CONNECT_RETRIES + ')');
  setTimeout(function() {
    if (!port) {
      connectNative();
      if (port && !serverInfo) {
        try { port.postMessage({ type: 'start-converter' }); } catch (e) {}
      }
    }
  }, delay);
}

function sendMessage(msg) {
  if (!port) return;
  try { port.postMessage(msg); } catch (e) { port = null; }
}

// ─── Tab Management ─────────────────────────────────────────
function openConverterTab() {
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
    stopConverter();
  }
}

// ─── Handle messages from loading.html ───────────────────────
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'get-server-url') {
    if (serverInfo && serverInfo.url) {
      sendResponse({ url: serverInfo.url });
    } else if (serverInfo && !serverInfo.url && serverInfo.office && !serverInfo.office.available) {
      sendResponse({ url: null, office: serverInfo.office });
    } else {
      sendResponse({ url: null });
    }
    return true;
  }
});

// ─── Start / Stop ──────────────────────────────────────────────
function startConverter() {
  if (serverInfo && serverInfo.url) {
    chrome.tabs.create({ url: serverInfo.url, active: true });
    return;
  }

  connectRetries = 0;
  setBadge('...', '#f39c12');

  // Open loading page IMMEDIATELY, then kick off native host.
  openConverterTab();

  if (!port) {
    connectNative();
  }
  if (port) {
    sendMessage({ type: 'start-converter' });
  } else {
    // Retry shortly — native host may still be starting.
    setTimeout(function() {
      if (!port) connectNative();
      if (port) sendMessage({ type: 'start-converter' });
    }, 100);
  }
}

function stopConverter() {
  if (port) {
    sendMessage({ type: 'stop' });
    port.disconnect();
    port = null;
  }
  serverInfo = null;
  openedTabId = null;
  clearBadge();
}

// ─── Extension Icon Clicked ─────────────────────────────────
chrome.action.onClicked.addListener(function() {
  startConverter();
});
