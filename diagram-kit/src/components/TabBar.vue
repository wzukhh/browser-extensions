<template>
  <div class="tab-list" ref="tabListRef">
    <div v-for="tab in openTabs" :key="tab.id" class="tab-item"
      :class="{ active: tab.id === activeId, unsaved: tab.dirty }"
      @click="switchTab(tab.id)">
      <img :src="toolIcon(tab.toolType)" class="tab-type-icon" alt="">
      <span class="tab-name" @dblclick.stop="startRename(tab.id)" v-if="renaming !== tab.id">{{ tab.name || '未命名' }}</span>
      <input v-else class="tab-rename-input" v-model="renameValue"
        @keydown.enter.stop.prevent="finishRename(tab.id)"
        @blur="finishRename(tab.id)"
        ref="renameInput" autofocus />
      <button class="tab-rename-btn" @click.stop="startRename(tab.id)" v-if="renaming !== tab.id" title="重命名">✎</button>
      <span class="tab-unsaved" v-if="tab.dirty && renaming !== tab.id">●</span>
      <button class="tab-close" @click.stop="closeTabWithCheck(tab.id)">✕</button>
    </div>
    <button class="tab-add" type="button" @click="handleAdd">
      <span class="tab-add-plus">+</span>
      <span class="tab-add-label">新建</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useDiagramStore } from '../stores/diagramStore.js'
import { useDialogStore } from '../stores/dialogStore.js'

const { state, setActive, createTab, closeTab, renameTab } = useDiagramStore()
const dialogStore = useDialogStore()

const renaming = ref(null)
const renameValue = ref('')
const renameInput = ref(null)
const openTabs = computed(() => state.openTabs)
const activeId = computed(() => state.activeTabId)

function getDiagramName(id) { return state.openTabs.find(d => d.id === id)?.name || '未命名' }
function toolIcon(toolType) { return toolType === 'markmap' ? '/icons/markmap.svg' : '/icons/mermaid.svg' }

async function switchTab(id) {
  if (id === state.activeId) return
  setActive(id, { ignoreDirty: true })
}

async function closeTabWithCheck(id) {
  if (state.unsavedMap[id]) {
    const ok = await dialogStore.confirm({
      title: '关闭标签？',
      message: `"${getDiagramName(id)}" 有未保存更改，关闭后只会保留已保存版本。`,
      tone: 'warning',
      confirmText: '关闭',
      cancelText: '取消',
      variant: 'danger'
    })
    if (!ok) return
  }
  closeTab(id)
}

async function handleAdd() {
  const toolType = await dialogStore.choose({
    title: '新建标签',
    message: '请选择这个标签的图表类型。',
    showClose: true,
    actionsAlign: 'center',
    actions: [
      { label: '新建 Mermaid', value: 'mermaid', variant: 'primary', icon: '/icons/mermaid.svg' },
      { label: '新建 Markmap', value: 'markmap', variant: 'primary', icon: '/icons/markmap.svg' }
    ]
  })
  if (!toolType) return
  createTab(undefined, undefined, { toolType })
}

async function startRename(id) {
  renaming.value = id; renameValue.value = getDiagramName(id)
  await nextTick()
  const input = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value
  input?.focus()
  input?.select()
}

async function finishRename(id) {
  if (renaming.value !== id) return
  const cleanName = renameValue.value.trim()
  renaming.value = null
  if (cleanName) await renameTab(id, cleanName)
}
</script>

<style scoped>
.tab-list { display: flex; align-items: center; gap: 4px; overflow-x: auto; flex: 1; }
.tab-list::-webkit-scrollbar { height: 2px; }
.tab-item {
  display: flex; align-items: center; gap: 4px; padding: 5px 9px; font-size: 12px;
  color: var(--text-secondary); cursor: pointer; border-radius: 6px;
  border: 1px solid var(--border-color); background: var(--bg-secondary);
  white-space: nowrap; user-select: none;
  box-shadow: inset 0 -1px 0 rgba(31, 35, 40, 0.04);
}
.tab-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.tab-item.active {
  background: var(--bg-primary); color: var(--text-primary);
  border-color: var(--accent-primary); font-weight: 600;
  box-shadow: 0 0 0 1px rgba(9, 105, 218, 0.14), 0 2px 8px rgba(31, 35, 40, 0.08);
}
.tab-type-icon { width: 14px; height: 14px; display: block; flex-shrink: 0; }
.tab-unsaved { color: var(--accent-warning); font-size: 10px; line-height: 1; }
.tab-rename-btn {
  background: none; border: none; color: var(--text-muted); font-size: 11px;
  cursor: pointer; padding: 0 2px; border-radius: 3px; line-height: 1; opacity: 0;
  transition: opacity 0.1s;
}
.tab-item:hover .tab-rename-btn { opacity: 1; }
.tab-rename-btn:hover { color: var(--accent-primary); }
.tab-close {
  background: none; border: none; color: var(--text-muted); font-size: 10px;
  cursor: pointer; padding: 1px 3px; border-radius: 3px; line-height: 1; visibility: hidden;
}
.tab-item:hover .tab-close { visibility: visible; }
.tab-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.tab-add {
  display: flex; align-items: center; gap: 5px; flex-shrink: 0;
  background: var(--accent-primary); border: 1px solid var(--accent-primary); color: #fff;
  font-size: 12px; font-weight: 700; cursor: pointer; padding: 5px 10px;
  border-radius: 6px; line-height: 1; margin-left: 6px;
  box-shadow: 0 3px 10px rgba(9, 105, 218, 0.22);
}
.tab-add:hover { opacity: 0.9; }
.tab-add-plus { font-size: 16px; line-height: 0.8; }
.tab-add-label { line-height: 1; white-space: nowrap; }
.tab-rename-input {
  background: var(--bg-primary); border: 1px solid var(--accent-primary);
  color: var(--text-primary); font-size: 12px; padding: 1px 4px; border-radius: 3px; width: 100px; outline: none;
}
</style>
