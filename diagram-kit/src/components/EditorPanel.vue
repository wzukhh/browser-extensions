<template>
  <div class="editor-panel">
    <div class="editor-header">
      <span class="editor-title">编辑器</span>
      <span class="editor-cursor">{{ cursorPos }}</span>
    </div>
    <div class="editor-container" ref="editorRef"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, dropCursor, rectangularSelection, crosshairCursor, placeholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { mermaidLanguage } from '../utils/mermaidLang.js'

const emit = defineEmits(['contentChange'])
const props = defineProps({ content: { type: String, default: '' } })

const editorRef = ref(null)
const cursorPos = ref('1:1')
let view = null
let updateDebounce = null
let suppressNextEmit = false

watch(() => props.content, (newVal) => {
  if (view && view.state.doc.toString() !== newVal) {
    suppressNextEmit = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newVal }
    })
  }
})

function createEditor() {
  const state = EditorState.create({
    doc: props.content,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      foldGutter(),
      bracketMatching(),
      indentOnInput(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      placeholder('请输入内容，或从右上角「模板库」导入模板'),
      syntaxHighlighting(defaultHighlightStyle),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
      mermaidLanguage,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          if (suppressNextEmit) { suppressNextEmit = false; return }
          clearTimeout(updateDebounce)
          updateDebounce = setTimeout(() => {
            emit('contentChange', update.state.doc.toString())
          }, 500)
        }
        const pos = update.state.selection.main.head
        const line = update.state.doc.lineAt(pos)
        cursorPos.value = `${line.number}:${pos - line.from + 1}`
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { fontFamily: 'var(--code-font)', fontSize: '14px' },
        '.cm-editor': { height: '100%' },
        '.cm-gutters': { borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)' },
        '.cm-placeholder': { color: 'var(--text-muted)', fontStyle: 'normal' }
      })
    ]
  })
  view = new EditorView({ state, parent: editorRef.value })
}

onMounted(() => {
  createEditor()
})

onBeforeUnmount(() => {
  view?.destroy()
  clearTimeout(updateDebounce)
})
</script>

<style scoped>
.editor-panel { display: flex; flex-direction: column; height: 100%; background: var(--editor-bg); }
.editor-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 12px; border-bottom: 1px solid var(--border-color);
  background: var(--toolbar-bg); font-size: 12px; color: var(--text-secondary); height: 32px;
}
.editor-title { font-weight: 600; }
.editor-cursor { font-family: var(--code-font); font-size: 11px; }
.editor-container { flex: 1; overflow: auto; }
</style>
