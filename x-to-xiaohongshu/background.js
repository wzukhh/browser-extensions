chrome.action.onClicked.addListener(() => chrome.tabs.create({url:chrome.runtime.getURL('editor.html')}));
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'CAPTURE_POST') return;
  (async () => {
    if (!sender.tab?.id || !/^https:\/\/(x|twitter)\.com\//.test(sender.tab.url || '')) throw new Error('请在 X 帖子页面使用');
    const image = await chrome.tabs.captureVisibleTab(sender.tab.windowId, {format:'png'});
    const id = crypto.randomUUID();
    await chrome.storage.local.set({['capture:' + id]: {...message, image, id}});
    await chrome.tabs.create({url:chrome.runtime.getURL('editor.html?id=' + encodeURIComponent(id))});
    sendResponse({ok:true});
  })().catch(error => sendResponse({ok:false,error:error.message}));
  return true;
});
