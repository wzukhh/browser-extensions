const MAX_DOCUMENTS = 50
const TOOL_TYPES = ['mermaid', 'markmap']
const DEFAULT_TOOL_TYPE = 'mermaid'
const DEFAULT_CONTENT_BY_TOOL = {
  mermaid: '',
  markmap: ''
}
const DEFAULT_NAME_BY_TOOL = {
  mermaid: '未命名图表',
  markmap: '未命名脑图'
}
const DEFAULT_CONTENT = DEFAULT_CONTENT_BY_TOOL.mermaid

let idCounter = Date.now()

function uid() {
  idCounter += 1
  return idCounter.toString(36)
}

function timestamp(options = {}) {
  return typeof options.now === 'function' ? options.now() : Date.now()
}

function cloneDocument(document) {
  return { ...document }
}

function cloneTab(tab) {
  return { ...tab }
}

function normalizeToolType(toolType) {
  return TOOL_TYPES.includes(toolType) ? toolType : DEFAULT_TOOL_TYPE
}

function normalizeDocuments(documents = []) {
  return [...documents]
    .map(document => ({
      ...document,
      toolType: normalizeToolType(document.toolType)
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, MAX_DOCUMENTS)
}

function createBlankTab(options = {}) {
  const now = timestamp(options)
  const toolType = normalizeToolType(options.toolType)
  return {
    id: options.id || uid(),
    documentId: null,
    toolType,
    name: options.name || DEFAULT_NAME_BY_TOOL[toolType],
    content: options.content ?? DEFAULT_CONTENT_BY_TOOL[toolType],
    createdAt: now,
    updatedAt: now,
    dirty: options.dirty ?? !!options.content
  }
}

function tabFromDocument(document, options = {}) {
  return {
    id: options.id || uid(),
    documentId: document.id,
    toolType: normalizeToolType(document.toolType),
    name: document.name,
    content: document.content,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    dirty: false
  }
}

function ensureOpenTabs(workspace, options = {}) {
  const activeToolType = normalizeToolType(workspace.activeToolType)
  if (workspace.openTabs.some(tab => tab.toolType === activeToolType)) return workspace
  const tab = createBlankTab({ ...options, toolType: activeToolType })
  return {
    ...workspace,
    openTabs: [tab],
    activeTabId: tab.id,
    activeToolType,
    activeTabByTool: {
      ...workspace.activeTabByTool,
      [activeToolType]: tab.id
    }
  }
}

export function buildInitialWorkspace({ documents = [], session = null, now } = {}) {
  const archived = normalizeDocuments(documents)
  const activeToolType = normalizeToolType(session?.activeToolType)
  const sessionTabs = Array.isArray(session?.openTabs)
    ? session.openTabs.map(tab => ({ ...tab, toolType: normalizeToolType(tab.toolType) }))
    : []
  const activeTabByTool = { ...(session?.activeTabByTool || {}) }
  for (const tab of sessionTabs) {
    if (!activeTabByTool[tab.toolType]) activeTabByTool[tab.toolType] = tab.id
  }

  if (sessionTabs.length > 0) {
    const preferredActiveId = activeTabByTool[activeToolType] || session?.activeTabId
    const activeTabId = sessionTabs.some(tab => tab.id === preferredActiveId)
      ? preferredActiveId
      : sessionTabs.find(tab => tab.toolType === activeToolType)?.id || sessionTabs[0].id
    const selectedTab = sessionTabs.find(tab => tab.id === activeTabId) || sessionTabs[0]
    return {
      documents: archived,
      openTabs: sessionTabs,
      activeTabId,
      activeToolType: selectedTab.toolType,
      activeTabByTool: {
        ...activeTabByTool,
        [selectedTab.toolType]: selectedTab.id
      }
    }
  }

  if (archived.length > 0) {
    const firstDocument = archived.find(document => document.toolType === activeToolType) || archived[0]
    const tab = tabFromDocument(firstDocument, { now })
    return {
      documents: archived,
      openTabs: [tab],
      activeTabId: tab.id,
      activeToolType: tab.toolType,
      activeTabByTool: { [tab.toolType]: tab.id }
    }
  }

  return ensureOpenTabs({
    documents: [],
    openTabs: [],
    activeTabId: null,
    activeToolType,
    activeTabByTool: {}
  }, { now, toolType: activeToolType })
}

export function getActiveTab(workspace) {
  return workspace.openTabs.find(tab => tab.id === workspace.activeTabId) || null
}

export function getIsDirty(workspace) {
  return !!getActiveTab(workspace)?.dirty
}

export function getIsArchived(workspace) {
  return !!getActiveTab(workspace)?.documentId
}

export function getCurrentToolTabs(workspace) {
  const activeToolType = normalizeToolType(workspace.activeToolType)
  return workspace.openTabs.filter(tab => tab.toolType === activeToolType).map(cloneTab)
}

export function getCurrentToolDocuments(workspace) {
  const activeToolType = normalizeToolType(workspace.activeToolType)
  return workspace.documents.filter(document => document.toolType === activeToolType).map(cloneDocument)
}

export function getArchiveDocuments(workspace) {
  return [...workspace.documents]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(cloneDocument)
}

export function createTab(workspace, options = {}) {
  const toolType = normalizeToolType(options.toolType || workspace.activeToolType)
  const tab = createBlankTab({ ...options, toolType })
  return {
    ...workspace,
    openTabs: [...workspace.openTabs.map(cloneTab), tab],
    activeTabId: tab.id,
    activeToolType: toolType,
    activeTabByTool: {
      ...workspace.activeTabByTool,
      [toolType]: tab.id
    }
  }
}

export function closeTab(workspace, tabId, options = {}) {
  const removedTab = workspace.openTabs.find(tab => tab.id === tabId)
  if (!removedTab) return workspace
  const removedIndex = workspace.openTabs.findIndex(tab => tab.id === tabId)
  const openTabs = workspace.openTabs.filter(tab => tab.id !== tabId).map(cloneTab)
  const sameToolTabs = openTabs.filter(tab => tab.toolType === removedTab.toolType)
  const activeTabByTool = { ...workspace.activeTabByTool }
  if (activeTabByTool[removedTab.toolType] === tabId) {
    if (sameToolTabs[0]) activeTabByTool[removedTab.toolType] = sameToolTabs[0].id
    else delete activeTabByTool[removedTab.toolType]
  }

  let activeTabId = workspace.activeTabId === tabId
    ? openTabs[Math.min(Math.max(removedIndex, 0), openTabs.length - 1)]?.id || null
    : workspace.activeTabId
  let activeTab = openTabs.find(tab => tab.id === activeTabId) || null
  if (!activeTab && openTabs[0]) {
    activeTab = openTabs[0]
    activeTabId = activeTab.id
  }
  if (activeTab) activeTabByTool[activeTab.toolType] = activeTab.id

  const nextWorkspace = {
    ...workspace,
    openTabs,
    activeTabId,
    activeToolType: activeTab?.toolType || removedTab.toolType,
    activeTabByTool
  }
  return openTabs.length > 0
    ? nextWorkspace
    : ensureOpenTabs(nextWorkspace, { ...options, toolType: removedTab.toolType })
}

export function setActiveTab(workspace, tabId) {
  const tab = workspace.openTabs.find(tab => tab.id === tabId)
  if (!tab) return workspace
  return {
    ...workspace,
    openTabs: workspace.openTabs.map(cloneTab),
    activeTabId: tabId,
    activeToolType: tab.toolType,
    activeTabByTool: {
      ...workspace.activeTabByTool,
      [tab.toolType]: tabId
    }
  }
}

export function updateContent(workspace, content, options = {}) {
  const now = timestamp(options)
  return {
    ...workspace,
    openTabs: workspace.openTabs.map(tab => {
      if (tab.id !== workspace.activeTabId) return cloneTab(tab)
      const document = tab.documentId
        ? workspace.documents.find(item => item.id === tab.documentId)
        : null
      const dirty = document
        ? document.content !== content || document.name !== tab.name
        : !!content
      return { ...tab, content, dirty, draftUpdatedAt: now }
    })
  }
}

export function renameTab(workspace, tabId, name, options = {}) {
  const cleanName = name.trim()
  if (!cleanName) return workspace
  const targetTab = workspace.openTabs.find(tab => tab.id === tabId)
  if (!targetTab || targetTab.name === cleanName) return workspace

  const now = timestamp(options)
  const savedDocument = targetTab.documentId
    ? workspace.documents.find(document => document.id === targetTab.documentId)
    : null
  const canSaveNameOnly = savedDocument && savedDocument.content === targetTab.content
  const documents = canSaveNameOnly
    ? normalizeDocuments(workspace.documents.map(document => {
      if (document.id !== savedDocument.id) return document
      return { ...document, name: cleanName, updatedAt: now }
    }))
    : workspace.documents

  return {
    ...workspace,
    documents,
    openTabs: workspace.openTabs.map(tab => {
      if (tab.id !== tabId) return cloneTab(tab)
      if (canSaveNameOnly) {
        return {
          ...tab,
          name: cleanName,
          updatedAt: now,
          dirty: false
        }
      }
      return { ...tab, name: cleanName, dirty: !!tab.content || !!tab.documentId, draftUpdatedAt: now }
    })
  }
}

export function loadTemplate(workspace, content, options = {}) {
  return updateContent(workspace, content, options)
}

export function loadDocument(workspace, documentId) {
  const existing = workspace.openTabs.find(tab => tab.documentId === documentId)
  if (existing) return setActiveTab(workspace, existing.id)

  const document = workspace.documents.find(item => item.id === documentId)
  if (!document) return workspace
  const tab = tabFromDocument(document)
  return {
    ...workspace,
    openTabs: [...workspace.openTabs.map(cloneTab), tab],
    activeTabId: tab.id,
    activeToolType: tab.toolType,
    activeTabByTool: {
      ...workspace.activeTabByTool,
      [tab.toolType]: tab.id
    }
  }
}

export function deleteDocument(workspace, documentId, options = {}) {
  const document = workspace.documents.find(item => item.id === documentId)
  if (!document) return workspace
  const now = timestamp(options)
  return {
    ...workspace,
    documents: normalizeDocuments(workspace.documents.filter(item => item.id !== documentId)),
    openTabs: workspace.openTabs.map(tab => {
      if (tab.documentId !== documentId) return cloneTab(tab)
      return {
        ...tab,
        documentId: null,
        dirty: !!tab.content,
        draftUpdatedAt: now
      }
    })
  }
}

export function switchTool(workspace, toolType, options = {}) {
  const nextToolType = normalizeToolType(toolType)
  const currentActiveTab = getActiveTab(workspace)
  const activeTabByTool = { ...workspace.activeTabByTool }
  if (currentActiveTab) activeTabByTool[currentActiveTab.toolType] = currentActiveTab.id

  let nextActiveTabId = activeTabByTool[nextToolType]
  if (!workspace.openTabs.some(tab => tab.id === nextActiveTabId && tab.toolType === nextToolType)) {
    nextActiveTabId = workspace.openTabs.find(tab => tab.toolType === nextToolType)?.id || null
  }

  let nextWorkspace = {
    ...workspace,
    activeToolType: nextToolType,
    activeTabId: nextActiveTabId,
    activeTabByTool
  }
  nextWorkspace = ensureOpenTabs(nextWorkspace, { ...options, toolType: nextToolType })
  const activeTab = getActiveTab(nextWorkspace)
  return {
    ...nextWorkspace,
    activeTabByTool: {
      ...nextWorkspace.activeTabByTool,
      [nextToolType]: activeTab.id
    }
  }
}

export function saveCurrent(workspace, options = {}) {
  const activeTab = getActiveTab(workspace)
  if (!activeTab) return workspace

  const now = timestamp(options)
  const documentId = activeTab.documentId || activeTab.id
  const existing = workspace.documents.find(document => document.id === documentId)
  const savedDocument = {
    id: documentId,
    toolType: activeTab.toolType,
    name: activeTab.name,
    content: activeTab.content,
    createdAt: existing?.createdAt || activeTab.createdAt || now,
    updatedAt: now
  }
  const documents = normalizeDocuments([
    savedDocument,
    ...workspace.documents.filter(document => document.id !== documentId)
  ])

  return {
    documents,
    openTabs: workspace.openTabs.map(tab => {
      if (tab.id !== activeTab.id) return cloneTab(tab)
      return {
        ...tab,
        documentId,
        updatedAt: now,
        dirty: false
      }
    }),
    activeTabId: activeTab.id,
    activeToolType: activeTab.toolType,
    activeTabByTool: {
      ...workspace.activeTabByTool,
      [activeTab.toolType]: activeTab.id
    }
  }
}

export function toSession(workspace) {
  return {
    activeToolType: workspace.activeToolType,
    activeTabId: workspace.activeTabId,
    activeTabByTool: { ...workspace.activeTabByTool },
    openTabs: workspace.openTabs.map(cloneTab)
  }
}

export { DEFAULT_CONTENT, DEFAULT_CONTENT_BY_TOOL, DEFAULT_NAME_BY_TOOL, DEFAULT_TOOL_TYPE, MAX_DOCUMENTS, TOOL_TYPES }
