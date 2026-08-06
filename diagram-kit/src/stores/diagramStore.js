import { computed, reactive } from 'vue'
import { get, set, KEYS } from '../utils/storage.js'
import templatesData from '../data/templates.json' with { type: 'json' }
import { useUiStore } from './uiStore.js'
import { loadStoredDocuments, refreshWorkspaceDocuments, saveStoredDocuments } from './documentHistory.js'
import {
  buildInitialWorkspace,
  closeTab as closeWorkspaceTab,
  createTab as createWorkspaceTab,
  deleteDocument as deleteWorkspaceDocument,
  getActiveTab,
  getArchiveDocuments,
  getCurrentToolDocuments,
  getCurrentToolTabs,
  getIsArchived,
  getIsDirty,
  loadDocument as loadWorkspaceDocument,
  loadTemplate as loadWorkspaceTemplate,
  renameTab as renameWorkspaceTab,
  saveCurrent as saveWorkspaceCurrent,
  setActiveTab,
  switchTool as switchWorkspaceTool,
  toSession,
  updateContent as updateWorkspaceContent
} from './diagramModel.js'

const state = reactive({
  documents: [],
  openTabs: [],
  activeTabId: null,
  activeToolType: 'mermaid',
  activeTabByTool: {},
  get diagrams() {
    return this.openTabs
  },
  get tabOrder() {
    return this.openTabs.map(tab => tab.id)
  },
  get activeId() {
    return this.activeTabId
  },
  get unsavedMap() {
    return Object.fromEntries(this.openTabs.map(tab => [tab.id, !!tab.dirty]))
  },
  get currentToolTabs() {
    return this.openTabs.filter(tab => tab.toolType === this.activeToolType)
  },
  get currentToolDocuments() {
    return this.documents.filter(document => document.toolType === this.activeToolType)
  },
  get archiveDocuments() {
    return getArchiveDocuments(this)
  }
})

let persistDebounce = null
let documentsPersistPromise = Promise.resolve()

function snapshot() {
  return {
    documents: state.documents,
    openTabs: state.openTabs,
    activeTabId: state.activeTabId,
    activeToolType: state.activeToolType,
    activeTabByTool: state.activeTabByTool
  }
}

function applyWorkspace(workspace) {
  state.documents = workspace.documents
  state.openTabs = workspace.openTabs
  state.activeTabId = workspace.activeTabId
  state.activeToolType = workspace.activeToolType
  state.activeTabByTool = workspace.activeTabByTool
}

function scheduleSessionPersist() {
  clearTimeout(persistDebounce)
  persistDebounce = setTimeout(() => {
    set(KEYS.SESSION, toSession(snapshot()))
  }, 500)
}

async function persistSession() {
  clearTimeout(persistDebounce)
  await set(KEYS.SESSION, toSession(snapshot()))
}

async function persistDocuments() {
  documentsPersistPromise = saveStoredDocuments(state.documents)
  await documentsPersistPromise
}

async function ensureTemplates() {
  let stored = await get(KEYS.TEMPLATES)
  if (!stored || !Array.isArray(stored)) {
    stored = templatesData.map(t => ({ ...t, toolType: 'mermaid', _builtin: true }))
    await set(KEYS.TEMPLATES, stored)
  }
}

export function useActiveDiagram() {
  return computed(() => getActiveTab(snapshot()))
}

export function useIsUnsaved() {
  return computed(() => getIsDirty(snapshot()))
}

export function useIsArchived() {
  return computed(() => getIsArchived(snapshot()))
}

export function useDiagramStore() {
  async function loadDiagrams() {
    await ensureTemplates()
    const documents = await loadStoredDocuments()
    const session = await get(KEYS.SESSION)
    const workspace = buildInitialWorkspace({ documents, session })
    applyWorkspace(workspace)

    const settings = (await get(KEYS.SETTINGS)) || {}
    if (settings.theme && settings.theme === 'light') {
      useUiStore().theme = settings.theme
    }

    await persistSession()
  }

  async function persistDiagrams() {
    await persistDocuments()
    await persistSession()
  }

  async function refreshDocuments() {
    await documentsPersistPromise.catch(() => {})
    const documents = await loadStoredDocuments()
    applyWorkspace(refreshWorkspaceDocuments(snapshot(), documents))
  }

  function setActive(id, options = {}) {
    if (getIsDirty(snapshot()) && !options.ignoreDirty) return false
    applyWorkspace(setActiveTab(snapshot(), id))
    scheduleSessionPersist()
    return true
  }

  function createTab(name, content, options = {}) {
    const tabOptions = { ...options }
    if (name !== undefined) tabOptions.name = name
    if (content !== undefined) tabOptions.content = content
    const workspace = createWorkspaceTab(snapshot(), tabOptions)
    applyWorkspace(workspace)
    scheduleSessionPersist()
    return workspace.activeTabId
  }

  function closeTab(id) {
    applyWorkspace(closeWorkspaceTab(snapshot(), id))
    scheduleSessionPersist()
  }

  function updateContent(content) {
    applyWorkspace(updateWorkspaceContent(snapshot(), content))
    scheduleSessionPersist()
  }

  async function saveCurrent() {
    await refreshDocuments()
    applyWorkspace(saveWorkspaceCurrent(snapshot()))
    await persistDocuments()
    await persistSession()
  }

  async function renameTab(id, newName) {
    await refreshDocuments()
    const beforeDocuments = state.documents
    const workspace = renameWorkspaceTab(snapshot(), id, newName)
    applyWorkspace(workspace)
    if (workspace.documents !== beforeDocuments) {
      await persistDocuments()
      await persistSession()
      return
    }
    scheduleSessionPersist()
  }

  function loadTemplate(content) {
    applyWorkspace(loadWorkspaceTemplate(snapshot(), content))
    scheduleSessionPersist()
  }

  function loadDocument(id) {
    applyWorkspace(loadWorkspaceDocument(snapshot(), id))
    scheduleSessionPersist()
  }

  async function deleteDocument(id) {
    await refreshDocuments()
    applyWorkspace(deleteWorkspaceDocument(snapshot(), id))
    await persistDocuments()
    await persistSession()
  }

  function switchTool(toolType) {
    applyWorkspace(switchWorkspaceTool(snapshot(), toolType))
    scheduleSessionPersist()
  }

  return {
    state,
    setActive,
    createTab,
    closeTab,
    updateContent,
    saveCurrent,
    renameTab,
    loadTemplate,
    loadDocument,
    deleteDocument,
    switchTool,
    loadDiagrams,
    persistDiagrams,
    refreshDocuments
  }
}

export function useCurrentToolTabs() {
  return computed(() => getCurrentToolTabs(snapshot()))
}

export function useCurrentToolDocuments() {
  return computed(() => getCurrentToolDocuments(snapshot()))
}
