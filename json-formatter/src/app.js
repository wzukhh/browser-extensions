import {
  createEditor,
  setEditorContent,
  getEditorContent,
  formatContent,
  compressContent,
  shouldReplaceEditorContentOnPaste,
} from './editor.js'
import {
  DEFAULT_BOTTOM_PANEL_EXPANDED,
  getBottomPanelPresentation,
  toggleBottomPanelExpanded,
} from './bottom-panel.js'
import { getNextTheme, normalizeTheme } from './theme.js'
import { validateJSON, escapeJSON, unescapeJSON, sortJSON, formatJSON } from './json-utils.js'
import { analyzeTreeRender } from './tree-guard.js'
import { highlightSyntax } from './syntax-highlight.js'
import { undo, redo } from '@codemirror/commands'

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────

/** @type {import('codemirror').EditorView | null} */
let editor = null
let currentJSON = null
let isWrapEnabled = false
let isBottomPanelExpanded = DEFAULT_BOTTOM_PANEL_EXPANDED
const toolResults = new Map()
let activeResultKey = null

const CONVERT_RESULT_LANGUAGES = {
  'to-yaml': 'yaml',
  'to-xml': 'xml',
  'to-toml': 'toml',
}

// ──────────────────────────────────────────────
// Module stubs — will be replaced by dynamic imports
// ──────────────────────────────────────────────

let renderTree = () => {}
let expandAll = () => {}
let collapseAll = () => {}
let convertJSON = () => ({ success: false, error: '格式转换模块不可用' })
let generateCode = () => '// 代码生成模块不可用'
let decodeJWT = () => ({ success: false, error: 'JWT 解码模块不可用' })
let encodeURL = () => ({ success: false, error: 'URL 编解码模块不可用' })
let decodeURL = () => ({ success: false, error: 'URL 编解码模块不可用' })
let encodeBase64 = () => ({ success: false, error: 'Base64 编解码模块不可用' })
let decodeBase64 = () => ({ success: false, error: 'Base64 编解码模块不可用' })

// ──────────────────────────────────────────────
// Default settings (fallback when settings.js absent)
// ──────────────────────────────────────────────

function getDefaultSettings() {
  return {
    indentSize: '2',
    theme: 'light',
    fontSize: '14',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  }
}

let loadSettings = async () => {
  const defaults = getDefaultSettings()
  const settings = {}
  for (const key of Object.keys(defaults)) {
    const val = localStorage.getItem(`jsonfmt_${key}`)
    settings[key] = val !== null ? val : defaults[key]
  }
  return settings
}

let saveSettings = async (s) => {
  for (const [key, val] of Object.entries(s)) {
    localStorage.setItem(`jsonfmt_${key}`, val)
  }
}

let getSetting = (key) => {
  const val = localStorage.getItem(`jsonfmt_${key}`)
  return val !== null ? val : getDefaultSettings()[key]
}

// ──────────────────────────────────────────────
// Dynamic module loader — catches missing modules
// ──────────────────────────────────────────────

async function loadDynamicModules() {
  try {
    const treeView = await import('./tree-view.js')
    renderTree = treeView.renderTree || renderTree
    expandAll = treeView.expandAll || expandAll
    collapseAll = treeView.collapseAll || collapseAll
  } catch (_) { /* tree-view.js not yet created (Task 5) */ }

  try {
    const settings = await import('./settings.js')
    loadSettings = settings.loadSettings || loadSettings
    saveSettings = settings.saveSettings || saveSettings
    getSetting = settings.getSetting || getSetting
  } catch (_) { /* settings.js not yet created (Task 9) */ }

  try {
    const converters = await import('./format-converters.js')
    convertJSON = converters.convertJSON || convertJSON
  } catch (_) { /* format-converters.js not yet created (Task 6) */ }

  try {
    const codegen = await import('./code-generators.js')
    generateCode = codegen.generateCode || generateCode
  } catch (_) { /* code-generators.js not yet created (Task 7) */ }

  try {
    const jwt = await import('./jwt-decoder.js')
    decodeJWT = jwt.decodeJWT || decodeJWT
  } catch (_) { /* jwt-decoder.js not yet created (Task 8) */ }

  try {
    const urlCodec = await import('./url-codec.js')
    encodeURL = urlCodec.encodeURL || encodeURL
    decodeURL = urlCodec.decodeURL || decodeURL
  } catch (_) { /* url-codec.js not yet created */ }

  try {
    const base64Codec = await import('./base64-codec.js')
    encodeBase64 = base64Codec.encodeBase64 || encodeBase64
    decodeBase64 = base64Codec.decodeBase64 || decodeBase64
  } catch (_) { /* base64-codec.js not yet created */ }
}

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────

async function init() {
  await loadDynamicModules()

  const settings = await loadSettings()
  const theme = normalizeTheme(settings.theme)
  applyTheme(theme)

  editor = createEditor(document.getElementById('editorContainer'), {
    content: '',
    theme,
    fontSize: parseInt(settings.fontSize || 14, 10),
    onChange: debounce(onEditorChange, 300),
  })

  applyEditorSettings(settings)
  bindToolbar()
  bindTabs()
  bindBottomPanel()
  bindSettings()
  bindKeyboardShortcuts()
  checkURLParams()
}

// ──────────────────────────────────────────────
// Editor change handler
// ──────────────────────────────────────────────

function onEditorChange(value) {
  const trimmed = value.trim()
  if (!trimmed) {
    document.getElementById('treeContainer').innerHTML =
      '<div class="tree-empty">输入有效 JSON 后自动显示树形结构</div>'
    currentJSON = null
    updateStatus('')
    return
  }

  const result = validateJSON(trimmed)
  if (result.valid) {
    try {
      currentJSON = JSON.parse(trimmed)
      renderTreeWithGuard(currentJSON, trimmed)
      updateStatus('✅ 有效 JSON')
    } catch (e) {
      updateStatus('❌ 解析错误')
    }
  } else {
    const line = result.position ? result.position.line : '?'
    const col = result.position ? result.position.col : '?'
    updateStatus(`❌ 第 ${line} 行第 ${col} 列: ${result.error}`)
  }
}

const STATUS_ICONS = {
  '✅': `<svg class="status-icon" viewBox="0 0 1050 1024" aria-hidden="true"><path d="M0.040958 673.137212l282.054116-187.237406 139.808572 253.609103S668.406616 229.915165 1021.583505 0.061436c0 0 2.355059 286.702798 28.424535 369.744216 0 0-338.944143 265.466312-599.659381 654.194348 0 0-49.783893-47.469792-450.307701-350.862788z" fill="#07C228"></path></svg>`,
  '❌': `<svg class="status-icon" viewBox="0 0 1024 1024" aria-hidden="true"><path d="M780.885333 200.618667l44.672 26.752c-101.162667 46.208-194.304 115.541333-279.424 207.957333 98.048 77.226667 203.093333 178.858667 315.221334 304.810667-61.098667 29.994667-110.464 66.389333-148.053334 109.184-62.336-134.528-138.794667-248.021333-229.376-340.48-73.642667 94.464-140.629333 207.957333-201.045333 340.48-32.896-39.168-70.314667-68.309333-112.213333-87.381334C254.933333 640 339.029333 536.533333 422.869333 451.584a955.221333 955.221333 0 0 0-226.133333-145.109333l40.874667-40.576c76.757333 20.181333 159.701333 61.738667 248.832 124.757333 98.432-88.874667 196.608-152.234667 294.442666-190.037333z" fill="#FF6D5E"></path></svg>`,
}

function updateStatus(msg) {
  const el = document.getElementById('statusBar')
  if (!el) return
  if (!msg) { el.textContent = ''; return }
  const match = msg.match(/^(✅|❌)\s*/)
  if (match) {
    el.innerHTML = STATUS_ICONS[match[1]]
    el.appendChild(document.createTextNode(msg.slice(match[0].length)))
  } else {
    el.textContent = msg
  }
}

function renderTreeWithGuard(data, sourceText) {
  const analysis = analyzeTreeRender(data, sourceText)
  if (analysis.shouldRender) {
    renderTree(data)
    return
  }
  showTreeRenderGuard(data, analysis)
}

function showTreeRenderGuard(data, analysis) {
  const container = document.getElementById('treeContainer')
  if (!container) return
  container.innerHTML = ''

  const wrapper = document.createElement('div')
  wrapper.className = 'tree-empty'
  const reason = analysis.reason === 'text-size'
    ? `文本大小 ${(analysis.textBytes / 1024).toFixed(1)} KB`
    : `节点数超过 ${analysis.nodeCount.toLocaleString()}`
  wrapper.textContent = `JSON 较大，已跳过自动树形渲染（${reason}）。`

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = '渲染树形视图'
  button.onclick = () => renderTree(data)

  wrapper.appendChild(document.createElement('br'))
  wrapper.appendChild(button)
  container.appendChild(wrapper)
}

// ──────────────────────────────────────────────
// Theme
// ──────────────────────────────────────────────

function applyTheme(theme) {
  theme = normalizeTheme(theme)
  document.documentElement.setAttribute('data-theme', theme)

  // Sync CodeMirror editor theme by recreating the editor
  if (editor) {
    import('./editor.js').then(mod => {
      const container = document.getElementById('editorContainer')
      const content = getEditorContent(editor)
      editor.destroy()
      editor = mod.createEditor(container, {
        content,
        theme,
        fontSize: parseInt(getSetting('fontSize') || 14, 10),
        onChange: debounce(onEditorChange, 300),
      })
      // Re-apply font settings on the new editor
      applyEditorSettings({
        fontSize: getSetting('fontSize'),
        fontFamily: getSetting('fontFamily'),
      })
    })
  }
}

// ──────────────────────────────────────────────
// Editor settings (font size / family)
// ──────────────────────────────────────────────

function applyEditorSettings(settings) {
  if (!editor) return
  editor.dom.style.fontSize = `${settings.fontSize || 14}px`
  if (settings.fontFamily) {
    editor.scrollDOM.style.fontFamily = settings.fontFamily
  }
}

// ──────────────────────────────────────────────
// Toolbar bindings
// ──────────────────────────────────────────────

function bindToolbar() {
  document.getElementById('btnFormat').onclick = () => {
    const indent = parseInt(getSetting('indentSize') || '2', 10)
    const result = formatContent(editor, indent)
    if (result.success) {
      updateStatus('✅ 格式化完成')
    } else {
      updateStatus(`❌ 格式化失败: ${result.error}`)
    }
  }

  document.getElementById('btnCompress').onclick = () => {
    const result = compressContent(editor)
    if (result.success) {
      updateStatus('✅ 压缩完成')
    } else {
      updateStatus(`❌ 压缩失败: ${result.error}`)
    }
  }

  document.getElementById('btnSort').onclick = () => {
    try {
      const content = getEditorContent(editor)
      const sorted = sortJSON(content)
      setEditorContent(editor, sorted)
      updateStatus('✅ 排序完成')
    } catch (e) {
      updateStatus(`❌ 排序失败: ${e.message}`)
    }
  }

  document.getElementById('btnEscape').onclick = () => {
    try {
      const content = getEditorContent(editor)
      const escaped = escapeJSON(content)
      setEditorContent(editor, escaped)
      updateStatus('✅ 转义完成')
    } catch (e) {
      updateStatus(`❌ 转义失败: ${e.message}`)
    }
  }

  document.getElementById('btnUnescape').onclick = () => {
    try {
      const content = getEditorContent(editor).trim()
      const unescaped = unescapeJSON(content)
      setEditorContent(editor, unescaped)
      updateStatus('✅ 去转义完成')
    } catch (e2) {
      updateStatus(`❌ 去转义失败: ${e2.message}`)
    }
  }

  document.getElementById('btnUndo').onclick = () => {
    undo(editor)
  }

  document.getElementById('btnRedo').onclick = () => {
    redo(editor)
  }

  document.getElementById('btnWrap').onclick = () => {
    isWrapEnabled = !isWrapEnabled
    document.getElementById('editorContainer').classList.toggle('wrap-enabled', isWrapEnabled)
    document.getElementById('btnWrap').classList.toggle('active', isWrapEnabled)
  }

  document.getElementById('btnTheme').onclick = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
    const newTheme = getNextTheme(currentTheme)
    applyTheme(newTheme)
    // Also persist the toggle in local settings
    const currentSettings = {
      indentSize: getSetting('indentSize'),
      theme: newTheme,
      fontSize: getSetting('fontSize'),
      fontFamily: getSetting('fontFamily'),
    }
    saveSettings(currentSettings)
    applyEditorSettings(currentSettings)
  }

  document.getElementById('btnExpandAll').onclick = () => {
    expandAll()
  }

  document.getElementById('btnCollapseAll').onclick = () => {
    collapseAll()
  }
}

// ──────────────────────────────────────────────
// Tab bindings
// ──────────────────────────────────────────────

function bindTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach(c => (c.hidden = true))
      tab.classList.add('active')

      const tabName = tab.dataset.tab
      const contentId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)
      const contentEl = document.getElementById(contentId)
      if (contentEl) contentEl.hidden = false
    }
  })
}

// ──────────────────────────────────────────────
// Tool result preview / modal
// ──────────────────────────────────────────────

function showToolResult(key, title, content, options = {}) {
  const text = String(content ?? '')
  const language = options.language || 'plain'
  toolResults.set(key, { title, content: text, language })

  const panel = document.querySelector(`[data-result-panel="${key}"]`)
  const titleEl = document.querySelector(`[data-result-title="${key}"]`)
  const previewEl = document.querySelector(`[data-result-preview="${key}"]`)

  if (panel) panel.hidden = false
  if (titleEl) titleEl.textContent = title
  if (previewEl) previewEl.textContent = text
}

function getToolResult(key) {
  return key ? toolResults.get(key) : null
}

async function copyToolResult(key) {
  const result = getToolResult(key)
  if (!result || !result.content) {
    updateStatus('❌ 暂无结果可复制')
    return
  }

  try {
    await writeClipboardText(result.content)
    updateStatus('✅ 结果已复制到剪贴板')
  } catch {
    updateStatus('❌ 复制失败')
  }
}

function openToolResult(key) {
  const result = getToolResult(key)
  if (!result) {
    updateStatus('❌ 暂无结果可查看')
    return
  }

  activeResultKey = key
  document.getElementById('toolResultModalTitle').textContent = result.title
  document.getElementById('toolResultModalBody').innerHTML = highlightSyntax(result.content, result.language)
  document.getElementById('toolResultModal').hidden = false
}

function closeToolResultModal() {
  const modal = document.getElementById('toolResultModal')
  if (modal) modal.hidden = true
  activeResultKey = null
}

async function writeClipboardText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) throw new Error('copy failed')
}

function bindToolResultActions() {
  document.querySelectorAll('[data-result-copy]').forEach(btn => {
    btn.onclick = () => copyToolResult(btn.dataset.resultCopy)
  })
  document.querySelectorAll('[data-result-open]').forEach(btn => {
    btn.onclick = () => openToolResult(btn.dataset.resultOpen)
  })

  document.getElementById('btnCloseResultModal').onclick = closeToolResultModal
  document.getElementById('btnCopyResultModal').onclick = () => copyToolResult(activeResultKey)
  document.getElementById('toolResultModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeToolResultModal()
  })
}

// ──────────────────────────────────────────────
// Bottom panel bindings
// ──────────────────────────────────────────────

function bindBottomPanel() {
  const bottomPanel = document.getElementById('bottomPanel')
  const bottomPanelBody = document.getElementById('bottomPanelBody')
  const toggleButton = document.getElementById('btnToggleBottomPanel')

  function applyBottomPanelState() {
    const presentation = getBottomPanelPresentation(isBottomPanelExpanded)
    bottomPanel.classList.toggle('is-collapsed', presentation.isCollapsed)
    bottomPanel.classList.toggle('is-expanded', !presentation.isCollapsed)
    bottomPanelBody.hidden = presentation.bodyHidden
    toggleButton.textContent = presentation.buttonText
    toggleButton.title = presentation.buttonTitle
    toggleButton.setAttribute('aria-expanded', presentation.ariaExpanded)
  }

  applyBottomPanelState()

  toggleButton.onclick = () => {
    isBottomPanelExpanded = toggleBottomPanelExpanded(isBottomPanelExpanded)
    applyBottomPanelState()
  }

  // File open
  document.getElementById('btnOpenFile').onclick = () => {
    document.getElementById('fileInput').click()
  }
  document.getElementById('fileInput').onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target.result
      setEditorContent(editor, content)
      updateStatus(`✅ 已加载: ${file.name}`)
    }
    reader.readAsText(file)
    // Reset so the same file can be re-opened
    e.target.value = ''
  }

  // URL import
  document.getElementById('btnImportURL').onclick = async () => {
    const url = prompt('请输入 JSON 文件的 URL:')
    if (!url) return
    updateStatus('⏳ 正在加载...')
    await importFromURL(url)
  }

  // Download
  document.getElementById('btnDownload').onclick = () => {
    const content = getEditorContent(editor)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'formatted.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Copy
  document.getElementById('btnCopy').onclick = () => {
    navigator.clipboard.writeText(getEditorContent(editor)).then(() => {
      updateStatus('✅ 已复制到剪贴板')
    }).catch(() => {
      updateStatus('❌ 复制失败')
    })
  }

  // Format conversion buttons
  document.querySelectorAll('.convert-btn').forEach(btn => {
    btn.onclick = () => {
      const result = convertJSON(getEditorContent(editor), btn.dataset.action)
      if (result && result.success) {
        const label = btn.textContent.trim().replace(/^→\s*/, '')
        showToolResult('convert', `${label} 转换结果`, result.content, {
          language: CONVERT_RESULT_LANGUAGES[btn.dataset.action] || 'plain',
        })
        updateStatus('✅ 转换完成，编辑器内容已保留')
      } else {
        updateStatus(`❌ 转换失败: ${(result && result.error) || '模块不可用'}`)
      }
    }
  })

  // Code generation buttons
  document.querySelectorAll('.codegen-btn').forEach(btn => {
    btn.onclick = () => {
      const code = generateCode(getEditorContent(editor), btn.dataset.lang)
      if (code) {
        showToolResult('codegen', `${btn.textContent.trim()} 代码生成结果`, code, {
          language: btn.dataset.lang,
        })
        updateStatus(`✅ ${btn.textContent} 代码已生成，编辑器内容已保留`)
      } else {
        updateStatus('❌ 代码生成失败: 模块不可用')
      }
    }
  })

  // JWT decode
  document.getElementById('btnDecodeJWT').onclick = () => {
    const token = document.getElementById('jwtInput').value.trim()
    if (!token) {
      showToolResult('jwt', 'JWT 解码结果', '请先粘贴 JWT token')
      return
    }
    const result = decodeJWT(token)
    if (result && result.success) {
      showToolResult('jwt', 'JWT 解码结果', result.pretty || JSON.stringify(result.data, null, 2), {
        language: 'json',
      })
    } else {
      showToolResult('jwt', 'JWT 解码结果', `错误: ${(result && result.error) || '模块不可用'}`)
    }
  }

  // URL encode / decode
  document.getElementById('btnEncodeURL').onclick = () => {
    const text = document.getElementById('urlInput').value.trim()
    if (!text) {
      showToolResult('url', 'URL 处理结果', '请先输入要编码的文本')
      return
    }
    const result = encodeURL(text)
    if (result && result.success) {
      showToolResult('url', 'URL 编码结果', result.content)
    } else {
      showToolResult('url', 'URL 处理结果', `错误: ${(result && result.error) || '模块不可用'}`)
    }
  }

  document.getElementById('btnDecodeURL').onclick = () => {
    const text = document.getElementById('urlInput').value.trim()
    if (!text) {
      showToolResult('url', 'URL 处理结果', '请先输入要解码的文本')
      return
    }
    const result = decodeURL(text)
    if (result && result.success) {
      showToolResult('url', 'URL 解码结果', result.content)
    } else {
      showToolResult('url', 'URL 处理结果', `错误: ${(result && result.error) || '模块不可用'}`)
    }
  }

  // Base64 encode / decode
  document.getElementById('btnEncodeBase64').onclick = () => {
    const text = document.getElementById('base64Input').value.trim()
    if (!text) {
      showToolResult('base64', 'Base64 处理结果', '请先输入要编码的文本')
      return
    }
    const result = encodeBase64(text)
    if (result && result.success) {
      showToolResult('base64', 'Base64 编码结果', result.content)
    } else {
      showToolResult('base64', 'Base64 处理结果', `错误: ${(result && result.error) || '模块不可用'}`)
    }
  }

  document.getElementById('btnDecodeBase64').onclick = () => {
    const text = document.getElementById('base64Input').value.trim()
    if (!text) {
      showToolResult('base64', 'Base64 处理结果', '请先输入要解码的文本')
      return
    }
    const result = decodeBase64(text)
    if (result && result.success) {
      showToolResult('base64', 'Base64 解码结果', result.content)
    } else {
      showToolResult('base64', 'Base64 处理结果', `错误: ${(result && result.error) || '模块不可用'}`)
    }
  }

  bindToolResultActions()
}

// ──────────────────────────────────────────────
// Settings modal
// ──────────────────────────────────────────────

function bindSettings() {
  const modal = document.getElementById('settingsModal')

  // Open
  document.getElementById('btnSettings').onclick = async () => {
    const settings = await loadSettings()
    document.getElementById('settingIndent').value = settings.indentSize || '2'
    document.getElementById('settingFontSize').value = settings.fontSize || '14'
    document.getElementById('settingFontFamily').value = settings.fontFamily || "'SF Mono', 'Fira Code', monospace"
    modal.hidden = false
  }

  // Close (cancel)
  document.getElementById('btnCloseSettings').onclick = () => {
    modal.hidden = true
  }

  // Click outside modal to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true
  })

  // Save
  document.getElementById('btnSaveSettings').onclick = async () => {
    const newSettings = {
      indentSize: document.getElementById('settingIndent').value,
      theme: normalizeTheme(getSetting('theme')),
      fontSize: document.getElementById('settingFontSize').value,
      fontFamily: document.getElementById('settingFontFamily').value,
    }

    await saveSettings(newSettings)
    applyEditorSettings(newSettings)

    modal.hidden = true
    updateStatus('✅ 设置已保存')
  }
}

// ──────────────────────────────────────────────
// Keyboard shortcuts
// ──────────────────────────────────────────────

function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+F / Cmd+Shift+F → Format
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault()
      document.getElementById('btnFormat').click()
    }
  })
}

// ──────────────────────────────────────────────
// URL / hash import
// ──────────────────────────────────────────────

async function importFromURL(url) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const text = await resp.text()
    setEditorContent(editor, text)
  } catch (e) {
    updateStatus(`❌ 导入失败: ${e.message}`)
  }
}

// 页面加载时检测 URL hash 中的 data 或 url 参数
function checkURLParams() {
  const hash = location.hash
  if (hash.startsWith('#format?data=')) {
    const data = decodeURIComponent(hash.slice('#format?data='.length))
    if (data) {
      try {
        const formatted = formatJSON(data)
        setEditorContent(editor, formatted)
        updateStatus('✅ URL 数据已加载')
      } catch (e) {
        setEditorContent(editor, data)
        updateStatus('❌ URL 数据不是有效的 JSON')
      }
    }
    // 清除 hash，避免刷新时重复解析
    history.replaceState(null, '', 'app.html')
  }
  if (hash.startsWith('#url=')) {
    const url = decodeURIComponent(hash.slice('#url='.length))
    importFromURL(url)
  }
}

// ──────────────────────────────────────────────
// Paste detection
// ──────────────────────────────────────────────

function isPasteInEditor(e) {
  const editorContainer = document.getElementById('editorContainer')
  return Boolean(
    editorContainer &&
    e.target instanceof Node &&
    editorContainer.contains(e.target),
  )
}

document.addEventListener('paste', (e) => {
  if (!editor || !isPasteInEditor(e)) return

  // Read clipboard data directly to avoid race condition with CodeMirror's paste handling
  const clipboardData = e.clipboardData || window.clipboardData
  if (!clipboardData) return

  const pastedText = clipboardData.getData('text')
  if (!pastedText) return

  if (!shouldReplaceEditorContentOnPaste(editor)) return

  const trimmed = pastedText.trim()
  const result = validateJSON(trimmed)
  if (result.valid) {
    e.preventDefault()
    const indent = parseInt(getSetting('indentSize'), 10)
    const formatted = formatJSON(trimmed, indent)
    setEditorContent(editor, formatted)
    updateStatus('✅ 格式化完成')
  }
})

// ──────────────────────────────────────────────
// Drag-drop
// ──────────────────────────────────────────────

const editorContainer = document.getElementById('editorContainer')
editorContainer.addEventListener('dragover', (e) => {
  e.preventDefault()
  e.currentTarget.style.outline = '2px dashed var(--accent)'
})
editorContainer.addEventListener('dragleave', (e) => {
  e.currentTarget.style.outline = ''
})
editorContainer.addEventListener('drop', (e) => {
  e.preventDefault()
  e.currentTarget.style.outline = ''
  const file = e.dataTransfer.files[0]
  if (file) {
    if (!file.name.endsWith('.json')) {
      updateStatus('❌ 仅支持 .json 文件')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target.result
      setEditorContent(editor, content)
    }
    reader.readAsText(file)
  }
})

// ──────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// ──────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init)
