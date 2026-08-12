import { createInjectedJsonSniffer } from './page-sniffer.js'

// Click extension icon → open app.html in a new tab
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app.html') })
})

// Right-click context menus
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'format-json',
    title: '格式化选中 JSON',
    contexts: ['selection'],
  })
  chrome.contextMenus.create({
    id: 'sniff-json',
    title: '提取页面 JSON 数据',
    contexts: ['page'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return
  if (info.menuItemId === 'format-json') {
    chrome.tabs.create({
      url: chrome.runtime.getURL(
        'app.html#format?data=' + encodeURIComponent(info.selectionText || '')
      ),
    })
    return
  }
  if (info.menuItemId === 'sniff-json') {
    await sniffJsonFromTab(tab.id)
  }
})

async function sniffJsonFromTab(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: createInjectedJsonSniffer(),
    })
    const payload = result && result.result
    if (payload && payload.ok) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('app.html#format?data=' + encodeURIComponent(payload.data)),
      })
      return
    }
    await showPageAlert(tabId, (payload && payload.error) || '未在页面中发现内嵌 JSON 数据')
  } catch (e) {
    await showPageAlert(tabId, `提取页面 JSON 失败: ${e.message}`)
  }
}

async function showPageAlert(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (text) => alert(text),
      args: [message],
    })
  } catch {
    // Restricted pages can block injection; there is no page surface to update.
  }
}
