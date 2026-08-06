import { get, remove, set, KEYS } from '../utils/storage.js'
import { buildInitialWorkspace, toSession } from './diagramModel.js'

const LEGACY_DIAGRAMS_KEY = 'mermaiddraw_diagrams'

export async function loadStoredDocuments() {
  const storedDocuments = await get(KEYS.DOCUMENTS)
  await remove(LEGACY_DIAGRAMS_KEY)
  return Array.isArray(storedDocuments) ? storedDocuments : []
}

export function serializeDocuments(documents = []) {
  return documents.map(document => ({ ...document }))
}

export async function saveStoredDocuments(documents) {
  await set(KEYS.DOCUMENTS, serializeDocuments(documents))
}

export function refreshWorkspaceDocuments(workspace, documents) {
  const normalizedWorkspace = buildInitialWorkspace({
    documents,
    session: toSession(workspace)
  })

  return {
    ...workspace,
    documents: normalizedWorkspace.documents
  }
}
