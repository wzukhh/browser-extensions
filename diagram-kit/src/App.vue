<template>
  <div class="app" :data-theme="uiStore.theme">
    <Toolbar @save="handleSave" @export="handleExport" />
    <main class="app-main">
      <div class="editor-panel-wrapper" ref="editorWrapper">
        <EditorPanel :content="activeDiagram?.content || ''" @content-change="handleContentChange" />
      </div>
      <div class="divider" @mousedown="startResize"></div>
      <div class="preview-panel-wrapper" ref="previewWrapper">
        <MarkmapPreview
          v-if="activeDiagram?.toolType === 'markmap'"
          :content="activeDiagram?.content || ''"
          @svg-ready="handleSvgReady" />
        <PreviewPanel
          v-else
          :content="activeDiagram?.content || ''"
          @svg-ready="handleSvgReady" />
      </div>
    </main>
    <div class="status-bar">
      <span v-if="isArchived" class="status-item archived">📁 已归档</span>
      <span v-if="isUnsaved" class="status-item unsaved">● 未保存</span>
      <span class="status-item">{{ toolLabel }}</span>
      <span class="status-item">{{ activeDiagram?.name || '无' }}</span>
      <span class="status-item status-author">作者: wzukhh | wzukhh@163.com</span>
    </div>
    <TemplatePanel :visible="uiStore.templatePanelOpen" @close="uiStore.templatePanelOpen = false" />
    <VersionHistory :visible="uiStore.versionPanelOpen" @close="uiStore.versionPanelOpen = false" />
    <DialogHost />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { useDiagramStore, useActiveDiagram, useIsUnsaved, useIsArchived } from './stores/diagramStore.js'
import { useUiStore } from './stores/uiStore.js'
import { get, set, KEYS } from './utils/storage.js'
import Toolbar from './components/Toolbar.vue'
import EditorPanel from './components/EditorPanel.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import TemplatePanel from './components/TemplatePanel.vue'
import VersionHistory from './components/VersionHistory.vue'
import DialogHost from './components/DialogHost.vue'
import { exportPng, exportSvg } from './utils/export.js'
import { useDialogStore } from './stores/dialogStore.js'

const MarkmapPreview = defineAsyncComponent(() => import('./components/MarkmapPreview.vue'))

const diagramStore = useDiagramStore()
const uiStore = useUiStore()
const dialogStore = useDialogStore()
const activeDiagram = useActiveDiagram()
const isUnsaved = useIsUnsaved()
const isArchived = useIsArchived()
const editorWrapper = ref(null)
const previewWrapper = ref(null)
const toolLabels = { mermaid: 'Mermaid', markmap: 'Markmap' }
const toolLabel = computed(() => toolLabels[activeDiagram.value?.toolType] || 'Mermaid')

const SPLIT_KEY = 'editorSplit'

onMounted(async () => {
  await diagramStore.loadDiagrams()
  // Restore divider position
  const settings = (await get(KEYS.SETTINGS)) || {}
  if (settings[SPLIT_KEY] && editorWrapper.value) {
    setSplit(settings[SPLIT_KEY])
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

function handleBeforeUnload(e) {
  if (diagramStore.state.openTabs.some(tab => tab.dirty)) {
    e.preventDefault(); e.returnValue = ''
  }
}

function handleContentChange(content) { diagramStore.updateContent(content) }
async function handleSave() { await diagramStore.saveCurrent() }

function handleSvgReady(svg) { /* svg available for export */ }

async function handleExport(fmt) {
  const name = activeDiagram.value?.name || 'diagram'
  try {
    if (fmt === 'png') await exportPng(name)
    else if (fmt === 'svg') await exportSvg(name)
    dialogStore.notify({ title: '导出成功', message: `${name}.${fmt} 已生成`, tone: 'success' })
  } catch (e) {
    dialogStore.notify({ title: '导出失败', message: e.message, tone: 'danger' })
  }
}

function setSplit(pct) {
  editorWrapper.value.style.width = pct + '%'
  editorWrapper.value.style.flex = 'none'
}

function startResize(e) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = editorWrapper.value.offsetWidth
  const totalWidth = editorWrapper.value.parentElement.offsetWidth
  function onMove(ev) {
    const pct = ((startWidth + ev.clientX - startX) / totalWidth) * 100
    if (pct > 20 && pct < 80) setSplit(pct)
  }
  async function onUp() {
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp)
    const pct = parseFloat(editorWrapper.value.style.width) || 50
    const settings = (await get(KEYS.SETTINGS)) || {}
    settings[SPLIT_KEY] = pct
    await set(KEYS.SETTINGS, settings)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; width: 100%; overflow: hidden; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
.app { display: flex; flex-direction: column; height: 100%; background: var(--bg-primary); }
.app-main { display: flex; flex: 1; overflow: hidden; position: relative; }
.editor-panel-wrapper { flex: 1; overflow: hidden; min-width: 300px; }
.preview-panel-wrapper { flex: 1; overflow: hidden; min-width: 300px; }
.divider { width: 4px; cursor: col-resize; background: var(--border-color); flex-shrink: 0; }
.divider:hover { background: var(--accent-primary); }
.status-bar {
  display: flex; align-items: center; gap: 16px; height: 24px; padding: 0 12px;
  background: var(--toolbar-bg); border-top: 1px solid var(--border-color); font-size: 11px; color: var(--text-muted);
}
.status-item.archived { color: var(--accent-primary); }
.status-item.unsaved { color: var(--accent-warning); font-weight: 600; }
.status-author { margin-left: auto; opacity: 0.45; }

/* Custom tooltip — appears instantly on hover */
[data-tip] { position: relative; }
[data-tip]:hover::after {
  content: attr(data-tip);
  position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%);
  padding: 4px 8px; border-radius: 4px;
  background: #333; color: #fff;
  font-size: 11px; white-space: nowrap;
  pointer-events: none; z-index: 9999;
}
</style>
