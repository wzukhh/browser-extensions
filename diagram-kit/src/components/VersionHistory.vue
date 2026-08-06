<template>
  <div class="version-overlay" v-if="visible" @click.self="close">
    <div class="version-panel">
      <div class="version-header">
        <span class="version-title">
          <img src="/icons/历史.svg" class="version-title-icon" alt="">
          图表存档
        </span>
        <span class="version-count">{{ documents.length }}/50</span>
        <button class="version-close" @click="close">✕</button>
      </div>
      <div class="version-body">
        <div v-if="documents.length === 0" class="version-empty">暂无存档。点击保存按钮保存 Mermaid 或 Markmap 文档。</div>
        <div v-for="d in documents" :key="d.id" class="diagram-card" :class="{ active: d.id === activeDocumentId }" @click="loadDiagram(d.id)">
          <div class="diagram-card-header">
            <span class="tool-badge" :class="toolMeta(d.toolType).className">
              <img :src="toolMeta(d.toolType).icon" alt="">
            </span>
            <div class="diagram-heading">
              <div class="diagram-name">{{ d.name }} <span v-if="d.id === activeDocumentId" class="current-badge">当前</span></div>
              <div class="diagram-time">
                <span class="diagram-tool">{{ toolMeta(d.toolType).label }}</span>
                最后保存 {{ formatTime(d.updatedAt) }}
              </div>
            </div>
            <button class="diagram-delete" type="button" title="删除存档" aria-label="删除存档" @click.stop="deleteDiagram(d)">✕</button>
          </div>
          <pre class="diagram-preview">{{ truncate(d.content) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useDiagramStore } from '../stores/diagramStore.js'
import { useDialogStore } from '../stores/dialogStore.js'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close'])

const diagramStore = useDiagramStore()
const dialogStore = useDialogStore()

const documents = computed(() => {
  return diagramStore.state.archiveDocuments
})

const activeDocumentId = computed(() => {
  return diagramStore.state.openTabs.find(tab => tab.id === diagramStore.state.activeTabId)?.documentId || null
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  diagramStore.refreshDocuments().catch(error => {
    console.error('Failed to refresh diagram history:', error)
  })
})

async function loadDiagram(id) {
  diagramStore.loadDocument(id)
  close()
}

async function deleteDiagram(document) {
  const isActive = document.id === activeDocumentId.value
  const ok = await dialogStore.confirm({
    title: '删除存档？',
    message: `确定删除 "${document.name}"？`,
    detail: isActive ? '当前打开的内容会保留在编辑器中，并转为未保存草稿。' : '',
    tone: 'danger',
    confirmText: '删除',
    cancelText: '取消',
    variant: 'danger'
  })
  if (!ok) return
  await diagramStore.deleteDocument(document.id)
}

function close() { emit('close') }

function toolMeta(toolType) {
  if (toolType === 'markmap') {
    return {
      label: 'Markmap',
      icon: '/icons/markmap.svg',
      className: 'markmap'
    }
  }
  return {
    label: 'Mermaid',
    icon: '/icons/mermaid.svg',
    className: 'mermaid'
  }
}

function formatTime(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
function truncate(c) { return c && c.length > 80 ? c.slice(0, 80) + '...' : (c || '') }
</script>

<style scoped>
.version-overlay {
  position: fixed; inset: 0; z-index: 100; background: rgba(0, 0, 0, 0.3);
  display: flex; justify-content: flex-end;
}
.version-panel {
  width: 372px; height: 100%; background: var(--bg-primary);
  border-left: 1px solid var(--border-color); display: flex; flex-direction: column;
  animation: slideInRight 0.2s ease;
  box-shadow: -18px 0 40px rgba(31, 35, 40, 0.12);
}
@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
.version-header {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border-color);
}
.version-title { font-weight: 700; font-size: 14px; flex: 1; display: flex; align-items: center; gap: 8px; }
.version-title-icon { width: 17px; height: 17px; display: block; }
.version-count { font-size: 11px; color: var(--text-muted); font-family: var(--code-font); }
.version-close { background: none; border: none; color: var(--text-secondary); font-size: 16px; cursor: pointer; }
.version-close:hover { color: var(--text-primary); }
.version-body { flex: 1; overflow-y: auto; padding: 8px; }
.version-empty { padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px; }
.diagram-card {
  padding: 12px; border: 1px solid var(--border-color);
  border-radius: var(--border-radius); margin-bottom: 6px; cursor: pointer;
  background: var(--bg-primary);
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
}
.diagram-card:hover {
  background: #f9fbfd;
  border-color: rgba(9, 105, 218, 0.48);
  box-shadow: 0 8px 18px rgba(31, 35, 40, 0.08);
}
.diagram-card.active { border-color: var(--accent-primary); background: rgba(9,105,218,0.07); }
.diagram-card-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 7px; }
.diagram-delete {
  width: 24px; height: 24px;
  border: 1px solid transparent; border-radius: 6px;
  background: transparent; color: var(--text-muted);
  cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; line-height: 1;
}
.diagram-delete:hover {
  color: var(--accent-danger);
  border-color: rgba(207, 34, 46, 0.24);
  background: rgba(207, 34, 46, 0.08);
}
.tool-badge {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 800;
  font-family: var(--code-font);
  line-height: 1;
}
.tool-badge img { width: 18px; height: 18px; display: block; }
.tool-badge.mermaid {
  background: rgba(9, 105, 218, 0.08);
  border-color: rgba(9, 105, 218, 0.22);
}
.tool-badge.markmap {
  background: rgba(26, 127, 55, 0.1);
  border-color: rgba(26, 127, 55, 0.24);
  color: var(--accent-success);
}
.diagram-heading { min-width: 0; flex: 1; }
.diagram-name { font-weight: 600; font-size: 13px; margin-bottom: 3px; display: flex; align-items: center; gap: 6px; color: var(--text-primary); }
.current-badge { font-size: 10px; color: var(--accent-primary); font-weight: 400; }
.diagram-time { font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.diagram-tool { color: var(--text-secondary); font-weight: 700; }
.diagram-preview { font-family: var(--code-font); font-size: 10px; color: var(--text-secondary); white-space: pre-wrap; max-height: 40px; overflow: hidden; line-height: 1.4; }
</style>
