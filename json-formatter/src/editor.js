import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { formatJSON, compressJSON } from './json-utils.js'

/**
 * Create a JSON editor instance with CodeMirror 6.
 *
 * @param {HTMLElement} container - DOM element to mount the editor into.
 * @param {object}      [options] - Configuration options.
 * @param {string}      [options.content='']   - Initial JSON content.
 * @param {string}      [options.theme='light'] - Editor theme: 'light' or 'dark'.
 * @param {number}      [options.fontSize=14]  - Base font size in pixels.
 * @param {function}    [options.onChange]     - Called with the current document text on every change.
 * @returns {EditorView}
 */
export function createEditor(container, options = {}) {
  const { content = '', theme = 'light', fontSize = 14, onChange } = options

  const extensions = [
    basicSetup,
    json(),
    linter(jsonParseLinter()),
    lintGutter(),
    keymap.of([indentWithTab]),
    EditorView.lineWrapping,
    EditorView.updateListener.of(update => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString())
      }
    }),
  ]

  if (theme === 'dark') {
    extensions.push(oneDark)
  }

  // Font size and font-family via theme
  extensions.push(EditorView.theme({
    '&': { fontSize: `${fontSize}px`, height: '100%' },
    '.cm-editor': { height: '100%' },
    '.cm-scroller': { fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace', overflow: 'auto' },
    '.cm-content': { minHeight: '100%' },
  }))

  const state = EditorState.create({
    doc: content,
    extensions,
  })

  return new EditorView({
    state,
    parent: container,
  })
}

/**
 * Replace the entire editor content with a new string.
 *
 * @param {EditorView} view
 * @param {string}     content
 */
export function setEditorContent(view, content) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
  })
}

/**
 * Return the current editor content as a plain string.
 *
 * @param {EditorView} view
 * @returns {string}
 */
export function getEditorContent(view) {
  return view.state.doc.toString()
}

/**
 * Return whether a paste action may replace the whole editor document.
 *
 * Full-document replacement is only appropriate when the editor is empty
 * or when the user explicitly selected the whole document.
 *
 * @param {EditorView} view
 * @returns {boolean}
 */
export function shouldReplaceEditorContentOnPaste(view) {
  const content = getEditorContent(view)
  if (!content.trim()) return true

  const ranges = view.state.selection.ranges
  return ranges.length === 1 &&
    ranges[0].from === 0 &&
    ranges[0].to === view.state.doc.length
}

/**
 * Format (pretty-print) the current editor content.
 *
 * @param {EditorView} view
 * @param {number}     [indent=2] - Number of spaces per indent level.
 * @returns {{ success: true } | { success: false, error: string }}
 */
export function formatContent(view, indent = 2) {
  try {
    const formatted = formatJSON(getEditorContent(view), indent)
    setEditorContent(view, formatted)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

/**
 * Compress (minify) the current editor content by removing all
 * unnecessary whitespace.
 *
 * @param {EditorView} view
 * @returns {{ success: true } | { success: false, error: string }}
 */
export function compressContent(view) {
  try {
    const compressed = compressJSON(getEditorContent(view))
    setEditorContent(view, compressed)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
