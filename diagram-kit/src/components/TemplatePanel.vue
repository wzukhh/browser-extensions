<template>
  <!-- Main overlay -->
  <div class="template-overlay" v-if="visible" @click.self="close">
    <div class="template-modal">
      <div class="template-header">
        <span class="template-title"><img :src="headerIcon" class="title-icon"> {{ toolLabel }} 模板库 ({{ allTemplates.length }}/100)</span>
        <div class="header-actions">
          <button v-if="!managing" class="hdr-btn" @click="openAdd()">添加</button>
          <button v-if="!managing" class="hdr-btn" @click="managing = true">管理</button>
          <button v-if="managing" class="hdr-btn" @click="finishManaging">完成</button>
          <button v-if="managing && selected.size" class="hdr-btn danger" @click="batchDelete">删除 ({{ selected.size }})</button>
          <button class="template-close" @click="close">✕</button>
        </div>
      </div>

      <!-- Search -->
      <div class="search-bar" v-if="allTemplates.length > 0">
        <input class="search-input" v-model="searchQuery" placeholder="搜索模板标题...">
      </div>

      <!-- Empty or grid -->
      <div class="template-body" v-if="filteredTemplates.length === 0">
        <div class="empty-msg">
          <img :src="headerIcon" class="empty-icon">
          <p v-if="searchQuery && allTemplates.length > 0">没有匹配的模板</p>
          <p v-else>模板库为空</p>
          <p class="empty-hint" v-if="!searchQuery">点击"添加"将当前图表保存为模板</p>
          <p class="empty-hint" v-else>尝试其他关键词</p>
        </div>
      </div>
      <div class="template-body" v-else>
        <div v-for="tpl in filteredTemplates" :key="tpl._uid"
          class="template-card"
          :class="{ selected: selected.has(tpl._uid) }"
          @click="managing ? toggleSelect(tpl._uid) : handleSelect(tpl)">
          <div class="card-top">
            <input v-if="managing" type="checkbox" class="card-cb" :checked="selected.has(tpl._uid)" @click.stop="toggleSelect(tpl._uid)">
            <div class="template-category">
              <img :src="catIcon(tpl)" class="cat-icon">
              {{ tpl.category }}
            </div>
            <button v-if="managing" class="card-edit" @click.stop="openEdit(tpl)">✎</button>
          </div>
          <div class="template-name">{{ tpl.name }}</div>
          <div class="template-snippet">{{ subtitle(tpl.content) }}</div>
        </div>
      </div>
    </div>

    <!-- Sub-dialog: add / edit -->
    <div class="sub-overlay" v-if="dialogOpen" @click.self="dialogOpen = false">
      <div class="sub-dialog">
        <div class="sub-header">
          <span class="sub-title">{{ editingUid !== null ? '编辑模板' : '添加模板' }}</span>
          <button class="template-close" @click="dialogOpen = false">✕</button>
        </div>
        <div class="sub-body">
          <!-- Type -->
          <div class="field">
            <label class="field-label">语法类型</label>
            <select class="field-input" v-model="formCategory">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
            <input v-if="formCategory === '自定义'" class="field-input" v-model="formCustomCat"
              placeholder="输入自定义类型名称" maxlength="20" style="margin-top:6px">
          </div>

          <!-- Icon -->
          <div class="field">
            <label class="field-label">图标</label>
            <div v-if="formCategory !== '自定义'" class="icon-preview-static">
              <img :src="catIcon({category:formCategory})" class="preview-icon"> 内置图标
            </div>
            <div v-else class="icon-custom">
              <div class="icon-preview" v-if="formIconData">
                <img :src="formIconData" class="preview-icon">
                <button class="icon-remove" @click="formIconData = ''">✕</button>
              </div>
              <div class="icon-upload">
                <label class="hdr-btn">选择 SVG 文件
                  <input type="file" accept=".svg" class="icon-file-input" @change="onIconFile">
                </label>
                <span class="icon-or">或</span>
                <textarea class="icon-code-input" v-model="formIconSvg" placeholder="粘贴 SVG 代码" rows="2"></textarea>
                <button v-if="formIconSvg.trim()" class="hdr-btn" @click="applyIconSvg">应用 SVG</button>
              </div>
            </div>
          </div>

          <!-- Title -->
          <div class="field">
            <label class="field-label">标题</label>
            <input class="field-input" v-model="formTitle" placeholder="模板名称" maxlength="30">
          </div>

          <!-- Content -->
          <div class="field">
            <label class="field-label">模板内容</label>
            <textarea class="field-textarea" v-model="formContent" :placeholder="contentPlaceholder"></textarea>
          </div>

          <!-- Subtitle -->
          <div class="field">
            <label class="field-label">副标题</label>
            <input class="field-input muted" :value="extractedSubtitle" readonly placeholder="自动从代码第一行提取">
          </div>
        </div>
        <div class="sub-footer">
          <button class="hdr-btn" @click="dialogOpen = false">取消</button>
          <button class="hdr-btn primary" :disabled="!canSave" @click="saveTemplate">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { get, set, KEYS } from '../utils/storage.js'
import templatesData from '../data/templates.json'
import markmapTemplatesData from '../data/markmapTemplates.json'
import { useDiagramStore } from '../stores/diagramStore.js'
import { useDialogStore } from '../stores/dialogStore.js'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close'])

const diagramStore = useDiagramStore()
const dialogStore = useDialogStore()
const headerIcon = '/icons/模板库.svg'
const MAX_TEMPLATES = 100

const userTemplates = ref([])
const builtinTemplates = ref([])
const managing = ref(false)
const selected = ref(new Set())
const dialogOpen = ref(false)
const editingUid = ref(null)
const searchQuery = ref('')

// Form state
const formTitle = ref('')
const formCategory = ref('流程图')
const formCustomCat = ref('')
const formContent = ref('')
const formIconData = ref('')
const formIconSvg = ref('')

const categoriesByTool = {
  mermaid: ['流程图', '时序图', '甘特图', '类图', '状态图', '饼图', 'ER 图', '旅程图', 'Git 图', '自定义'],
  markmap: ['项目规划', '知识整理', '会议记录', '学习笔记', '自定义']
}

const templateConfig = {
  mermaid: {
    key: KEYS.TEMPLATES,
    label: 'Mermaid',
    data: templatesData,
    defaultCategory: '流程图',
    placeholder: '粘贴 Mermaid 代码'
  },
  markmap: {
    key: KEYS.MARKMAP_TEMPLATES,
    label: 'Markmap',
    data: markmapTemplatesData,
    defaultCategory: '项目规划',
    placeholder: '粘贴 Markdown 内容'
  }
}

const activeToolType = computed(() => diagramStore.state.activeToolType)
const activeConfig = computed(() => templateConfig[activeToolType.value] || templateConfig.mermaid)
const categories = computed(() => categoriesByTool[activeToolType.value] || categoriesByTool.mermaid)
const toolLabel = computed(() => activeConfig.value.label)
const contentPlaceholder = computed(() => activeConfig.value.placeholder)

const builtinCatIcons = {
  '流程图': '/icons/流程图2.svg', '时序图': '/icons/时序图.svg', '甘特图': '/icons/甘特图.svg',
  '类图': '/icons/表结构配置.svg', '状态图': '/icons/状态图.svg', '饼图': '/icons/饼图.svg',
  'ER 图': '/icons/ER图.svg', '旅程图': '/icons/旅程图.svg', 'Git 图': '/icons/git-merge-line.svg'
}

const allTemplates = computed(() => {
  const sorted = [...userTemplates.value].sort((a, b) => (b._createdAt || 0) - (a._createdAt || 0))
  return [...sorted, ...builtinTemplates.value]
})

const filteredTemplates = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return allTemplates.value
  return allTemplates.value.filter(t => t.name.toLowerCase().includes(q))
})

const extractedSubtitle = computed(() => {
  return (formContent.value || '').split('\n').find(l => l.trim() && !l.trim().startsWith('%')) || ''
})

const canSave = computed(() => {
  if (!formTitle.value.trim()) return false
  if (formCategory.value === '自定义' && !formCustomCat.value.trim()) return false
  if (!formContent.value.trim()) return false
  return true
})

function catIcon(tpl) {
  if (tpl._icon) return tpl._icon
  return builtinCatIcons[tpl.category] || headerIcon
}

function subtitle(content) {
  return (content || '').split('\n').find(l => l.trim() && !l.trim().startsWith('%')) || ''
}

let uidCounter = Date.now()
function uid() { return (++uidCounter).toString(36) }

async function loadTemplates() {
  const config = activeConfig.value
  let stored = await get(config.key)
  if (!stored || !Array.isArray(stored)) {
    builtinTemplates.value = config.data.map(t => ({ ...t, toolType: activeToolType.value, _builtin: true, _uid: uid() }))
    userTemplates.value = []
    await saveAll()
    return
  }
  builtinTemplates.value = stored.filter(t => t._builtin)
  userTemplates.value = stored.filter(t => !t._builtin)
  if (builtinTemplates.value.length === 0 && stored.some(t => !t._builtin) === false) {
    builtinTemplates.value = config.data.map(t => ({ ...t, toolType: activeToolType.value, _builtin: true, _uid: uid() }))
    await saveAll()
  }
}

async function saveAll() {
  await set(activeConfig.value.key, [...userTemplates.value, ...builtinTemplates.value])
}

function openAdd() {
  formTitle.value = ''
  formCategory.value = activeConfig.value.defaultCategory
  formCustomCat.value = ''
  formContent.value = ''
  formIconData.value = ''
  formIconSvg.value = ''
  editingUid.value = null
  dialogOpen.value = true
}

function openEdit(tpl) {
  formTitle.value = tpl.name
  formCategory.value = builtinCatIcons[tpl.category] ? tpl.category : '自定义'
  formCustomCat.value = builtinCatIcons[tpl.category] ? '' : tpl.category
  formContent.value = tpl.content
  formIconData.value = tpl._icon || ''
  formIconSvg.value = ''
  editingUid.value = tpl._uid
  dialogOpen.value = true
}

async function saveTemplate() {
  if (!canSave.value) return
  if (editingUid.value === null && allTemplates.value.length >= MAX_TEMPLATES) return
  const category = formCategory.value === '自定义' ? formCustomCat.value.trim() : formCategory.value
  const orig = editingUid.value !== null
    ? allTemplates.value.find(t => t._uid === editingUid.value)
    : null
  const tpl = {
    name: formTitle.value.trim(),
    category,
    content: formContent.value,
    toolType: activeToolType.value,
    _builtin: false,
    _icon: formIconData.value || '',
    _uid: orig?._uid || uid(),
    _createdAt: orig?._createdAt || Date.now()
  }
  if (orig) {
    if (orig._builtin) {
      const bi = builtinTemplates.value.indexOf(orig)
      if (bi !== -1) builtinTemplates.value.splice(bi, 1)
      userTemplates.value.push(tpl)
    } else {
      const ui = userTemplates.value.indexOf(orig)
      if (ui !== -1) userTemplates.value[ui] = tpl
    }
  } else {
    userTemplates.value.push(tpl)
  }
  await saveAll()
  dialogOpen.value = false
}

function finishManaging() {
  managing.value = false
  selected.value = new Set()
}

function toggleSelect(uid) {
  const s = new Set(selected.value)
  s.has(uid) ? s.delete(uid) : s.add(uid)
  selected.value = s
}

async function batchDelete() {
  const ok = await dialogStore.confirm({
    title: '删除模板？',
    message: `确定删除选中的 ${selected.value.size} 个模板？`,
    tone: 'danger',
    confirmText: '删除',
    cancelText: '取消',
    variant: 'danger'
  })
  if (!ok) return
  const selectedUids = selected.value
  builtinTemplates.value = builtinTemplates.value.filter(t => !selectedUids.has(t._uid))
  userTemplates.value = userTemplates.value.filter(t => !selectedUids.has(t._uid))
  selected.value = new Set()
  await saveAll()
}

async function handleSelect(tpl) {
  if (diagramStore.state.unsavedMap[diagramStore.state.activeId]) {
    const action = await dialogStore.choose({
      title: '加载模板？',
      message: `当前标签有未保存更改，是否加载 "${tpl.name}"？`,
      tone: 'warning',
      showClose: true,
      actions: [
        { label: '不保存加载', value: 'discard', variant: 'secondary' },
        { label: '保存并加载', value: 'save', variant: 'primary' }
      ]
    })
    if (!action) return
    if (action === 'save') await diagramStore.saveCurrent()
  }
  diagramStore.loadTemplate(tpl.content)
  close()
}

function close() { emit('close') }

function onIconFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    formIconData.value = reader.result
    formIconSvg.value = ''
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function applyIconSvg() {
  if (!formIconSvg.value.trim()) return
  const blob = new Blob([formIconSvg.value.trim()], { type: 'image/svg+xml' })
  const reader = new FileReader()
  reader.onload = () => { formIconData.value = reader.result; formIconSvg.value = '' }
  reader.readAsDataURL(blob)
}

onMounted(() => loadTemplates())

watch([() => props.visible, activeToolType], ([v]) => {
  if (v) {
    loadTemplates()
  } else {
    managing.value = false
    dialogOpen.value = false
    selected.value = new Set()
    searchQuery.value = ''
  }
})
</script>

<style scoped>
.template-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.template-modal {
  width: 600px; max-height: 85vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: var(--shadow);
  display: flex; flex-direction: column;
  animation: fadeIn 0.15s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
.template-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border-color);
}
.template-title { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.title-icon { width: 18px; height: 18px; display: block; }
.header-actions { display: flex; align-items: center; gap: 6px; }
.hdr-btn {
  background: var(--bg-tertiary); border: 1px solid var(--border-color);
  color: var(--text-primary); padding: 4px 10px; border-radius: var(--border-radius);
  cursor: pointer; font-size: 11px; white-space: nowrap;
}
.hdr-btn:hover { background: var(--bg-hover); }
.hdr-btn.danger { color: var(--accent-danger); border-color: var(--accent-danger); }
.hdr-btn.danger:hover { background: rgba(248,81,73,0.1); }
.hdr-btn.primary { color: #fff; background: var(--accent-primary); border-color: var(--accent-primary); }
.hdr-btn.primary:hover { opacity: 0.9; }
.hdr-btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }
.template-close {
  background: none; border: none; color: var(--text-secondary);
  font-size: 18px; cursor: pointer; padding: 2px 6px; border-radius: 4px; margin-left: 4px;
}
.template-close:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Search */
.search-bar { padding: 8px 16px 0; }
.search-input {
  width: 100%; padding: 7px 12px; border: 1px solid var(--border-color);
  border-radius: var(--border-radius); background: var(--bg-primary);
  color: var(--text-primary); font-size: 13px; outline: none;
}
.search-input:focus { border-color: var(--accent-primary); }
.search-input::placeholder { color: var(--text-muted); }

/* Body grid */
.template-body { overflow-y: auto; padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.template-card {
  padding: 12px; border: 1px solid var(--border-color);
  border-radius: var(--border-radius); cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  display: flex; flex-direction: column; gap: 3px;
  min-height: 68px; position: relative;
}
.template-card:hover { background: var(--bg-hover); border-color: var(--accent-primary); }
.template-card.selected { border-color: var(--accent-primary); background: rgba(88,166,255,0.06); }
.card-top { display: flex; align-items: center; gap: 4px; }
.card-cb { margin: 0; cursor: pointer; }
.card-edit {
  margin-left: auto; background: none; border: none; color: var(--text-muted);
  cursor: pointer; font-size: 13px; padding: 0 4px; border-radius: 3px;
}
.card-edit:hover { background: var(--bg-hover); color: var(--text-primary); }
.template-category { font-size: 10px; color: var(--accent-primary); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; }
.cat-icon { width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 3px; }
.template-name { font-weight: 600; font-size: 13px; }
.template-snippet { font-family: var(--code-font); font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Empty state */
.empty-msg { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: var(--text-muted); gap: 6px; }
.empty-icon { width: 36px; height: 36px; opacity: 0.3; margin-bottom: 4px; }
.empty-hint { font-size: 12px; }

/* Sub-dialog */
.sub-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, 0.35);
  display: flex; align-items: center; justify-content: center;
}
.sub-dialog {
  width: 520px; max-height: 90vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.2);
  display: flex; flex-direction: column;
  animation: fadeIn 0.12s ease;
}
.sub-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--border-color);
}
.sub-title { font-weight: 700; font-size: 15px; }
.sub-body { overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.sub-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 20px; border-top: 1px solid var(--border-color);
}
.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
.field-input {
  padding: 7px 10px; border: 1px solid var(--border-color);
  border-radius: var(--border-radius); background: var(--bg-primary);
  color: var(--text-primary); font-size: 13px; outline: none;
}
.field-input:focus { border-color: var(--accent-primary); }
.field-input.muted { color: var(--text-muted); }
select.field-input { cursor: pointer; }
.field-textarea {
  padding: 10px; border: 1px solid var(--border-color);
  border-radius: var(--border-radius); background: var(--editor-bg);
  color: var(--text-primary); font-size: 13px; font-family: var(--code-font);
  outline: none; resize: vertical; min-height: 140px; line-height: 1.5;
}
.field-textarea:focus { border-color: var(--accent-primary); }

/* Icon */
.icon-preview-static { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); }
.preview-icon { width: 20px; height: 20px; display: block; }
.icon-custom { display: flex; flex-direction: column; gap: 6px; }
.icon-preview { display: flex; align-items: center; gap: 8px; }
.icon-remove { background: none; border: none; color: var(--accent-danger); cursor: pointer; font-size: 14px; }
.icon-upload { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.icon-file-input { display: none; }
.icon-or { font-size: 11px; color: var(--text-muted); }
.icon-code-input {
  flex: 1; min-width: 150px; padding: 5px 8px; border: 1px solid var(--border-color);
  border-radius: var(--border-radius); background: var(--bg-primary); color: var(--text-primary);
  font-size: 11px; font-family: var(--code-font); outline: none; resize: none;
}
.icon-code-input:focus { border-color: var(--accent-primary); }
</style>
