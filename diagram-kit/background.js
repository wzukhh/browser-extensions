const DIAGRAM_KIT_PAGE = 'index.html'

async function openOrFocusDiagramKitPage() {
  const url = chrome.runtime.getURL(DIAGRAM_KIT_PAGE)
  const tabs = await chrome.tabs.query({ url })
  const existingTab = tabs.find(tab => tab.id !== undefined)

  if (existingTab) {
    await chrome.tabs.update(existingTab.id, { active: true })
    if (existingTab.windowId !== undefined && chrome.windows?.update) {
      await chrome.windows.update(existingTab.windowId, { focused: true })
    }
    return
  }

  await chrome.tabs.create({ url })
}

chrome.action.onClicked.addListener(() => {
  return openOrFocusDiagramKitPage().catch(error => {
    console.error('Failed to open DiagramKit page:', error)
  })
})
