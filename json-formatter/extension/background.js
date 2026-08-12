// src/page-sniffer.js
function createInjectedJsonSniffer() {
  return function injectedJsonSniffer() {
    const globalCandidates = ["__NUXT__", "__INITIAL_STATE__", "__INITIAL_PROPS__"];
    const isValidJSON = (text) => {
      try {
        JSON.parse(text);
        return true;
      } catch {
        return false;
      }
    };
    const nextData = document.getElementById("__NEXT_DATA__");
    if (nextData && isValidJSON(nextData.textContent || "")) {
      return { ok: true, source: "__NEXT_DATA__ (Next.js)", data: nextData.textContent || "" };
    }
    for (const key of globalCandidates) {
      if (window[key] !== void 0) {
        try {
          return { ok: true, source: key, data: JSON.stringify(window[key], null, 2) };
        } catch {
          continue;
        }
      }
    }
    for (const el of document.querySelectorAll('script[type="application/json"]')) {
      if (el.id === "__NEXT_DATA__") continue;
      const text = el.textContent || "";
      if (isValidJSON(text)) {
        return { ok: true, source: 'script[type="application/json"]', data: text };
      }
    }
    return { ok: false, error: "\u672A\u5728\u9875\u9762\u4E2D\u53D1\u73B0\u5185\u5D4C JSON \u6570\u636E" };
  };
}

// src/background.js
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("app.html") });
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "format-json",
    title: "\u683C\u5F0F\u5316\u9009\u4E2D JSON",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "sniff-json",
    title: "\u63D0\u53D6\u9875\u9762 JSON \u6570\u636E",
    contexts: ["page"]
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  if (info.menuItemId === "format-json") {
    chrome.tabs.create({
      url: chrome.runtime.getURL(
        "app.html#format?data=" + encodeURIComponent(info.selectionText || "")
      )
    });
    return;
  }
  if (info.menuItemId === "sniff-json") {
    await sniffJsonFromTab(tab.id);
  }
});
async function sniffJsonFromTab(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: createInjectedJsonSniffer()
    });
    const payload = result && result.result;
    if (payload && payload.ok) {
      chrome.tabs.create({
        url: chrome.runtime.getURL("app.html#format?data=" + encodeURIComponent(payload.data))
      });
      return;
    }
    await showPageAlert(tabId, payload && payload.error || "\u672A\u5728\u9875\u9762\u4E2D\u53D1\u73B0\u5185\u5D4C JSON \u6570\u636E");
  } catch (e) {
    await showPageAlert(tabId, `\u63D0\u53D6\u9875\u9762 JSON \u5931\u8D25: ${e.message}`);
  }
}
async function showPageAlert(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (text) => alert(text),
      args: [message]
    });
  } catch {
  }
}
